# Phase 5 — Entity Relationship Architecture & Reference Map

```mermaid
erDiagram
    CUSTOMERS ||--o{ TRANSACTIONS : "initiates"
    CUSTOMERS ||--o{ CUSTOMER_PAYMENTS : "pays"
    TRANSACTIONS ||--o{ DISTRIBUTION_SPLITS : "splits into"
    DISTRIBUTORS ||--o{ DISTRIBUTION_SPLITS : "receives"
    TRANSACTIONS ||--o{ CUSTOMER_PAYMENTS : "settled by"
    DISTRIBUTORS ||--o{ BANK_DISTRIP_RECORDS : "tracks"
    TRANSACTIONS ||--o{ AUDIT_LOGS : "logs"

    CUSTOMERS {
        uuid id PK
        string name
        string code
        string phone
        numeric default_rate
        string party_type
        boolean is_active
    }

    TRANSACTIONS {
        uuid id PK
        date transaction_date
        uuid customer_id FK
        numeric inr_amount
        numeric customer_rate
        numeric aed_amount
        numeric base_rate
        numeric cost_aed
        numeric gross_profit_aed
        numeric delivery_charge_aed
        numeric net_profit_aed
        string status
    }

    DISTRIBUTORS {
        uuid id PK
        string name
        string code
        string phone
        string status
    }

    DISTRIBUTION_SPLITS {
        uuid id PK
        uuid transaction_id FK
        uuid distributor_id FK
        numeric inr_amount
        numeric paid_amount_inr
        numeric balance_inr
    }

    CUSTOMER_PAYMENTS {
        uuid id PK
        uuid customer_id FK
        uuid transaction_id FK
        date payment_date
        numeric amount_aed
        string payment_method
    }
```

---

## Reference Integrity Guarantees

1. **Foreign Key Integrity:**
   - \`transactions.customer_id\` references \`customers.id\`.
   - \`distribution_splits.transaction_id\` references \`transactions.id\`.
   - \`distribution_splits.distributor_id\` references \`distributors.id\`.
   - \`customer_payments.transaction_id\` references \`transactions.id\`.
2. **Cascade Deletion Policy:**
   - When a \`transaction\` is deleted via \`deleteTransaction(id)\`, the database executes:
     1. \`DELETE FROM customer_payments WHERE transaction_id = $1\`
     2. \`DELETE FROM distribution_splits WHERE transaction_id = $1\`
     3. \`DELETE FROM audit_logs WHERE entity_id = $1\`
     4. \`DELETE FROM transactions WHERE id = $1\`
   - Zero orphaned payment or split rows can remain.
3. **Authentic Distribution Parties Constraint:**
   - Strictly 5 protected entities: \`MK\`, \`SALA\`, \`HAJA\`, \`SARAB\`, \`NF2\`. Spurious or test distributor entities are barred.
