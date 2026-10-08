/**
 * Core Authoritative Financial Calculation Engine for Dubai-India Remittance.
 * All financial logic MUST be executed server-side. The frontend is never authoritative.
 */

export interface TransactionInputs {
  inrAmount: number;
  customerRate: number; // e.g. 38.25 (AED per 1000 INR)
  baseRate: number; // e.g. 26.82 (INR per AED) or 37.25 (AED per 1000 INR)
  deliveryChargePct?: number; // default 0.20 (20%)
  deliveryChargeAed?: number; // fixed delivery charge in AED
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

export interface DubaiClientInputs {
  total: number;
  manualRate: number;
  paidAmount?: number;
}

export interface DubaiClientCalculationResult {
  total: number;
  manualRate: number;
  wholesaleRate: number;
  inDhirams: number;
  paidAmount: number;
  balanceToPaid: number;
}

/**
 * Authoritative Dubai Client transfer calculation:
 * Wholesale rate = 1000 / manual value
 * In Dhirams = Total / Wholesale rate
 * Balance to paid = In Dhirams - Paid amount
 */
export function calculateDubaiClientTransfer(inputs: DubaiClientInputs): DubaiClientCalculationResult {
  const total = Number(inputs.total);
  const manualRate = Number(inputs.manualRate);
  const paidAmount = Number(inputs.paidAmount || 0);

  if (total <= 0) throw new Error("Total amount must be greater than zero");
  if (manualRate <= 0) throw new Error("Manual rate value must be greater than zero");
  if (paidAmount < 0) throw new Error("Paid amount cannot be negative");

  // Wholesale rate = 1000 / manual rate (3 decimal points)
  const wholesaleRate = roundTo(1000 / manualRate, 3);
  // Exact In Dhirams formula avoids floating division rounding drift (prevents 60,000 drifting to 59,998)
  const inDhirams = roundTo((total * manualRate) / 1000, 3);
  const balanceToPaid = roundTo(inDhirams - paidAmount, 3);

  return {
    total: roundTo(total, 3),
    manualRate: roundTo(manualRate, 3),
    wholesaleRate,
    inDhirams,
    paidAmount: roundTo(paidAmount, 3),
    balanceToPaid,
  };
}

/**
 * Rounds a number to a specified number of decimal places (default 3 decimals).
 */
export function roundTo(val: number, decimals: number = 3): number {
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
  return roundTo(1000 / ratePer1000, 3);
}

export function inrPerAedToRatePer1000(inrPerAed: number): number {
  if (inrPerAed <= 0) return 0;
  return roundTo(1000 / inrPerAed, 3);
}

/**
 * Authoritative transaction calculations with 3 decimal precision
 */
export function calculateTransaction(inputs: TransactionInputs): TransactionCalculationResult {
  const inr = Number(inputs.inrAmount);
  const custRate = Number(inputs.customerRate);
  let baseRate = Number(inputs.baseRate);

  if (inr <= 0) throw new Error("INR amount must be greater than zero");
  if (custRate <= 0) throw new Error("Customer rate must be greater than zero");
  if (baseRate <= 0) throw new Error("Base rate must be greater than zero");

  // Determine Customer Rate convention & exact AED amount charged
  // Rate >= 30: AED per 1000 INR (e.g. 38.25 AED for 1,000 INR) -> AED = (INR * Rate) / 1000
  // Rate < 30: INR per 1 AED (e.g. 26.144 INR for 1 AED) -> AED = INR / Rate
  const rawAedAmount = custRate >= 30 ? (inr * custRate) / 1000 : inr / custRate;
  const aedAmount = roundTo(rawAedAmount, 3);

  const customerRatePer1000 = custRate >= 30 ? custRate : inrPerAedToRatePer1000(custRate);
  const customerRateInrPerAed = custRate < 30 ? custRate : ratePer1000ToInrPerAed(custRate);

  // Determine Base Rate convention & exact Wholesale Cost AED
  // Rate >= 30: AED per 1000 INR (e.g. 38.25 AED for 1,000 INR) -> Cost AED = (INR * Rate) / 1000
  // Rate < 30: INR per 1 AED (e.g. 26.82 INR for 1 AED) -> Cost AED = INR / Rate
  const rawCostAed = baseRate >= 30 ? (inr * baseRate) / 1000 : inr / baseRate;
  const costAed = roundTo(rawCostAed, 3);

  const baseRatePer1000 = baseRate >= 30 ? baseRate : inrPerAedToRatePer1000(baseRate);
  const baseRateInrPerAed = baseRate < 30 ? baseRate : ratePer1000ToInrPerAed(baseRate);

  // Gross Profit AED = AED Charged - Cost AED
  const rawGrossProfit = rawAedAmount - rawCostAed;
  const grossProfitAed = roundTo(rawGrossProfit, 3);

  // Delivery Charge Calculation:
  // If deliveryChargeAed is explicitly supplied (and >= 0), use that fixed AED amount directly without reducing it!
  // Otherwise if deliveryChargePct is provided, calculate as rawGrossProfit * deliveryPct.
  let deliveryChargeAed: number;
  let deliveryPct = inputs.deliveryChargePct !== undefined ? Number(inputs.deliveryChargePct) : 0;

  if (inputs.deliveryChargeAed !== undefined && !isNaN(Number(inputs.deliveryChargeAed))) {
    deliveryChargeAed = roundTo(Number(inputs.deliveryChargeAed), 3);
    if (grossProfitAed > 0) {
      deliveryPct = roundTo(deliveryChargeAed / grossProfitAed, 3);
    }
  } else if (inputs.deliveryChargePct !== undefined) {
    const rawDeliveryCharge = rawGrossProfit * deliveryPct;
    deliveryChargeAed = roundTo(rawDeliveryCharge, 3);
  } else {
    deliveryChargeAed = 0;
  }

  // Net Profit AED = Gross Profit - Delivery Charge
  const rawNetProfit = rawGrossProfit - deliveryChargeAed;
  const netProfitAed = roundTo(rawNetProfit, 3);

  const marginPct = aedAmount > 0 ? roundTo((netProfitAed / aedAmount) * 100, 3) : 0;

  return {
    inrAmount: roundTo(inr, 3),
    customerRate: roundTo(customerRatePer1000, 3),
    customerRateInrPerAed: roundTo(customerRateInrPerAed, 3),
    aedAmount,
    baseRate: roundTo(baseRate, 3),
    baseRateAedPer1000: roundTo(baseRatePer1000, 3),
    baseRateInrPerAed: roundTo(baseRateInrPerAed, 3),
    costAed,
    grossProfitAed,
    deliveryChargePct: roundTo(deliveryPct, 3),
    deliveryChargeAed,
    netProfitAed,
    marginPct,
  };
}

/**
 * Bank Distrip Running Balance (3 decimal precision):
 * Current Balance = Previous Balance + Order (INR) + Commission (INR) - Paid (INR)
 */
export function calculateBankDistripBalance(
  previousBalance: number,
  orderInr: number,
  commissionInr: number,
  paidInr: number
): number {
  return roundTo(previousBalance + orderInr + commissionInr - paidInr, 3);
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
  const inDirhams = roundTo(inrAmount / wholesaleRate, 3);
  const balanceToBePaidAed = roundTo(inDirhams - paidAed, 3);
  const dailyBalanceAed = roundTo(prevDailyBalanceAed + balanceToBePaidAed, 3);

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
  return roundTo(previousBalance + aedCharged - aedReceived, 3);
}
