/**
 * INDEPENDENT FINANCIAL CALCULATION ORACLE
 * Built specifically for autonomous QA verification without referencing or calling application internals.
 * Implements deterministic IEEE 754 half-up 3-decimal financial mathematics.
 */

export function round3(val) {
  const n = Number(val);
  if (isNaN(n)) return 0;
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

export function oracleCalculateRemittance(inrAmount, customerRate, baseRate, deliveryCutPct = 0.20) {
  const inr = Number(inrAmount);
  const cRate = Number(customerRate);
  const bRate = Number(baseRate);

  if (inr <= 0) throw new Error("INR amount must be greater than zero");
  if (cRate <= 0) throw new Error("Customer rate must be greater than zero");
  if (bRate <= 0) throw new Error("Base rate must be greater than zero");

  // Customer AED charged
  const aedCharged = cRate >= 30 ? (inr * cRate) / 1000 : inr / cRate;
  
  // Wholesale cost AED
  const costAed = bRate >= 30 ? (inr * bRate) / 1000 : inr / bRate;

  // Margins
  const grossProfitAed = aedCharged - costAed;
  const deliveryChargeAed = grossProfitAed * deliveryCutPct;
  const netProfitAed = grossProfitAed - deliveryChargeAed;

  return {
    inrAmount: round3(inr),
    customerRate: round3(cRate),
    baseRate: round3(bRate),
    aedCharged: round3(aedCharged),
    costAed: round3(costAed),
    grossProfitAed: round3(grossProfitAed),
    deliveryChargeAed: round3(deliveryChargeAed),
    netProfitAed: round3(netProfitAed),
  };
}

export function oracleCalculateDubaiClient(totalInr, manualRate, paidAed = 0) {
  const total = Number(totalInr);
  const rate = Number(manualRate);
  const paid = Number(paidAed);

  const wholesaleRate = round3(1000 / rate);
  const inDhirams = round3((total * rate) / 1000);
  const balanceToPaid = round3(inDhirams - paid);

  return {
    total: round3(total),
    manualRate: round3(rate),
    wholesaleRate,
    inDhirams,
    paidAmount: round3(paid),
    balanceToPaid,
  };
}

export function oracleBankDistripBalance(prevBal, orderInr, commissionInr, paidInr) {
  return round3(Number(prevBal) + Number(orderInr) + Number(commissionInr) - Number(paidInr));
}

export function oracleCustomerRunningBalance(prevBal, aedCharged, aedReceived) {
  return round3(Number(prevBal) + Number(aedCharged) - Number(aedReceived));
}
