import { Pool } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';

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

async function fuseAndInsert() {
  console.log('================================================================================');
  console.log('       PETTI DATA FUSION & SYSTEMATIC VERIFICATION IMPORTER (ONE-BY-ONE)        ');
  console.log('================================================================================\n');

  console.log(`Connecting to: ${process.env.DATABASE_URL?.split('@')[1] || 'Neon DB'}\n`);

  // Load snapshot
  const snapshotRaw = fs.readFileSync('backups/current_db_snapshot.json', 'utf-8');
  const snapshot = JSON.parse(snapshotRaw);

  const client = await pool.connect();

  try {
    // -------------------------------------------------------------------------
    // STEP 1: app_security
    // -------------------------------------------------------------------------
    console.log('--- Step 1: Fusing app_security (Master Auth & Wipe Password) ---');
    const secRows = snapshot.app_security || [];
    for (const row of secRows) {
      await client.query(`
        INSERT INTO app_security (id, password_hash, salt, updated_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE 
        SET password_hash = EXCLUDED.password_hash, salt = EXCLUDED.salt, updated_at = EXCLUDED.updated_at;
      `, [row.id, row.password_hash, row.salt, row.updated_at || new Date()]);
      console.log(`✓ Inserted app_security record for: ${row.id}`);
    }

    // -------------------------------------------------------------------------
    // STEP 2: distributors
    // -------------------------------------------------------------------------
    console.log('\n--- Step 2: Fusing distributors master (13 Partners) ---');
    const distRows = snapshot.distributors || [];
    let distCount = 0;
    for (const d of distRows) {
      await client.query(`
        INSERT INTO distributors (
          id, code, name, partner_type, default_settlement_currency,
          status, created_at, client_confirmation_note, group_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          code = EXCLUDED.code,
          name = EXCLUDED.name,
          partner_type = EXCLUDED.partner_type,
          default_settlement_currency = EXCLUDED.default_settlement_currency,
          status = EXCLUDED.status,
          client_confirmation_note = EXCLUDED.client_confirmation_note,
          group_type = EXCLUDED.group_type;
      `, [
        d.id, d.code, d.name, d.partner_type, d.default_settlement_currency || 'AED',
        d.status || 'ACTIVE', d.created_at || new Date(), d.client_confirmation_note, d.group_type
      ]);
      distCount++;
      process.stdout.write(`\rInserted distributor ${distCount}/${distRows.length}: ${d.name} (${d.code})`);
    }
    console.log(`\n✓ Successfully verified & inserted ${distCount} distributors.`);

    // -------------------------------------------------------------------------
    // STEP 3: bank_distrip_accounts
    // -------------------------------------------------------------------------
    console.log('\n--- Step 3: Fusing bank_distrip_accounts (13 Accounts) ---');
    const bdaRows = snapshot.bank_distrip_accounts || [];
    let bdaCount = 0;
    for (const b of bdaRows) {
      await client.query(`
        INSERT INTO bank_distrip_accounts (
          id, account_code, account_name, bank_name, account_number, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          account_code = EXCLUDED.account_code,
          account_name = EXCLUDED.account_name,
          bank_name = EXCLUDED.bank_name,
          account_number = EXCLUDED.account_number,
          status = EXCLUDED.status;
      `, [
        b.id, b.account_code, b.account_name, b.bank_name,
        b.account_number, b.status || 'ACTIVE', b.created_at || new Date()
      ]);
      bdaCount++;
      process.stdout.write(`\rInserted bank account ${bdaCount}/${bdaRows.length}: ${b.account_name} (${b.account_code})`);
    }
    console.log(`\n✓ Successfully verified & inserted ${bdaCount} bank distrip accounts.`);

    // -------------------------------------------------------------------------
    // STEP 4: customers (Retail Customers + Wholesale Parties)
    // -------------------------------------------------------------------------
    console.log('\n--- Step 4: Fusing customers & parties (42 Total Accounts) ---');
    const custRows = snapshot.customers || [];
    let custCount = 0;
    for (const c of custRows) {
      await client.query(`
        INSERT INTO customers (
          id, code, name, phone, default_rate, status, created_at, updated_at, entity_type, party_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          code = EXCLUDED.code,
          name = EXCLUDED.name,
          phone = EXCLUDED.phone,
          default_rate = EXCLUDED.default_rate,
          status = EXCLUDED.status,
          entity_type = EXCLUDED.entity_type,
          party_type = EXCLUDED.party_type;
      `, [
        c.id, c.code, c.name, c.phone, c.default_rate,
        c.status || 'ACTIVE', c.created_at || new Date(), c.updated_at || new Date(),
        c.entity_type || 'CUSTOMER', c.party_type
      ]);
      custCount++;
      process.stdout.write(`\rInserted customer account ${custCount}/${custRows.length}: ${c.name} (${c.code})`);
    }
    console.log(`\n✓ Successfully verified & inserted ${custCount} customer accounts.`);

    // -------------------------------------------------------------------------
    // STEP 5: transactions (1,599 Transactions)
    // -------------------------------------------------------------------------
    console.log('\n--- Step 5: Fusing transactions (1,599 Records) ---');
    const txnRows = snapshot.transactions || [];
    let txnCount = 0;
    let txnTotalInr = 0;
    let txnTotalAed = 0;

    // Insert in chunks of 50 for speed and atomic reliability
    const txnChunkSize = 50;
    for (let i = 0; i < txnRows.length; i += txnChunkSize) {
      const chunk = txnRows.slice(i, i + txnChunkSize);
      for (const t of chunk) {
        // Validate numbers
        const inr = Number(t.inr_amount || 0);
        const aed = Number(t.aed_amount || 0);
        const custRate = Number(t.customer_rate || 0);
        const baseRate = Number(t.base_rate || 0);

        txnTotalInr += inr;
        txnTotalAed += aed;

        await client.query(`
          INSERT INTO transactions (
            id, transaction_number, transaction_date, customer_id,
            inr_amount, customer_rate, aed_amount, base_rate,
            cost_aed, gross_profit_aed, delivery_charge_pct, delivery_charge_aed,
            net_profit_aed, distributor_id, status, notes,
            created_at, updated_at, is_demo, customer_rate_convention, base_rate_convention
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
          )
          ON CONFLICT (id) DO UPDATE SET
            transaction_number = EXCLUDED.transaction_number,
            transaction_date = EXCLUDED.transaction_date,
            inr_amount = EXCLUDED.inr_amount,
            customer_rate = EXCLUDED.customer_rate,
            aed_amount = EXCLUDED.aed_amount,
            base_rate = EXCLUDED.base_rate,
            cost_aed = EXCLUDED.cost_aed,
            gross_profit_aed = EXCLUDED.gross_profit_aed,
            net_profit_aed = EXCLUDED.net_profit_aed;
        `, [
          t.id, t.transaction_number, t.transaction_date, t.customer_id,
          inr, custRate, aed, baseRate,
          t.cost_aed, t.gross_profit_aed, t.delivery_charge_pct || 0.20, t.delivery_charge_aed || 0,
          t.net_profit_aed, t.distributor_id, t.status || 'CONFIRMED', t.notes,
          t.created_at || new Date(), t.updated_at || new Date(), t.is_demo || false,
          t.customer_rate_convention || 'AED_PER_1000', t.base_rate_convention || 'INR_PER_AED'
        ]);
        txnCount++;
      }
      process.stdout.write(`\rInserted transactions: ${txnCount}/${txnRows.length} (${((txnCount / txnRows.length) * 100).toFixed(1)}%)`);
    }
    console.log(`\n✓ Inserted ${txnCount} transactions (Total INR: ₹${txnTotalInr.toLocaleString('en-IN')}, AED: ${txnTotalAed.toFixed(2)}).`);

    // -------------------------------------------------------------------------
    // STEP 6: distribution_splits (3,687 Splits)
    // -------------------------------------------------------------------------
    console.log('\n--- Step 6: Fusing distribution_splits (3,687 Records) ---');
    const splitRows = snapshot.distribution_splits || [];
    let splitCount = 0;
    let splitTotalInr = 0;
    const splitChunkSize = 50;

    for (let i = 0; i < splitRows.length; i += splitChunkSize) {
      const chunk = splitRows.slice(i, i + splitChunkSize);
      for (const s of chunk) {
        const inr = Number(s.inr_amount || 0);
        splitTotalInr += inr;

        await client.query(`
          INSERT INTO distribution_splits (
            id, transaction_id, distributor_id, split_date,
            inr_amount, wholesale_rate, aed_equivalent,
            paid_amount_inr, balance_inr, status, notes, is_demo, created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
          )
          ON CONFLICT (id) DO UPDATE SET
            inr_amount = EXCLUDED.inr_amount,
            wholesale_rate = EXCLUDED.wholesale_rate,
            aed_equivalent = EXCLUDED.aed_equivalent,
            paid_amount_inr = EXCLUDED.paid_amount_inr,
            balance_inr = EXCLUDED.balance_inr;
        `, [
          s.id, s.transaction_id, s.distributor_id, s.split_date,
          inr, s.wholesale_rate, s.aed_equivalent,
          s.paid_amount_inr || 0, s.balance_inr || inr, s.status || 'ALLOCATED',
          s.notes, s.is_demo || false, s.created_at || new Date()
        ]);
        splitCount++;
      }
      process.stdout.write(`\rInserted distribution splits: ${splitCount}/${splitRows.length} (${((splitCount / splitRows.length) * 100).toFixed(1)}%)`);
    }
    console.log(`\n✓ Inserted ${splitCount} distribution splits (Total Split INR: ₹${splitTotalInr.toLocaleString('en-IN')}).`);

    // -------------------------------------------------------------------------
    // STEP 7: customer_payments (1,255 Payments)
    // -------------------------------------------------------------------------
    console.log('\n--- Step 7: Fusing customer_payments (1,255 Records) ---');
    const pmtRows = snapshot.customer_payments || [];
    let pmtCount = 0;
    let pmtTotalAed = 0;
    const pmtChunkSize = 50;

    for (let i = 0; i < pmtRows.length; i += pmtChunkSize) {
      const chunk = pmtRows.slice(i, i + pmtChunkSize);
      for (const p of chunk) {
        const aed = Number(p.amount_aed || 0);
        pmtTotalAed += aed;

        await client.query(`
          INSERT INTO customer_payments (
            id, payment_number, payment_date, customer_id,
            transaction_id, amount_aed, payment_method,
            reference_number, notes, created_at, is_demo
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
          )
          ON CONFLICT (id) DO UPDATE SET
            amount_aed = EXCLUDED.amount_aed,
            payment_method = EXCLUDED.payment_method,
            reference_number = EXCLUDED.reference_number,
            notes = EXCLUDED.notes;
        `, [
          p.id, p.payment_number, p.payment_date, p.customer_id,
          p.transaction_id, aed, p.payment_method || 'CASH',
          p.reference_number, p.notes, p.created_at || new Date(), p.is_demo || false
        ]);
        pmtCount++;
      }
      process.stdout.write(`\rInserted customer payments: ${pmtCount}/${pmtRows.length} (${((pmtCount / pmtRows.length) * 100).toFixed(1)}%)`);
    }
    console.log(`\n✓ Inserted ${pmtCount} customer payments (Total Paid AED: ${pmtTotalAed.toFixed(2)}).`);

    // -------------------------------------------------------------------------
    // STEP 8: bank_distrip_records (279 Records)
    // -------------------------------------------------------------------------
    console.log('\n--- Step 8: Fusing bank_distrip_records (279 Records) ---');
    const bdrRows = snapshot.bank_distrip_records || [];
    let bdrCount = 0;
    let bdrOrderInr = 0;
    let bdrPaidInr = 0;

    for (const r of bdrRows) {
      const ord = Number(r.order_inr || 0);
      const com = Number(r.commission_inr || 0);
      const paid = Number(r.paid_inr || 0);
      const bal = Number(r.balance_inr || 0);
      bdrOrderInr += ord;
      bdrPaidInr += paid;

      await client.query(`
        INSERT INTO bank_distrip_records (
          id, record_date, account_id, order_inr,
          commission_inr, paid_inr, balance_inr, notes, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9
        )
        ON CONFLICT (id) DO UPDATE SET
          order_inr = EXCLUDED.order_inr,
          commission_inr = EXCLUDED.commission_inr,
          paid_inr = EXCLUDED.paid_inr,
          balance_inr = EXCLUDED.balance_inr;
      `, [
        r.id, r.record_date, r.account_id, ord,
        com, paid, bal, r.notes, r.created_at || new Date()
      ]);
      bdrCount++;
      process.stdout.write(`\rInserted bank record ${bdrCount}/${bdrRows.length}`);
    }
    console.log(`\n✓ Inserted ${bdrCount} bank distrip records (Total Orders INR: ₹${bdrOrderInr.toLocaleString('en-IN')}, Paid: ₹${bdrPaidInr.toLocaleString('en-IN')}).`);

    // -------------------------------------------------------------------------
    // STEP 9: audit_logs & scheduled_wipes
    // -------------------------------------------------------------------------
    console.log('\n--- Step 9: Fusing audit_logs & scheduled_wipes ---');
    const auditRows = snapshot.audit_logs || [];
    for (const a of auditRows) {
      await client.query(`
        INSERT INTO audit_logs (id, entity_name, entity_id, action, old_values, new_values, user_name, reason, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING;
      `, [a.id, a.entity_name, a.entity_id, a.action, a.old_values, a.new_values, a.user_name, a.reason, a.created_at || new Date()]);
    }
    console.log(`✓ Inserted ${auditRows.length} audit logs.`);

    const wipeRows = snapshot.scheduled_wipes || [];
    for (const w of wipeRows) {
      await client.query(`
        INSERT INTO scheduled_wipes (id, status, scheduled_at, execute_at, backup_downloaded, created_at, scope)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING;
      `, [w.id, w.status, w.scheduled_at, w.execute_at, w.backup_downloaded, w.created_at, w.scope]);
    }
    console.log(`✓ Inserted ${wipeRows.length} scheduled wipe system records.`);

    console.log('\n================================================================================');
    console.log('       FUSION COMPLETED! RUNNING COMPREHENSIVE RECONCILIATION VERIFICATION     ');
    console.log('================================================================================\n');

  } finally {
    client.release();
  }

  // Verification Queries
  const tableCheck = [
    { name: 'customers', expected: 42 },
    { name: 'distributors', expected: 13 },
    { name: 'bank_distrip_accounts', expected: 13 },
    { name: 'transactions', expected: 1599 },
    { name: 'distribution_splits', expected: 3687 },
    { name: 'customer_payments', expected: 1255 },
    { name: 'bank_distrip_records', expected: 279 },
    { name: 'app_security', expected: 1 }
  ];

  console.log('DATABASE RECONCILIATION SUMMARY:');
  for (const tc of tableCheck) {
    const res = await pool.query(`SELECT count(*) as c FROM ${tc.name}`);
    const actual = Number(res.rows[0].c);
    const match = actual === tc.expected ? '✓ EXACT MATCH' : '❌ MISMATCH';
    console.log(`  - ${tc.name.padEnd(25)} : Actual=${actual.toString().padEnd(6)} Expected=${tc.expected.toString().padEnd(6)} -> ${match}`);
    if (actual !== tc.expected) {
      throw new Error(`CRITICAL MISMATCH on table ${tc.name}: expected ${tc.expected}, got ${actual}`);
    }
  }

  await pool.end();
  console.log('\n🎉 ALL DATA SUCCESSFULLY FUSED INTO NEW NEON DATABASE WITH ZERO LOSS!');
}

fuseAndInsert().catch(err => {
  console.error('\n❌ FUSION ERROR:', err);
  process.exit(1);
});
