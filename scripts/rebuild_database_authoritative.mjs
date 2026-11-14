import { Pool } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import {
  calculateDubaiClientTransfer,
  calculateTransaction,
  calculateWholesaleSettlement,
  calculateBankDistripBalance,
  roundTo,
} from '../src/lib/calculations.ts';
import { recordCustomerPayment } from '../src/lib/repository.ts';

// 1. Load Environment
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

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const EXCEL_PATH = 'F:/AYYAN JAN11.xlsx';

function parseNum(val, defaultVal = 0) {
  if (val === null || val === undefined) return defaultVal;
  if (typeof val === 'object' && val?.result !== undefined) val = val.result;
  if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
  if (typeof val === 'string') {
    const clean = val.replace(/,/g, '').trim();
    if (clean === '' || clean.includes('#') || clean.toLowerCase() === 'null') return defaultVal;
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? defaultVal : parsed;
  }
  return defaultVal;
}

function parseDate(val) {
  if (!val) return null;
  if (typeof val === 'object' && val.result !== undefined) val = val.result;
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof val === 'string') {
    const match = val.match(/\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }
  return null;
}

async function batchInsert(client, tableName, columns, rows, batchSize = 100) {
  if (rows.length === 0) return 0;
  let totalInserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const valuePlaceholders = [];
    const params = [];
    let pIdx = 1;

    for (const row of chunk) {
      const rowPlaceholders = [];
      for (const col of columns) {
        rowPlaceholders.push(`$${pIdx++}`);
        params.push(row[col]);
      }
      valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
    }

    const sql = `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES ${valuePlaceholders.join(', ')}`;
    let success = false;
    for (let attempt = 1; attempt <= 6; attempt++) {
      try {
        await client.query(sql, params);
        success = true;
        break;
      } catch (err) {
        if (attempt === 6) throw err;
        console.warn(`\n⚠️ Retry ${attempt}/6 for ${tableName} (batch ${i}): ${err?.message || err}`);
        await new Promise(r => setTimeout(r, 1500 * attempt));
      }
    }
    totalInserted += chunk.length;
    process.stdout.write(`\rInserted ${totalInserted}/${rows.length} into ${tableName}...`);
  }
  console.log(`\n✓ Inserted ${totalInserted} rows into ${tableName}.`);
  return totalInserted;
}

// Wrapper for recordCustomerPayment with retry on payment_number collision
async function safeRecordCustomerPayment(data) {
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      return await recordCustomerPayment(data);
    } catch (err) {
      if (err.message?.includes('duplicate key') || err.message?.includes('payment_number') || err.message?.includes('violates unique constraint')) {
        await new Promise(r => setTimeout(r, 40 * attempt));
        continue;
      }
      throw err;
    }
  }
}

