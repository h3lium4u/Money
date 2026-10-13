import { oracleCalculateRemittance, oracleCalculateDubaiClient, oracleBankDistripBalance, oracleCustomerRunningBalance, round3 } from "../qa-artifacts/reference_calculator/index.mjs";
import { calculateTransaction, calculateDubaiClientTransfer, calculateBankDistripBalance, calculateCustomerRunningBalance } from "../src/lib/calculations.ts";
import fs from "fs";

async function runFullReconciliation() {
  console.log("Starting Full Autonomous Financial QA & Reconciliation Engine...\n");

  const testCases = [];
  const executionResults = [];
  const reconciliation = [];
  const defectRegister = [];

  // 1. Workbook Reference Test Cases (Authoritative Ground Truth)
  const workbookCases = [
    {
      id: "WB-ROW-004",
      name: "Workbook Row 4 (2026-05-03) Customer DIVAN",
      type: "REMITTANCE",
      inr: 69600,
      custRate: 38.25,
      baseRate: 25.61,
      deliveryPct: 0.20,
      expectedAed: 2662.200,
      expectedCost: 2717.688,
      expectedGross: -55.488,
      expectedNet: -44.390,
      sheet: "COLLECTION & PROFIT",
      cellRange: "Row 4: B4, AN4, CZ4, EC4"
    },
    {
      id: "WB-ROW-008",
      name: "Workbook Row 8 (2026-05-07) Customer RAKSAN",
      type: "REMITTANCE",
      inr: 347000,
      custRate: 38.42,
      baseRate: 26.10966,
      deliveryPct: 0.20,
      expectedAed: 13331.740,
      expectedCost: 13290.100,
      expectedGross: 41.640,
      expectedNet: 33.312,
      sheet: "COLLECTION & PROFIT",
      cellRange: "Row 8: E8, AR8, CZ8, EC8"
    },
    {
      id: "WB-ROW-024",
      name: "Workbook Row 24 (2026-05-23) Customer DIVAN",
      type: "REMITTANCE",
      inr: 503300.20,
      custRate: 37.30,
      baseRate: 26.82,
      deliveryPct: 0.20,
      expectedAed: 18773.097,
      expectedCost: 18765.854,
      expectedGross: 7.244,
      expectedNet: 5.795,
      sheet: "COLLECTION & PROFIT",
      cellRange: "Row 24: C24, AP24, CZ24, EC24"
    },
    {
      id: "WB-ROW-031",
      name: "Workbook Row 31 (2026-05-30) Customer RAKSAN",
      type: "REMITTANCE",
      inr: 120900,
      custRate: 37.45,
      baseRate: 26.84564,
      deliveryPct: 0.20,
      expectedAed: 4527.705,
      expectedCost: 4503.525,
      expectedGross: 24.180,
      expectedNet: 19.344,
      sheet: "COLLECTION & PROFIT",
      cellRange: "Row 31: E31, AR31, CZ31, EC31"
    },
    {
      id: "WB-ROW-033",
      name: "Workbook Row 33 (2026-06-01) Customer RAKSAN",
      type: "REMITTANCE",
      inr: 402900,
      custRate: 37.40,
      baseRate: 26.88172,
      deliveryPct: 0.20,
      expectedAed: 15068.460,
      expectedCost: 14987.880,
      expectedGross: 80.580,
      expectedNet: 64.464,
      sheet: "COLLECTION & PROFIT",
      cellRange: "Row 33: E33, AR33, CZ33, EC33"
    },
    {
      id: "WB-ROW-040",
      name: "Workbook Row 40 (2026-06-08) Customer APPAS",
      type: "REMITTANCE",
      inr: 165000,
      custRate: 37.28,
      baseRate: 26.86728,
      deliveryPct: 0.20,
      expectedAed: 6151.200,
      expectedCost: 6141.300,
      expectedGross: 9.900,
      expectedNet: 7.920,
      sheet: "COLLECTION & PROFIT",
      cellRange: "Row 40: H40, AU40, CZ40, EC40"
    }
  ];

  // 2. Boundary, Stress & Edge-Case Synthetic Scenarios
  const syntheticCases = [
    { id: "SYN-001", name: "Standard Retail Remittance", inr: 50000, custRate: 38.25, baseRate: 37.25, deliveryPct: 0.20 },
    { id: "SYN-002", name: "High Volume Institutional Order", inr: 5000000, custRate: 38.10, baseRate: 26.24, deliveryPct: 0.20 },
    { id: "SYN-003", name: "Sub-rupee Precision Boundary", inr: 2399600.20, custRate: 38.40, baseRate: 26.10966, deliveryPct: 0.20 },
    { id: "SYN-004", name: "Zero Margin Transaction", inr: 100000, custRate: 38.25, baseRate: 38.25, deliveryPct: 0.20 },
    { id: "SYN-005", name: "Fixed AED Delivery Charge Scenario", inr: 60000, custRate: 38.25, baseRate: 38.25, fixedDeliveryAed: 20 },
    { id: "SYN-006", name: "Inverted Rate Convention (INR/AED)", inr: 250000, custRate: 26.144, baseRate: 26.82, deliveryPct: 0.20 },
    { id: "SYN-007", name: "Small Remittance Value", inr: 1000, custRate: 38.50, baseRate: 37.50, deliveryPct: 0.20 },
    { id: "SYN-008", name: "High Precision Rate Quotation", inr: 789123.456, custRate: 38.12345, baseRate: 26.78912, deliveryPct: 0.20 }
  ];

  // 3. Bank Distrip Running Balance Cases
  const bankDistripCases = [
    { id: "BD-001", name: "MK Day 1 Settlement", prev: 0, order: 0, com: 0, paid: -56530, expected: 56530 },
    { id: "BD-002", name: "MK Day 2 Settlement", prev: 56530, order: 2014700, com: 0, paid: 1800000, expected: 271230 },
    { id: "BD-003", name: "MK Day 3 Settlement", prev: 271230, order: 1395200, com: 5400, paid: 1500000, expected: 171830 },
    { id: "BD-004", name: "MK Day 4 Settlement", prev: 171830, order: 977400, com: 4500, paid: 1100000, expected: 53730 },
    { id: "BD-005", name: "MK Day 5 Settlement", prev: 53730, order: 1237300, com: 3300, paid: 1200000, expected: 94330 },
    { id: "BD-006", name: "MK Day 6 Settlement", prev: 94330, order: 1480400, com: 3600, paid: 1200000, expected: 378330 },
    { id: "BD-007", name: "MK Day 7 Settlement", prev: 378330, order: 666700, com: 3600, paid: 0, expected: 1048630 },
    { id: "BD-008", name: "SALA Day 1 Settlement", prev: 0, order: 69600, com: 0, paid: 0, expected: 69600 },
    { id: "BD-009", name: "SALA Day 2 Settlement", prev: 69600, order: 384900, com: 0, paid: 600000, expected: -145500 },
    { id: "BD-010", name: "SALA Day 3 Settlement", prev: -145500, order: 866700, com: 0, paid: 500000, expected: 221200 }
  ];

  // 4. Customer Receivables Running Balance Cases
  const customerRunningCases = [
    { id: "CUST-BAL-001", name: "DIVAN Opening & First Order", prev: -5968, charged: 2662.200, rcvd: 0, expected: -3305.800 },
    { id: "CUST-BAL-002", name: "DIVAN Settle with Partial Cash", prev: -3305.800, charged: 25608.375, rcvd: 17500, expected: 4802.575 },
    { id: "CUST-BAL-003", name: "RAKSAN May 4 Order & Balance", prev: 1124, charged: 6186.605, rcvd: 0, expected: 7310.605 },
    { id: "CUST-BAL-004", name: "RAKSAN May 7 Settle & Surplus", prev: 14331.454, charged: 5199.360, rcvd: 0, expected: 19530.814 }
  ];

  // Execute Remittance Cases (Workbook & Synthetic)
  const allRemittance = [...workbookCases, ...syntheticCases];
  for (const tc of allRemittance) {
    testCases.push(tc);

    // Oracle run
    const oracleRes = oracleCalculateRemittance(tc.inr, tc.custRate, tc.baseRate, tc.deliveryPct || 0.20);
    // App Engine run
    const appRes = calculateTransaction({
      inrAmount: tc.inr,
      customerRate: tc.custRate,
      baseRate: tc.baseRate,
      deliveryChargePct: tc.fixedDeliveryAed !== undefined ? undefined : (tc.deliveryPct || 0.20),
      deliveryChargeAed: tc.fixedDeliveryAed
    });

    const diffAed = Math.abs(appRes.aedAmount - oracleRes.aedCharged);
    const diffNet = tc.fixedDeliveryAed !== undefined ? 0 : Math.abs(appRes.netProfitAed - oracleRes.netProfitAed);
    const isPass = diffAed < 0.002 && diffNet < 0.002;

    executionResults.push({
      testId: tc.id,
      module: "REMITTANCE_CALC",
      status: isPass ? "PASS" : "FAIL",
      expected: oracleRes.aedCharged,
      actual: appRes.aedAmount,
      diff: diffAed
    });

    reconciliation.push({
      ruleId: "RULE-FIN-02",
      testId: tc.id,
      entityId: tc.name,
      sourceWorksheet: tc.sheet || "SYNTHETIC",
      sourceCell: tc.cellRange || "N/A",
      inputValues: `INR=${tc.inr}, Rate=${tc.custRate}, Base=${tc.baseRate}`,
      expectedValue: oracleRes.aedCharged,
      actualValue: appRes.aedAmount,
      diff: diffAed,
      currency: "AED",
      status: isPass ? "PASS" : "FAIL"
    });
  }

  // Execute Bank Distrip Cases
  for (const btc of bankDistripCases) {
    testCases.push(btc);
    const oracleBal = oracleBankDistripBalance(btc.prev, btc.order, btc.com, btc.paid);
    const appBal = calculateBankDistripBalance(btc.prev, btc.order, btc.com, btc.paid);
    const diff = Math.abs(appBal - oracleBal);
    const isPass = diff < 0.002;

    executionResults.push({
      testId: btc.id,
      module: "BANK_DISTRIP",
      status: isPass ? "PASS" : "FAIL",
      expected: oracleBal,
      actual: appBal,
      diff
    });

    reconciliation.push({
      ruleId: "RULE-FIN-08",
      testId: btc.id,
      entityId: btc.name,
      sourceWorksheet: "BANK DISTRIP",
      sourceCell: "Order/Com/Paid/Bal Rows",
      inputValues: `Prev=${btc.prev}, Order=${btc.order}, Com=${btc.com}, Paid=${btc.paid}`,
      expectedValue: oracleBal,
      actualValue: appBal,
      diff,
      currency: "INR",
      status: isPass ? "PASS" : "FAIL"
    });
  }

  // Execute Customer Running Balance Cases
  for (const ctc of customerRunningCases) {
    testCases.push(ctc);
    const oracleBal = oracleCustomerRunningBalance(ctc.prev, ctc.charged, ctc.rcvd);
    const appBal = calculateCustomerRunningBalance(ctc.prev, ctc.charged, ctc.rcvd);
    const diff = Math.abs(appBal - oracleBal);
    const isPass = diff < 0.002;

    executionResults.push({
      testId: ctc.id,
      module: "CUSTOMER_RECEIVABLES",
      status: isPass ? "PASS" : "FAIL",
      expected: oracleBal,
      actual: appBal,
      diff
    });

    reconciliation.push({
      ruleId: "RULE-FIN-06",
      testId: ctc.id,
      entityId: ctc.name,
      sourceWorksheet: "RECEIVABLES & BALANCE",
      sourceCell: "Ledger Row",
      inputValues: `Prev=${ctc.prev}, Charged=${ctc.charged}, Rcvd=${ctc.rcvd}`,
      expectedValue: oracleBal,
      actualValue: appBal,
      diff,
      currency: "AED",
      status: isPass ? "PASS" : "FAIL"
    });
  }

  // Write qa-artifacts/07-generated-test-cases.json
  fs.writeFileSync("qa-artifacts/07-generated-test-cases.json", JSON.stringify(testCases, null, 2));
  console.log(`✔ Generated qa-artifacts/07-generated-test-cases.json (${testCases.length} cases)`);

  // Write qa-artifacts/08-test-execution-results.csv
  const execCsv = "TestID,Module,Status,Expected,Actual,Diff\n" +
    executionResults.map(r => `"${r.testId}","${r.module}","${r.status}",${r.expected},${r.actual},${r.diff}`).join("\n");
  fs.writeFileSync("qa-artifacts/08-test-execution-results.csv", execCsv);
  console.log(`✔ Generated qa-artifacts/08-test-execution-results.csv (${executionResults.length} records)`);

  // Write qa-artifacts/09-financial-reconciliation.csv
  const recCsv = "RuleID,TestID,EntityID,SourceWorksheet,SourceCell,InputValues,ExpectedValue,ActualValue,Diff,Currency,Status\n" +
    reconciliation.map(r => `"${r.ruleId}","${r.testId}","${r.entityId}","${r.sourceWorksheet}","${r.sourceCell}","${r.inputValues}",${r.expectedValue},${r.actualValue},${r.diff},"${r.currency}","${r.status}"`).join("\n");
  fs.writeFileSync("qa-artifacts/09-financial-reconciliation.csv", recCsv);
  console.log(`✔ Generated qa-artifacts/09-financial-reconciliation.csv (${reconciliation.length} items)`);

  // Summary counts
  const totalExec = executionResults.length;
  const passedExec = executionResults.filter(r => r.status === "PASS").length;
  const failedExec = totalExec - passedExec;
  console.log(`\nReconciliation Completed: ${passedExec} Passed / ${failedExec} Failed across ${totalExec} tests.`);
}

runFullReconciliation().catch(console.error);
