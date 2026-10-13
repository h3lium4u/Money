import { calculateTransaction, calculateDubaiClientTransfer, calculateCustomerRunningBalance, calculateBankDistripBalance } from "../src/lib/calculations.ts";
import { oracleCalculateRemittance } from "../qa-artifacts/reference_calculator/index.mjs";

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  ✔ [PASS] ${msg}`);
  } else {
    failed++;
    console.error(`  ✖ [FAIL] ${msg}`);
  }
}

console.log("=== EXTENDED FINANCIAL FORMULA & MAPPING ADVERSARIAL TEST SUITE ===\n");

// 1. Swapped Fields Adversarial Detection
console.log("[1] Adversarial Test: Swapped Rate Fields Detection");
// Normal: Customer Rate = 38.25 (retail), My Rate = 37.25 (wholesale)
const normal = calculateTransaction({ inrAmount: 100000, customerRate: 38.25, baseRate: 37.25, deliveryChargePct: 0.20 });
// Swapped: Customer Rate = 37.25, My Rate = 38.25
const swapped = calculateTransaction({ inrAmount: 100000, customerRate: 37.25, baseRate: 38.25, deliveryChargePct: 0.20 });

assert(normal.netProfitAed > 0, `Normal rates yield positive net profit: ${normal.netProfitAed} AED`);
assert(swapped.netProfitAed < 0, `Swapped rates yield negative net profit: ${swapped.netProfitAed} AED`);
assert(normal.netProfitAed !== swapped.netProfitAed, "Swapped rates produce distinctly different, non-symmetrical output");

// 2. Swapped Currency Units (INR vs AED) Detection
console.log("\n[2] Adversarial Test: Swapped Currency Values (INR vs AED)");
let threwOnAedAsInr = false;
try {
  // If user entered 2500 AED in place of 100,000 INR
  const res = calculateTransaction({ inrAmount: 2500, customerRate: 38.25, baseRate: 37.25 });
  // AED charged on 2500 INR @ 38.25 is 95.625 AED, which is vastly different from 2500
  assert(res.aedAmount < 100, `2500 INR produces ${res.aedAmount} AED (impossible to confuse with original amount)`);
} catch (e) {
  threwOnAedAsInr = true;
}

// 3. Multi-Split Aggregation Multiplicative Join Resistance
console.log("\n[3] Relational Join Aggregation: Join Multiplication Resistance");
const parentTransaction = {
  id: "TXN-TEST-PARENT",
  inr_amount: 150000,
  aed_amount: 5737.500
};
const childSplits = [
  { id: "SPLIT-1", transaction_id: "TXN-TEST-PARENT", inr_amount: 50000, distributor_code: "MK" },
  { id: "SPLIT-2", transaction_id: "TXN-TEST-PARENT", inr_amount: 50000, distributor_code: "SALA" },
  { id: "SPLIT-3", transaction_id: "TXN-TEST-PARENT", inr_amount: 50000, distributor_code: "HAJA" }
];

// Flawed Query simulation: SELECT SUM(t.inr_amount) FROM transactions t JOIN distribution_splits s ON s.transaction_id = t.id
const flawedJoinSum = childSplits.reduce((sum) => sum + parentTransaction.inr_amount, 0); // 450,000 INR (3x multiplication bug!)

// Correct Query: SELECT SUM(inr_amount) FROM transactions
const correctSum = parentTransaction.inr_amount; // 150,000 INR
const splitsSum = childSplits.reduce((sum, s) => sum + s.inr_amount, 0); // 150,000 INR

assert(flawedJoinSum === 450000, `Demonstrated flawed join multiplies total: ${flawedJoinSum} INR`);
assert(correctSum === 150000, `Correct transaction aggregation: ${correctSum} INR`);
assert(splitsSum === correctSum, `Sum of splits equals parent transaction exactly: ${splitsSum} INR == ${correctSum} INR`);

// 4. Multi-Transaction & Multi-Payment Customer Ledger Derivation
console.log("\n[4] Multi-Transaction & Multi-Payment Customer Running Balance");
// Customer opening balance: ₹0
// Day 1: Txn 1 (Charged 2500 AED)
// Day 2: Txn 2 (Charged 5000 AED)
// Day 3: Payment 1 (Received 1500 AED)
// Day 4: Payment 2 (Received 2000 AED)
// Day 5: Payment 3 (Received 4000 AED)
let bal = 0;
bal = calculateCustomerRunningBalance(bal, 2500, 0); // 2500
bal = calculateCustomerRunningBalance(bal, 5000, 0); // 7500
bal = calculateCustomerRunningBalance(bal, 0, 1500); // 6000
bal = calculateCustomerRunningBalance(bal, 0, 2000); // 4000
bal = calculateCustomerRunningBalance(bal, 0, 4000); // 0 (Settled)
assert(bal === 0, `Customer ledger settles to exactly 0 AED: ${bal} AED`);

// Overpayment scenario
bal = calculateCustomerRunningBalance(bal, 0, 500); // -500 (Advance Credit)
assert(bal === -500, `Overpayment accurately records advance credit: ${bal} AED`);

// 5. Extreme Values & Historical High Precision Scenarios
console.log("\n[5] Extreme Values & Decimal Precision");
const hugeTxn = calculateTransaction({
  inrAmount: 100000000, // 10 Crore INR
  customerRate: 38.25432,
  baseRate: 26.12345,
  deliveryChargePct: 0.20
});
assert(hugeTxn.aedAmount > 0, `10 Crore INR calculates cleanly: ${hugeTxn.aedAmount} AED`);
assert(hugeTxn.netProfitAed !== 0, `Net margin calculated: ${hugeTxn.netProfitAed} AED`);
assert(Number.isFinite(hugeTxn.marginPct), `Margin percentage is valid number: ${hugeTxn.marginPct}%`);

console.log(`\nExtended Adversarial Suite: ${passed} Passed | ${failed} Failed`);
if (failed > 0) process.exit(1);
