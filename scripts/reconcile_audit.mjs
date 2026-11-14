import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

// Load .env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...vals] = trimmed.split('=');
      process.env[key.trim()] = vals.join('=').replace(/^["']|["']$/g, '').trim();
    }
  }
}

const { query } = await import('../src/lib/db.ts');

const EXCEL_PATH = 'C:/Users/F1ZZ4N/.gemini/antigravity/brain/391fc215-7568-43ab-88f4-e1ff253be3eb/.user_uploaded/media_1794628949701_15926bf9.xlsx';

function getNum(val, defaultVal = 0) {
  if (val === null || val === undefined) return defaultVal;
  if (typeof val === 'object' && val.result !== undefined) val = val.result;
  if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
  if (typeof val === 'string') {
    const clean = val.replace(/,/g, '').trim();
    if (clean === '' || clean.includes('#') || clean.toLowerCase() === 'null') return defaultVal;
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? defaultVal : parsed;
  }
  return defaultVal;
}

function round2(val) {
  return Math.round((Number(val || 0) + Number.EPSILON) * 100) / 100;
}

function round3(val) {
  return Math.round((Number(val || 0) + Number.EPSILON) * 1000) / 1000;
}

function classify(diff) {
  const absDiff = Math.abs(diff);
  if (absDiff <= 0.009) return 'MATCH';
  if (absDiff <= 0.05) return 'ROUNDING';
  return 'DISCREPANCY';
}

