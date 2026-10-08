import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateTransaction,
  calculateBankDistripBalance,
  calculateWholesaleSettlement,
  calculateCustomerRunningBalance,
  calculateDubaiClientTransfer,
  ratePer1000ToInrPerAed,
  inrPerAedToRatePer1000,
} from "./calculations.ts";

test("Rate Conversions between conventions (3 decimals)", () => {
  // 38.25 AED per 1000 INR -> 1000 / 38.25 = 26.144 INR/AED
  const inrPerAed = ratePer1000ToInrPerAed(38.25);
  assert.equal(inrPerAed, 26.144);

  // 26.82 INR/AED -> 1000 / 26.82 = 37.286 AED per 1000 INR
  const ratePer1000 = inrPerAedToRatePer1000(26.82);
  assert.equal(ratePer1000, 37.286);
});

test("No reduction in AED conversion: 60,000 INR @ 38.25 and fixed 20 AED delivery", () => {
  const result = calculateTransaction({
    inrAmount: 60000,
    customerRate: 38.25,
    baseRate: 38.25,
    deliveryChargeAed: 20,
  });

  // Exactly 2295.000 AED - must not drift or be reduced
  assert.equal(result.aedAmount, 2295.000);
  assert.equal(result.costAed, 2295.000);
  assert.equal(result.grossProfitAed, 0.000);
  // Delivery charge must stay exactly 20.000 AED as entered
  assert.equal(result.deliveryChargeAed, 20.000);
  assert.equal(result.netProfitAed, -20.000);
});

test("Dubai Client Transfer: 60,000 total @ 38.25 rate", () => {
  const result = calculateDubaiClientTransfer({
    total: 60000,
    manualRate: 38.25,
    paidAmount: 2000,
  });

  // Exactly 2295.000 AED - must not drift to 59,998 or 2294.982
  assert.equal(result.inDhirams, 2295.000);
  assert.equal(result.wholesaleRate, 26.144);
  assert.equal(result.balanceToPaid, 295.000);
});

test("Workbook Row 4 (2026-05-03): Customer DIVAN calculation (3 decimals)", () => {
  // Order: 69,600 INR, Customer Rate: 38.25 AED/1000, Base Rate: 25.61 INR/AED, Delivery: 20%
  const result = calculateTransaction({
    inrAmount: 69600,
    customerRate: 38.25,
    baseRate: 25.61,
    deliveryChargePct: 0.20,
  });

  assert.equal(result.aedAmount, 2662.200);
  assert.equal(result.costAed, 2717.688);
  assert.equal(result.grossProfitAed, -55.488);
  assert.equal(result.deliveryChargeAed, -11.098);
  assert.equal(result.netProfitAed, -44.390);
});

test("Workbook Row 8 (2026-05-07): Customer RAKSAN calculation (3 decimals)", () => {
  // Order: 347,000 INR, Customer Rate: 38.42, Base Rate: 26.10966, Delivery: 20%
  const result = calculateTransaction({
    inrAmount: 347000,
    customerRate: 38.42,
    baseRate: 26.10966,
    deliveryChargePct: 0.20,
  });

  assert.equal(result.aedAmount, 13331.740);
  assert.equal(result.costAed, 13290.100);
  assert.equal(result.grossProfitAed, 41.640);
  assert.equal(result.deliveryChargeAed, 8.328);
  assert.equal(result.netProfitAed, 33.312);
});

test("Workbook Row 24 (2026-05-23): Customer DIVAN calculation (3 decimals)", () => {
  // Order: 503,300.20 INR, Customer Rate: 37.30, Base Rate: 26.82, Delivery: 20%
  const result = calculateTransaction({
    inrAmount: 503300.20,
    customerRate: 37.30,
    baseRate: 26.82,
    deliveryChargePct: 0.20,
  });

  assert.equal(result.aedAmount, 18773.097);
  assert.equal(result.costAed, 18765.854);
  assert.equal(result.grossProfitAed, 7.244);
  assert.equal(result.deliveryChargeAed, 1.449);
  assert.equal(result.netProfitAed, 5.795);
});

test("Workbook Row 31 (2026-05-30): Customer RAKSAN calculation (3 decimals)", () => {
  // Order: 120,900 INR, Customer Rate: 37.45, Base Rate: 26.84564 (=1000/37.25), Delivery: 20%
  const result = calculateTransaction({
    inrAmount: 120900,
    customerRate: 37.45,
    baseRate: 26.84564,
    deliveryChargePct: 0.20,
  });

  assert.equal(result.aedAmount, 4527.705);
  assert.equal(result.costAed, 4503.525);
  assert.equal(result.grossProfitAed, 24.180);
  assert.equal(result.deliveryChargeAed, 4.836);
  assert.equal(result.netProfitAed, 19.344);
});

test("Bank Distrip Running Balance formula", () => {
  // Prev Balance: 100,000 INR, Order: 50,000 INR, Commission: 1,500 INR, Paid: 120,000 INR
  const balance = calculateBankDistripBalance(100000, 50000, 1500, 120000);
  assert.equal(balance, 31500);
});

test("Bank Distribution Settlement - Excel MK Validation (3-May to 9-May)", () => {
  let bal = calculateBankDistripBalance(0, 0, 0, -56530);
  assert.equal(bal, 56530);

  bal = calculateBankDistripBalance(bal, 2014700, 0, 1800000);
  assert.equal(bal, 271230);

  bal = calculateBankDistripBalance(bal, 1395200, 5400, 1500000);
  assert.equal(bal, 171830);

  bal = calculateBankDistripBalance(bal, 977400, 4500, 1100000);
  assert.equal(bal, 53730);

  bal = calculateBankDistripBalance(bal, 1237300, 3300, 1200000);
  assert.equal(bal, 94330);

  bal = calculateBankDistripBalance(bal, 1480400, 3600, 1200000);
  assert.equal(bal, 378330);

  bal = calculateBankDistripBalance(bal, 666700, 3600, 0);
  assert.equal(bal, 1048630);
});

test("Bank Distribution Settlement - Excel SALA Validation (3-May to 5-May)", () => {
  let bal = calculateBankDistripBalance(0, 69600, 0, 0);
  assert.equal(bal, 69600);

  bal = calculateBankDistripBalance(bal, 384900, 0, 600000);
  assert.equal(bal, -145500);

  bal = calculateBankDistripBalance(bal, 866700, 0, 500000);
  assert.equal(bal, 221200);
});

test("Wholesale Liquidity Settlement calculation (3 decimals)", () => {
  // INR: 1,700,000, Rate: 24.80 INR/AED, Paid: 50,000 AED, Prev Balance: 10,000 AED
  const settlement = calculateWholesaleSettlement(1700000, 24.80, 50000, 10000);
  assert.equal(settlement.inDirhams, 68548.387);
  assert.equal(settlement.balanceToBePaidAed, 18548.387);
  assert.equal(settlement.dailyBalanceAed, 28548.387);
});

test("Customer Running Balance calculation", () => {
  const currentBal = calculateCustomerRunningBalance(5000, 2662.20, 3000);
  assert.equal(currentBal, 4662.20);
});
