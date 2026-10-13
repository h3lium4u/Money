# Phase 4 — Field Mapping Audit & Data Flow Findings

**Audit Scope:** End-to-end data lifecycle from Excel workbooks to PostgreSQL, REST API payloads, and React frontend states.  
**Auditor:** Full-Stack Debugging & Financial Systems Auditor

---

## 1. Verified Data Pathways

### A. Dubai Remittance Creation Flow
1. **Frontend Input (\`/remittances/new\` & \`/transactions/new\`):**  
   User enters \`inr_amount\`, selects Dubai Customer (\`customer_id\`), enters Customer Rate (e.g. \`38.25\`) and My Rate (\`26.82\`).
2. **Backend API (\`/api/transactions\`):**  
   Validates request body via Zod schema. Passes values to \`calculateTransaction()\` in \`src/lib/calculations.ts\`.
3. **Database Persistence (\`transactions\` table):**  
   Stores \`inr_amount\`, \`aed_amount\`, \`cost_aed\`, \`gross_profit_aed\`, \`delivery_charge_aed\`, \`net_profit_aed\`, with all floats normalized to 3 decimal places.
4. **Relational Children:**  
   Child distribution splits are written transactionally to \`distribution_splits\` linked via \`transaction_id\`. If an upfront payment is specified, a linked row is inserted into \`customer_payments\`.

### B. Party Transfer & India Distribution Flow
1. **Input (\`/party-transfers\`):**  
   User enters party transfer amount (supports both INR mode for Indian distribution and AED mode for Dubai clients).
2. **Indian Entity Distinction:**  
   The application specifically recognizes \`MK\` and \`SALA\` (and parties flagged \`party_type === 'INDIA'\`) as Indian distribution entities, using INR base currency.
3. **Optimistic Live Deletion Flow:**  
   When a user clicks delete, the entity is evicted from React state in \`0ms\`, server cache is wiped, and child records in \`distribution_splits\` and \`customer_payments\` are cascaded and deleted in PostgreSQL.

---

## 2. Detailed Findings & Resolutions

| Field / Feature | Historical Issue | Corrective Implementation | Verification Status |
|---|---|---|:---:|
| **Sub-rupee Fractions** | Floating-point discrepancy on split equality (e.g. ₹0.20 drift) | \`⚡ Auto-balance Fraction\` button auto-absorbs sub-rupee fractions $\le ₹1.00$ into final split row | **RESOLVED & VERIFIED** |
| **Payment Channels** | Non-standard channels (\`HAWALA\`, \`BANK\`) present in UI | Removed. Preserved valid options: \`DEFAULT\`, \`GPAY\`, \`CASH\`, \`OTHER\` | **RESOLVED & VERIFIED** |
| **Active Advance Credit Multiplier** | MK's ₹50k displayed 4x as ₹200k | Deduplicated \`priorSummaries\` by unique \`partyId\` in \`src/app/party-transfers/page.tsx\` | **RESOLVED & VERIFIED** |
| **Cascade Deletion** | Deleting transaction previously set \`transaction_id = NULL\` on payments | Hard delete \`DELETE FROM customer_payments WHERE transaction_id = $1\` permanently purges child rows | **RESOLVED & VERIFIED** |
| **Live UI State on Deletion** | Stale item remained visible until manual page reload | Optimistic React filter \`setTransfers((prev) => prev.filter(...))\` updates UI in \`0ms\` | **RESOLVED & VERIFIED** |
