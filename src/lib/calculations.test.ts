import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateTransaction,
  calculateBankDistripBalance,
  calculateWholesaleSettlement,
  calculateCustomerRunningBalance,
  ratePer1000ToInrPerAed,
  inrPerAedToRatePer1000,
} from "./calculations.ts";

test("Rate Conversions between conventions", () => {
  // 38.25 AED per 1000 INR -> 1000 / 38.25 = 26.1438 INR/AED
  const inrPerAed = ratePer1000ToInrPerAed(38.25);
  assert.equal(inrPerAed, 26.1438);

  // 26.82 INR/AED -> 1000 / 26.82 = 37.2856 AED per 1000 INR
  const ratePer1000 = inrPerAedToRatePer1000(26.82);
  assert.equal(ratePer1000, 37.2856);
});

test("Workbook Row 4 (2026-05-03): Customer DIVAN calculation", () => {
  // Order: 69,600 INR, Customer Rate: 38.25 AED/1000, Base Rate: 25.61 INR/AED, Delivery: 20%
  const result = calculateTransaction({
    inrAmount: 69600,
    customerRate: 38.25,
    baseRate: 25.61,
    deliveryChargePct: 0.20,
  });

  // Excel BR4 = (69600 / 1000) * 38.25 = 2662.20 AED
  assert.equal(result.aedAmount, 2662.20);
  // Cost = 69600 / 25.61 = 2717.69 AED
  assert.equal(result.costAed, 2717.69);
  // Profit = 2662.20 - 2717.69 = -55.49 AED
  assert.equal(result.grossProfitAed, -55.49);
  // Delivery Charge = -55.49 * 0.2 = -11.10 AED
  assert.equal(result.deliveryChargeAed, -11.10);
  // Net = -55.49 - (-11.10) = -44.39 AED
  assert.equal(result.netProfitAed, -44.39);
});

test("Workbook Row 8 (2026-05-07): Customer RAKSAN calculation", () => {
  // Order: 347,000 INR, Customer Rate: 38.42, Base Rate: 26.10966, Delivery: 20%
  const result = calculateTransaction({
    inrAmount: 347000,
    customerRate: 38.42,
    baseRate: 26.10966,
    deliveryChargePct: 0.20,
  });

  // AED = (347000 / 1000) * 38.42 = 13331.74 AED
  assert.equal(result.aedAmount, 13331.74);
  // Cost = 347000 / 26.10966 = 13290.10 AED
  assert.equal(result.costAed, 13290.10);
  // Gross Profit = 13331.74 - 13290.10 = 41.64 AED
  assert.equal(result.grossProfitAed, 41.64);
  // Delivery Charge = 41.64 * 0.20 = 8.33 AED
  assert.equal(result.deliveryChargeAed, 8.33);
  // Net Profit = 41.64 - 8.33 = 33.31 AED
  assert.equal(result.netProfitAed, 33.31);
});

test("Workbook Row 24 (2026-05-23): Customer DIVAN calculation", () => {
  // Order: 503,300.20 INR, Customer Rate: 37.30, Base Rate: 26.82, Delivery: 20%
  const result = calculateTransaction({
    inrAmount: 503300.20,
    customerRate: 37.30,
    baseRate: 26.82,
    deliveryChargePct: 0.20,
  });

  // AED = (503300.20 / 1000) * 37.30 = 18773.10 AED
  assert.equal(result.aedAmount, 18773.10);
  // Cost = 503300.20 / 26.82 = 18765.85 AED
  assert.equal(result.costAed, 18765.85);
  // Gross Profit = 18773.10 - 18765.85 = 7.24 AED
  assert.equal(result.grossProfitAed, 7.24);
  // Delivery Charge = 7.24 * 0.20 = 1.45 AED
  assert.equal(result.deliveryChargeAed, 1.45);
  // Net Profit = 7.24 - 1.45 = 5.79 AED
  assert.equal(result.netProfitAed, 5.79);
});

test("Workbook Row 31 (2026-05-30): Customer RAKSAN calculation", () => {
  // Order: 120,900 INR, Customer Rate: 37.45, Base Rate: 26.84564 (=1000/37.25), Delivery: 20%
  const result = calculateTransaction({
    inrAmount: 120900,
    customerRate: 37.45,
    baseRate: 26.84564,
    deliveryChargePct: 0.20,
  });

  // AED = (120900 / 1000) * 37.45 = 4527.71 AED
  assert.equal(result.aedAmount, 4527.71);
  // Cost = 120900 / 26.84564 = 4503.52 AED
  assert.equal(result.costAed, 4503.52);
  // Gross Profit = 4527.71 - 4503.52 = 24.18 AED
  assert.equal(result.grossProfitAed, 24.18);
  // Delivery Charge = 24.18 * 0.20 = 4.84 AED
  assert.equal(result.deliveryChargeAed, 4.84);
  // Net Profit = 24.18 - 4.84 = 19.34 AED
  assert.equal(result.netProfitAed, 19.34);
});

