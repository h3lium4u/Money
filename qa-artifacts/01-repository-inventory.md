# Phase 1 — Repository Discovery & Baseline Architecture Inventory

**Date of Audit:** October 13, 2026  
**Repository Branch:** \`main\`  
**Runtime:** Node.js v24.13.0 \| Next.js 16.3.6 (Turbopack) \| PostgreSQL (Neon Serverless)

---

## 1. Application Architecture Overview

### Framework & Frontend Layer
- **Framework:** Next.js 16.3.6 (App Router architecture with React 19.3.0).
- **Styling & Components:** Tailwind CSS v3.4.19, Lucide React icons, Sonner toast notifications, Motion animations.
- **Charts & Visualizations:** Chart.js v4.5.1, react-chartjs-2 v5.3.1.
- **Client Caching & Optimistic Updates:** In-memory instant UI eviction on deletion (\`0ms\` update) across transaction, party transfer, customer, and party ledgers.

### Backend & API Layer
- **Framework:** Next.js Serverless Route Handlers (\`src/app/api/**/route.ts\`).
- **Validation:** Zod v4.6.5 runtime schema parsing and sanitization.
- **Database Query Engine:** Parameterized native SQL via \`@neondatabase/serverless\` pool with automatic exponential backoff retry on cold starts.
- **Financial Computation Engine:** Server-authoritative deterministic arithmetic engine in \`src/lib/calculations.ts\` with strict 3-decimal rounding.

---

## 2. Inventory of Application Modules & UI Routes

| UI Route | File Path | Core Business Purpose |
|---|---|---|
| \`/\` | \`src/app/page.tsx\` | Landing gateway redirecting to Dashboard |
| \`/dashboard\` | \`src/app/dashboard/page.tsx\` | Executive KPI overview (INR, AED, Gross/Net Margins, Receivables) |
| \`/remittances\` | \`src/app/remittances/page.tsx\` | Master Dubai remittance transaction register with live delete & void |
| \`/remittances/new\` | \`src/app/remittances/new/page.tsx\` | Remittance creation form with dynamic multi-distributor split allocation |
| \`/transactions\` | \`src/app/transactions/page.tsx\` | Dubai client remittance ledger with rate conversions and balance tracking |
| \`/transactions/new\` | \`src/app/transactions/new/page.tsx\` | Client transaction intake with wholesale rate calculation |
| \`/party-transfers\` | \`src/app/party-transfers/page.tsx\` | Indian distribution & party transfer manager, active advance credits |
| \`/party-transfers/new\`| \`src/app/party-transfers/new/page.tsx\`| Creation interface for Indian transfers |
| \`/parties\` | \`src/app/parties/page.tsx\` | Core 5 authentic distribution parties (\`MK\`, \`SALA\`, \`HAJA\`, \`SARAB\`, \`NF2\`) |
| \`/parties/[id]\` | \`src/app/parties/[id]/page.tsx\` | Detailed statement ledger for a specific party with receipt printing |
| \`/receivables\` | \`src/app/receivables/page.tsx\` | Customer receivables, payments tracking, running balances |
| \`/customers/[id]\` | \`src/app/customers/[id]/page.tsx\` | Dedicated customer account statement |
| \`/bank-distrip\` | \`src/app/bank-distrip/page.tsx\` | Bank Distributor ledger (MK, SALA) with orders, commissions, paid |
| \`/reports\` | \`src/app/reports/page.tsx\` | Consolidated financial reports, date filters, Excel and PDF export |
| \`/settings/system-health\` | \`src/app/settings/system-health/page.tsx\` | Database storage gauge, size monitoring, scheduled wipe configuration |

---

## 3. Inventory of API Endpoints

| Endpoint | Method | Path | Handlers & Core Services |
|---|:---:|---|---|
| **Health** | GET | \`/api/health\` | Neon connectivity ping, warmup verification |
| **Dashboard** | GET | \`/api/dashboard/summary\` | Aggregated KPIs (revenue, margins, volume) |
| **Transactions** | GET, POST | \`/api/transactions\` | Listing & creating Dubai remittance transactions |
| **Transaction Item**| GET, PUT, DELETE | \`/api/transactions/[id]\` | Item fetch, update, and cascaded permanent delete |
| **Calculation Engine**| POST | \`/api/transactions/calculate\` | Server-side financial formula evaluation |
| **Party Transfers**| GET | \`/api/party-transfers\` | Retrieve transfers and active advance credits |
| **Parties Master** | GET, POST | \`/api/parties\` | List and manage authentic parties |
| **Party Detail** | GET, PUT, DELETE | \`/api/parties/[id]\` | Fetch ledger, edit rates, delete party |
| **Party Payments**| GET, POST, DELETE | \`/api/parties/[id]/payments\` | Settle party transfers and delete payments |
| **Customers** | GET, POST | \`/api/customers\` | List and create Dubai customer profiles |
| **Customer Payments**| POST, DELETE | \`/api/customers/[id]/payments\` | Record and remove customer receipts |
| **Distribution Splits**| GET | \`/api/distribution-splits\` | Query multi-party transaction splits |
| **Export Excel** | GET | \`/api/reports/export-excel\` | Generate full Excel workbook with formulas |
| **Database Storage**| GET | \`/api/system/database-usage\` | Size check, quota threshold monitoring |
| **AI Assistant** | POST | \`/api/ai/chat\` | Dual LLM (Groq + Gemini fallback) Q&A engine |

---

## 4. Database Schema & Tables

The Neon PostgreSQL database implements the following relational model:
- \`transactions\`: Primary remittance ledger (INR amount, customer rate, base rate, cost AED, AED charged, gross profit, net profit, status).
- \`distribution_splits\`: Child allocations dividing a single customer order among Indian distributors.
- \`customer_payments\`: Receipt payments received from customers settling AED balances.
- \`distributors\`: The 5 authentic distribution entities (\`MK\`, \`SALA\`, \`HAJA\`, \`SARAB\`, \`NF2\`).
- \`customers\`: Customer directory (\`DIVAN\`, \`RAKSAN\`, \`SAMI\`, etc.).
- \`bank_distrip_accounts\` & \`bank_distrip_records\`: Bank Distributor tracking.
- \`audit_logs\`: Historical immutable mutation trail.

---

## 5. Baseline Test Status

Prior to new modifications:
- \`node --test src/lib/calculations.test.ts\`: **12 Passed, 0 Failed**.
- \`npx tsc --noEmit\`: **0 Errors (Clean TypeScript compilation)**.
- Baseline DB count verification: **0 test dump records, 5 authentic parties preserved**.
