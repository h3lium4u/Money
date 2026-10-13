# Phase 3 — Authoritative Business Rules Specification

**Source Authority:** \`AYYAN JAN(5).xlsx\`  
**Engine Implementation:** \`src/lib/calculations.ts\` & Serverless Route Handlers  
**Standard Precision:** Strict 3 Decimal Places (\`0.001\` precision)

---

## Rule Inventory

### RULE-FIN-01: Dual Quotation Convention Normalization
- **Source Worksheet:** \`COLLECTION & PROFIT\` (Cols AN–BR vs Col CZ)
- **Mathematical Principle:** The Dubai-India remittance corridor quotes exchange rates in two distinct market conventions:
  1. **AED per 1,000 INR** (Direct Middle East retail quotation, e.g., \`38.250 AED\` for \`₹1,000\`).
  2. **INR per 1 AED** (Indian interbank wholesale quotation, e.g., \`₹26.144\` for \`1 AED\`).
- **Mathematical Formulations:**
  $$\text{INR per AED} = \text{round}\left(\frac{1000}{\text{Rate per 1000}}, 3\right)$$
  $$\text{Rate per 1000} = \text{round}\left(\frac{1000}{\text{INR per AED}}, 3\right)$$
- **Condition:** Rate values $\ge 30$ are treated as AED/1,000 INR; rate values $< 30$ are treated as INR/1 AED.
- **Application Module:** \`src/lib/calculations.ts\` (\`ratePer1000ToInrPerAed\`, \`inrPerAedToRatePer1000\`).

---

### RULE-FIN-02: AED Amount Charged to Customer
- **Source Worksheet:** \`COLLECTION & PROFIT\` (Cols BT–CX)
- **Description:** Derives the exact gross Dirhams to collect from the Dubai sender.
- **Formulas:**
  $$\text{AED Amount} = \begin{cases} 
  \text{round}\left(\frac{\text{INR Amount} \times \text{Customer Rate}}{1000}, 3\right) & \text{if Customer Rate} \ge 30 \\ 
  \text{round}\left(\frac{\text{INR Amount}}{\text{Customer Rate}}, 3\right) & \text{if Customer Rate} < 30 
  \end{cases}$$
- **Verification Example:**
  - Row 4 (2026-05-03, DIVAN): $69,600 \text{ INR} \times 38.250 / 1000 = \mathbf{2,662.200\text{ AED}}$.

---

### RULE-FIN-03: Wholesale Base Cost (My Rate)
- **Source Worksheet:** \`COLLECTION & PROFIT\` (Col CZ: \`MY RATE\`)
- **Description:** Determines the cost incurred by the remittance business to acquire INR in India.
- **Formulas:**
  $$\text{Cost AED} = \begin{cases} 
  \text{round}\left(\frac{\text{INR Amount} \times \text{Base Rate}}{1000}, 3\right) & \text{if Base Rate} \ge 30 \\ 
  \text{round}\left(\frac{\text{INR Amount}}{\text{Base Rate}}, 3\right) & \text{if Base Rate} < 30 
  \end{cases}$$
- **Verification Example:**
  - Row 4 (DIVAN): $69,600 \text{ INR} / 25.610 = \mathbf{2,717.688\text{ AED}}$.

---

### RULE-FIN-04: Gross Margin
- **Source Worksheet:** \`COLLECTION & PROFIT\` (Cols DA–DY)
- **Formula:**
  $$\text{Gross Profit AED} = \text{round}(\text{AED Amount Charged} - \text{Wholesale Cost AED}, 3)$$
- **Verification Example:**
  - Row 4 (DIVAN): $2,662.200 - 2,717.688 = \mathbf{-55.488\text{ AED}}$.

---

### RULE-FIN-05: Partner Delivery Cut & Retained Net Margin
- **Source Worksheet:** \`COLLECTION & PROFIT\` (Cols EA–EC)
- **Formulas:**
  $$\text{Delivery Charge AED} = \begin{cases} 
  \text{Fixed AED (if explicitly specified)} \\ 
  \text{round}(\text{Gross Profit AED} \times 0.20, 3) & \text{(default 20\% cut)} 
  \end{cases}$$
  $$\text{Net Profit AED} = \text{round}(\text{Gross Profit AED} - \text{Delivery Charge AED}, 3)$$
- **Verification Example:**
  - Row 4 (DIVAN):
    - Delivery Charge: $-55.488 \times 0.20 = \mathbf{-11.098\text{ AED}}$
    - Net Retained: $-55.488 - (-11.098) = \mathbf{-44.390\text{ AED}}$

---

### RULE-FIN-06: Customer Receivables Running Balance
- **Source Worksheet:** \`RECEIVABLES & BALANCE\`
- **Formula:**
  $$\text{Closing Balance}_t = \text{Closing Balance}_{t-1} + \text{AED Charged}_t - \text{AED Received}_t$$
- **Sign Convention:** Positive balance indicates client owes the business; negative indicates advance credit.

---

### RULE-FIN-07: India Distribution Wholesale Settlement
- **Source Worksheet:** \`INDIA DISTRIBUTION\`
- **Formulas:**
  $$\text{In Dirhams} = \text{round}\left(\frac{\text{INR Allocated}}{\text{Wholesale Rate}}, 3\right)$$
  $$\text{Balance to be Paid} = \text{round}(\text{In Dirhams} - \text{Paid AED}, 3)$$
  $$\text{Daily Running Balance}_t = \text{round}(\text{Daily Running Balance}_{t-1} + \text{Balance to be Paid}_t, 3)$$

---

### RULE-FIN-08: Bank Distributor Running Balance
- **Source Worksheet:** \`BANK DISTRIP\` (MK, SALA, USAIN, etc.)
- **Formula:**
  $$\text{Balance}_t = \text{round}(\text{Balance}_{t-1} + \text{Order INR}_t + \text{Commission INR}_t - \text{Paid INR}_t, 3)$$
- **Verification Example:**
  - MK Cumulative Balance: Starting ₹0, running to **₹1,048,630.000** over May 3 to May 9.