async function rebuildDatabase() {
  console.log('================================================================================');
  console.log('       PETTI AUTHORITATIVE DATABASE REBUILD (EXCEL -> NEON POSTGRES)            ');
  console.log('================================================================================\n');

  // Verify backup exists
  const jsonBackup = 'backups/neon_db_pre_rebuild_snapshot.json';
  const sqlBackup = 'backups/neon_db_pre_rebuild_snapshot.sql';
  if (!fs.existsSync(jsonBackup) || !fs.existsSync(sqlBackup)) {
    throw new Error('Pre-rebuild snapshot backup files not found! Aborting for data safety.');
  }
  console.log(`✓ Verified pre-rebuild backups exist: ${jsonBackup} and ${sqlBackup}\n`);

  const client = await pool.connect();

  try {
    // -------------------------------------------------------------------------
    // STEP 2: Wipe Transactional Tables
    // -------------------------------------------------------------------------
    console.log('--- Step 2: Wiping transactional tables ---');
    await client.query('DELETE FROM distribution_splits;');
    console.log('✓ Wiped distribution_splits');
    await client.query('DELETE FROM customer_payments;');
    console.log('✓ Wiped customer_payments');
    await client.query('DELETE FROM transactions;');
    console.log('✓ Wiped transactions');
    await client.query('DELETE FROM bank_distrip_records;');
    console.log('✓ Wiped bank_distrip_records');
    await client.query('DELETE FROM wholesale_settlements;');
    console.log('✓ Wiped wholesale_settlements');
    await client.query('DELETE FROM audit_logs WHERE entity_name IN (\'TRANSACTION\', \'PAYMENT\', \'SPLIT\');');
    console.log('✓ Cleaned operational audit logs');
    console.log('✓ Step 2 Complete: All transactional tables cleanly wiped.\n');

    // -------------------------------------------------------------------------
    // STEP 3: Cleanly Reset Customers Table (29 Customers + 13 Parties)
    // -------------------------------------------------------------------------
    console.log('--- Step 3: Cleanly resetting customers table ---');
    await client.query("DELETE FROM customers WHERE entity_type = 'CUSTOMER';");

    // 13 Wholesale Parties
    const allParties = [
      { id: 'party-mk', code: 'MK', name: 'MK', partyType: 'INDIA', distId: 'dist-mk', partnerType: 'INDIA_DISTRIBUTOR', groupType: 'IND' },
      { id: 'party-sala', code: 'SALA', name: 'SALA', partyType: 'INDIA', distId: 'dist-sala', partnerType: 'INDIA_DISTRIBUTOR', groupType: 'IND' },
      { id: 'party-haja', code: 'HAJA', name: 'HAJA', partyType: 'DUBAI', distId: 'dist-haja', partnerType: 'WHOLESALE_PARTNER', groupType: 'AED' },
      { id: 'party-sarabu', code: 'SARAB', name: 'SARAB', partyType: 'DUBAI', distId: 'dist-sarabu', partnerType: 'WHOLESALE_PARTNER', groupType: 'AED' },
      { id: 'party-nf2', code: 'NF2', name: 'NF2', partyType: 'DUBAI', distId: 'dist-nf2', partnerType: 'WHOLESALE_PARTNER', groupType: 'AED' },
      { id: 'party-aadhil', code: 'AADHIL', name: 'AADHIL (AWAFI)', partyType: 'DUBAI', distId: 'dist-aadhil', partnerType: 'WHOLESALE_PARTNER', groupType: 'AED' },
      { id: 'party-anwar', code: 'ANWAR', name: 'ANWAR', partyType: 'DUBAI', distId: 'dist-anwar', partnerType: 'WHOLESALE_PARTNER', groupType: 'AED' },
      { id: 'party-basid', code: 'BASID', name: 'BASID', partyType: 'DUBAI', distId: 'dist-basid', partnerType: 'WHOLESALE_PARTNER', groupType: 'AED' },
      { id: 'party-usain', code: 'USAIN', name: 'USAIN (ASKER)', partyType: 'INDIA', distId: 'dist-usain', partnerType: 'INDIA_DISTRIBUTOR', groupType: 'IND' },
      { id: 'party-sheik', code: 'SHEIK', name: 'SHEIK', partyType: 'INDIA', distId: 'dist-sheik', partnerType: 'INDIA_DISTRIBUTOR', groupType: 'IND' },
      { id: 'party-black-grp', code: 'BLK', name: 'BLACK GRP (BLK)', partyType: 'INDIA', distId: 'dist-black-grp', partnerType: 'INDIA_DISTRIBUTOR', groupType: 'IND' },
      { id: 'party-ismail', code: 'ISMAIL', name: 'ISMAIL', partyType: 'INDIA', distId: 'dist-ismail', partnerType: 'INDIA_DISTRIBUTOR', groupType: 'IND' },
      { id: 'party-nng', code: 'NNG', name: 'NNG', partyType: 'INDIA', distId: 'dist-nng', partnerType: 'INDIA_DISTRIBUTOR', groupType: 'IND' },
    ];

    for (const p of allParties) {
      await client.query(`
        INSERT INTO distributors (id, code, name, partner_type, group_type, default_settlement_currency, status)
        VALUES ($1, $2, $3, $4, $5, 'AED', 'ACTIVE')
        ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, partner_type = EXCLUDED.partner_type, group_type = EXCLUDED.group_type;
      `, [p.distId, p.code, p.name, p.partnerType, p.groupType]);

      await client.query(`
        INSERT INTO bank_distrip_accounts (id, account_code, account_name, status)
        VALUES ($1, $2, $3, 'ACTIVE')
        ON CONFLICT (id) DO UPDATE SET account_code = EXCLUDED.account_code, account_name = EXCLUDED.account_name;
      `, [p.distId, p.code, p.name]);

      await client.query(`
        INSERT INTO customers (id, code, name, default_rate, status, entity_type, party_type)
        VALUES ($1, $2, $3, 38.25, 'ACTIVE', 'PARTY', $4)
        ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, entity_type = 'PARTY', party_type = EXCLUDED.party_type;
      `, [p.id, p.code, p.name, p.partyType]);
    }
    console.log(`✓ Preserved/upserted ${allParties.length} Wholesale Parties.`);

    // 29 Retail Customers (Note: Mapping two SAMI columns to 'SAMI' and 'SAMI 2')
    const retailCustomers = [
      { code: "SAMI", name: "SAMI", col: 2, id: "cust-sami" },
      { code: "DIVAN", name: "DIVAN", col: 3, id: "cust-divan" },
      { code: "FAIZ_BU", name: "FAIZ BU", col: 4, id: "cust-faiz-bu" },
      { code: "RAKSAN", name: "RAKSAN", col: 5, id: "cust-raksan" },
      { code: "SATHIK", name: "SATHIK", col: 6, id: "cust-sathik" },
      { code: "AJIFER", name: "AJIFER", col: 7, id: "cust-ajifer" },
      { code: "ABBAS", name: "ABBAS", col: 8, id: "cust-abbas" },
      { code: "SAMI_2", name: "SAMI 2", col: 9, id: "cust-sami-2" },
      { code: "AKBAR_DRY", name: "AKBAR DRY", col: 10, id: "cust-akbar-dry" },
      { code: "SMS", name: "SMS", col: 11, id: "cust-sms" },
      { code: "BUHARI", name: "BUHARI", col: 12, id: "cust-buhari" },
      { code: "MALIK", name: "MALIK", col: 13, id: "cust-malik" },
      { code: "KADHAR", name: "KADHAR", col: 14, id: "cust-kadhar" },
      { code: "JAHIR", name: "JAHIR", col: 15, id: "cust-jahir" },
      { code: "FAYAS", name: "FAYAS", col: 16, id: "cust-fayas" },
      { code: "AJMAL", name: "AJMAL", col: 17, id: "cust-ajmal" },
      { code: "SALEEM", name: "SALEEM", col: 18, id: "cust-saleem" },
      { code: "IBRM_APS", name: "IBRM APS", col: 19, id: "cust-ibrm-aps" },
      { code: "RIYAS", name: "RIYAS", col: 20, id: "cust-riyas" },
      { code: "YUVRAJ", name: "YUVRAJ", col: 21, id: "cust-yuvraj" },
      { code: "FAIZAL", name: "FAIZAL", col: 22, id: "cust-faizal" },
      { code: "SHAHUL", name: "SHAHUL", col: 23, id: "cust-shahul" },
      { code: "ASF_AKBAR", name: "ASF AKBAR", col: 24, id: "cust-asf-akbar" },
      { code: "GANI", name: "GANI", col: 25, id: "cust-gani" },
      { code: "BEER", name: "BEER", col: 26, id: "cust-beer" },
      { code: "ASF_SHAJHN", name: "ASF SHAJHN", col: 27, id: "cust-asf-shajhn" },
      { code: "NAISAR", name: "NAISAR", col: 28, id: "cust-naisar" },
      { code: "ADIL_RAS", name: "ADIL RAS", col: 29, id: "cust-adil-ras" },
      { code: "THARIK", name: "THARIK", col: 30, id: "cust-tharik" }
    ];

    for (const c of retailCustomers) {
      await client.query(`
        INSERT INTO customers (id, code, name, default_rate, status, entity_type)
        VALUES ($1, $2, $3, 38.25, 'ACTIVE', 'CUSTOMER')
        ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, entity_type = 'CUSTOMER';
      `, [c.id, c.code, c.name]);
    }
    console.log(`✓ Cleanly inserted all ${retailCustomers.length} retail customers with unique codes & names (including SAMI and SAMI 2).`);

    const custCountRes = await client.query('SELECT COUNT(*) FROM customers');
    console.log(`✓ Total customers in DB: ${custCountRes.rows[0].count} (29 retail + 13 wholesale parties).\n`);

    // -------------------------------------------------------------------------
    // STEP 4: Ingest 'PREV BAL' row from RECEIVABLES & BALANCE
    // -------------------------------------------------------------------------
    console.log('--- Step 4: Ingesting PREV BAL row (Opening Balances) ---');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(EXCEL_PATH);

    const cp = wb.getWorksheet('COLLECTION & PROFIT');
    const rb = wb.getWorksheet('RECEIVABLES & BALANCE');
    const id = wb.getWorksheet('INDIA DISTRIBUTION');
    const bd = wb.getWorksheet('BANK DISTRIP');

    const openingTxns = [];
    const openingPmts = [];
    let seqTxn = 100000;
    let seqPmt = 100000;
    let seqSplit = 100000;
    let seqBdr = 100000;
    let seqWs = 100000;

    for (const cust of retailCustomers) {
      const balCol = cust.col + 35; // Col 37 is SAMI, Col 38 is DIVAN...
      const balVal = parseNum(rb.getCell(4, balCol).value, 0);

      if (balVal > 0) {
        seqTxn++;
        const inrAmt = roundTo(balVal * 26.11, 2);
        openingTxns.push({
          id: `txn-prev-${cust.code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          transaction_number: `TXN-2026-${seqTxn}`,
          transaction_date: '2026-05-01',
          customer_id: cust.id,
          inr_amount: inrAmt,
          customer_rate: 38.25,
          customer_rate_convention: 'AED_PER_1000',
          aed_amount: balVal,
          base_rate: 26.11,
          base_rate_convention: 'INR_PER_AED',
          cost_aed: balVal,
          gross_profit_aed: 0,
          delivery_charge_pct: 0,
          delivery_charge_aed: 0,
          net_profit_aed: 0,
          distributor_id: 'dist-haja',
          status: 'CONFIRMED',
          notes: 'Opening Balance (PREV BAL from Excel)',
          is_demo: false,
        });
      } else if (balVal < 0) {
        seqPmt++;
        openingPmts.push({
          id: `pmt-prev-${cust.code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          payment_number: `PMT-2026-${seqPmt}`,
          payment_date: '2026-05-01',
          customer_id: cust.id,
          transaction_id: null,
          amount_aed: Math.abs(balVal),
          payment_method: 'CASH',
          reference_number: 'PREV_BAL',
          notes: 'Opening Advance Payment (PREV BAL from Excel)',
          is_demo: false,
        });
      }
    }
    console.log(`✓ Prepared ${openingTxns.length} opening debit transactions and ${openingPmts.length} opening advance payments.\n`);

    // -------------------------------------------------------------------------
    // STEP 5: Ingest All Transactions from COLLECTION & PROFIT (2026-05-02 to 2026-11-12)
    // -------------------------------------------------------------------------
    console.log('--- Step 5: Ingesting transactions ONE BY ONE through calculation engines ---');
    const clientTxns = [];
    const splits = [];

    for (let r = 3; r <= 197; r++) {
      const dateStr = parseDate(cp.getCell(r, 1).value);
      if (!dateStr) continue;

      let baseRate = parseNum(cp.getCell(r, 100).value, 26.11);
      if (baseRate <= 0) baseRate = 26.11;

      // Check active distributors for the date
      const salaSplit = parseNum(cp.getCell(r, 33).value, 0);
      const sarabSplit = parseNum(cp.getCell(r, 34).value, 0);
      const mkSplit = parseNum(cp.getCell(r, 35).value, 0);
      const ismSplit = parseNum(cp.getCell(r, 36).value, 0);
      const nngSplit = parseNum(cp.getCell(r, 37).value, 0);

      const activeDists = [];
      if (mkSplit > 0) activeDists.push({ id: 'dist-mk', name: 'MK', amt: mkSplit });
      if (salaSplit > 0) activeDists.push({ id: 'dist-sala', name: 'SALA', amt: salaSplit });
      if (sarabSplit > 0) activeDists.push({ id: 'dist-sarabu', name: 'SARAB', amt: sarabSplit });
      if (ismSplit > 0) activeDists.push({ id: 'dist-ismail', name: 'ISMAIL', amt: ismSplit });
      if (nngSplit > 0) activeDists.push({ id: 'dist-nng', name: 'NNG', amt: nngSplit });

      const totalDistAmt = activeDists.reduce((s, x) => s + x.amt, 0);
      const primaryDistId = activeDists.length > 0 ? activeDists[0].id : 'dist-haja';

      for (const cust of retailCustomers) {
        const inr = parseNum(cp.getCell(r, cust.col).value, 0);
        if (inr === 0) continue;

        let custRate = parseNum(cp.getCell(r, cust.col + 38).value, 0);
        if (custRate <= 0) custRate = baseRate >= 30 ? baseRate : roundTo(1000 / baseRate, 2);

        // Core calculation engine for client orders:
        const dubaiCalc = calculateDubaiClientTransfer({
          total: inr,
          manualRate: custRate,
          paidAmount: 0
        });

        // Core calculation engine for transaction financials:
        const txnCalc = calculateTransaction({
          inrAmount: inr,
          customerRate: custRate,
          customerRateConvention: 'AED_PER_1000',
          baseRate: baseRate,
          baseRateConvention: 'INR_PER_AED',
          deliveryChargePct: 0.20
        });

        seqTxn++;
        const txnId = `txn-${seqTxn}`;

        clientTxns.push({
          id: txnId,
          transaction_number: `TXN-2026-${seqTxn}`,
          transaction_date: dateStr,
          customer_id: cust.id,
          inr_amount: dubaiCalc.total,
          customer_rate: dubaiCalc.manualRate,
          customer_rate_convention: 'AED_PER_1000',
          aed_amount: dubaiCalc.inDhirams,
          base_rate: baseRate,
          base_rate_convention: 'INR_PER_AED',
          cost_aed: txnCalc.costAed,
          gross_profit_aed: txnCalc.grossProfitAed,
          delivery_charge_pct: 0.20,
          delivery_charge_aed: txnCalc.deliveryChargeAed,
          net_profit_aed: txnCalc.netProfitAed,
          distributor_id: primaryDistId,
          status: 'CONFIRMED',
          notes: `Excel Row ${r} - Customer ${cust.name}`,
          is_demo: false,
        });

        // Proportional distribution splits
        if (totalDistAmt > 0 && activeDists.length > 0) {
          let remainingInr = inr;
          for (let i = 0; i < activeDists.length; i++) {
            const ad = activeDists[i];
            const splitInr = i === activeDists.length - 1
              ? remainingInr
              : roundTo(inr * (ad.amt / totalDistAmt), 2);
            remainingInr = roundTo(remainingInr - splitInr, 2);

            if (splitInr !== 0) {
              const splitCostAed = roundTo(splitInr / baseRate, 3);
              seqSplit++;
              splits.push({
                id: `split-${seqSplit}`,
                transaction_id: txnId,
                distributor_id: ad.id,
                split_date: dateStr,
                inr_amount: splitInr,
                wholesale_rate: baseRate,
                aed_equivalent: splitCostAed,
                paid_amount_inr: 0,
                balance_inr: splitInr,
                status: 'ALLOCATED',
                notes: `Allocated to ${ad.name} (Share: ${Math.round((ad.amt / totalDistAmt) * 100)}%)`,
                is_demo: false,
              });
            }
          }
        } else {
          seqSplit++;
          splits.push({
            id: `split-${seqSplit}`,
            transaction_id: txnId,
            distributor_id: 'dist-haja',
            split_date: dateStr,
            inr_amount: inr,
            wholesale_rate: baseRate,
            aed_equivalent: txnCalc.costAed,
            paid_amount_inr: 0,
            balance_inr: inr,
            status: 'ALLOCATED',
            notes: 'Allocated to HAJA',
            is_demo: false,
          });
        }
      }
    }
    console.log(`✓ Processed ${clientTxns.length} client transactions and ${splits.length} distribution splits.`);

    // Wholesale Orders from INDIA DISTRIBUTION (using calculateTransaction)
    const wholesaleConfigs = [
      { code: 'AADHIL', name: 'AADHIL (AWAFI)', custId: 'party-aadhil', distId: 'dist-aadhil', inrCol: 5, rateCol: 12, aedCol: 13, paidCol: 14, defaultRate: 27.5 },
      { code: 'NF2', name: 'NF2', custId: 'party-nf2', distId: 'dist-nf2', inrCol: 6, rateCol: 17, aedCol: 18, paidCol: 19, defaultRate: 24.8 },
      { code: 'HAJA', name: 'HAJA', custId: 'party-haja', distId: 'dist-haja', inrCol: 7, rateCol: 22, aedCol: 23, paidCol: 24, defaultRate: 26.11 },
      { code: 'SARAB', name: 'SARAB', custId: 'party-sarabu', distId: 'dist-sarabu', inrCol: 8, rateCol: 27, aedCol: 28, paidCol: 29, defaultRate: 26.11 },
      { code: 'ANWAR', name: 'ANWAR', custId: 'party-anwar', distId: 'dist-anwar', inrCol: 9, rateCol: 32, aedCol: 33, paidCol: 34, defaultRate: 24.8 },
    ];

    const partyTxns = [];
    const partyPmts = [];
    const settlements = [];

    for (const wcfg of wholesaleConfigs) {
      let prevDailyBalance = 0;
      for (let r = 6; r <= 200; r++) {
        let dateStr = parseDate(id.getCell(r, 1).value);
        if (!dateStr) {
          dateStr = parseDate(cp.getCell(r - 3, 1).value);
        }
        if (!dateStr) continue;

        const inr = parseNum(id.getCell(r, wcfg.inrCol).value, 0);
        let rate = parseNum(id.getCell(r, wcfg.rateCol).value, wcfg.defaultRate);
        if (rate <= 0) rate = wcfg.defaultRate;
        const paid = parseNum(id.getCell(r, wcfg.paidCol).value, 0);

        // Core calculation engine for wholesale partner settlement:
        const wsCalc = calculateWholesaleSettlement(inr, rate, paid, prevDailyBalance);
        prevDailyBalance = wsCalc.dailyBalanceAed;

        if (inr > 0 || paid > 0 || wsCalc.inDirhams > 0) {
          seqWs++;
          settlements.push({
            id: `ws-${seqWs}`,
            settlement_date: dateStr,
            distributor_id: wcfg.distId,
            inr_amount: inr,
            wholesale_rate: rate,
            aed_equivalent: wsCalc.inDirhams,
            paid_amount_aed: paid,
            balance_aed: wsCalc.balanceToBePaidAed,
            notes: `Daily Balance: AED ${wsCalc.dailyBalanceAed.toFixed(3)}`,
          });
        }

        if (inr > 0) {
          // Core calculation engine for wholesale partner transactions:
          const txnCalc = calculateTransaction({
            inrAmount: inr,
            customerRate: rate,
            customerRateConvention: 'INR_PER_AED',
            baseRate: rate,
            baseRateConvention: 'INR_PER_AED',
            deliveryChargePct: 0
          });

          seqTxn++;
          partyTxns.push({
            id: `txn-${seqTxn}`,
            transaction_number: `TXN-2026-${seqTxn}`,
            transaction_date: dateStr,
            customer_id: wcfg.custId,
            inr_amount: inr,
            customer_rate: rate,
            customer_rate_convention: 'INR_PER_AED',
            aed_amount: txnCalc.aedAmount,
            base_rate: rate,
            base_rate_convention: 'INR_PER_AED',
            cost_aed: txnCalc.costAed,
            gross_profit_aed: 0,
            delivery_charge_pct: 0,
            delivery_charge_aed: 0,
            net_profit_aed: 0,
            distributor_id: wcfg.distId,
            status: 'CONFIRMED',
            notes: `Wholesale distribution to ${wcfg.name} (India Dist Row ${r})`,
            is_demo: false,
          });
        }

        if (paid !== 0) {
          seqPmt++;
          partyPmts.push({
            id: `pmt-${seqPmt}`,
            payment_number: `PMT-2026-${seqPmt}`,
            payment_date: dateStr,
            customer_id: wcfg.custId,
            transaction_id: null,
            amount_aed: paid,
            payment_method: 'CASH',
            reference_number: `ID-R${r}`,
            notes: paid < 0 ? `Wholesale payment adjustment for ${wcfg.name} (India Dist Row ${r})` : `Wholesale receipt from ${wcfg.name} (India Dist Row ${r})`,
            is_demo: false,
          });
        }
      }
    }
    console.log(`✓ Processed ${partyTxns.length} wholesale transactions, ${partyPmts.length} wholesale payments, ${settlements.length} wholesale settlements.`);

    // Now batch insert all transactions and splits
    const allTxnsToInsert = [...openingTxns, ...clientTxns, ...partyTxns];
    console.log(`\nInserting ${allTxnsToInsert.length} total transactions into database...`);
    const txnColumns = [
      'id', 'transaction_number', 'transaction_date', 'customer_id',
      'inr_amount', 'customer_rate', 'customer_rate_convention',
      'aed_amount', 'base_rate', 'base_rate_convention',
      'cost_aed', 'gross_profit_aed', 'delivery_charge_pct', 'delivery_charge_aed',
      'net_profit_aed', 'distributor_id', 'status', 'notes', 'is_demo'
    ];
    await batchInsert(client, 'transactions', txnColumns, allTxnsToInsert, 100);

    console.log(`Inserting ${splits.length} distribution splits into database...`);
    const splitColumns = [
      'id', 'transaction_id', 'distributor_id', 'split_date',
      'inr_amount', 'wholesale_rate', 'aed_equivalent',
      'paid_amount_inr', 'balance_inr', 'status', 'notes', 'is_demo'
    ];
    await batchInsert(client, 'distribution_splits', splitColumns, splits, 100);

    // -------------------------------------------------------------------------
    // STEP 6: Ingest Customer Payments from RECEIVABLES & BALANCE ONE BY ONE
    // -------------------------------------------------------------------------
    console.log('\n--- Step 6: Ingesting customer payments ONE BY ONE through recordCustomerPayment ---');
    // First, insert opening advance payments
    for (const op of openingPmts) {
      await safeRecordCustomerPayment({
        customer_id: op.customer_id,
        payment_date: op.payment_date,
        amount_aed: op.amount_aed,
        payment_method: op.payment_method,
        reference_number: op.reference_number,
        notes: op.notes,
      });
    }
    console.log(`✓ Ingested ${openingPmts.length} opening advance payments via recordCustomerPayment.`);

    // Next, client payments from RECEIVABLES & BALANCE
    let clientPmtCount = 0;
    const clientPmtsList = [];
    for (let r = 5; r <= 199; r++) {
      const dateStr = parseDate(rb.getCell(r, 1).value);
      if (!dateStr) continue;

      for (const cust of retailCustomers) {
        const paid = parseNum(rb.getCell(r, cust.col).value, 0);
        if (paid === 0) continue;

        clientPmtsList.push({
          customer_id: cust.id,
          payment_date: dateStr,
          amount_aed: paid,
          payment_method: 'CASH',
          reference_number: `EXCEL-R${r}`,
          notes: paid < 0 ? `Customer payment reversal/adjustment per Excel Row ${r}` : `Customer payment received per Excel Row ${r}`
        });
      }
    }

    console.log(`Found ${clientPmtsList.length} client payments to ingest one-by-one.`);
    // Process in managed concurrent batches of 8 for optimal speed and Neon stability
    const concurrency = 8;
    for (let i = 0; i < clientPmtsList.length; i += concurrency) {
      const chunk = clientPmtsList.slice(i, i + concurrency);
      await Promise.all(chunk.map(p => safeRecordCustomerPayment(p)));
      clientPmtCount += chunk.length;
      if (clientPmtCount % 100 === 0 || clientPmtCount === clientPmtsList.length) {
        process.stdout.write(`\rIngested ${clientPmtCount}/${clientPmtsList.length} client payments...`);
      }
    }
    console.log(`\n✓ Successfully ingested ${clientPmtCount} client payments through recordCustomerPayment.`);

    // Ingest wholesale partner payments
    console.log(`Ingesting ${partyPmts.length} wholesale partner payments through recordCustomerPayment...`);
    let partyPmtCount = 0;
    for (let i = 0; i < partyPmts.length; i += concurrency) {
      const chunk = partyPmts.slice(i, i + concurrency);
      await Promise.all(chunk.map(p => safeRecordCustomerPayment({
        customer_id: p.customer_id,
        payment_date: p.payment_date,
        amount_aed: p.amount_aed,
        payment_method: p.payment_method,
        reference_number: p.reference_number,
        notes: p.notes
      })));
      partyPmtCount += chunk.length;
      process.stdout.write(`\rIngested ${partyPmtCount}/${partyPmts.length} wholesale payments...`);
    }
    console.log(`\n✓ Successfully ingested ${partyPmtCount} wholesale payments through recordCustomerPayment.`);

    // -------------------------------------------------------------------------
    // STEP 7: Ingest Settlements & Bank Distrip Records
    // -------------------------------------------------------------------------
    console.log('\n--- Step 7: Ingesting Wholesale Settlements & Bank Distrip Records ---');
    console.log(`Inserting ${settlements.length} wholesale settlements into database...`);
    const wsColumns = [
      'id', 'settlement_date', 'distributor_id', 'inr_amount',
      'wholesale_rate', 'aed_equivalent', 'paid_amount_aed',
      'balance_aed', 'notes'
    ];
    await batchInsert(client, 'wholesale_settlements', wsColumns, settlements, 100);

    // Bank Distrip
    const bankConfigs = [
      { id: 'dist-mk', name: 'MK', dateCol: 1, ordCol: 2, comCol: 3, paidCol: 4 },
      { id: 'dist-sala', name: 'SALA', dateCol: 7, ordCol: 8, comCol: 9, paidCol: 10 },
      { id: 'dist-usain', name: 'USAIN', dateCol: 13, ordCol: 14, comCol: 15, paidCol: 16 },
      { id: 'dist-sheik', name: 'SHEIK', dateCol: 19, ordCol: 20, comCol: 21, paidCol: 22 },
      { id: 'dist-black-grp', name: 'BLACK GRP', dateCol: 25, ordCol: 26, comCol: 27, paidCol: 28 },
    ];

    const bdRecords = [];
    for (const cfg of bankConfigs) {
      let runningBal = 0;
      let accCount = 0;
      for (let r = 4; r <= 198; r++) {
        let recDate = parseDate(bd.getCell(r, cfg.dateCol).value);
        if (!recDate) {
          recDate = parseDate(bd.getCell(r, 1).value) || parseDate(cp.getCell(r - 1, 1).value);
        }
        if (!recDate) continue;

        const ord = parseNum(bd.getCell(r, cfg.ordCol).value, 0);
        const com = parseNum(bd.getCell(r, cfg.comCol).value, 0);
        const paid = parseNum(bd.getCell(r, cfg.paidCol).value, 0);

        if (ord !== 0 || com !== 0 || paid !== 0) {
          runningBal = calculateBankDistripBalance(runningBal, ord, com, paid);
          seqBdr++;
          accCount++;
          bdRecords.push({
            id: `bdr-${seqBdr}`,
            record_date: recDate,
            account_id: cfg.id,
            order_inr: ord,
            commission_inr: com,
            paid_inr: paid,
            balance_inr: runningBal,
            notes: `Bank Distrip ${cfg.name} Row ${r}`,
          });
        }
      }
      console.log(`  - Bank Account ${cfg.name}: ${accCount} records, final bal: ₹${runningBal.toLocaleString('en-IN')}`);
    }

    console.log(`Inserting ${bdRecords.length} bank distrip records into database...`);
    const bdColumns = [
      'id', 'record_date', 'account_id', 'order_inr',
      'commission_inr', 'paid_inr', 'balance_inr', 'notes'
    ];
    await batchInsert(client, 'bank_distrip_records', bdColumns, bdRecords, 100);

    // -------------------------------------------------------------------------
    // STEP 8: Final Verification & Reconciliations
    // -------------------------------------------------------------------------
    console.log('\n================================================================================');
    console.log('                          FINAL DATABASE VERIFICATION                           ');
    console.log('================================================================================\n');

    const tablesToCheck = [
      'customers',
      'transactions',
      'customer_payments',
      'distribution_splits',
      'wholesale_settlements',
      'bank_distrip_records',
      'distributors',
      'bank_distrip_accounts',
      'audit_logs'
    ];

    const finalCounts = {};
    for (const table of tablesToCheck) {
      const res = await client.query(`SELECT COUNT(*) FROM "${table}"`);
      finalCounts[table] = parseInt(res.rows[0].count, 10);
      console.log(`Table '${table}': ${finalCounts[table]} records`);
    }

    // Verify 29 Retail customers with unique names and codes
    const retailRes = await client.query("SELECT COUNT(DISTINCT name) as uname, COUNT(DISTINCT code) as ucode, COUNT(*) as total FROM customers WHERE entity_type = 'CUSTOMER'");
    console.log(`\nRetail Customers: total=${retailRes.rows[0].total}, unique names=${retailRes.rows[0].uname}, unique codes=${retailRes.rows[0].ucode}`);

    // Check SAMI and SAMI 2
    const samiRes = await client.query("SELECT id, code, name FROM customers WHERE name LIKE 'SAMI%' ORDER BY code");
    console.log('SAMI Customers:', samiRes.rows);

    return finalCounts;

  } finally {
    client.release();
    await pool.end();
  }
}

rebuildDatabase()
  .then(() => {
    console.log('\n✓ REBUILD COMPLETED SUCCESSFULLY!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ REBUILD FAILED:', err);
    process.exit(1);
  });