test("Bank Distrip Running Balance formula", () => {
  // Prev Balance: 100,000 INR, Order: 50,000 INR, Commission: 1,500 INR, Paid: 120,000 INR
  const balance = calculateBankDistripBalance(100000, 50000, 1500, 120000);
  assert.equal(balance, 31500);
});

test("Bank Distribution Settlement - Excel MK Validation (3-May to 9-May)", () => {
  // 3-May: Order 0, COM 0, Paid -56,530, Prev 0 -> BAL 56,530
  let bal = calculateBankDistripBalance(0, 0, 0, -56530);
  assert.equal(bal, 56530);

  // 4-May: Order 2,014,700, COM 0, Paid 1,800,000, Prev 56,530 -> BAL 271,230
  bal = calculateBankDistripBalance(bal, 2014700, 0, 1800000);
  assert.equal(bal, 271230);

  // 5-May: Order 1,395,200, COM 5,400, Paid 1,500,000, Prev 271,230 -> BAL 171,830
  bal = calculateBankDistripBalance(bal, 1395200, 5400, 1500000);
  assert.equal(bal, 171830);

  // 6-May: Order 977,400, COM 4,500, Paid 1,100,000, Prev 171,830 -> BAL 53,730
  bal = calculateBankDistripBalance(bal, 977400, 4500, 1100000);
  assert.equal(bal, 53730);

  // 7-May: Order 1,237,300, COM 3,300, Paid 1,200,000, Prev 53,730 -> BAL 94,330
  bal = calculateBankDistripBalance(bal, 1237300, 3300, 1200000);
  assert.equal(bal, 94330);

  // 8-May: Order 1,480,400, COM 3,600, Paid 1,200,000, Prev 94,330 -> BAL 378,330
  bal = calculateBankDistripBalance(bal, 1480400, 3600, 1200000);
  assert.equal(bal, 378330);

  // 9-May: Order 666,700, COM 3,600, Paid 0, Prev 378,330 -> BAL 1,048,630
  bal = calculateBankDistripBalance(bal, 666700, 3600, 0);
  assert.equal(bal, 1048630);
});

test("Bank Distribution Settlement - Excel SALA Validation (3-May to 5-May)", () => {
  // 3-May: Order 69,600, COM 0, Paid 0, Prev 0 -> BAL 69,600
  let bal = calculateBankDistripBalance(0, 69600, 0, 0);
  assert.equal(bal, 69600);

  // 4-May: Order 384,900, COM 0, Paid 600,000, Prev 69,600 -> BAL -145,500 (valid negative!)
  bal = calculateBankDistripBalance(bal, 384900, 0, 600000);
  assert.equal(bal, -145500);

  // 5-May: Order 866,700, COM 0, Paid 500,000, Prev -145,500 -> BAL 221,200
  bal = calculateBankDistripBalance(bal, 866700, 0, 500000);
  assert.equal(bal, 221200);
});

test("Wholesale Liquidity Settlement calculation", () => {
  // INR: 1,700,000, Rate: 24.80 INR/AED, Paid: 50,000 AED, Prev Balance: 10,000 AED
  const settlement = calculateWholesaleSettlement(1700000, 24.80, 50000, 10000);
  // In Dirhams = 1,700,000 / 24.80 = 68,548.39 AED
  assert.equal(settlement.inDirhams, 68548.39);
  // Balance to be paid = 68,548.39 - 50,000 = 18,548.39 AED
  assert.equal(settlement.balanceToBePaidAed, 18548.39);
  // Daily Balance = 10,000 + 18,548.39 = 28,548.39 AED
  assert.equal(settlement.dailyBalanceAed, 28548.39);
});

test("Customer Running Balance calculation", () => {
  // Prev Balance: 5,000 AED, New Charge: 2,662.20 AED, Payment: 3,000.00 AED
  const currentBal = calculateCustomerRunningBalance(5000, 2662.20, 3000);
  assert.equal(currentBal, 4662.20);
});
