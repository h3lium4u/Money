# Phase 2 — Programmatic Excel Workbook Analysis Report

**Workbook Filename:** `AYYAN JAN(5).xlsx`  
**Analysis Engine:** ExcelJS Programmatic AST & Cell Grid Scanner  
**Timestamp:** 2026-10-13T15:15:04.248Z  
**Total Worksheets:** 7  
**Total Formulas Captured:** 25172  

---

## 1. Worksheet Inventory & Topography

| # | Worksheet Name | Rows | Columns | Formulas | Status | Key Accounting Role |
|---|---|:---:|:---:|:---:|:---:|---|
| 1 | **COLLECTION & PROFIT** | 192 | 134 | 11373 | ACTIVE | Order Intake, Daily Rates, Wholesale Rates, Delivery Cuts & Net Margins |
| 2 | **RECEIVABLES & BALANCE** | 182 | 70 | 5800 | ACTIVE | Customer Receipts, Settlements & Running Balances |
| 3 | **INDIA DISTRIBUTION** | 165 | 37 | 3215 | ACTIVE | Wholesale India Allocations, Dirham Conversion & Partner Balances |
| 4 | **BANK DISTRIP** | 163 | 32 | 1241 | ACTIVE | Distributor Accounts (MK, SALA, USAIN, etc.), Commissions & INR Balances |
| 5 | **SUMMARY** | 134 | 26 | 1620 | ACTIVE | Executive Consolidation, Daily Cash, Total AED, Net Financial Position |
| 6 | **SEPRATE AC"S** | 90 | 99 | 1886 | ACTIVE | Individual Party Statements & Account Ledgers |
| 7 | **DAILY ACC** | 5 | 97 | 37 | ACTIVE | Daily Cash & Operational Account Snapshots |

---

## 2. In-Depth Worksheet Structural Breakdown

### A. COLLECTION & PROFIT
- **Role:** Master remittance order intake, customer rates, wholesale base rate (My Rate), AED charged, AED cost, gross margin, delivery partner cut (20%), and retained net margin.
- **Top Row Coordinates:**
  - Date column: Col A (`DATE`)
  - Customer Order INR blocks: Cols B–AD (`SAMI`, `DIVAN`, `FAIZ BU`, `RAKSAN`, `SATHIK`, etc.)
  - Total Daily INR: Col AE (`TOTAL`)
  - India Distributor Split Allocation: Cols AG–AL (`SALA`, `SARABU`, `MK`, `ISMAIL`, `NNG`, `TOTAL`)
  - Daily Rate Quotations (AED per 1,000 INR): Cols AN–BR
  - AED Charged to Customer: Cols BT–CX
  - Wholesale Base Cost (My Rate): Col CZ
  - Partner Delivery Charge (20% Cut): Col EA (`0.20`)
  - Retained Net Margin (AED): Col EC (`NET AMOUNT`)

### B. RECEIVABLES & BALANCE
- **Role:** Customer ledger settlements, tracking customer payments (`RECEIVED AMOUNT`) vs remittance volume (`BALANCE AMOUNT`) with cumulative running balances per customer.
- **Formulas:** Running balance equation:  
  $$\text{Current Balance} = \text{Previous Balance} + \text{New Orders Charged (AED)} - \text{AED Received}$$

### C. INDIA DISTRIBUTION
- **Role:** Wholesale liquidity allocations distributed in India to partners (`FASLM`, `MUHI`, `NF2`, `HAJA`, `SARABU`, `BASID`).
- **Formulas:**  
  $$\text{In Dirhams} = \frac{\text{INR Allocated}}{\text{Wholesale Rate (INR/AED)}}$$  
  $$\text{Balance to be Paid} = \text{In Dirhams} - \text{Paid Amount}$$  
  $$\text{Daily Running Balance} = \text{Previous Balance} + \text{Balance to be Paid}$$

### D. BANK DISTRIP
- **Role:** Tracking distributor bank accounts (`MK`, `SALA`, `USAIN`, `BLACK GRP`).
- **Formulas:**  
  $$\text{Distributor Balance} = \text{Previous Balance} + \text{Order (INR)} + \text{Commission (INR)} - \text{Paid (INR)}$$

### E. SUMMARY
- **Role:** Consolidated executive overview reconciling daily opening cash, Hand AED, Awafi, NF2, Haja, Sarabu, Basid, Total AED converted, MK balance, Sala balance, Usain balance, and net closing liquidity.

### F. SEPRATE AC"S & DAILY ACC
- **Role:** Individual dedicated statements for top accounts (`DIVAN`, `RAKSAN`, `APPAS`, `KADER KAKA`, `TRAVEL`, `NAJIB`, `THARIK`, `AKBAR`).

---

## 3. Discovered Formula Categories

```
Total Formulas: 25172
- Rate Conversions & Margins: 4207
- Running Balances: 1011
- Column / Row Sum Aggregations: 1063
- Cross-Sheet References: 7368
- General / Other: 11523
```

---
*Report generated programmatically from the source Excel workbook.*
