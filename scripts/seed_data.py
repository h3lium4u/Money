import sqlite3
import openpyxl
import uuid
import datetime
import os

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "remittance.db")
EXCEL_PATH = r"D:\AYYAN JAN.xlsx"

def seed():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    print("--- Initializing Schema ---")
    cur.executescript("""
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      default_rate REAL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS distributors (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      partner_type TEXT NOT NULL,
      default_settlement_currency TEXT NOT NULL DEFAULT 'AED',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      transaction_number TEXT UNIQUE NOT NULL,
      transaction_date TEXT NOT NULL,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      inr_amount REAL NOT NULL,
      customer_rate REAL NOT NULL,
      aed_amount REAL NOT NULL,
      base_rate REAL NOT NULL,
      cost_aed REAL NOT NULL,
      gross_profit_aed REAL NOT NULL,
      delivery_charge_pct REAL NOT NULL DEFAULT 0.20,
      delivery_charge_aed REAL NOT NULL DEFAULT 0.00,
      net_profit_aed REAL NOT NULL,
      distributor_id TEXT REFERENCES distributors(id),
      status TEXT NOT NULL DEFAULT 'CONFIRMED',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customer_payments (
      id TEXT PRIMARY KEY,
      payment_number TEXT UNIQUE NOT NULL,
      payment_date TEXT NOT NULL,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      transaction_id TEXT REFERENCES transactions(id),
      amount_aed REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'CASH',
      reference_number TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wholesale_settlements (
      id TEXT PRIMARY KEY,
      settlement_date TEXT NOT NULL,
      distributor_id TEXT NOT NULL REFERENCES distributors(id),
      inr_amount REAL NOT NULL DEFAULT 0.00,
      wholesale_rate REAL NOT NULL,
      aed_equivalent REAL NOT NULL,
      paid_amount_aed REAL NOT NULL DEFAULT 0.00,
      balance_aed REAL NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bank_distrip_accounts (
      id TEXT PRIMARY KEY,
      account_code TEXT UNIQUE NOT NULL,
      account_name TEXT NOT NULL,
      bank_name TEXT,
      account_number TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bank_distrip_records (
      id TEXT PRIMARY KEY,
      record_date TEXT NOT NULL,
      account_id TEXT NOT NULL REFERENCES bank_distrip_accounts(id),
      order_inr REAL NOT NULL DEFAULT 0.00,
      commission_inr REAL NOT NULL DEFAULT 0.00,
      paid_inr REAL NOT NULL DEFAULT 0.00,
      balance_inr REAL NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      expense_date TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      amount_aed REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      entity_name TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      old_values TEXT,
      new_values TEXT,
      user_name TEXT DEFAULT 'Admin',
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    """)
    conn.commit()

    print("--- Loading Excel Workbook ---")
    wb_val = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
    ws_cp = wb_val['COLLECTION & PROFIT']
    ws_rb = wb_val['RECEIVABLES & BALANCE']
    ws_bd = wb_val['BANK DISTRIP']
    ws_id = wb_val['INDIA DISTRIBUTION']

    # 1. Seed Customers
    print("--- Seeding Customers ---")
    customer_map = {} # col_index -> customer_id
    customer_names = [ws_cp.cell(2, c).value for c in range(2, 31)]
    for idx, c_name in enumerate(customer_names):
        col = 2 + idx
        name = str(c_name).strip()
        code = f"CUST-{idx+1:03d}"
        c_id = str(uuid.uuid4())
        
        cur.execute("SELECT id FROM customers WHERE name = ?", (name,))
        row = cur.fetchone()
        if row:
            customer_map[col] = row[0]
        else:
            cur.execute(
                "INSERT INTO customers (id, code, name, default_rate, status) VALUES (?, ?, ?, ?, 'ACTIVE')",
                (c_id, code, name, 38.25)
            )
            customer_map[col] = c_id

    # 2. Seed Distributors
    print("--- Seeding Distributors ---")
    distributor_map = {} # name -> id
    # Bank Distributors
    bank_dists = [('MK', 'MK Account'), ('SALA', 'SALA Network'), ('USAIN', 'USAIN Bank'), ('NNG', 'NNG Bank'), ('BLACK GRP', 'Black Group Payout')]
    for code, name in bank_dists:
        cur.execute("SELECT id FROM distributors WHERE code = ?", (code,))
        r = cur.fetchone()
        if r:
            distributor_map[code] = r[0]
        else:
            d_id = str(uuid.uuid4())
            cur.execute("INSERT INTO distributors (id, code, name, partner_type) VALUES (?, ?, ?, 'BANK_DISTRIBUTOR')", (d_id, code, name))
            distributor_map[code] = d_id
            
        # Bank Distrip Account
        cur.execute("SELECT id FROM bank_distrip_accounts WHERE account_code = ?", (code,))
        if not cur.fetchone():
            cur.execute("INSERT INTO bank_distrip_accounts (id, account_code, account_name) VALUES (?, ?, ?)", (str(uuid.uuid4()), code, name))

    # Wholesale Partners
    wholesale_dists = [('AWAFI', 'Awafi Trading'), ('NF2', 'NF2 Liquidity'), ('HAJA', 'Haja Exchange'), ('SARABU', 'Sarabu Wholesale'), ('BASID', 'Basid Payouts')]
    for code, name in wholesale_dists:
        cur.execute("SELECT id FROM distributors WHERE code = ?", (code,))
        r = cur.fetchone()
        if r:
            distributor_map[code] = r[0]
        else:
            d_id = str(uuid.uuid4())
            cur.execute("INSERT INTO distributors (id, code, name, partner_type) VALUES (?, ?, ?, 'WHOLESALE_PARTNER')", (d_id, code, name))
            distributor_map[code] = d_id

    conn.commit()

    # 3. Seed Transactions
    print("--- Importing Transactions from COLLECTION & PROFIT ---")
    txn_count = 0
    cur.execute("DELETE FROM transactions")
    for r in range(3, 148):
        dt = ws_cp.cell(r, 1).value
        if not dt:
            continue
        dt_str = dt.strftime('%Y-%m-%d') if hasattr(dt, 'strftime') else str(dt)[:10]
        base_rate_val = ws_cp.cell(r, 100).value or 26.82
        try:
            base_rate = float(base_rate_val)
        except Exception:
            base_rate = 26.82

        for col_idx in range(2, 31):
            bo_val = ws_cp.cell(r, col_idx).value
            if bo_val and float(bo_val) > 0:
                inr = round(float(bo_val), 2)
                rate_val = ws_cp.cell(r, col_idx + 38).value or 38.25
                try:
                    cust_rate = float(rate_val)
                except Exception:
                    cust_rate = 38.25

                aed_val = ws_cp.cell(r, col_idx + 68).value
                prof_val = ws_cp.cell(r, col_idx + 99).value

                # Authoritative arithmetic
                aed_amount = round((inr / 1000.0) * cust_rate, 2)
                cost_aed = round(inr / base_rate if base_rate < 30 else (inr / 1000.0) * base_rate, 2)
                gross_profit = round(aed_amount - cost_aed, 2)
                delivery_pct = 0.20
                delivery_amt = round(gross_profit * delivery_pct, 2)
                net_profit = round(gross_profit - delivery_amt, 2)

                txn_id = str(uuid.uuid4())
                txn_num = f"TXN-2026-{100000 + txn_count}"
                c_id = customer_map[col_idx]

                cur.execute("""
                    INSERT INTO transactions (
                        id, transaction_number, transaction_date, customer_id,
                        inr_amount, customer_rate, aed_amount, base_rate,
                        cost_aed, gross_profit_aed, delivery_charge_pct, delivery_charge_aed,
                        net_profit_aed, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED')
                """, (
                    txn_id, txn_num, dt_str, c_id,
                    inr, cust_rate, aed_amount, base_rate,
                    cost_aed, gross_profit, delivery_pct, delivery_amt,
                    net_profit
                ))
                txn_count += 1

    print(f"Imported {txn_count} transactions.")

    # 4. Seed Customer Payments from RECEIVABLES & BALANCE
    print("--- Importing Customer Payments from RECEIVABLES & BALANCE ---")
    pay_count = 0
    cur.execute("DELETE FROM customer_payments")
    for r in range(5, 148):
        dt = ws_rb.cell(r, 1).value
        if not dt:
            continue
        dt_str = dt.strftime('%Y-%m-%d') if hasattr(dt, 'strftime') else str(dt)[:10]

        for col_idx in range(2, 31):
            rec_val = ws_rb.cell(r, col_idx).value
            if rec_val and float(rec_val) > 0:
                amt = round(float(rec_val), 2)
                c_id = customer_map.get(col_idx)
                if not c_id:
                    continue

                pay_id = str(uuid.uuid4())
                pay_num = f"PAY-2026-{100000 + pay_count}"
                cur.execute("""
                    INSERT INTO customer_payments (
                        id, payment_number, payment_date, customer_id, amount_aed, payment_method
                    ) VALUES (?, ?, ?, ?, ?, 'CASH')
                """, (pay_id, pay_num, dt_str, c_id, amt))
                pay_count += 1

    print(f"Imported {pay_count} customer payments.")

    # 5. Seed Bank Distrip Records
    print("--- Importing Bank Distrip Records ---")
    cur.execute("DELETE FROM bank_distrip_records")
    bd_account_columns = [
        ('MK', 1),
        ('SALA', 7),
        ('USAIN', 13),
        ('BLACK GRP', 25)
    ]
    bd_count = 0
    for code, col_start in bd_account_columns:
        cur.execute("SELECT id FROM bank_distrip_accounts WHERE account_code = ?", (code,))
        acct_row = cur.fetchone()
        if not acct_row:
            continue
        acct_id = acct_row[0]

        running_bal = 0.0
        for r in range(4, 35):
            dt = ws_bd.cell(r, col_start).value
            if not dt:
                continue
            dt_str = dt.strftime('%Y-%m-%d') if hasattr(dt, 'strftime') else str(dt)[:10]
            order = float(ws_bd.cell(r, col_start + 1).value or 0)
            com = float(ws_bd.cell(r, col_start + 2).value or 0)
            paid = float(ws_bd.cell(r, col_start + 3).value or 0)
            running_bal = round(running_bal + order + com - paid, 2)

            if order > 0 or com > 0 or paid > 0:
                cur.execute("""
                    INSERT INTO bank_distrip_records (
                        id, record_date, account_id, order_inr, commission_inr, paid_inr, balance_inr
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (str(uuid.uuid4()), dt_str, acct_id, order, com, paid, running_bal))
                bd_count += 1

    print(f"Imported {bd_count} Bank Distrip entries.")

    conn.commit()
    conn.close()
    print("=== SEEDING COMPLETED SUCCESSFULLY ===")

if __name__ == "__main__":
    seed()
