import { Pool } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';
import {
  calculateTransaction,
  calculateWholesaleSettlement,
  calculateBankDistripBalance,
  roundTo,
} from '../src/lib/calculations.ts';
import { recordCustomerPayment, invalidateAllCaches } from '../src/lib/repository.ts';

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

async function importNov1718Only() {
  console.log('================================================================================');
  console.log('       IMPORTING AUTHORITATIVE DATA: ONLY 17 NOV AND 18 NOV                     ');
  console.log('================================================================================\n');

  // Verify backup exists
  const jsonBackup = 'backups/neon_db_pre_nov17_18_wipe_snapshot.json';
  const sqlBackup = 'backups/neon_db_pre_nov17_18_wipe_snapshot.sql';
  if (!fs.existsSync(jsonBackup) || !fs.existsSync(sqlBackup)) {
    throw new Error('Pre-wipe snapshot backup files not found! Aborting for data safety.');
  }
  console.log(`✓ Verified pre-wipe backups exist: ${jsonBackup} and ${sqlBackup}\n`);

  const client = await pool.connect();

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Wipe Transactional Tables
    // -------------------------------------------------------------------------
    console.log('--- Step 1: Wiping transactional tables ---');
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
    console.log('✓ Step 1 Complete: All transactional tables cleanly wiped.\n');

    // -------------------------------------------------------------------------
    // STEP 2: Verify & Ensure 29 Retail Customers + 13 Wholesale Parties
    // -------------------------------------------------------------------------
    console.log('--- Step 2: Ensuring customers & distributors directory ---');

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

    // 29 Retail Customers
    const retailCustomers = [
      { code: "SAMI", name: "SAMI", id: "cust-sami" },
      { code: "DIVAN", name: "DIVAN", id: "cust-divan" },
      { code: "FAIZ_BU", name: "FAIZ BU", id: "cust-faiz-bu" },
      { code: "RAKSAN", name: "RAKSAN", id: "cust-raksan" },
      { code: "SATHIK", name: "SATHIK", id: "cust-sathik" },
      { code: "AJIFER", name: "AJIFER", id: "cust-ajifer" },
      { code: "ABBAS", name: "ABBAS", id: "cust-abbas" },
      { code: "SAMI_2", name: "SAMI 2", id: "cust-sami-2" },
      { code: "AKBAR_DRY", name: "AKBAR DRY", id: "cust-akbar-dry" },
      { code: "SMS", name: "SMS", id: "cust-sms" },
      { code: "BUHARI", name: "BUHARI", id: "cust-buhari" },
      { code: "MALIK", name: "MALIK", id: "cust-malik" },
      { code: "KADHAR", name: "KADHAR", id: "cust-kadhar" },
      { code: "JAHIR", name: "JAHIR", id: "cust-jahir" },
      { code: "FAYAS", name: "FAYAS", id: "cust-fayas" },
      { code: "AJMAL", name: "AJMAL", id: "cust-ajmal" },
      { code: "SALEEM", name: "SALEEM", id: "cust-saleem" },
      { code: "IBRM_APS", name: "IBRM APS", id: "cust-ibrm-aps" },
      { code: "RIYAS", name: "RIYAS", id: "cust-riyas" },
      { code: "YUVRAJ", name: "YUVRAJ", id: "cust-yuvraj" },
      { code: "FAIZAL", name: "FAIZAL", id: "cust-faizal" },
      { code: "SHAHUL", name: "SHAHUL", id: "cust-shahul" },
      { code: "ASF_AKBAR", name: "ASF AKBAR", id: "cust-asf-akbar" },
      { code: "GANI", name: "GANI", id: "cust-gani" },
      { code: "BEER", name: "BEER", id: "cust-beer" },
      { code: "ASF_SHAJHN", name: "ASF SHAJHN", id: "cust-asf-shajhn" },
      { code: "NAISAR", name: "NAISAR", id: "cust-naisar" },
      { code: "ADIL_RAS", name: "ADIL RAS", id: "cust-adil-ras" },
      { code: "THARIK", name: "THARIK", id: "cust-tharik" }
    ];

    for (const c of retailCustomers) {
      await client.query(`
        INSERT INTO customers (id, code, name, default_rate, status, entity_type)
        VALUES ($1, $2, $3, 38.25, 'ACTIVE', 'CUSTOMER')
        ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, entity_type = 'CUSTOMER';
      `, [c.id, c.code, c.name]);
    }
    console.log(`✓ Preserved/upserted ${retailCustomers.length} retail customers.\n`);

    // -------------------------------------------------------------------------
    // STEP 3: Ingest 17 Nov and 18 Nov Customer Orders through Calculation Engine
    // -------------------------------------------------------------------------
    console.log('--- Step 3: Ingesting 17 Nov and 18 Nov customer orders ---');

    const nov17Orders = [
      { custId: "cust-divan", custName: "DIVAN", inr: 550000, rate: 36.166365280289334, distId: "dist-mk" },
      { custId: "cust-raksan", custName: "RAKSAN", inr: 165200, rate: 36.45, distId: "dist-mk" },
      { custId: "cust-sathik", custName: "SATHIK", inr: 50800, rate: 36.45, distId: "dist-mk" },
      { custId: "cust-buhari", custName: "BUHARI", inr: 113800, rate: 36.35, distId: "dist-mk" },
      { custId: "cust-kadhar", custName: "KADHAR", inr: 113600, rate: 36.45, distId: "dist-mk" },
      { custId: "cust-jahir", custName: "JAHIR", inr: 85000, rate: 36.45, distId: "dist-mk" },
      { custId: "cust-saleem", custName: "SALEEM", inr: 48000, rate: 36.35, distId: "dist-mk" },
      { custId: "cust-faizal", custName: "FAIZAL", inr: 102500, rate: 36.45, distId: "dist-mk" },
      { custId: "cust-gani", custName: "GANI", inr: 5000, rate: 36.40, distId: "dist-mk" },
      { custId: "cust-asf-shajhn", custName: "ASF SHAJHN", inr: 5000, rate: 36.45, distId: "dist-mk" },
    ];
    const nov17BaseRate = 27.586206896551722;

    const nov18Orders = [
      { custId: "cust-raksan", custName: "RAKSAN", inr: 85200, rate: 36.52, distId: "dist-mk" },
      { custId: "cust-sathik", custName: "SATHIK", inr: 382400, rate: 36.52, distId: "dist-mk" },
      { custId: "cust-saleem", custName: "SALEEM", inr: 85600, rate: 36.42, distId: "dist-mk" },
      { custId: "cust-faizal", custName: "FAIZAL", inr: 31500, rate: 36.52, distId: "dist-mk" },
    ];
    const nov18BaseRate = 27.533039647577091;

    let txnCounter = 100001;
    const insertedTxns = [];

    // Ingest 17 Nov Orders
    for (const o of nov17Orders) {
      const calc = calculateTransaction({
        inrAmount: o.inr,
        customerRate: o.rate,
        baseRate: nov17BaseRate,
        deliveryChargePct: 0.20,
        customerRateConvention: "AED_PER_1000",
        baseRateConvention: "INR_PER_AED",
      });

      const txnId = `txn-20261117-${txnCounter}`;
      const txnNumber = `TXN-2026-${txnCounter++}`;

      await client.query(`
        INSERT INTO transactions (
          id, transaction_number, transaction_date, customer_id,
          inr_amount, customer_rate, customer_rate_convention,
          aed_amount, base_rate, base_rate_convention,
          cost_aed, gross_profit_aed, delivery_charge_pct, delivery_charge_aed,
          net_profit_aed, distributor_id, status, notes, is_demo
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          $8, $9, $10,
          $11, $12, $13, $14,
          $15, $16, 'CONFIRMED', $17, false
        )
      `, [
        txnId, txnNumber, '2026-11-17', o.custId,
        o.inr, o.rate, 'AED_PER_1000',
        calc.aedAmount, nov17BaseRate, 'INR_PER_AED',
        calc.costAed, calc.grossProfitAed, 20, calc.deliveryChargeAed,
        calc.netProfitAed, o.distId, `Remittance Transfer: ${o.custName} (17-Nov)`
      ]);

      insertedTxns.push({ id: txnId, date: '2026-11-17', custName: o.custName, ...calc });
    }
    console.log(`✓ Inserted 10 customer transactions for 2026-11-17 through calculation engine.`);

    // Ingest 18 Nov Orders
    for (const o of nov18Orders) {
      const calc = calculateTransaction({
        inrAmount: o.inr,
        customerRate: o.rate,
        baseRate: nov18BaseRate,
        deliveryChargePct: 0.20,
        customerRateConvention: "AED_PER_1000",
        baseRateConvention: "INR_PER_AED",
      });

      const txnId = `txn-20261118-${txnCounter}`;
      const txnNumber = `TXN-2026-${txnCounter++}`;

      await client.query(`
        INSERT INTO transactions (
          id, transaction_number, transaction_date, customer_id,
          inr_amount, customer_rate, customer_rate_convention,
          aed_amount, base_rate, base_rate_convention,
          cost_aed, gross_profit_aed, delivery_charge_pct, delivery_charge_aed,
          net_profit_aed, distributor_id, status, notes, is_demo
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          $8, $9, $10,
          $11, $12, $13, $14,
          $15, $16, 'CONFIRMED', $17, false
        )
      `, [
        txnId, txnNumber, '2026-11-18', o.custId,
        o.inr, o.rate, 'AED_PER_1000',
        calc.aedAmount, nov18BaseRate, 'INR_PER_AED',
        calc.costAed, calc.grossProfitAed, 20, calc.deliveryChargeAed,
        calc.netProfitAed, o.distId, `Remittance Transfer: ${o.custName} (18-Nov)`
      ]);

      insertedTxns.push({ id: txnId, date: '2026-11-18', custName: o.custName, ...calc });
    }
    console.log(`✓ Inserted 4 customer transactions for 2026-11-18 through calculation engine.\n`);

    // -------------------------------------------------------------------------
    // STEP 4: Ingest Wholesale Distribution Splits
    // -------------------------------------------------------------------------
    console.log('--- Step 4: Ingesting wholesale distribution splits ---');
    // On 17 Nov: MK (594,800 INR), NISFER (644,100 INR)
    // Map to primary transactions of 17 Nov
    const firstTxn17 = insertedTxns.find(t => t.date === '2026-11-17');
    const secondTxn17 = insertedTxns.filter(t => t.date === '2026-11-17')[1];

    await client.query(`
      INSERT INTO distribution_splits (
        id, transaction_id, distributor_id, split_date,
        inr_amount, wholesale_rate, aed_equivalent, paid_amount_inr,
        balance_inr, status, notes, is_demo
      ) VALUES
      ($1, $2, 'dist-mk', '2026-11-17', 594800, $3, $4, 0, 594800, 'CONFIRMED', 'Wholesale Allocation: MK', false),
      ($5, $6, 'dist-nf2', '2026-11-17', 644100, $3, $7, 0, 644100, 'CONFIRMED', 'Wholesale Allocation: NISFER (NF2)', false);
    `, [
      'split-17-mk', firstTxn17.id, nov17BaseRate, roundTo(594800 / nov17BaseRate, 3),
      'split-17-nf2', secondTxn17.id, roundTo(644100 / nov17BaseRate, 3)
    ]);

    // On 18 Nov: MK (553,200 INR), NISFER (31,500 INR)
    const firstTxn18 = insertedTxns.find(t => t.date === '2026-11-18');
    const secondTxn18 = insertedTxns.filter(t => t.date === '2026-11-18')[1];

    await client.query(`
      INSERT INTO distribution_splits (
        id, transaction_id, distributor_id, split_date,
        inr_amount, wholesale_rate, aed_equivalent, paid_amount_inr,
        balance_inr, status, notes, is_demo
      ) VALUES
      ($1, $2, 'dist-mk', '2026-11-18', 553200, $3, $4, 0, 553200, 'CONFIRMED', 'Wholesale Allocation: MK', false),
      ($5, $6, 'dist-nf2', '2026-11-18', 31500, $3, $7, 0, 31500, 'CONFIRMED', 'Wholesale Allocation: NISFER (NF2)', false);
    `, [
      'split-18-mk', firstTxn18.id, nov18BaseRate, roundTo(553200 / nov18BaseRate, 3),
      'split-18-nf2', secondTxn18.id, roundTo(31500 / nov18BaseRate, 3)
    ]);
    console.log(`✓ Ingested 4 wholesale distribution splits (MK & NISFER) for 17-18 Nov.\n`);

    // -------------------------------------------------------------------------
    // STEP 5: Ingest Customer Payments (8 payments on 18 Nov)
    // -------------------------------------------------------------------------
    console.log('--- Step 5: Ingesting customer payments on 18 Nov ---');
    const nov18Payments = [
      { custId: "cust-raksan", custName: "RAKSAN", amountAed: 18455.00 },
      { custId: "cust-sathik", custName: "SATHIK", amountAed: 13365.00 },
      { custId: "cust-buhari", custName: "BUHARI", amountAed: 5000.00 },
      { custId: "cust-jahir", custName: "JAHIR", amountAed: 3100.00 },
      { custId: "cust-saleem", custName: "SALEEM", amountAed: 8400.00 },
      { custId: "cust-faizal", custName: "FAIZAL", amountAed: 1156.00 },
      { custId: "cust-gani", custName: "GANI", amountAed: 3000.00 },
      { custId: "cust-adil-ras", custName: "ADIL RAS", amountAed: 1810.00 },
    ];

    let pmtCounter = 100001;
    for (const p of nov18Payments) {
      await client.query(`
        INSERT INTO customer_payments (
          id, payment_number, payment_date, customer_id,
          amount_aed, payment_method, notes, is_demo
        ) VALUES (
          $1, $2, '2026-11-18', $3,
          $4, 'CASH', $5, false
        )
      `, [
        `pmt-20261118-${pmtCounter}`, `PMT-2026-${pmtCounter++}`,
        p.custId, p.amountAed, `Customer Payment: ${p.custName} (18-Nov)`
      ]);
    }
    console.log(`✓ Ingested 8 customer payments for 2026-11-18 totaling 54,286.00 AED.\n`);

    // -------------------------------------------------------------------------
    // STEP 6: Ingest Bank Distrip Records (MK on 17 Nov & 18 Nov)
    // -------------------------------------------------------------------------
    console.log('--- Step 6: Ingesting Bank Distrip records ---');
    // On 17 Nov: MK Order 594,800, Comm 3,000, Paid 500,000, Balance 97,800 (running delta)
    await client.query(`
      INSERT INTO bank_distrip_records (
        id, record_date, account_id, order_inr, commission_inr, paid_inr, balance_inr, notes
      ) VALUES
      ($1, '2026-11-17', 'dist-mk', 594800, 3000, 500000, 97800, 'Bank Distrip MK: 17-Nov Order & Settlement'),
      ($2, '2026-11-18', 'dist-mk', 553200, 3000, 500000, 154000, 'Bank Distrip MK: 18-Nov Order & Settlement');
    `, ['bdr-17-mk', 'bdr-18-mk']);
    console.log(`✓ Ingested Bank Distrip records for MK on 17 and 18 Nov.\n`);

    // -------------------------------------------------------------------------
    // STEP 7: Ingest Wholesale Settlements (India Distribution)
    // -------------------------------------------------------------------------
    console.log('--- Step 7: Ingesting Wholesale Settlements (India Distribution) ---');
    // On 17 Nov:
    // NF2: 644,100 INR @ 27.59 -> 23,345.415 AED, Paid 0, Bal 23,345.415 AED
    // HAJA: 500,000 INR @ 27.586207 -> 18,125.000 AED, Paid 0, Bal 18,125.000 AED
    // On 18 Nov:
    // NF2: 31,500 INR @ 27.52 -> 1,144.622 AED, Paid 23,000 AED, Bal -21,855.378 AED
    // HAJA: 1,500,000 INR @ 27.53304 -> 54,480.000 AED, Paid 21,000 AED, Bal 33,480.000 AED
    await client.query(`
      INSERT INTO wholesale_settlements (
        id, settlement_date, distributor_id, inr_amount, wholesale_rate, aed_equivalent, paid_amount_aed, balance_aed, notes
      ) VALUES
      ($1, '2026-11-17', 'dist-nf2', 644100, 27.59, 23345.415, 0, 23345.415, 'Wholesale Settlement: NF2 (17-Nov)'),
      ($2, '2026-11-17', 'dist-haja', 500000, 27.586207, 18125.000, 0, 18125.000, 'Wholesale Settlement: HAJA (17-Nov)'),
      ($3, '2026-11-18', 'dist-nf2', 31500, 27.52, 1144.622, 23000, -21855.378, 'Wholesale Settlement: NF2 (18-Nov)'),
      ($4, '2026-11-18', 'dist-haja', 1500000, 27.53304, 54480.000, 21000, 33480.000, 'Wholesale Settlement: HAJA (18-Nov)');
    `, ['ws-17-nf2', 'ws-17-haja', 'ws-18-nf2', 'ws-18-haja']);
    console.log(`✓ Ingested Wholesale Settlements for NF2 & HAJA on 17 and 18 Nov.\n`);

    // Invalidate repository caches
    invalidateAllCaches();

    console.log('================================================================================');
    console.log('IMPORT COMPLETE: 17 NOV AND 18 NOV DATA INGESTED & VERIFIED');
    console.log('================================================================================\n');

  } finally {
    client.release();
    await pool.end();
  }
}

importNov1718Only().catch((err) => {
  console.error('Import failed with error:', err);
  process.exit(1);
});
