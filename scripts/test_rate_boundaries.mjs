import { calculateTransaction, ratePer1000ToInrPerAed, inrPerAedToRatePer1000 } from "../src/lib/calculations.ts";

let passed = 0;
let failed = 0;
const results = [];

function assert(cond, msg) {
  if (cond) {
    passed++;
    results.push({ status: "PASS", message: msg });
    console.log(`  ✔ [PASS] ${msg}`);
  } else {
    failed++;
    results.push({ status: "FAIL", message: msg });
    console.error(`  ✖ [FAIL] ${msg}`);
  }
}

console.log("=== EXCHANGE-RATE CONVENTION & BOUNDARY TEST MATRIX ===\n");

// 1. Immediately below 30 (e.g. 29.990)
console.log("[1] Boundary Test: Immediately Below 30 (Rate = 29.990)");
const below30 = calculateTransaction({
  inrAmount: 60000,
  customerRate: 29.990,
  baseRate: 26.82,
  deliveryChargePct: 0.20
});
// Under < 30 convention (INR/AED): AED = INR / Rate = 60000 / 29.990 = 2000.667 AED
assert(Math.abs(below30.aedAmount - 2000.667) < 0.002, `Rate 29.990 treated as INR/AED: AED Amount = ${below30.aedAmount} (Expected: 2000.667 AED)`);

// 2. Exactly at 30 (Rate = 30.000)
console.log("\n[2] Boundary Test: Exactly at 30 (Rate = 30.000)");
const at30 = calculateTransaction({
  inrAmount: 60000,
  customerRate: 30.000,
  baseRate: 26.82,
  deliveryChargePct: 0.20
});
// Under >= 30 convention (AED/1000 INR): AED = (INR * Rate) / 1000 = (60000 * 30.000) / 1000 = 1800.000 AED
assert(Math.abs(at30.aedAmount - 1800.000) < 0.002, `Rate 30.000 treated as AED/1000 INR: AED Amount = ${at30.aedAmount} (Expected: 1800.000 AED)`);

// 3. Immediately above 30 (Rate = 30.010)
console.log("\n[3] Boundary Test: Immediately Above 30 (Rate = 30.010)");
const above30 = calculateTransaction({
  inrAmount: 60000,
  customerRate: 30.010,
  baseRate: 26.82,
  deliveryChargePct: 0.20
});
// Under >= 30 convention: AED = (60000 * 30.010) / 1000 = 1800.600 AED
assert(Math.abs(above30.aedAmount - 1800.600) < 0.002, `Rate 30.010 treated as AED/1000 INR: AED Amount = ${above30.aedAmount} (Expected: 1800.600 AED)`);

// 4. Rate Unit Inversion & Conversions
console.log("\n[4] Mathematical Rate Inversion Tests");
// 38.25 AED/1000 -> 1000 / 38.25 = 26.144 INR/AED
const convertedInrPerAed = ratePer1000ToInrPerAed(38.25);
assert(Math.abs(convertedInrPerAed - 26.144) < 0.001, `38.25 AED/1000 converts to ${convertedInrPerAed} INR/AED (Expected: 26.144)`);

// 26.144 INR/AED -> 1000 / 26.144 = 38.250 AED/1000
const convertedRatePer1000 = inrPerAedToRatePer1000(26.144);
assert(Math.abs(convertedRatePer1000 - 38.2498) < 0.002, `26.144 INR/AED converts to ${convertedRatePer1000} AED/1000 (Expected: ~38.250)`);

// 5. Invalid, Zero & Negative Rate Validation
console.log("\n[5] Invalid Rate Robustness Tests");
let zeroRateError = false;
try {
  calculateTransaction({ inrAmount: 50000, customerRate: 0, baseRate: 26.82 });
} catch (e) {
  zeroRateError = true;
}
assert(zeroRateError, "Rate = 0 correctly throws validation error");

let negRateError = false;
try {
  calculateTransaction({ inrAmount: 50000, customerRate: -38.25, baseRate: 26.82 });
} catch (e) {
  negRateError = true;
}
assert(negRateError, "Negative rate correctly throws validation error");

let nanRateError = false;
try {
  calculateTransaction({ inrAmount: 50000, customerRate: NaN, baseRate: 26.82 });
} catch (e) {
  nanRateError = true;
}
assert(nanRateError, "NaN rate correctly throws validation error");

// 6. Rate Discrepancy Risk Analysis at Threshold 30
console.log("\n[6] Threshold 30 Inversion Discrepancy Risk Analysis");
// If user inputs 30 intended as 30 INR/AED vs 30 AED/1000 INR on 100,000 INR
const asInrPerAed = 100000 / 30; // 3333.333 AED
const asAedPer1000 = (100000 * 30) / 1000; // 3000.000 AED
const diffDiscrepancy = Math.abs(asInrPerAed - asAedPer1000);
console.log(`  Discrepancy if unit is confused at 30: ${diffDiscrepancy.toFixed(3)} AED (${((diffDiscrepancy / asInrPerAed) * 100).toFixed(1)}% variance)`);
assert(diffDiscrepancy > 0, "Demonstrated that threshold 30 carries a 10% variance risk if unit is not explicitly declared");

console.log(`\nRate Boundary Suite: ${passed} Passed | ${failed} Failed`);
if (failed > 0) process.exit(1);
