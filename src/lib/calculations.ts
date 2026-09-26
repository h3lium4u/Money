/**
 * Core Authoritative Financial Calculation Engine for Dubai-India Remittance.
 * All financial logic MUST be executed server-side. The frontend is never authoritative.
 */

export interface TransactionInputs {
  inrAmount: number;
  customerRate: number; // e.g. 38.25 (AED per 1000 INR)
  baseRate: number; // e.g. 26.82 (INR per AED) or 37.25 (AED per 1000 INR)
  deliveryChargePct?: number; // default 0.20 (20%)
}

export interface TransactionCalculationResult {
  inrAmount: number;
  customerRate: number;
  customerRateInrPerAed: number;
  aedAmount: number; // AED charged to customer
  baseRate: number;
  baseRateAedPer1000: number;
  baseRateInrPerAed: number;
  costAed: number; // Base cost to the business in AED
  grossProfitAed: number; // Gross margin before delivery charges
  deliveryChargePct: number;
  deliveryChargeAed: number; // Partner cut / delivery charge
  netProfitAed: number; // Net retained profit in AED
  marginPct: number; // Profit margin percentage on AED collected
}

/**
 * Rounds a number to a specified number of decimal places.
 */
export function roundTo(val: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

/**
 * Normalizes rates between the two market quotation conventions:
 * 1. AED per 1,000 INR (e.g. 38.25 AED)
 * 2. INR per 1 AED (e.g. 26.14 INR)
 */
export function ratePer1000ToInrPerAed(ratePer1000: number): number {
  if (ratePer1000 <= 0) return 0;
  return roundTo(1000 / ratePer1000, 4);
}

export function inrPerAedToRatePer1000(inrPerAed: number): number {
  if (inrPerAed <= 0) return 0;
  return roundTo(1000 / inrPerAed, 4);
}

/**
 * Authoritative transaction calculations
 */
export function calculateTransaction(inputs: TransactionInputs): TransactionCalculationResult {
  const inr = Number(inputs.inrAmount);
  const custRate = Number(inputs.customerRate);
  let baseRate = Number(inputs.baseRate);
  const deliveryPct = inputs.deliveryChargePct !== undefined ? Number(inputs.deliveryChargePct) : 0.20;

  if (inr <= 0) throw new Error("INR amount must be greater than zero");
  if (custRate <= 0) throw new Error("Customer rate must be greater than zero");
  if (baseRate <= 0) throw new Error("Base rate must be greater than zero");

  // Customer rate is in AED per 1000 INR (e.g. 38.25)
  // If user entered it as INR per AED (e.g. ~26), normalize it:
  let customerRatePer1000 = custRate;
  let customerRateInrPerAed = ratePer1000ToInrPerAed(custRate);

  if (custRate < 30) {
    // Entered in INR per AED
    customerRateInrPerAed = custRate;
    customerRatePer1000 = inrPerAedToRatePer1000(custRate);
  }

  // 1. AED Charged to Customer = (INR / 1000) * Customer_Rate_Per_1000
  const rawAedAmount = (inr / 1000) * customerRatePer1000;
  const aedAmount = roundTo(rawAedAmount, 2);

  // 2. Base Cost AED
  // In the Excel, Base Rate (CV) is either in INR/AED (~26.82) or entered as =1000/38.30
  let baseRateInrPerAed = baseRate;
  let baseRatePer1000 = inrPerAedToRatePer1000(baseRate);

  if (baseRate >= 30) {
    // Entered in AED per 1000 INR
    baseRatePer1000 = baseRate;
    baseRateInrPerAed = ratePer1000ToInrPerAed(baseRate);
  }

  // Cost = INR / baseRateInrPerAed == (INR / 1000) * baseRatePer1000
  const rawCostAed = inr / baseRateInrPerAed;
  const costAed = roundTo(rawCostAed, 2);

  // 3. Gross Profit AED = AED Charged - Cost AED
  const rawGrossProfit = rawAedAmount - rawCostAed;
  const grossProfitAed = roundTo(rawGrossProfit, 2);

  // 4. Delivery Charge AED = Gross Profit * Delivery Charge %
  const rawDeliveryCharge = rawGrossProfit * deliveryPct;
  const deliveryChargeAed = roundTo(rawDeliveryCharge, 2);

  // 5. Net Profit AED = Gross Profit - Delivery Charge
  const rawNetProfit = rawGrossProfit - rawDeliveryCharge;
  const netProfitAed = roundTo(rawNetProfit, 2);

  const marginPct = aedAmount > 0 ? roundTo((netProfitAed / aedAmount) * 100, 2) : 0;

  return {
    inrAmount: roundTo(inr, 2),
    customerRate: roundTo(customerRatePer1000, 4),
    customerRateInrPerAed: roundTo(customerRateInrPerAed, 4),
    aedAmount,
    baseRate: roundTo(baseRate, 4),
    baseRateAedPer1000: roundTo(baseRatePer1000, 4),
    baseRateInrPerAed: roundTo(baseRateInrPerAed, 4),
    costAed,
    grossProfitAed,
    deliveryChargePct: roundTo(deliveryPct, 4),
    deliveryChargeAed,
    netProfitAed,
    marginPct,
  };
}

/**
 * Bank Distrip Running Balance:
 * Current Balance = Previous Balance + Order (INR) + Commission (INR) - Paid (INR)
 */
export function calculateBankDistripBalance(
  previousBalance: number,
  orderInr: number,
  commissionInr: number,
  paidInr: number
): number {
  return roundTo(previousBalance + orderInr + commissionInr - paidInr, 2);
}

/**
 * Wholesale Liquidity Partner Settlement:
 * In Dirhams = INR / Wholesale Rate (in INR/AED)
 * Balance To Be Paid = In Dirhams - Paid Amount (AED)
 * Daily Balance = Previous Daily Balance + Balance To Be Paid
 */
export function calculateWholesaleSettlement(
  inrAmount: number,
  wholesaleRate: number,
  paidAed: number,
  prevDailyBalanceAed: number
): {
  inDirhams: number;
  balanceToBePaidAed: number;
  dailyBalanceAed: number;
} {
  const inDirhams = roundTo(inrAmount / wholesaleRate, 2);
  const balanceToBePaidAed = roundTo(inDirhams - paidAed, 2);
  const dailyBalanceAed = roundTo(prevDailyBalanceAed + balanceToBePaidAed, 2);

  return {
    inDirhams,
    balanceToBePaidAed,
    dailyBalanceAed,
  };
}

/**
 * Customer Ledger Running Balance:
 * Current Balance = Previous Balance + AED Charged - AED Received
 */
export function calculateCustomerRunningBalance(
  previousBalance: number,
  aedCharged: number,
  aedReceived: number
): number {
  return roundTo(previousBalance + aedCharged - aedReceived, 2);
}
