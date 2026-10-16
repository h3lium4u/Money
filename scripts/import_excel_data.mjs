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
      const val = vals.join('=').replace(/^["']|["']$/g, '').trim();
      process.env[key.trim()] = val;
    }
  }
}

const { execute, query } = await import('../src/lib/db.ts');

const EXCEL_PATH = 'F:/AYYAN JAN.xlsx';

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
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === 'string') {
    const m = val.match(/\d{4}-\d{2}-\d{2}/);
    if (m) return m[0];
  }
  return null;
}

function roundTo(val, dec = 3) {
  const f = Math.pow(10, dec);
  return Math.round((val + Number.EPSILON) * f) / f;
}

// Batch insert helper with resilient retry
async function batchInsert(tableName, columns, rows, batchSize = 100) {
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

    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${valuePlaceholders.join(', ')}`;
    let success = false;
    for (let attempt = 1; attempt <= 6; attempt++) {
      try {
        await execute(sql, params);
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

async function main() {
  console.log('================================================================');
  console.log('   IMPORTING ALL EXCEL DATA & PARTIES FROM F:\\AYYAN JAN.xlsx');
  console.log('================================================================\n');

  // Load workbook
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);

  const cp = wb.getWorksheet('COLLECTION & PROFIT');
  const rb = wb.getWorksheet('RECEIVABLES & BALANCE');
  const bd = wb.getWorksheet('BANK DISTRIP');
  const id = wb.getWorksheet('INDIA DISTRIBUTION');

  // Step 0: Delete all operational data
  console.log('Step 0: Clearing existing operational records & retail customers...');
  await execute('DELETE FROM distribution_splits');
  await execute('DELETE FROM customer_payments');
  await execute('DELETE FROM transactions');
  await execute('DELETE FROM bank_distrip_records');
  await execute("DELETE FROM customers WHERE entity_type = 'CUSTOMER'");
  console.log('✓ Operational data cleared cleanly.\n');

  // Step 1: Register All Master Wholesale & Bank Distribution Parties
  console.log('Step 1: Registering All Master Wholesale & Bank Parties...');
  const allParties = [
    // Original 5 Master Parties
    { id: 'dist-mk', custId: 'party-mk', code: 'MK', name: 'MK', groupType: 'IND', partnerType: 'INDIA_DISTRIBUTOR', partyType: 'INDIA' },
    { id: 'dist-sala', custId: 'party-sala', code: 'SALA', name: 'SALA', groupType: 'IND', partnerType: 'INDIA_DISTRIBUTOR', partyType: 'INDIA' },
    { id: 'dist-haja', custId: 'party-haja', code: 'HAJA', name: 'HAJA', groupType: 'AED', partnerType: 'WHOLESALE_PARTNER', partyType: 'DUBAI' },
    { id: 'dist-sarabu', custId: 'party-sarabu', code: 'SARAB', name: 'SARAB', groupType: 'AED', partnerType: 'WHOLESALE_PARTNER', partyType: 'DUBAI' },
    { id: 'dist-nf2', custId: 'party-nf2', code: 'NF2', name: 'NF2', groupType: 'AED', partnerType: 'WHOLESALE_PARTNER', partyType: 'DUBAI' },

    // Additional Wholesale Parties (AED Side)
    { id: 'dist-aadhil', custId: 'party-aadhil', code: 'AADHIL', name: 'AADHIL (AWAFI)', groupType: 'AED', partnerType: 'WHOLESALE_PARTNER', partyType: 'DUBAI' },
    { id: 'dist-anwar', custId: 'party-anwar', code: 'ANWAR', name: 'ANWAR', groupType: 'AED', partnerType: 'WHOLESALE_PARTNER', partyType: 'DUBAI' },
    { id: 'dist-basid', custId: 'party-basid', code: 'BASID', name: 'BASID', groupType: 'AED', partnerType: 'WHOLESALE_PARTNER', partyType: 'DUBAI' },

    // Additional Bank & Distribution Channel Parties (IND / INR Side)
    { id: 'dist-usain', custId: 'party-usain', code: 'USAIN', name: 'USAIN (ASKER)', groupType: 'IND', partnerType: 'INDIA_DISTRIBUTOR', partyType: 'INDIA' },
    { id: 'dist-sheik', custId: 'party-sheik', code: 'SHEIK', name: 'SHEIK', groupType: 'IND', partnerType: 'INDIA_DISTRIBUTOR', partyType: 'INDIA' },
    { id: 'dist-black-grp', custId: 'party-black-grp', code: 'BLK', name: 'BLACK GRP (BLK)', groupType: 'IND', partnerType: 'INDIA_DISTRIBUTOR', partyType: 'INDIA' },
    { id: 'dist-ismail', custId: 'party-ismail', code: 'ISMAIL', name: 'ISMAIL', groupType: 'IND', partnerType: 'INDIA_DISTRIBUTOR', partyType: 'INDIA' },
    { id: 'dist-nng', custId: 'party-nng', code: 'NNG', name: 'NNG', groupType: 'IND', partnerType: 'INDIA_DISTRIBUTOR', partyType: 'INDIA' },
  ];

  for (const p of allParties) {
    await execute(`
      INSERT INTO distributors (id, code, name, partner_type, group_type, default_settlement_currency, status)
      VALUES ($1, $2, $3, $4, $5, 'AED', 'ACTIVE')
      ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, partner_type = EXCLUDED.partner_type, group_type = EXCLUDED.group_type;
    `, [p.id, p.code, p.name, p.partnerType, p.groupType]);

    await execute(`
      INSERT INTO bank_distrip_accounts (id, account_code, account_name, status)
      VALUES ($1, $2, $3, 'ACTIVE')
      ON CONFLICT (id) DO UPDATE SET account_code = EXCLUDED.account_code, account_name = EXCLUDED.account_name;
    `, [p.id, p.code, p.name]);

    await execute(`
      INSERT INTO customers (id, code, name, default_rate, status, entity_type, party_type)
      VALUES ($1, $2, $3, 38.25, 'ACTIVE', 'PARTY', $4)
      ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, entity_type = 'PARTY', party_type = EXCLUDED.party_type;
    `, [p.custId, p.code, p.name, p.partyType]);
  }
  console.log(`✓ ${allParties.length} Master parties registered in distributors, bank accounts & parties ledger.\n`);

  // Step 2: Register 29 Retail Customers
  console.log('Step 2: Registering 29 Retail Customers...');
  const retailCustomers = [
    { code: "SAMI", name: "SAMI", col: 2 },
    { code: "DIVAN", name: "DIVAN", col: 3 },
    { code: "FAIZ_BU", name: "FAIZ BU", col: 4 },
    { code: "RAKSAN", name: "RAKSAN", col: 5 },
    { code: "SATHIK", name: "SATHIK", col: 6 },
    { code: "AJIFER", name: "AJIFER", col: 7 },
    { code: "ABBAS", name: "ABBAS", col: 8 },
    { code: "ARAFATH", name: "ARAFATH", col: 9 },
    { code: "AKBAR_DRY", name: "AKBAR DRY", col: 10 },
    { code: "SMS", name: "SMS", col: 11 },
    { code: "BUHARI", name: "BUHARI", col: 12 },
    { code: "MALIK", name: "MALIK", col: 13 },
    { code: "KADHAR", name: "KADHAR", col: 14 },
    { code: "JAHIR", name: "JAHIR", col: 15 },
    { code: "FAYAS", name: "FAYAS", col: 16 },
    { code: "AJMAL", name: "AJMAL", col: 17 },
    { code: "SALEEM", name: "SALEEM", col: 18 },
    { code: "IBRM_APS", name: "IBRM APS", col: 19 },
    { code: "RIYAS", name: "RIYAS", col: 20 },
    { code: "YUVRAJ", name: "YUVRAJ", col: 21 },
    { code: "FAIZAL", name: "FAIZAL", col: 22 },
    { code: "SHAHUL", name: "SHAHUL", col: 23 },
    { code: "ASF_AKBAR", name: "ASF AKBAR", col: 24 },
    { code: "GANI", name: "GANI", col: 25 },
    { code: "BEER", name: "BEER", col: 26 },
    { code: "ASF_SHAJHN", name: "ASF SHAJHN", col: 27 },
    { code: "NAISAR", name: "NAISAR", col: 28 },
    { code: "ADIL_RAS", name: "ADIL RAS", col: 29 },
    { code: "THARIK", name: "THARIK", col: 30 }
  ];

  for (let i = 0; i < retailCustomers.length; i++) {
    const c = retailCustomers[i];
    const custId = `cust-${c.code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    c.id = custId;

    await execute(`
      INSERT INTO customers (id, code, name, default_rate, status, entity_type)
      VALUES ($1, $2, $3, 38.25, 'ACTIVE', 'CUSTOMER')
      ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, entity_type = 'CUSTOMER';
    `, [c.id, c.code, c.name]);
  }
  console.log(`✓ ${retailCustomers.length} Retail customers verified.\n`);

  // Step 3: Parse Opening Balances (PREV BAL from RECEIVABLES & BALANCE Row 3)
  console.log('Step 3: Parsing Opening Balances (Row 3 PRE BAL)...');
  const openingTxns = [];
  const openingPmts = [];
  let seqTxn = 100000;
  let seqPmt = 100000;
  let seqSplit = 100000;
  let seqBdr = 100000;

  for (const cust of retailCustomers) {
    const balVal = parseNum(rb.getCell(3, cust.col + 36).value, 0);
    if (balVal > 0) {
      seqTxn++;
      const inrAmt = roundTo(balVal * 26.11, 2);
      openingTxns.push({
        id: `txn-prev-${cust.code.toLowerCase().slice(0, 15)}`,
        transaction_number: `TXN-2026-${seqTxn}`,
        transaction_date: '2026-05-02',
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
      const pmtId = `pmt-prev-${cust.code.toLowerCase().slice(0, 15)}`;
      openingPmts.push({
        id: pmtId,
        payment_number: `PMT-2026-${seqPmt}`,
        payment_date: '2026-05-02',
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
  console.log(`✓ Found ${openingTxns.length} opening receivable balances and ${openingPmts.length} opening advance credits.\n`);

  // Step 4: Parse COLLECTION & PROFIT (Remittances & Multi-Party Splits)
  console.log('Step 4: Parsing COLLECTION & PROFIT (Remittances & Splits)...');
  const txnsToInsert = [...openingTxns];
  const splitsToInsert = [];

  for (let r = 4; r <= cp.rowCount; r++) {
    const dateStr = parseDate(cp.getCell(r, 1).value);
    if (!dateStr) continue;

    let baseRate = parseNum(cp.getCell(r, 100).value, 26.11);
    if (baseRate <= 0) baseRate = 26.11;

    // Check party distributions on this date from cols 33-37
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

    // Primary distributor for the transaction header
    let primaryDistId = 'dist-haja';
    if (activeDists.length > 0) {
      primaryDistId = activeDists[0].id;
    }

    for (const cust of retailCustomers) {
      const inr = parseNum(cp.getCell(r, cust.col).value, 0);
      if (inr <= 0) continue;

      let custRate = parseNum(cp.getCell(r, cust.col + 38).value, 0);
      if (custRate <= 0) custRate = baseRate >= 30 ? baseRate : roundTo(1000 / baseRate, 2);

      const custConv = custRate >= 30 ? 'AED_PER_1000' : 'INR_PER_AED';
      const baseConv = baseRate >= 30 ? 'AED_PER_1000' : 'INR_PER_AED';

      const aedAmt = custConv === 'AED_PER_1000'
        ? roundTo((inr / 1000) * custRate, 3)
        : roundTo(inr / custRate, 3);

      const costAed = baseConv === 'AED_PER_1000'
        ? roundTo((inr / 1000) * baseRate, 3)
        : roundTo(inr / baseRate, 3);

      const grossProfitAed = roundTo(aedAmt - costAed, 3);
      const deliveryAed = roundTo(aedAmt * 0.002, 3);
      const netProfitAed = roundTo(grossProfitAed - deliveryAed, 3);

      seqTxn++;
      const txnId = `txn-${seqTxn}`;

      txnsToInsert.push({
        id: txnId,
        transaction_number: `TXN-2026-${seqTxn}`,
        transaction_date: dateStr,
        customer_id: cust.id,
        inr_amount: inr,
        customer_rate: custRate,
        customer_rate_convention: custConv,
        aed_amount: aedAmt,
        base_rate: baseRate,
        base_rate_convention: baseConv,
        cost_aed: costAed,
        gross_profit_aed: grossProfitAed,
        delivery_charge_pct: 0.20,
        delivery_charge_aed: deliveryAed,
        net_profit_aed: netProfitAed,
        distributor_id: primaryDistId,
        status: 'CONFIRMED',
        notes: `Excel Row ${r} - Customer ${cust.name}`,
        is_demo: false,
      });

      // Split distribution across active distributors
      if (totalDistAmt > 0 && activeDists.length > 0) {
        let remainingInr = inr;
        for (let i = 0; i < activeDists.length; i++) {
          const ad = activeDists[i];
          const splitInr = i === activeDists.length - 1
            ? remainingInr
            : roundTo(inr * (ad.amt / totalDistAmt), 2);
          remainingInr = roundTo(remainingInr - splitInr, 2);

          if (splitInr > 0) {
            const splitCostAed = baseConv === 'AED_PER_1000'
              ? roundTo((splitInr / 1000) * baseRate, 3)
              : roundTo(splitInr / baseRate, 3);

            seqSplit++;
            splitsToInsert.push({
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
        splitsToInsert.push({
          id: `split-${seqSplit}`,
          transaction_id: txnId,
          distributor_id: 'dist-haja',
          split_date: dateStr,
          inr_amount: inr,
          wholesale_rate: baseRate,
          aed_equivalent: costAed,
          paid_amount_inr: 0,
          balance_inr: inr,
          status: 'ALLOCATED',
          notes: 'Allocated to HAJA',
          is_demo: false,
        });
      }
    }
  }
  console.log(`✓ Prepared ${txnsToInsert.length} customer remittances and ${splitsToInsert.length} distribution splits.\n`);

  // Step 5: Parse Customer Payments from RECEIVABLES & BALANCE
  console.log('Step 5: Parsing RECEIVABLES & BALANCE (Customer Payments)...');
  const pmtsToInsert = [...openingPmts];

  for (let r = 4; r <= rb.rowCount; r++) {
    const dateStr = parseDate(rb.getCell(r, 1).value);
    if (!dateStr) continue;

    for (const cust of retailCustomers) {
      const paid = parseNum(rb.getCell(r, cust.col + 36).value, 0);
      if (paid <= 0) continue;

      seqPmt++;
      const pmtId = `pmt-${seqPmt}`;

      pmtsToInsert.push({
        id: pmtId,
        payment_number: `PMT-2026-${seqPmt}`,
        payment_date: dateStr,
        customer_id: cust.id,
        transaction_id: null,
        amount_aed: paid,
        payment_method: 'CASH',
        reference_number: `EXCEL-R${r}`,
        notes: `Customer payment received per Excel Row ${r}`,
        is_demo: false,
      });
    }
  }
  console.log(`✓ Prepared ${pmtsToInsert.length} customer payments.\n`);

  // Step 6: Parse BANK DISTRIP (All 5 Accounts: MK, SALA, USAIN, SHEIK, BLACK GRP)
  console.log('Step 6: Parsing BANK DISTRIP (MK, SALA, USAIN, SHEIK, BLACK GRP)...');
  const bdRecordsToInsert = [];

  const bankConfigs = [
    { id: 'dist-mk', name: 'MK', dateCol: 1, ordCol: 2, comCol: 3, paidCol: 4 },
    { id: 'dist-sala', name: 'SALA', dateCol: 7, ordCol: 8, comCol: 9, paidCol: 10 },
    { id: 'dist-usain', name: 'USAIN', dateCol: 13, ordCol: 14, comCol: 15, paidCol: 16 },
    { id: 'dist-sheik', name: 'SHEIK', dateCol: 19, ordCol: 20, comCol: 21, paidCol: 22 },
    { id: 'dist-black-grp', name: 'BLACK GRP', dateCol: 25, ordCol: 26, comCol: 27, paidCol: 28 },
  ];

  for (const cfg of bankConfigs) {
    const accountRecords = [];
    for (let r = 4; r <= bd.rowCount; r++) {
      let recDate = parseDate(bd.getCell(r, cfg.dateCol).value);
      if (!recDate) {
        recDate = parseDate(bd.getCell(r, 1).value) || parseDate(cp.getCell(r, 1).value);
      }

      const ord = parseNum(bd.getCell(r, cfg.ordCol).value, 0);
      const com = parseNum(bd.getCell(r, cfg.comCol).value, 0);
      const paid = parseNum(bd.getCell(r, cfg.paidCol).value, 0);

      if (ord !== 0 || com !== 0 || paid !== 0) {
        seqBdr++;
        accountRecords.push({
          id: `bdr-${seqBdr}`,
          record_date: recDate || '2026-05-01',
          account_id: cfg.id,
          order_inr: ord,
          commission_inr: com,
          paid_inr: paid,
          balance_inr: 0, // will compute running balance
          notes: `Bank Distrip ${cfg.name} Row ${r}`,
        });
      }
    }

    // Sort by record_date ascending and compute running balance
    accountRecords.sort((a, b) => a.record_date.localeCompare(b.record_date));
    let runningBal = 0;
    for (const rec of accountRecords) {
      runningBal = roundTo(runningBal + rec.order_inr + rec.commission_inr - rec.paid_inr, 2);
      rec.balance_inr = runningBal;
      bdRecordsToInsert.push(rec);
    }
    console.log(`  - ${cfg.name}: ${accountRecords.length} records (Final Balance: ₹${runningBal.toLocaleString('en-IN')})`);
  }
  console.log(`✓ Prepared ${bdRecordsToInsert.length} bank distrip records across all 5 accounts.\n`);

  // Step 7: Parse INDIA DISTRIBUTION (Wholesale Parties: NF2, HAJA, SARAB, AADHIL, ANWAR)
  console.log('Step 7: Parsing INDIA DISTRIBUTION (Wholesale Parties: NF2, HAJA, SARAB, AADHIL, ANWAR)...');
  const partyTxnsToInsert = [];
  const partyPmtsToInsert = [];

  const wholesaleConfigs = [
    { code: 'NF2', name: 'NF2', custId: 'party-nf2', distId: 'dist-nf2', inrCol: 6, rateCol: 17, aedCol: 18, paidCol: 19, defaultRate: 24.8 },
    { code: 'HAJA', name: 'HAJA', custId: 'party-haja', distId: 'dist-haja', inrCol: 7, rateCol: 22, aedCol: 23, paidCol: 24, defaultRate: 26.11 },
    { code: 'SARAB', name: 'SARAB', custId: 'party-sarabu', distId: 'dist-sarabu', inrCol: 8, rateCol: 27, aedCol: 28, paidCol: 29, defaultRate: 26.11 },
    { code: 'AADHIL', name: 'AADHIL (AWAFI)', custId: 'party-aadhil', distId: 'dist-aadhil', inrCol: 5, rateCol: 12, aedCol: 13, paidCol: 14, defaultRate: 27.5 },
    { code: 'ANWAR', name: 'ANWAR', custId: 'party-anwar', distId: 'dist-anwar', inrCol: 9, rateCol: 32, aedCol: 33, paidCol: 34, defaultRate: 24.8 },
  ];

  for (const wcfg of wholesaleConfigs) {
    let pTxnCount = 0;
    let pPmtCount = 0;

    for (let r = 4; r <= id.rowCount; r++) {
      let dateStr = parseDate(id.getCell(r, 1).value);
      if (!dateStr) {
        dateStr = parseDate(cp.getCell(r - 2, 1).value) || parseDate(cp.getCell(r, 1).value);
      }
      if (!dateStr) dateStr = '2026-05-01';

      const inr = parseNum(id.getCell(r, wcfg.inrCol).value, 0);
      let rate = parseNum(id.getCell(r, wcfg.rateCol).value, wcfg.defaultRate);
      if (rate <= 0) rate = wcfg.defaultRate;
      const aed = parseNum(id.getCell(r, wcfg.aedCol).value, 0) || (rate > 0 ? roundTo(inr / rate, 3) : 0);
      const paid = parseNum(id.getCell(r, wcfg.paidCol).value, 0);

      if (inr > 0) {
        seqTxn++;
        pTxnCount++;
        partyTxnsToInsert.push({
          id: `txn-${seqTxn}`,
          transaction_number: `TXN-2026-${seqTxn}`,
          transaction_date: dateStr,
          customer_id: wcfg.custId,
          inr_amount: inr,
          customer_rate: rate,
          customer_rate_convention: 'INR_PER_AED',
          aed_amount: aed,
          base_rate: rate,
          base_rate_convention: 'INR_PER_AED',
          cost_aed: aed,
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

      if (paid > 0) {
        seqPmt++;
        pPmtCount++;
        partyPmtsToInsert.push({
          id: `pmt-${seqPmt}`,
          payment_number: `PMT-2026-${seqPmt}`,
          payment_date: dateStr,
          customer_id: wcfg.custId,
          transaction_id: null,
          amount_aed: paid,
          payment_method: 'CASH',
          reference_number: `ID-R${r}`,
          notes: `Wholesale payment received from ${wcfg.name} (India Dist Row ${r})`,
          is_demo: false,
        });
      }
    }
    console.log(`  - ${wcfg.name}: ${pTxnCount} wholesale orders, ${pPmtCount} payments.`);
  }
  console.log(`✓ Prepared ${partyTxnsToInsert.length} wholesale party transfers and ${partyPmtsToInsert.length} wholesale payments.\n`);

  // Step 8: Execute Database Batch Inserts
  console.log('Step 8: Executing Database Batch Inserts...');

  const allTxns = [...txnsToInsert, ...partyTxnsToInsert];
  const allPmts = [...pmtsToInsert, ...partyPmtsToInsert];

  const txnColumns = [
    'id', 'transaction_number', 'transaction_date', 'customer_id',
    'inr_amount', 'customer_rate', 'customer_rate_convention',
    'aed_amount', 'base_rate', 'base_rate_convention',
    'cost_aed', 'gross_profit_aed', 'delivery_charge_pct', 'delivery_charge_aed',
    'net_profit_aed', 'distributor_id', 'status', 'notes', 'is_demo'
  ];

  const splitColumns = [
    'id', 'transaction_id', 'distributor_id', 'split_date',
    'inr_amount', 'wholesale_rate', 'aed_equivalent',
    'paid_amount_inr', 'balance_inr', 'status', 'notes', 'is_demo'
  ];

  const pmtColumns = [
    'id', 'payment_number', 'payment_date', 'customer_id',
    'transaction_id', 'amount_aed', 'payment_method',
    'reference_number', 'notes', 'is_demo'
  ];

  const bdrColumns = [
    'id', 'record_date', 'account_id', 'order_inr',
    'commission_inr', 'paid_inr', 'balance_inr', 'notes'
  ];

  console.log('\n--- Inserting Transactions ---');
  await batchInsert('transactions', txnColumns, allTxns, 80);

  console.log('\n--- Inserting Distribution Splits ---');
  await batchInsert('distribution_splits', splitColumns, splitsToInsert, 80);

  console.log('\n--- Inserting Customer Payments ---');
  await batchInsert('customer_payments', pmtColumns, allPmts, 80);

  console.log('\n--- Inserting Bank Distrip Records ---');
  await batchInsert('bank_distrip_records', bdrColumns, bdRecordsToInsert, 80);

  console.log('\n================================================================');
  console.log('   ALL DATA IMPORT COMPLETE AND RECONCILED WITH EXCEL');
  console.log(`   - Master Parties & Distributors: ${allParties.length}`);
  console.log(`   - Retail Customers: ${retailCustomers.length}`);
  console.log(`   - Transactions: ${allTxns.length}`);
  console.log(`   - Distribution Splits: ${splitsToInsert.length}`);
  console.log(`   - Customer Payments: ${allPmts.length}`);
  console.log(`   - Bank Distrip Records: ${bdRecordsToInsert.length}`);
  console.log('================================================================\n');

  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Fatal error during import:', err);
  process.exit(1);
});
