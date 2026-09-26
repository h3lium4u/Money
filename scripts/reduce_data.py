import sqlite3
import os
import uuid

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "remittance.db")

def reduce_data():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    print("--- Trimming database to a small, clean dataset ---")
    # Fetch customer IDs for key customers: DIVAN, RAKSAN, SATHIK, SAMI, ABBAS, BUHARI, MALIK, JAHIR
    cur.execute("SELECT id, name FROM customers")
    customers = {name: c_id for c_id, name in cur.fetchall()}

    # Clear previous transactions and payments
    cur.execute("DELETE FROM transactions")
    cur.execute("DELETE FROM customer_payments")
    cur.execute("DELETE FROM bank_distrip_records")

    # Sample clean transactions
    # Dates: Today (2026-09-26), Yesterday (2026-09-25), and recent days this week
    sample_txns = [
        # Today: 2026-09-26
        ("2026-09-26", "DIVAN", 100000, 38.25, 26.82, 0.20, "Family remittance Chennai"),
        ("2026-09-26", "RAKSAN", 75000, 38.20, 26.82, 0.20, "Bank transfer Mumbai"),
        ("2026-09-26", "SATHIK", 150000, 38.30, 26.82, 0.20, "Emergency medical money"),
        ("2026-09-26", "ABBAS", 50000, 38.25, 26.82, 0.20, "Monthly family allowance"),
        ("2026-09-26", "BUHARI", 120000, 38.20, 26.82, 0.20, "Urgent home transfer"),

        # Yesterday: 2026-09-25
        ("2026-09-25", "DIVAN", 200000, 38.25, 26.82, 0.20, "Business settlement"),
        ("2026-09-25", "SAMI", 80000, 38.15, 26.82, 0.20, "Cash delivery Delhi"),
        ("2026-09-25", "MALIK", 65000, 38.25, 26.82, 0.20, "Family support"),
        ("2026-09-25", "JAHIR", 90000, 38.20, 26.82, 0.20, "Bank transfer Kochi"),

        # This week: 2026-09-24 to 2026-09-21
        ("2026-09-24", "FAIZ BU", 110000, 38.25, 26.80, 0.20, "Regular transfer"),
        ("2026-09-24", "RAKSAN", 130000, 38.30, 26.80, 0.20, "Family remittance"),
        ("2026-09-23", "SATHIK", 85000, 38.20, 26.80, 0.20, "School fees India"),
        ("2026-09-23", "AJIFER", 140000, 38.25, 26.80, 0.20, "House construction"),
        ("2026-09-22", "ABBAS", 70000, 38.15, 26.78, 0.20, "Personal savings"),
        ("2026-09-22", "DIVAN", 180000, 38.25, 26.78, 0.20, "Supplier payment"),
        ("2026-09-21", "SMS", 95000, 38.20, 26.78, 0.20, "Direct account transfer"),
        ("2026-09-21", "KADHAR", 60000, 38.25, 26.78, 0.20, "Monthly allowance"),

        # Earlier this month: 2026-09-15 to 2026-09-18
        ("2026-09-18", "FAYAS", 125000, 38.20, 26.75, 0.20, "Bank transfer"),
        ("2026-09-17", "SALEEM", 90000, 38.25, 26.75, 0.20, "Family remittance"),
        ("2026-09-15", "IBRM APS", 200000, 38.15, 26.75, 0.20, "Commercial payment"),
    ]

    for idx, (dt, cust_name, inr, cust_rate, base_rate, deliv_pct, note) in enumerate(sample_txns):
        c_id = customers.get(cust_name)
        if not c_id:
            # Fallback to first customer
            c_id = list(customers.values())[0]

        aed_amount = round((inr / 1000.0) * cust_rate, 2)
        cost_aed = round(inr / base_rate, 2)
        gross_profit = round(aed_amount - cost_aed, 2)
        delivery_amt = round(gross_profit * deliv_pct, 2)
        net_profit = round(gross_profit - delivery_amt, 2)
        txn_num = f"TXN-2026-{1000 + idx}"

        cur.execute("""
            INSERT INTO transactions (
                id, transaction_number, transaction_date, customer_id,
                inr_amount, customer_rate, aed_amount, base_rate,
                cost_aed, gross_profit_aed, delivery_charge_pct, delivery_charge_aed,
                net_profit_aed, status, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', ?)
        """, (
            str(uuid.uuid4()), txn_num, dt, c_id,
            inr, cust_rate, aed_amount, base_rate,
            cost_aed, gross_profit, deliv_pct, delivery_amt,
            net_profit, note
        ))

    print(f"Inserted {len(sample_txns)} clean sample transactions.")

    # Sample payments (customers paying some AED)
    sample_pays = [
        ("2026-09-26", "DIVAN", 3500.00, "CASH", "Cash at counter"),
        ("2026-09-26", "SATHIK", 5000.00, "BANK_TRANSFER", "Online bank transfer"),
        ("2026-09-25", "RAKSAN", 2500.00, "CASH", "Cash payment"),
        ("2026-09-25", "DIVAN", 7000.00, "CASH", "Office deposit"),
        ("2026-09-24", "ABBAS", 1800.00, "CASH", "Cash settled"),
        ("2026-09-23", "MALIK", 2400.00, "CASH", "Full payment"),
        ("2026-09-22", "JAHIR", 3000.00, "BANK_TRANSFER", "Bank transfer"),
        ("2026-09-21", "SMS", 3500.00, "CASH", "Cash"),
    ]

    for idx, (dt, cust_name, amt, method, note) in enumerate(sample_pays):
        c_id = customers.get(cust_name) or list(customers.values())[0]
        cur.execute("""
            INSERT INTO customer_payments (
                id, payment_number, payment_date, customer_id, amount_aed, payment_method, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (str(uuid.uuid4()), f"PAY-2026-{1000 + idx}", dt, c_id, amt, method, note))

    print(f"Inserted {len(sample_pays)} sample customer payments.")

    # Sample Bank Distrip records
    cur.execute("SELECT id, account_code FROM bank_distrip_accounts")
    accts = {code: a_id for a_id, code in cur.fetchall()}

    bank_entries = [
        ("2026-09-26", "MK", 350000, 1050, 400000, "MK India Bank disbursement"),
        ("2026-09-26", "SALA", 145000, 435, 150000, "SALA Network payout"),
        ("2026-09-25", "MK", 280000, 840, 250000, "MK orders sent"),
        ("2026-09-25", "USAIN", 155000, 465, 200000, "USAIN Bank orders"),
        ("2026-09-24", "SALA", 215000, 645, 200000, "SALA daily orders"),
        ("2026-09-23", "BLACK GRP", 140000, 420, 150000, "Black Group payout"),
    ]

    for dt, acct_code, order, com, paid, note in bank_entries:
        a_id = accts.get(acct_code)
        if a_id:
            bal = round(order + com - paid, 2)
            cur.execute("""
                INSERT INTO bank_distrip_records (
                    id, record_date, account_id, order_inr, commission_inr, paid_inr, balance_inr, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), dt, a_id, order, com, paid, bal, note))

    print(f"Inserted {len(bank_entries)} clean bank payout records.")

    conn.commit()
    conn.close()
    print("=== DATA REDUCED SUCCESSFULLY ===")

if __name__ == "__main__":
    reduce_data()
