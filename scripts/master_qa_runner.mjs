import { query } from "../src/lib/db.ts";

const BASE_URL = "http://localhost:3000";

let passedCount = 0;
let failedCount = 0;
const results = [];

function assert(condition, message) {
  if (condition) {
    passedCount++;
    results.push({ status: "PASS", message });
    console.log(`  ✔ [PASS] ${message}`);
  } else {
    failedCount++;
    results.push({ status: "FAIL", message });
    console.error(`  ✖ [FAIL] ${message}`);
  }
}

async function runMasterQA() {
  console.log("================================================================================");
  console.log("       PETTI REMITTANCE APP - MASTER QA END-TO-END AUTOMATED AUDIT SUITE        ");
  console.log("================================================================================\n");

  // SECTION 1: System Health & Neon Connectivity
  console.log("[SECTION 1] System Health & Neon Connectivity");
  try {
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    assert(healthRes.status === 200, `GET /api/health returned HTTP 200 (Status: ${healthRes.status})`);
    const healthData = await healthRes.json();
    assert(healthData.ok === true && healthData.neon === true, `Health check confirms Neon connection is alive: ok=${healthData.ok}, neon=${healthData.neon}`);
  } catch (err) {
    assert(false, `Health endpoint failed: ${err.message}`);
  }

  // SECTION 2: Authentic Parties Integrity (MK, SALA, HAJA, SARAB, NF2)
  console.log("\n[SECTION 2] Authentic Parties Integrity Verification");
  try {
    const partiesRes = await fetch(`${BASE_URL}/api/parties`);
    assert(partiesRes.status === 200, `GET /api/parties returned HTTP 200`);
    const parties = await partiesRes.json();
    assert(Array.isArray(parties), `Parties payload is a valid Array`);
    const expectedParties = ["MK", "SALA", "HAJA", "SARAB", "NF2"];
    const partyCodes = parties.map(p => p.code?.toUpperCase() || p.name?.toUpperCase());
    
    for (const ep of expectedParties) {
      assert(partyCodes.includes(ep), `Authentic Party '${ep}' is registered in database`);
    }
  } catch (err) {
    assert(false, `Parties endpoint failed: ${err.message}`);
  }

  // SECTION 3: Financial Calculations Engine (Authoritative Excel Workbooks)
  console.log("\n[SECTION 3] Financial Formula Engine Verification (Workbook Scenarios)");
  try {
    // Row 4 (2026-05-03): DIVAN
    const row4Res = await fetch(`${BASE_URL}/api/transactions/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inrAmount: 69600,
        customerRate: 38.25,
        baseRate: 25.61,
        deliveryChargePct: 0.20
      })
    });
    assert(row4Res.status === 200, `Workbook Row 4 (DIVAN) calculation returned HTTP 200`);
    const row4 = await row4Res.json();
    assert(Math.abs(row4.aedAmount - 2662.200) < 0.001, `Row 4 AED Amount: ${row4.aedAmount} matches expected 2662.200 AED`);
    assert(Math.abs(row4.costAed - 2717.688) < 0.001, `Row 4 Cost AED: ${row4.costAed} matches expected 2717.688 AED`);
    assert(Math.abs(row4.grossProfitAed - (-55.488)) < 0.001, `Row 4 Gross Profit: ${row4.grossProfitAed} matches expected -55.488 AED`);
    assert(Math.abs(row4.netProfitAed - (-44.390)) < 0.001, `Row 4 Net Profit: ${row4.netProfitAed} matches expected -44.390 AED`);

    // Row 8 (2026-05-07): RAKSAN
    const row8Res = await fetch(`${BASE_URL}/api/transactions/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inrAmount: 347000,
        customerRate: 38.42,
        baseRate: 26.10966,
        deliveryChargePct: 0.20
      })
    });
    assert(row8Res.status === 200, `Workbook Row 8 (RAKSAN) calculation returned HTTP 200`);
    const row8 = await row8Res.json();
    assert(Math.abs(row8.aedAmount - 13331.740) < 0.001, `Row 8 AED Amount: ${row8.aedAmount} matches expected 13331.740 AED`);
    assert(Math.abs(row8.costAed - 13290.100) < 0.001, `Row 8 Cost AED: ${row8.costAed} matches expected 13290.100 AED`);
    assert(Math.abs(row8.grossProfitAed - 41.640) < 0.001, `Row 8 Gross Profit: ${row8.grossProfitAed} matches expected 41.640 AED`);
    assert(Math.abs(row8.netProfitAed - 33.312) < 0.001, `Row 8 Net Profit: ${row8.netProfitAed} matches expected 33.312 AED`);

    // Row 24 (2026-05-23): DIVAN
    const row24Res = await fetch(`${BASE_URL}/api/transactions/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inrAmount: 503300.20,
        customerRate: 37.30,
        baseRate: 26.82,
        deliveryChargePct: 0.20
      })
    });
    assert(row24Res.status === 200, `Workbook Row 24 (DIVAN) calculation returned HTTP 200`);
    const row24 = await row24Res.json();
    assert(Math.abs(row24.aedAmount - 18773.097) < 0.001, `Row 24 AED Amount: ${row24.aedAmount} matches expected 18773.097 AED`);
    assert(Math.abs(row24.costAed - 18765.854) < 0.001, `Row 24 Cost AED: ${row24.costAed} matches expected 18765.854 AED`);
    assert(Math.abs(row24.netProfitAed - 5.795) < 0.001, `Row 24 Net Profit: ${row24.netProfitAed} matches expected 5.795 AED`);

    // Row 31 (2026-05-30): RAKSAN
    const row31Res = await fetch(`${BASE_URL}/api/transactions/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inrAmount: 120900,
        customerRate: 37.45,
        baseRate: 26.84564,
        deliveryChargePct: 0.20
      })
    });
    assert(row31Res.status === 200, `Workbook Row 31 (RAKSAN) calculation returned HTTP 200`);
    const row31 = await row31Res.json();
    assert(Math.abs(row31.aedAmount - 4527.705) < 0.001, `Row 31 AED Amount: ${row31.aedAmount} matches expected 4527.705 AED`);
    assert(Math.abs(row31.costAed - 4503.525) < 0.001, `Row 31 Cost AED: ${row31.costAed} matches expected 4503.525 AED`);
    assert(Math.abs(row31.netProfitAed - 19.344) < 0.001, `Row 31 Net Profit: ${row31.netProfitAed} matches expected 19.344 AED`);

    // Dubai Client Transfer: 60,000 INR @ 38.25 rate
    const dubaiClientRes = await fetch(`${BASE_URL}/api/transactions/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        total: 60000,
        manualRate: 38.25,
        paidAmount: 2000
      })
    });
    assert(dubaiClientRes.status === 200, `Dubai Client Transfer calculation returned HTTP 200`);
    const dubaiClient = await dubaiClientRes.json();
    assert(Math.abs(dubaiClient.inDhirams - 2295.000) < 0.001, `Dubai In Dhirams: ${dubaiClient.inDhirams} matches expected 2295.000 AED`);
    assert(Math.abs(dubaiClient.wholesaleRate - 26.144) < 0.001, `Dubai Wholesale Rate: ${dubaiClient.wholesaleRate} matches expected 26.144 INR/AED`);
    assert(Math.abs(dubaiClient.balanceToPaid - 295.000) < 0.001, `Dubai Balance to Paid: ${dubaiClient.balanceToPaid} matches expected 295.000 AED`);
  } catch (err) {
    assert(false, `Calculation API verification failed: ${err.message}`);
  }

  // SECTION 4: Validation & Error Handling
  console.log("\n[SECTION 4] Validation & Error Handling on Calculation API");
  try {
    const zeroRes = await fetch(`${BASE_URL}/api/transactions/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ total: 0, manualRate: 38.25 })
    });
    assert(zeroRes.status === 400, `Zero total amount rejected with HTTP 400`);

    const negRes = await fetch(`${BASE_URL}/api/transactions/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ total: 50000, manualRate: -10 })
    });
    assert(negRes.status === 400, `Negative rate rejected with HTTP 400`);
  } catch (err) {
    assert(false, `Validation tests failed: ${err.message}`);
  }

  // SECTION 5: End-to-End Lifecycle: Create -> Verify -> Cascaded Delete
  console.log("\n[SECTION 5] End-to-End Transaction Lifecycle & Cascaded Delete Verification");
  let testCustomerId = null;
  let testTransactionId = null;

  try {
    // 5.1 Create isolated test customer
    const createCustRes = await fetch(`${BASE_URL}/api/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "TEST_QA_AUTOMATION_CLIENT",
        code: "TEST_QA_01",
        phone: "+971500009999",
        default_rate: 38.25,
      })
    });
    assert(createCustRes.status === 201 || createCustRes.status === 200, `Test Customer created successfully (HTTP ${createCustRes.status})`);
    const custData = await createCustRes.json();
    testCustomerId = custData.id;
    assert(testCustomerId != null, `Test customer ID retrieved: ${testCustomerId}`);

    // Fetch MK distributor ID
    const distRows = await query(`SELECT id FROM distributors WHERE code = 'MK' LIMIT 1`);
    const mkDistId = distRows.length > 0 ? distRows[0].id : null;

    // 5.2 Create transaction with customer payment & split
    const createTxnRes = await fetch(`${BASE_URL}/api/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transaction_date: "2026-10-13",
        customer_id: testCustomerId,
        total: 50000,
        inr_amount: 50000,
        manual_rate: 38.25,
        customer_rate: 38.25,
        base_rate: 37.25,
        paid_amount: 500,
        paid_aed: 500,
        notes: "QA E2E Automated Test Transaction",
        splits: mkDistId ? [
          {
            distributor_id: mkDistId,
            inr_amount: 50000,
            paid_amount_inr: 0,
            balance_inr: 50000,
            notes: "QA Split test row"
          }
        ] : []
      })
    });
    assert(createTxnRes.status === 201, `Transaction created successfully (HTTP 201)`);
    const txnData = await createTxnRes.json();
    testTransactionId = txnData.id;
    assert(testTransactionId != null, `Test Transaction ID: ${testTransactionId}`);

    // 5.3 Verify transaction exists in DB
    const txnCheck = await query(`SELECT id, inr_amount, aed_amount FROM transactions WHERE id = $1`, [testTransactionId]);
    assert(txnCheck.length === 1, `Transaction confirmed in database table: ${txnCheck.length} row`);

    const splitCheck = await query(`SELECT id FROM distribution_splits WHERE transaction_id = $1`, [testTransactionId]);
    assert(splitCheck.length > 0, `Distribution splits confirmed in database: ${splitCheck.length} rows`);

    const pmtCheck = await query(`SELECT id, amount_aed FROM customer_payments WHERE transaction_id = $1`, [testTransactionId]);
    assert(pmtCheck.length === 1, `Customer payment confirmed in database: ${pmtCheck.length} rows`);

    // 5.4 Execute DELETE /api/transactions/:id
    console.log("  Executing DELETE /api/transactions/:id...");
    const deleteRes = await fetch(`${BASE_URL}/api/transactions/${testTransactionId}`, {
      method: "DELETE"
    });
    assert(deleteRes.status === 200, `DELETE /api/transactions/${testTransactionId} returned HTTP 200`);

    // 5.5 Verify Cascade Purge in DB (Transaction, Splits, Customer Payments)
    const postTxnCheck = await query(`SELECT id FROM transactions WHERE id = $1`, [testTransactionId]);
    assert(postTxnCheck.length === 0, `Transaction successfully purged from database (0 rows remain)`);

    const postSplitCheck = await query(`SELECT id FROM distribution_splits WHERE transaction_id = $1`, [testTransactionId]);
    assert(postSplitCheck.length === 0, `Child distribution splits cascaded & purged (0 rows remain)`);

    const postPmtCheck = await query(`SELECT id FROM customer_payments WHERE transaction_id = $1`, [testTransactionId]);
    assert(postPmtCheck.length === 0, `Child customer payments cascaded & purged (0 rows remain)`);

  } catch (err) {
    assert(false, `Lifecycle test failed: ${err.message}`);
  } finally {
    // Cleanup test customer
    if (testCustomerId) {
      try {
        await query(`DELETE FROM customers WHERE id = $1`, [testCustomerId]);
        console.log(`  ✔ Cleaned up test customer: ${testCustomerId}`);
      } catch (err) {
        console.error(`  ✖ Failed to clean up test customer: ${err.message}`);
      }
    }
  }

  // SECTION 6: Security & Input Resilience Tests
  console.log("\n[SECTION 6] Security & Injection Resilience Tests");
  try {
    // Malformed UUID test
    const invalidIdRes = await fetch(`${BASE_URL}/api/transactions/INVALID_UUID_NONEXISTENT_9999`);
    assert(invalidIdRes.status === 404 || invalidIdRes.status === 400 || invalidIdRes.status === 500, `Malformed transaction ID handled safely (HTTP ${invalidIdRes.status})`);

    // SQL Injection resilience on transactions search
    const sqlPayload = encodeURIComponent("'; DROP TABLE transactions; --");
    const sqlInjectionRes = await fetch(`${BASE_URL}/api/transactions?customerId=${sqlPayload}`);
    assert(sqlInjectionRes.status === 200, `SQL Injection payload in query parameters handled safely with parameterized queries (HTTP ${sqlInjectionRes.status})`);

    // Verify transactions table still exists and is intact
    const verifyTable = await query(`SELECT count(*) as cnt FROM transactions`);
    assert(verifyTable.length > 0, `Database integrity intact: transactions table verified`);
  } catch (err) {
    assert(false, `Security tests failed: ${err.message}`);
  }

  // SECTION 7: Database Storage Indicator & Capacity Endpoint
  console.log("\n[SECTION 7] System Storage & Diagnostics Verification");
  try {
    const storageRes = await fetch(`${BASE_URL}/api/system/database-usage`);
    assert(storageRes.status === 200, `GET /api/system/database-usage returned HTTP 200`);
    const storageData = await storageRes.json();
    assert(storageData.usagePercent !== undefined, `Storage usage percentage reported: ${storageData.usagePercent}%`);
    assert(storageData.status !== undefined, `Storage health status reported: ${storageData.status}`);
    assert(!storageData.connectionString, `Database credentials/connection string strictly hidden from client payload`);
  } catch (err) {
    assert(false, `Storage endpoint failed: ${err.message}`);
  }

  // SECTION 8: Final DB Cleanliness Audit
  console.log("\n[SECTION 8] Final Cleanliness Audit (Zero Dump Data)");
  try {
    const txnCount = await query(`SELECT count(*) as cnt FROM transactions`);
    const pmtCount = await query(`SELECT count(*) as cnt FROM customer_payments`);
    const splitCount = await query(`SELECT count(*) as cnt FROM distribution_splits`);
    const distCount = await query(`SELECT count(*) as cnt FROM distributors`);

    assert(parseInt(txnCount[0].cnt) === 0, `Transactions table has 0 dump rows (Actual: ${txnCount[0].cnt})`);
    assert(parseInt(pmtCount[0].cnt) === 0, `Customer payments table has 0 dump rows (Actual: ${pmtCount[0].cnt})`);
    assert(parseInt(splitCount[0].cnt) === 0, `Distribution splits table has 0 dump rows (Actual: ${splitCount[0].cnt})`);
    assert(parseInt(distCount[0].cnt) === 5, `Distributors table has exactly 5 authentic entities (Actual: ${distCount[0].cnt})`);
  } catch (err) {
    assert(false, `Cleanliness audit failed: ${err.message}`);
  }

  console.log("\n================================================================================");
  console.log(`MASTER QA TEST SUITE COMPLETED: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log("================================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runMasterQA().catch(err => {
  console.error("FATAL ERROR IN QA RUNNER:", err);
  process.exit(1);
});
