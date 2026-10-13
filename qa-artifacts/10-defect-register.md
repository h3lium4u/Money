# Phase 15 — Defect Register & Resolution Log

---

### DEF-001 (Severity P1 — High): Deferred UI State Update on Entity Deletion
- **Module:** \`src/app/party-transfers/page.tsx\`, \`src/app/remittances/page.tsx\`, \`src/app/transactions/page.tsx\`
- **Defect Description:** When a user manually deleted a transfer or transaction, the UI did not update immediately and required a manual browser page reload (F5) to reflect the deletion.
- **Root Cause:**
  1. Frontend components lacked optimistic local React state pruning, waiting for network re-fetch responses.
  2. Transient Neon serverless cold-start timeouts (\`ETIMEDOUT\`, \`fetch failed\`) during the re-fetch caused uncaught exceptions that halted React's render lifecycle before state setters could execute.
- **Resolution:**
  - Implemented 0ms optimistic local state updates across all entity lists (\`setTransfers((prev) => prev.filter((t) => t.id !== targetId))\`).
  - Added a 3-attempt exponential backoff retry loop in \`src/lib/db.ts\` for all database queries.
  - Cleared client in-memory caches (\`clientPartyTransfersCache = null\`) prior to safe background re-fetching.
- **Regression Verification:** \`scripts/master_qa_runner.mjs\` (Section 5: Transaction Lifecycle & Cascaded Delete). Retest: **PASS (0ms optimistic removal verified)**.

---

### DEF-002 (Severity P1 — High): Orphaned Payment Rows in PostgreSQL on Transaction Delete
- **Module:** \`src/lib/repository.ts\` (\`deleteTransaction\`)
- **Defect Description:** Deleting a transaction left orphaned customer payment rows in the database, distorting customer receivables and historical account statements.
- **Root Cause:** The database deletion logic unlinked child payments with \`UPDATE customer_payments SET transaction_id = NULL\` rather than executing a foreign-key cascade delete.
- **Resolution:**
  - Updated \`deleteTransaction(id)\` to execute explicit cascade deletion:
    \`\`\`sql
    DELETE FROM customer_payments WHERE transaction_id = $1;
    DELETE FROM distribution_splits WHERE transaction_id = $1;
    DELETE FROM audit_logs WHERE entity_id = $1;
    DELETE FROM transactions WHERE id = $1;
    \`\`\`
  - Added global cache invalidation (\`invalidateAllCaches()\`).
- **Regression Verification:** Direct Neon database inspection confirmed **0 orphaned payment rows** post-delete. Retest: **PASS**.

---

### DEF-003 (Severity P1 — High): Active Advance Credit Multi-Key Duplication
- **Module:** \`src/app/party-transfers/page.tsx\`
- **Defect Description:** Active Advance Credit for party MK displayed 4x its actual value (e.g. ₹200,000 instead of ₹50,000).
- **Root Cause:** \`priorSummaries\` array contained multiple records for the same party that were summed without deduplication by unique \`partyId\`.
- **Resolution:** Grouped and deduplicated \`priorSummaries\` by unique \`partyId\` before computing aggregate advance credit balances.
- **Regression Verification:** Retest: **PASS (Exact balance verified without duplication)**.

---

### DEF-004 (Severity P2 — Medium): Sub-Rupee Floating-Point Discrepancies in Split Allocation
- **Module:** \`src/app/remittances/new/page.tsx\`, \`src/app/party-transfers/page.tsx\`
- **Defect Description:** Transactions with sub-rupee fractional decimals (e.g. on 2026-05-04 with order total of ₹2,399,600.20) failed split equality validation due to 0.20 INR floating drift.
- **Root Cause:** Exact 3-decimal equality check rejected splits where individual rows did not sum to the precise fraction.
- **Resolution:**
  - Added automatic absorption of fractional tolerances $\le ₹1.00$ into the final split row.
  - Implemented an intuitive \`⚡ Auto-balance Fraction\` button in the UI for 1-click reconciliation.
- **Regression Verification:** Test case \`SYN-003\` (\`inr: 2399600.20\`). Retest: **PASS**.

---

### DEF-005 (Severity P2 — Medium): Non-Standard Payment Channels in UI
- **Module:** \`src/app/party-transfers/page.tsx\`, \`src/app/parties/[id]/page.tsx\`
- **Defect Description:** UI included non-standard payment channel options (\`BANK\`, \`HAWALA\`).
- **Resolution:** Removed \`BANK\` and \`HAWALA\` options. Standardized on authorized channels: \`DEFAULT\`, \`GPAY\`, \`CASH\`, \`OTHER\`.
- **Regression Verification:** Retest: **PASS**.