export async function runReconciliation() {
  console.log('Starting Financial Reconciliation Audit Engine...');
  console.log('Loading Excel Workbook from: ' + EXCEL_PATH);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);

  const cp = wb.getWorksheet('COLLECTION & PROFIT');
  const rb = wb.getWorksheet('RECEIVABLES & BALANCE');
  const id = wb.getWorksheet('INDIA DISTRIBUTION');
  const bd = wb.getWorksheet('BANK DISTRIP');
  const sm = wb.getWorksheet('SUMMARY');

  const report = {
    timestamp: new Date().toISOString(),
    customerBalances: [],
    customerOrdersInr: [],
    customerOrdersAed: [],
    customerPayments: [],
    dailyProfit: {
      summary: null,
      discrepancies: []
    },
    indiaDistributors: [],
    wholesalePartners: [],
    stats: {
      totalChecks: 0,
      matches: 0,
      roundings: 0,
      discrepancies: 0
    }
  };

  function track(status) {
    report.stats.totalChecks++;
    if (status === 'MATCH') report.stats.matches++;
    else if (status === 'ROUNDING') report.stats.roundings++;
    else report.stats.discrepancies++;
  }

  // 1. Fetch DB Customers
  const dbCustomers = await query(`
    SELECT id, code, name, entity_type 
    FROM customers 
    ORDER BY name
  `);

  const retailCustomersMap = new Map();
  for (const c of dbCustomers) {
    retailCustomersMap.set(c.name.toUpperCase().trim(), c);
    retailCustomersMap.set(c.code.toUpperCase().trim(), c);
  }

  // Define 29 Customers mapping
  const customersConfig = [
    { name: 'SAMI', code: 'SAMI', col: 2, balCol: 37, altNames: ['SAMI'] },
    { name: 'DIVAN', code: 'DIVAN', col: 3, balCol: 38 },
    { name: 'FAIZ BU', code: 'FAIZ_BU', col: 4, balCol: 39 },
    { name: 'RAKSAN', code: 'RAKSAN', col: 5, balCol: 40 },
    { name: 'SATHIK', code: 'SATHIK', col: 6, balCol: 41 },
    { name: 'AJIFER', code: 'AJIFER', col: 7, balCol: 42 },
    { name: 'ABBAS', code: 'ABBAS', col: 8, balCol: 43 },
    { name: 'SAMI 2', code: 'SAMI_2', col: 9, balCol: 44, altNames: ['SAMI 2', 'SAMI2', 'ARAFATH'] },
    { name: 'AKBAR DRY', code: 'AKBAR_DRY', col: 10, balCol: 45 },
    { name: 'SMS', code: 'SMS', col: 11, balCol: 46 },
    { name: 'BUHARI', code: 'BUHARI', col: 12, balCol: 47 },
    { name: 'MALIK', code: 'MALIK', col: 13, balCol: 48 },
    { name: 'KADHAR', code: 'KADHAR', col: 14, balCol: 49 },
    { name: 'JAHIR', code: 'JAHIR', col: 15, balCol: 50 },
    { name: 'FAYAS', code: 'FAYAS', col: 16, balCol: 51 },
    { name: 'AJMAL', code: 'AJMAL', col: 17, balCol: 52 },
    { name: 'SALEEM', code: 'SALEEM', col: 18, balCol: 53 },
    { name: 'IBRM APS', code: 'IBRM_APS', col: 19, balCol: 54 },
    { name: 'RIYAS', code: 'RIYAS', col: 20, balCol: 55 },
    { name: 'YUVRAJ', code: 'YUVRAJ', col: 21, balCol: 56 },
    { name: 'FAIZAL', code: 'FAIZAL', col: 22, balCol: 57 },
    { name: 'SHAHUL', code: 'SHAHUL', col: 23, balCol: 58 },
    { name: 'ASF AKBAR', code: 'ASF_AKBAR', col: 24, balCol: 59 },
    { name: 'GANI', code: 'GANI', col: 25, balCol: 60 },
    { name: 'BEER', code: 'BEER', col: 26, balCol: 61 },
    { name: 'ASF SHAJHN', code: 'ASF_SHAJHN', col: 27, balCol: 62 },
    { name: 'NAISAR', code: 'NAISAR', col: 28, balCol: 63 },
    { name: 'ADIL RAS', code: 'ADIL_RAS', col: 29, balCol: 64 },
    { name: 'THARIK', code: 'THARIK', col: 30, balCol: 65 }
  ];

  function findCust(cfg) {
    let cust = retailCustomersMap.get(cfg.name.toUpperCase()) || retailCustomersMap.get(cfg.code.toUpperCase());
    if (!cust && cfg.altNames) {
      for (const alt of cfg.altNames) {
        cust = retailCustomersMap.get(alt.toUpperCase());
        if (cust) break;
      }
    }
    return cust;
  }

  // =========================================================================
  // 1. RECONCILIATION: CUSTOMER BALANCES, ORDERS & PAYMENTS
  // =========================================================================
  console.log('\n--- Section 1: Customer Reconciliation (Balances, Orders, Payments) ---');

  for (const cfg of customersConfig) {
    const cust = findCust(cfg);
    const custId = cust?.id;

    // Excel Ground Truth
    const excelClosingBal = round2(getNum(rb.getRow(3).getCell(cfg.balCol).value));

    // Excel Sum Orders (INR and AED) from COLLECTION & PROFIT
    let excelSumInr = 0;
    let excelSumAed = 0;
    for (let r = 3; r <= 197; r++) {
      excelSumInr += getNum(cp.getRow(r).getCell(cfg.col).value);
      excelSumAed += getNum(cp.getRow(r).getCell(cfg.col + 68).value);
    }
    excelSumInr = round2(excelSumInr);
    excelSumAed = round2(excelSumAed);

    // Excel Sum Payments from RECEIVABLES & BALANCE Rows 4 to 199 (includes negative adjustments)
    let excelSumPmts = 0;
    for (let r = 4; r <= 199; r++) {
      excelSumPmts += getNum(rb.getRow(r).getCell(cfg.col).value);
    }
    excelSumPmts = round2(excelSumPmts);

    // Database Queries
    let dbOrdersInr = 0;
    let dbOrdersAed = 0;
    let dbPaymentsAed = 0;
    let dbOpeningAed = 0;
    let dbCalculatedBal = 0;

    if (custId) {
      const ordersRes = await query(`
        SELECT 
          COALESCE(SUM(inr_amount), 0) as total_inr,
          COALESCE(SUM(aed_amount), 0) as total_aed
        FROM transactions
        WHERE customer_id = $1 AND status = 'CONFIRMED' AND notes NOT LIKE '%Opening Balance%'
      `, [custId]);

      const openingRes = await query(`
        SELECT COALESCE(SUM(aed_amount), 0) as opening_aed
        FROM transactions
        WHERE customer_id = $1 AND status = 'CONFIRMED' AND notes LIKE '%Opening Balance%'
      `, [custId]);

      // Operational payments (excluding opening advance payment with reference_number = 'PREV_BAL')
      const operationalPmtsRes = await query(`
        SELECT COALESCE(SUM(amount_aed), 0) as total_pmts
        FROM customer_payments
        WHERE customer_id = $1 AND reference_number != 'PREV_BAL'
      `, [custId]);

      // All payments including opening advance payment
      const allPmtsRes = await query(`
        SELECT COALESCE(SUM(amount_aed), 0) as total_pmts
        FROM customer_payments
        WHERE customer_id = $1
      `, [custId]);

      dbOrdersInr = round2(ordersRes[0].total_inr);
      dbOrdersAed = round2(ordersRes[0].total_aed);
      dbOpeningAed = round2(openingRes[0].opening_aed);
      dbPaymentsAed = round2(operationalPmtsRes[0].total_pmts);

      // In the application ledger:
      // Customer balance = Total Confirmed Transactions AED - Total Customer Payments AED
      // opening debit is a transaction; opening credit is in customer_payments
      const allTxnsRes = await query(`
        SELECT COALESCE(SUM(aed_amount), 0) as total_aed
        FROM transactions
        WHERE customer_id = $1 AND status = 'CONFIRMED'
      `, [custId]);

      dbCalculatedBal = round2(Number(allTxnsRes[0].total_aed) - Number(allPmtsRes[0].total_pmts));
    }

    // Comparison 1: Customer Closing Balance
    const balDiff = round2(dbCalculatedBal - excelClosingBal);
    const balStatus = classify(balDiff);
    track(balStatus);
    report.customerBalances.push({
      customer: cfg.name,
      excel: excelClosingBal,
      database: dbCalculatedBal,
      difference: balDiff,
      status: balStatus
    });

    // Comparison 2: Customer Total INR Orders
    const inrDiff = round2(dbOrdersInr - excelSumInr);
    const inrStatus = classify(inrDiff);
    track(inrStatus);
    report.customerOrdersInr.push({
      customer: cfg.name,
      excel: excelSumInr,
      database: dbOrdersInr,
      difference: inrDiff,
      status: inrStatus
    });

    // Comparison 3: Customer Total AED Orders
    const aedDiff = round2(dbOrdersAed - excelSumAed);
    const aedStatus = classify(aedDiff);
    track(aedStatus);
    report.customerOrdersAed.push({
      customer: cfg.name,
      excel: excelSumAed,
      database: dbOrdersAed,
      difference: aedDiff,
      status: aedStatus
    });

    // Comparison 4: Customer Total Payments Received (Operational payments)
    const pmtDiff = round2(dbPaymentsAed - excelSumPmts);
    const pmtStatus = classify(pmtDiff);
    track(pmtStatus);
    report.customerPayments.push({
      customer: cfg.name,
      excel: excelSumPmts,
      database: dbPaymentsAed,
      difference: pmtDiff,
      status: pmtStatus
    });
  }

  // =========================================================================
  // 2. RECONCILIATION: DAILY PROFIT & TRANSACTION PROFIT
  // =========================================================================
  console.log('\n--- Section 2: Daily Profit & Transaction Profit Reconciliation ---');

  let excelTotalGross = 0;
  let excelTotalDelivery = 0;
  let excelTotalNet = 0;

  for (let r = 3; r <= 197; r++) {
    const gross = getNum(cp.getRow(r).getCell(130).value);
    const delivery = getNum(cp.getRow(r).getCell(132).value);
    const net = getNum(cp.getRow(r).getCell(133).value);

    excelTotalGross += gross;
    excelTotalDelivery += delivery;
    excelTotalNet += net;
  }
  excelTotalGross = round2(excelTotalGross);
  excelTotalDelivery = round2(excelTotalDelivery);
  excelTotalNet = round2(excelTotalNet);

  const dbProfitRes = await query(`
    SELECT 
      COALESCE(SUM(gross_profit_aed), 0) as sum_gross,
      COALESCE(SUM(delivery_charge_aed), 0) as sum_delivery,
      COALESCE(SUM(net_profit_aed), 0) as sum_net
    FROM transactions
    WHERE status = 'CONFIRMED' AND notes NOT LIKE '%Opening Balance%'
  `);

  const dbTotalGross = round2(dbProfitRes[0].sum_gross);
  const dbTotalDelivery = round2(dbProfitRes[0].sum_delivery);
  const dbTotalNet = round2(dbProfitRes[0].sum_net);

  const grossDiff = round2(dbTotalGross - excelTotalGross);
  const grossStatus = classify(grossDiff);
  track(grossStatus);

  const deliveryDiff = round2(dbTotalDelivery - excelTotalDelivery);
  const deliveryStatus = classify(deliveryDiff);
  track(deliveryStatus);

  const netDiff = round2(dbTotalNet - excelTotalNet);
  const netStatus = classify(netDiff);
  track(netStatus);

  report.dailyProfit.summary = {
    grossProfit: {
      excel: excelTotalGross,
      database: dbTotalGross,
      difference: grossDiff,
      status: grossStatus
    },
    deliveryCharges: {
      excel: excelTotalDelivery,
      database: dbTotalDelivery,
      difference: deliveryDiff,
      status: deliveryStatus
    },
    netProfit: {
      excel: excelTotalNet,
      database: dbTotalNet,
      difference: netDiff,
      status: netStatus
    }
  };

  // =========================================================================
  // 3. RECONCILIATION: INDIA DISTRIBUTORS (BANK DISTRIP)
  // =========================================================================
  console.log('\n--- Section 3: India Distributor Balances (BANK DISTRIP) ---');

  const distConfig = [
    { code: 'MK', name: 'MK', dbId: 'dist-mk', expectedBal: 579048 },
    { code: 'SALA', name: 'SALA', dbId: 'dist-sala', expectedBal: 38900 },
    { code: 'USAIN', name: 'USAIN (ASKER)', dbId: 'dist-usain', expectedBal: 0 },
    { code: 'SHEIK', name: 'SHEIK', dbId: 'dist-sheik', expectedBal: 185000 },
    { code: 'BLACK GRP', name: 'BLACK GRP (BLK)', dbId: 'dist-black-grp', expectedBal: 592500 }
  ];

  for (const d of distConfig) {
    const bdrRes = await query(`
      SELECT balance_inr, order_inr, commission_inr, paid_inr, record_date
      FROM bank_distrip_records
      WHERE account_id = $1
      ORDER BY record_date DESC, created_at DESC
      LIMIT 1
    `, [d.dbId]);

    const dbBal = bdrRes.length > 0 ? round2(bdrRes[0].balance_inr) : 0;
    const diff = round2(dbBal - d.expectedBal);
    const status = classify(diff);
    track(status);

    report.indiaDistributors.push({
      distributor: d.name,
      code: d.code,
      excel: d.expectedBal,
      database: dbBal,
      difference: diff,
      status: status
    });
  }

  // =========================================================================
  // 4. RECONCILIATION: WHOLESALE PARTNERS (INDIA DISTRIBUTION)
  // =========================================================================
  console.log('\n--- Section 4: Wholesale Partner Balances (INDIA DISTRIBUTION) ---');

  const wholesaleConfig = [
    { code: 'AADHIL', name: 'AADHIL (AWAFI)', dbId: 'dist-aadhil', expectedBal: -4.44 },
    { code: 'NF2', name: 'NF2', dbId: 'dist-nf2', expectedBal: 1708.30 },
    { code: 'HAJA', name: 'HAJA', dbId: 'dist-haja', expectedBal: 17879.75 },
    { code: 'SARABU', name: 'SARAB', dbId: 'dist-sarabu', expectedBal: -89285.00 },
    { code: 'BASID', name: 'BASID', dbId: 'dist-basid', expectedBal: 0.00 }
  ];

  for (const w of wholesaleConfig) {
    // Check latest cumulative daily balance from notes or sum(aed_equivalent) - sum(paid_amount_aed)
    const latestRes = await query(`
      SELECT balance_aed, notes, settlement_date
      FROM wholesale_settlements
      WHERE distributor_id = $1
      ORDER BY settlement_date DESC, created_at DESC
      LIMIT 1
    `, [w.dbId]);

    let dbDailyBal = 0;
    if (latestRes.length > 0 && latestRes[0].notes?.includes('Daily Balance: AED')) {
      const match = latestRes[0].notes.match(/Daily Balance: AED ([-\d.]+)/);
      if (match) dbDailyBal = round2(parseFloat(match[1]));
    } else {
      const netRes = await query(`
        SELECT COALESCE(SUM(aed_equivalent), 0) - COALESCE(SUM(paid_amount_aed), 0) as net_bal
        FROM wholesale_settlements
        WHERE distributor_id = $1
      `, [w.dbId]);
      dbDailyBal = round2(netRes[0].net_bal);
    }

    const diff = round2(dbDailyBal - w.expectedBal);
    const status = classify(diff);
    track(status);

    report.wholesalePartners.push({
      partner: w.name,
      code: w.code,
      excel: w.expectedBal,
      database: dbDailyBal,
      difference: diff,
      status: status
    });
  }

  return report;
}

if (process.argv[1]?.endsWith('reconcile_audit.mjs')) {
  runReconciliation()
    .then(report => {
      console.log('\n=================================================================');
      console.log('                 RECONCILIATION AUDIT SUMMARY                   ');
      console.log('=================================================================');
      console.log('Total Verification Checks: ' + report.stats.totalChecks);
      console.log('Exact Matches:             ' + report.stats.matches);
      console.log('Rounding (< 0.05 AED):     ' + report.stats.roundings);
      console.log('Discrepancies:             ' + report.stats.discrepancies);
      console.log('=================================================================\n');

      fs.writeFileSync(
        path.resolve(process.cwd(), 'backups/reconciliation_audit_report.json'),
        JSON.stringify(report, null, 2)
      );
      console.log('Audit report saved to backups/reconciliation_audit_report.json');
    })
    .catch(err => {
      console.error('Reconciliation error:', err);
      process.exit(1);
    });
}
