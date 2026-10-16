import ExcelJS from 'exceljs';
import { execute, query } from '../src/lib/db.ts';

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
  console.log('   WIPING ALL DATA & IMPORTING FROM F:\\AYYAN JAN.xlsx');
  console.log('================================================================\n');

  // Load workbook
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);

  const cp = wb.getWorksheet('COLLECTION & PROFIT');
  const rb = wb.getWorksheet('RECEIVABLES & BALANCE');
  const bd = wb.getWorksheet('BANK DISTRIP');
  const id = wb.getWorksheet('INDIA DISTRIBUTION');

  // Step 0: Delete all existing data
  console.log('Step 0: Deleting all existing data (wiping transactions, payments, splits, bank distrip, and retail customers)...');
  await execute('DELETE FROM distribution_splits');
  await execute('DELETE FROM customer_payments');
  await execute('DELETE FROM transactions');
  await execute('DELETE FROM bank_distrip_records');
  await execute("DELETE FROM customers WHERE entity_type = 'CUSTOMER'");
  console.log('✓ All existing data deleted cleanly.\n');

  // Step 1: Ensure 5 Master Parties in distributors, bank_distrip_accounts, customers
  console.log('Step 1: Ensuring 5 Master Parties...');
  const masterParties = [
    { id: 'dist-mk', custId: 'party-mk', code: 'MK', name: 'MK', groupType: 'IND', partnerType: 'INDIA_DISTRIBUTOR', partyType: 'INDIA' },
    { id: 'dist-sala', custId: 'party-sala', code: 'SALA', name: 'SALA', groupType: 'IND', partnerType: 'INDIA_DISTRIBUTOR', partyType: 'INDIA' },
    { id: 'dist-haja', custId: 'party-haja', code: 'HAJA', name: 'HAJA', groupType: 'AED', partnerType: 'WHOLESALE_PARTNER', partyType: 'DUBAI' },
    { id: 'dist-sarabu', custId: 'party-sarabu', code: 'SARAB', name: 'SARAB', groupType: 'AED', partnerType: 'WHOLESALE_PARTNER', partyType: 'DUBAI' },
    { id: 'dist-nf2', custId: 'party-nf2', code: 'NF2', name: 'NF2', groupType: 'AED', partnerType: 'WHOLESALE_PARTNER', partyType: 'DUBAI' },
  ];

  for (const p of masterParties) {
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
  console.log('✓ 5 Master parties verified (MK, SALA, HAJA, SARAB, NF2).\n');

  // Step 2: Register Retail Customers
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

  for (const c of retailCustomers) {
    const custId = `cust-${c.code.toLowerCase().replace(/_/g, '-')}`;
    c.id = custId;
    await execute(`
      INSERT INTO customers (id, code, name, default_rate, status, entity_type)
      VALUES ($1, $2, $3, 38.25, 'ACTIVE', 'CUSTOMER')
      ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, entity_type = 'CUSTOMER';
    `, [custId, c.code, c.name]);
  }
  console.log(`✓ ${retailCustomers.length} retail customers registered.\n`);

  // Step 3: Insert Customer Opening Balances (RECEIVABLES & BALANCE Row 4)
  console.log('Step 3: Processing Opening Balances from RECEIVABLES & BALANCE Row 4...');
  const openingTxns = [];
  const openingPmts = [];
  let seqTxn = 100000;
  let seqPmt = 100000;

  for (const cust of retailCustomers) {
    // Row 4 cols 37 to 65 have PREV BAL
    const balVal = parseNum(rb.getCell(4, cust.col + 35).value, 0);
    if (balVal > 0) {
      // Customer owes money (receivable)
      seqTxn++;
      const txnId = `txn-prev-${cust.code.toLowerCase()}`;
      const inrAmt = roundTo(balVal * 26.11, 2);
      openingTxns.push({
        id: txnId,
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
      // Customer has advance credit
      seqPmt++;
      const pmtId = `pmt-prev-${cust.code.toLowerCase()}`;
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

  // Step 4: Parse COLLECTION & PROFIT (Transactions & Splits)
  console.log('Step 4: Parsing COLLECTION & PROFIT (Remittances)...');
  const txnsToInsert = [...openingTxns];
  const splitsToInsert = [];

  for (let r = 4; r <= cp.rowCount; r++) {
    const dateStr = parseDate(cp.getCell(r, 1).value);
    if (!dateStr) continue;

    let baseRate = parseNum(cp.getCell(r, 100).value, 26.11);
    if (baseRate <= 0) baseRate = 26.11;

    // Check party distribution split on this date
    const salaSplit = parseNum(cp.getCell(r, 33).value, 0);
    const sarabSplit = parseNum(cp.getCell(r, 34).value, 0);
    const mkSplit = parseNum(cp.getCell(r, 35).value, 0);

    let dayDistId = 'dist-haja';
    if (mkSplit > 0) dayDistId = 'dist-mk';
    else if (salaSplit > 0) dayDistId = 'dist-sala';
    else if (sarabSplit > 0) dayDistId = 'dist-sarabu';

    for (const cust of retailCustomers) {
      const inr = parseNum(cp.getCell(r, cust.col).value, 0);
      if (inr <= 0) continue;

      let custRate = parseNum(cp.getCell(r, cust.col + 38).value, 0);
      if (custRate <= 0) custRate = baseRate >= 30 ? baseRate : roundTo(1000 / baseRate, 2);

      const custConv = custRate >= 30 ? 'AED_PER_1000' : 'INR_PER_AED';
      const baseConv = baseRate >= 30 ? 'AED_PER_1000' : 'INR_PER_AED';

      const aed = roundTo(custConv === 'AED_PER_1000' ? (inr * custRate) / 1000 : inr / custRate, 3);
      const cost = roundTo(baseConv === 'AED_PER_1000' ? (inr * baseRate) / 1000 : inr / baseRate, 3);
      const profit = roundTo(aed - cost, 3);

      seqTxn++;
      const txnId = `txn-${dateStr}-${cust.code.toLowerCase()}-${seqTxn}`;
      const splitId = `split-${dateStr}-${cust.code.toLowerCase()}-${seqTxn}`;

      txnsToInsert.push({
        id: txnId,
        transaction_number: `TXN-2026-${seqTxn}`,
        transaction_date: dateStr,
        customer_id: cust.id,
        inr_amount: inr,
        customer_rate: custRate,
        customer_rate_convention: custConv,
        aed_amount: aed,
        base_rate: baseRate,
        base_rate_convention: baseConv,
        cost_aed: cost,
        gross_profit_aed: profit,
        delivery_charge_pct: 0,
        delivery_charge_aed: 0,
        net_profit_aed: profit,
        distributor_id: dayDistId,
        status: 'CONFIRMED',
        notes: `Imported from Excel Row ${r}`,
        is_demo: false,
      });

      splitsToInsert.push({
        id: splitId,
        transaction_id: txnId,
        distributor_id: dayDistId,
        split_date: dateStr,
        inr_amount: inr,
        wholesale_rate: baseRate,
        aed_equivalent: cost,
        paid_amount_inr: 0,
        balance_inr: inr,
        status: 'ALLOCATED',
        notes: null,
        is_demo: false,
      });
    }
  }

  console.log(`✓ Prepared ${txnsToInsert.length} transactions and ${splitsToInsert.length} distribution splits.\n`);

  // Step 5: Parse RECEIVABLES & BALANCE (Payments)
  console.log('Step 5: Parsing RECEIVABLES & BALANCE (Payments)...');
  const pmtsToInsert = [...openingPmts];

  for (let r = 5; r <= rb.rowCount; r++) {
    const dateStr = parseDate(rb.getCell(r, 1).value);
    if (!dateStr) continue;

    for (const cust of retailCustomers) {
      const paid = parseNum(rb.getCell(r, cust.col).value, 0);
      if (paid <= 0) continue;

      seqPmt++;
      const pmtId = `pmt-${dateStr}-${cust.code.toLowerCase()}-${seqPmt}`;

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

  // Step 6: Parse BANK DISTRIP (MK & SALA)
  console.log('Step 6: Parsing BANK DISTRIP (MK & SALA records)...');
  const bdRecordsToInsert = [];
  let seqBdr = 100000;

  for (let r = 4; r <= bd.rowCount; r++) {
    // MK (cols 1 to 5)
    const mkDate = parseDate(bd.getCell(r, 1).value);
    if (mkDate) {
      const ord = parseNum(bd.getCell(r, 2).value, 0);
      const com = parseNum(bd.getCell(r, 3).value, 0);
      const paid = parseNum(bd.getCell(r, 4).value, 0);
      if (ord !== 0 || com !== 0 || paid !== 0) {
        seqBdr++;
        bdRecordsToInsert.push({
          id: `bdr-mk-${mkDate}-${seqBdr}`,
          record_date: mkDate,
          account_id: 'dist-mk',
          order_inr: ord,
          commission_inr: com,
          paid_inr: paid,
          balance_inr: 0,
          notes: `Bank Distrip MK Row ${r}`,
        });
      }
    }

    // SALA (cols 7 to 11)
    const salaDate = parseDate(bd.getCell(r, 7).value);
    if (salaDate) {
      const ord = parseNum(bd.getCell(r, 8).value, 0);
      const com = parseNum(bd.getCell(r, 9).value, 0);
      const paid = parseNum(bd.getCell(r, 10).value, 0);
      if (ord !== 0 || com !== 0 || paid !== 0) {
        seqBdr++;
        bdRecordsToInsert.push({
          id: `bdr-sala-${salaDate}-${seqBdr}`,
          record_date: salaDate,
          account_id: 'dist-sala',
          order_inr: ord,
          commission_inr: com,
          paid_inr: paid,
          balance_inr: 0,
          notes: `Bank Distrip SALA Row ${r}`,
        });
      }
    }
  }

  // Compute running balance for MK
  let mkBal = 0;
  for (const r of bdRecordsToInsert.filter(x => x.account_id === 'dist-mk')) {
    mkBal = roundTo(mkBal + r.order_inr + r.commission_inr - r.paid_inr, 2);
    r.balance_inr = mkBal;
  }

  // Compute running balance for SALA
  let salaBal = 0;
  for (const r of bdRecordsToInsert.filter(x => x.account_id === 'dist-sala')) {
    salaBal = roundTo(salaBal + r.order_inr + r.commission_inr - r.paid_inr, 2);
    r.balance_inr = salaBal;
  }

  console.log(`✓ Prepared ${bdRecordsToInsert.length} bank distrip records (MK: final bal = ₹${mkBal.toLocaleString()}, SALA: final bal = ₹${salaBal.toLocaleString()}).\n`);

  // Step 7: Parse INDIA DISTRIBUTION (Wholesale Parties: HAJA, NF2, SARAB)
  console.log('Step 7: Parsing INDIA DISTRIBUTION (Wholesale Settlements for HAJA, NF2, SARAB)...');
  const partyTxnsToInsert = [];
  const partyPmtsToInsert = [];

  for (let r = 4; r <= id.rowCount; r++) {
    // Date: Cell 1 formula is 'COLLECTION & PROFIT'!A${r - 3}
    let dateStr = parseDate(id.getCell(r, 1).value);
    if (!dateStr) {
      // Lookup from CP
      const cpDateVal = cp.getCell(r - 2, 1).value;
      dateStr = parseDate(cpDateVal);
    }
    if (!dateStr) dateStr = '2026-05-01';

    // NF2
    const nf2Inr = parseNum(id.getCell(r, 6).value, 0);
    let nf2Rate = parseNum(id.getCell(r, 17).value, 24.8);
    if (nf2Rate <= 0) nf2Rate = 24.8;
    const nf2Aed = parseNum(id.getCell(r, 18).value, 0) || (nf2Rate > 0 ? roundTo(nf2Inr / nf2Rate, 3) : 0);
    const nf2Paid = parseNum(id.getCell(r, 19).value, 0);

    if (nf2Inr > 0) {
      seqTxn++;
      partyTxnsToInsert.push({
        id: `txn-party-nf2-${dateStr}-${seqTxn}`,
        transaction_number: `TXN-2026-${seqTxn}`,
        transaction_date: dateStr,
        customer_id: 'party-nf2',
        inr_amount: nf2Inr,
        customer_rate: nf2Rate,
        customer_rate_convention: 'INR_PER_AED',
        aed_amount: nf2Aed,
        base_rate: nf2Rate,
        base_rate_convention: 'INR_PER_AED',
        cost_aed: nf2Aed,
        gross_profit_aed: 0,
        delivery_charge_pct: 0,
        delivery_charge_aed: 0,
        net_profit_aed: 0,
        distributor_id: 'dist-nf2',
        status: 'CONFIRMED',
        notes: `Wholesale distribution to NF2 (India Dist Row ${r})`,
        is_demo: false,
      });
    }
    if (nf2Paid > 0) {
      seqPmt++;
      partyPmtsToInsert.push({
        id: `pmt-party-nf2-${dateStr}-${seqPmt}`,
        payment_number: `PMT-2026-${seqPmt}`,
        payment_date: dateStr,
        customer_id: 'party-nf2',
        transaction_id: null,
        amount_aed: nf2Paid,
        payment_method: 'CASH',
        reference_number: `ID-R${r}`,
        notes: `Wholesale payment received from NF2 (India Dist Row ${r})`,
        is_demo: false,
      });
    }

    // HAJA
    const hajaInr = parseNum(id.getCell(r, 7).value, 0);
    let hajaRate = parseNum(id.getCell(r, 22).value, 26.11);
    if (hajaRate <= 0) hajaRate = 26.11;
    const hajaAed = parseNum(id.getCell(r, 23).value, 0) || (hajaRate > 0 ? roundTo(hajaInr / hajaRate, 3) : 0);
    const hajaPaid = parseNum(id.getCell(r, 24).value, 0);

    if (hajaInr > 0) {
      seqTxn++;
      partyTxnsToInsert.push({
        id: `txn-party-haja-${dateStr}-${seqTxn}`,
        transaction_number: `TXN-2026-${seqTxn}`,
        transaction_date: dateStr,
        customer_id: 'party-haja',
        inr_amount: hajaInr,
        customer_rate: hajaRate,
        customer_rate_convention: 'INR_PER_AED',
        aed_amount: hajaAed,
        base_rate: hajaRate,
        base_rate_convention: 'INR_PER_AED',
        cost_aed: hajaAed,
        gross_profit_aed: 0,
        delivery_charge_pct: 0,
        delivery_charge_aed: 0,
        net_profit_aed: 0,
        distributor_id: 'dist-haja',
        status: 'CONFIRMED',
        notes: `Wholesale distribution to HAJA (India Dist Row ${r})`,
        is_demo: false,
      });
    }
    if (hajaPaid > 0) {
      seqPmt++;
      partyPmtsToInsert.push({
        id: `pmt-party-haja-${dateStr}-${seqPmt}`,
        payment_number: `PMT-2026-${seqPmt}`,
        payment_date: dateStr,
        customer_id: 'party-haja',
        transaction_id: null,
        amount_aed: hajaPaid,
        payment_method: 'CASH',
        reference_number: `ID-R${r}`,
        notes: `Wholesale payment received from HAJA (India Dist Row ${r})`,
        is_demo: false,
      });
    }

    // SARAB
    const sarabInr = parseNum(id.getCell(r, 8).value, 0);
    let sarabRate = parseNum(id.getCell(r, 27).value, 26.11);
    if (sarabRate <= 0) sarabRate = 26.11;
    const sarabAed = parseNum(id.getCell(r, 28).value, 0) || (sarabRate > 0 ? roundTo(sarabInr / sarabRate, 3) : 0);
    const sarabPaid = parseNum(id.getCell(r, 29).value, 0);

    if (sarabInr > 0) {
      seqTxn++;
      partyTxnsToInsert.push({
        id: `txn-party-sarab-${dateStr}-${seqTxn}`,
        transaction_number: `TXN-2026-${seqTxn}`,
        transaction_date: dateStr,
        customer_id: 'party-sarabu',
        inr_amount: sarabInr,
        customer_rate: sarabRate,
        customer_rate_convention: 'INR_PER_AED',
        aed_amount: sarabAed,
        base_rate: sarabRate,
        base_rate_convention: 'INR_PER_AED',
        cost_aed: sarabAed,
        gross_profit_aed: 0,
        delivery_charge_pct: 0,
        delivery_charge_aed: 0,
        net_profit_aed: 0,
        distributor_id: 'dist-sarabu',
        status: 'CONFIRMED',
        notes: `Wholesale distribution to SARAB (India Dist Row ${r})`,
        is_demo: false,
      });
    }
    if (sarabPaid > 0) {
      seqPmt++;
      partyPmtsToInsert.push({
        id: `pmt-party-sarab-${dateStr}-${seqPmt}`,
        payment_number: `PMT-2026-${seqPmt}`,
        payment_date: dateStr,
        customer_id: 'party-sarabu',
        transaction_id: null,
        amount_aed: sarabPaid,
        payment_method: 'CASH',
        reference_number: `ID-R${r}`,
        notes: `Wholesale payment received from SARAB (India Dist Row ${r})`,
        is_demo: false,
      });
    }
  }

  console.log(`✓ Prepared ${partyTxnsToInsert.length} wholesale party transfers and ${partyPmtsToInsert.length} wholesale payments.\n`);

  // Step 8: Execute Database Batch Inserts
  console.log('Step 8: Executing Database Batch Inserts...');

  // Combine transactions and payments
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

  console.log('\n--- Inserting Customer & Party Payments ---');
  await batchInsert('customer_payments', pmtColumns, allPmts, 80);

  console.log('\n--- Inserting Bank Distrip Records ---');
  await batchInsert('bank_distrip_records', bdrColumns, bdRecordsToInsert, 80);

  console.log('\n================================================================');
  console.log('            DATABASE IMPORT COMPLETED SUCCESSFULLY!             ');
  console.log('================================================================\n');

  // Step 9: Verification Queries
  console.log('Step 9: Database Record Verification:');
  const countCust = await query('SELECT COUNT(*) FROM customers');
  const countTxn = await query('SELECT COUNT(*) FROM transactions');
  const countSplits = await query('SELECT COUNT(*) FROM distribution_splits');
  const countPmts = await query('SELECT COUNT(*) FROM customer_payments');
  const countBdr = await query('SELECT COUNT(*) FROM bank_distrip_records');
  const countDist = await query('SELECT COUNT(*) FROM distributors');

  console.log(`- Customers:              ${countCust[0].count} (5 parties + 29 retail)`);
  console.log(`- Distributors:           ${countDist[0].count} (5 master parties)`);
  console.log(`- Transactions:           ${countTxn[0].count}`);
  console.log(`- Distribution Splits:    ${countSplits[0].count}`);
  console.log(`- Customer Payments:      ${countPmts[0].count}`);
  console.log(`- Bank Distrip Records:   ${countBdr[0].count}`);
}

main().then(() => {
  console.log('\nAll done.');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Import Error:', err);
  process.exit(1);
});
