function evaluateFractionalTolerance(totalOrderInr, splits) {
  const totalAllocatedInr = Math.round((splits.reduce((sum, s) => sum + (parseFloat(s.inr_amount) || 0), 0) + Number.EPSILON) * 1000) / 1000;
  const diff = Math.round((totalOrderInr - totalAllocatedInr + Number.EPSILON) * 1000) / 1000;

  if (Math.abs(diff) > 1.00) {
    if (diff > 0) {
      throw new Error(`Unallocated discrepancy exceeds permitted tolerance: ₹${diff.toFixed(3)} unallocated`);
    } else {
      throw new Error(`Over-allocation exceeds permitted tolerance: ₹${Math.abs(diff).toFixed(3)} excess`);
    }
  }

  // If within tolerance, absorb into last split and tag notes
  const adjustedSplits = splits.map(s => ({ ...s }));
  let autoAdjusted = false;
  let adjustmentTag = null;

  if (Math.abs(diff) > 0 && Math.abs(diff) <= 1.00 && adjustedSplits.length > 0) {
    const lastIdx = adjustedSplits.length - 1;
    const curAmt = parseFloat(adjustedSplits[lastIdx].inr_amount) || 0;
    const adjustedAmt = Math.round((curAmt + diff + Number.EPSILON) * 1000) / 1000;
    adjustedSplits[lastIdx].inr_amount = String(adjustedAmt);
    adjustmentTag = `[Fractional balance adjustment: ${diff > 0 ? `+${diff.toFixed(3)}` : diff.toFixed(3)} INR]`;
    adjustedSplits[lastIdx].notes = adjustedSplits[lastIdx].notes ? `${adjustedSplits[lastIdx].notes} ${adjustmentTag}` : adjustmentTag;
    autoAdjusted = true;
  }

  const finalSum = Math.round((adjustedSplits.reduce((sum, s) => sum + parseFloat(s.inr_amount), 0) + Number.EPSILON) * 1000) / 1000;

  return {
    originalDiff: diff,
    autoAdjusted,
    adjustmentTag,
    adjustedSplits,
    isBalanced: Math.abs(finalSum - totalOrderInr) < 0.001
  };
}

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

console.log("=== FRACTIONAL ROUNDING & AUTO-BALANCE TOLERANCE AUDIT ===\n");

// Test 1: Positive sub-rupee discrepancy (+0.20 INR from 2026-05-04 workbook scenario)
console.log("[1] Below Tolerance: +0.20 INR discrepancy (Order 2,399,600.20 vs Splits 2,399,600.00)");
const t1 = evaluateFractionalTolerance(2399600.20, [
  { distributor: "SALA", inr_amount: "384900.00" },
  { distributor: "MK", inr_amount: "2014700.00" }
]);
assert(t1.autoAdjusted === true, "Auto-adjustment triggered for +0.20 INR");
assert(t1.isBalanced === true, "Splits balanced to exact order amount 2,399,600.20 INR");
assert(t1.adjustmentTag.includes("+0.200 INR"), "Audit tag explicitly reports +0.200 INR adjustment");
assert(t1.adjustedSplits[1].inr_amount === "2014700.2", "MK split adjusted from 2,014,700.00 to 2,014,700.20");

// Test 2: Negative sub-rupee discrepancy (-0.35 INR over-allocated)
console.log("\n[2] Negative Within Tolerance: -0.35 INR discrepancy");
const t2 = evaluateFractionalTolerance(100000.00, [
  { distributor: "SALA", inr_amount: "50000.00" },
  { distributor: "MK", inr_amount: "50000.35" }
]);
assert(t2.autoAdjusted === true, "Auto-adjustment triggered for -0.35 INR");
assert(t2.isBalanced === true, "Splits balanced to exact order amount 100,000.00 INR");
assert(t2.adjustmentTag.includes("-0.350 INR"), "Audit tag explicitly reports -0.350 INR adjustment");

// Test 3: Exactly at upper tolerance (+1.00 INR)
console.log("\n[3] Boundary Test: Exactly at +1.00 INR tolerance");
const t3 = evaluateFractionalTolerance(100001.00, [
  { distributor: "SALA", inr_amount: "50000.00" },
  { distributor: "MK", inr_amount: "50000.00" }
]);
assert(t3.isBalanced === true, "Boundary +1.00 INR correctly absorbed");

// Test 4: Exactly at lower tolerance (-1.00 INR)
console.log("\n[4] Boundary Test: Exactly at -1.00 INR tolerance");
const t4 = evaluateFractionalTolerance(100000.00, [
  { distributor: "SALA", inr_amount: "50000.00" },
  { distributor: "MK", inr_amount: "50001.00" }
]);
assert(t4.isBalanced === true, "Boundary -1.00 INR correctly absorbed");

// Test 5: Above tolerance (+1.01 INR unallocated) - MUST REJECT
console.log("\n[5] Violation Test: +1.01 INR discrepancy (Exceeds ₹1.00 tolerance)");
let errAbove = false;
try {
  evaluateFractionalTolerance(100001.01, [
    { distributor: "SALA", inr_amount: "50000.00" },
    { distributor: "MK", inr_amount: "50000.00" }
  ]);
} catch (e) {
  errAbove = true;
}
assert(errAbove, "+1.01 INR unallocated correctly rejected with error");

// Test 6: Over-allocated beyond tolerance (-1.01 INR excess) - MUST REJECT
console.log("\n[6] Violation Test: -1.01 INR discrepancy (Exceeds ₹1.00 tolerance)");
let errBelow = false;
try {
  evaluateFractionalTolerance(100000.00, [
    { distributor: "SALA", inr_amount: "50000.00" },
    { distributor: "MK", inr_amount: "50001.01" }
  ]);
} catch (e) {
  errBelow = true;
}
assert(errBelow, "-1.01 INR over-allocated correctly rejected with error");

// Test 7: Material error (e.g. ₹500 discrepancy) - MUST NEVER AUTO-ABSORB
console.log("\n[7] Material Calculation Error: ₹500.00 difference");
let errMaterial = false;
try {
  evaluateFractionalTolerance(100500.00, [
    { distributor: "SALA", inr_amount: "50000.00" },
    { distributor: "MK", inr_amount: "50000.00" }
  ]);
} catch (e) {
  errMaterial = true;
}
assert(errMaterial, "Material error of ₹500 correctly blocked from auto-absorption");

console.log(`\nFractional Tolerance Suite: ${passed} Passed | ${failed} Failed`);
if (failed > 0) process.exit(1);
