import { query, queryOne } from "../db.ts";
import { roundTo } from "../calculations.ts";
import { formatDate } from "./date-parser.ts";
import type {
  IntentAnalysisResult,
  VerifiedFinancialContext,
  ParsedDateRange,
} from "./types.ts";

function toDateStr(val: any): string {
  if (!val) return "";
  if (typeof val === "string") return val.slice(0, 10);
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

/**
 * Executes controlled, parameterized PostgreSQL queries based on intent and entities.
 * The AI NEVER calculates these numbers; all numbers are calculated by PostgreSQL/backend.
 */
export async function retrieveVerifiedFinancialData(
  analysis: IntentAnalysisResult
): Promise<VerifiedFinancialContext> {
  const { intent, entities } = analysis;
  const now = new Date();
  const todayStr = formatDate(now);

  // Default to this month if no date range is provided for period queries
  const currentMonthStart = formatDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const currentMonthEnd = formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const resolvedRange: ParsedDateRange = entities.dateRange || {
    from: currentMonthStart,
    to: currentMonthEnd,
    label: `${now.toLocaleString("default", { month: "long" })} ${now.getFullYear()}`,
  };

  switch (intent) {
    case "TODAY_SUMMARY": {
      // 1. Transactions today
      const txnStats = await queryOne(`
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(inr_amount), 0) as total_inr,
          COALESCE(SUM(aed_amount), 0) as total_aed,
          COALESCE(SUM(gross_profit_aed), 0) as gross_profit,
          COALESCE(SUM(delivery_charge_aed), 0) as delivery_charges,
          COALESCE(SUM(net_profit_aed), 0) as net_profit
        FROM transactions
        WHERE status = 'CONFIRMED' AND transaction_date = $1
      `, [todayStr]);

      // 2. Payments collected today
      const payStats = await queryOne(`
        SELECT COALESCE(SUM(amount_aed), 0) as total_collected
        FROM customer_payments
        WHERE payment_date = $1
      `, [todayStr]);

      // 3. Transactions list today
      const txns = await query(`
        SELECT 
          t.transaction_number,
          c.name as customer_name,
          t.inr_amount,
          t.customer_rate,
          t.aed_amount,
          t.net_profit_aed,
          t.status
        FROM transactions t
        JOIN customers c ON c.id = t.customer_id
        WHERE t.status = 'CONFIRMED' AND t.transaction_date = $1
        ORDER BY t.created_at DESC
        LIMIT 10
      `, [todayStr]);

      // 4. Overall cumulative receivables as of today
      const receivables = await queryOne(`
        SELECT 
          COALESCE((SELECT SUM(aed_amount) FROM transactions WHERE status = 'CONFIRMED'), 0) - 
          COALESCE((SELECT SUM(amount_aed) FROM customer_payments), 0) as total_receivable
      `);

      return {
        topic: "Today's Business Summary",
        asOf: todayStr,
        periodLabel: "Today",
        dateRange: { from: todayStr, to: todayStr },
        metrics: {
          transactionCount: Number(txnStats?.count || 0),
          totalInrProcessed: roundTo(Number(txnStats?.total_inr || 0), 2),
          totalAedBilled: roundTo(Number(txnStats?.total_aed || 0), 2),
          totalAedCollected: roundTo(Number(payStats?.total_collected || 0), 2),
          grossProfitAed: roundTo(Number(txnStats?.gross_profit || 0), 2),
          deliveryChargesAed: roundTo(Number(txnStats?.delivery_charges || 0), 2),
          netProfitAed: roundTo(Number(txnStats?.net_profit || 0), 2),
          totalOutstandingReceivablesAed: roundTo(Number(receivables?.total_receivable || 0), 2),
        },
        records: txns,
      };
    }

    case "COMPARE_PERIODS": {
      // Comparison: This Month vs Last Month
      const thisMonthStart = formatDate(new Date(now.getFullYear(), now.getMonth(), 1));
      const thisMonthEnd = formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      const lastMonthStart = formatDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      const lastMonthEnd = formatDate(new Date(now.getFullYear(), now.getMonth(), 0));

      const thisMonth = await queryOne(`
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(inr_amount), 0) as total_inr,
          COALESCE(SUM(aed_amount), 0) as total_aed,
          COALESCE(SUM(net_profit_aed), 0) as net_profit
        FROM transactions
        WHERE status = 'CONFIRMED' AND transaction_date >= $1 AND transaction_date <= $2
      `, [thisMonthStart, thisMonthEnd]);

      const lastMonth = await queryOne(`
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(inr_amount), 0) as total_inr,
          COALESCE(SUM(aed_amount), 0) as total_aed,
          COALESCE(SUM(net_profit_aed), 0) as net_profit
        FROM transactions
        WHERE status = 'CONFIRMED' AND transaction_date >= $1 AND transaction_date <= $2
      `, [lastMonthStart, lastMonthEnd]);

      const thisMonthInr = Number(thisMonth?.total_inr || 0);
      const lastMonthInr = Number(lastMonth?.total_inr || 0);
      const thisMonthProfit = Number(thisMonth?.net_profit || 0);
      const lastMonthProfit = Number(lastMonth?.net_profit || 0);

      const inrGrowthPct = lastMonthInr > 0 ? roundTo(((thisMonthInr - lastMonthInr) / lastMonthInr) * 100, 1) : null;
      const profitGrowthPct = lastMonthProfit > 0 ? roundTo(((thisMonthProfit - lastMonthProfit) / lastMonthProfit) * 100, 1) : null;

      return {
        topic: "Monthly Performance Comparison",
        asOf: todayStr,
        periodLabel: "This Month vs Last Month",
        metrics: {
          currentPeriod: {
            label: "This Month",
            transactions: Number(thisMonth?.count || 0),
            inrAmount: roundTo(thisMonthInr, 2),
            aedAmount: roundTo(Number(thisMonth?.total_aed || 0), 2),
            netProfitAed: roundTo(thisMonthProfit, 2),
          },
          previousPeriod: {
            label: "Last Month",
            transactions: Number(lastMonth?.count || 0),
            inrAmount: roundTo(lastMonthInr, 2),
            aedAmount: roundTo(Number(lastMonth?.total_aed || 0), 2),
            netProfitAed: roundTo(lastMonthProfit, 2),
          },
          comparison: {
            inrDifference: roundTo(thisMonthInr - lastMonthInr, 2),
            profitDifferenceAed: roundTo(thisMonthProfit - lastMonthProfit, 2),
            inrGrowthPercentage: inrGrowthPct,
            profitGrowthPercentage: profitGrowthPct,
          },
        },
      };
    }

    case "PROFIT_ANALYSIS": {
      const from = resolvedRange.from || currentMonthStart;
      const to = resolvedRange.to || currentMonthEnd;

      const stats = await queryOne(`
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(inr_amount), 0) as total_inr,
          COALESCE(SUM(aed_amount), 0) as total_aed,
          COALESCE(SUM(cost_aed), 0) as cost_aed,
          COALESCE(SUM(gross_profit_aed), 0) as gross_profit,
          COALESCE(SUM(delivery_charge_aed), 0) as delivery_charges,
          COALESCE(SUM(net_profit_aed), 0) as net_profit,
          AVG(customer_rate) as avg_customer_rate,
          AVG(base_rate) as avg_base_rate
        FROM transactions
        WHERE status = 'CONFIRMED' AND transaction_date >= $1 AND transaction_date <= $2
      `, [from, to]);

      return {
        topic: "Profit & Margin Analysis",
        asOf: todayStr,
        periodLabel: resolvedRange.label,
        dateRange: { from, to },
        metrics: {
          transactionCount: Number(stats?.count || 0),
          totalInrProcessed: roundTo(Number(stats?.total_inr || 0), 2),
          totalAedBilled: roundTo(Number(stats?.total_aed || 0), 2),
          baseCostAed: roundTo(Number(stats?.cost_aed || 0), 2),
          grossProfitAed: roundTo(Number(stats?.gross_profit || 0), 2),
          deliveryChargesAed: roundTo(Number(stats?.delivery_charges || 0), 2),
          netProfitAed: roundTo(Number(stats?.net_profit || 0), 2),
          averageCustomerRate: stats?.avg_customer_rate ? roundTo(Number(stats.avg_customer_rate), 4) : null,
          averageBaseRate: stats?.avg_base_rate ? roundTo(Number(stats.avg_base_rate), 4) : null,
        },
      };
    }

    case "CUSTOMER_QUERY": {
      const custName = entities.customerName;
      if (!custName) {
        return {
          topic: "Customer Query",
          asOf: todayStr,
          insufficientData: true,
          metrics: {},
          summaryNotes: ["No specific customer name identified in query."],
        };
      }

      // Fetch customer
      const cust = await queryOne(`
        SELECT id, code, name, phone, default_rate
        FROM customers
        WHERE UPPER(name) = UPPER($1) OR code ILIKE $1
        LIMIT 1
      `, [custName]);

      if (!cust) {
        return {
          topic: `Customer ${custName}`,
          asOf: todayStr,
          insufficientData: true,
          metrics: { customerNotFound: true, queriedName: custName },
          summaryNotes: [`Customer '${custName}' was not found in database.`],
        };
      }

      // Customer financial balances
      const totals = await queryOne(`
        SELECT 
          COUNT(*) as total_orders,
          COALESCE(SUM(inr_amount), 0) as total_inr,
          COALESCE(SUM(aed_amount), 0) as total_aed,
          COALESCE(SUM(net_profit_aed), 0) as total_profit
        FROM transactions
        WHERE customer_id = $1 AND status = 'CONFIRMED'
      `, [cust.id]);

      const payments = await queryOne(`
        SELECT COALESCE(SUM(amount_aed), 0) as total_paid
        FROM customer_payments
        WHERE customer_id = $1
      `, [cust.id]);

      const totalAed = Number(totals?.total_aed || 0);
      const totalPaid = Number(payments?.total_paid || 0);
      const outstanding = roundTo(totalAed - totalPaid, 2);

      // Recent transactions
      const recentTxns = await query(`
        SELECT 
          t.transaction_number,
          t.transaction_date,
          t.inr_amount,
          t.customer_rate,
          t.aed_amount,
          COALESCE((
            SELECT SUM(cp.amount_aed) 
            FROM customer_payments cp 
            WHERE cp.transaction_id = t.id
          ), 0) as paid_for_txn,
          t.status
        FROM transactions t
        WHERE t.customer_id = $1 AND t.status = 'CONFIRMED'
        ORDER BY t.transaction_date DESC, t.created_at DESC
        LIMIT 10
      `, [cust.id]);

      return {
        topic: `Customer Statement: ${cust.name}`,
        asOf: todayStr,
        metrics: {
          customerName: cust.name,
          customerCode: cust.code,
          defaultRate: cust.default_rate ? Number(cust.default_rate) : null,
          totalTransactionsCount: Number(totals?.total_orders || 0),
          totalInrVolume: roundTo(Number(totals?.total_inr || 0), 2),
          totalAedBilled: roundTo(totalAed, 2),
          totalAedPaid: roundTo(totalPaid, 2),
          outstandingBalanceAed: outstanding,
          paymentStatus: outstanding <= 0 ? "Fully Paid / Clear" : "Outstanding Balance Due",
        },
        records: recentTxns.map((r: any) => ({
          transactionNumber: r.transaction_number,
          date: r.transaction_date,
          inr: roundTo(Number(r.inr_amount), 2),
          rate: Number(r.customer_rate),
          aed: roundTo(Number(r.aed_amount), 2),
          paidAed: roundTo(Number(r.paid_for_txn), 2),
          pendingAed: roundTo(Math.max(0, Number(r.aed_amount) - Number(r.paid_for_txn)), 2),
        })),
      };
    }

    case "RECEIVABLES_QUERY": {
      // List all customers with outstanding balances
      const customerBalances = await query(`
        SELECT 
          c.id,
          c.code,
          c.name,
          COALESCE(SUM(t.aed_amount), 0) as total_aed,
          COALESCE((
            SELECT SUM(p.amount_aed) 
            FROM customer_payments p 
            WHERE p.customer_id = c.id
          ), 0) as total_paid
        FROM customers c
        LEFT JOIN transactions t ON t.customer_id = c.id AND t.status = 'CONFIRMED'
        GROUP BY c.id, c.code, c.name
        HAVING (COALESCE(SUM(t.aed_amount), 0) - COALESCE((
          SELECT SUM(p.amount_aed) 
          FROM customer_payments p 
          WHERE p.customer_id = c.id
        ), 0)) > 0.01
        ORDER BY (COALESCE(SUM(t.aed_amount), 0) - COALESCE((
          SELECT SUM(p.amount_aed) 
          FROM customer_payments p 
          WHERE p.customer_id = c.id
        ), 0)) DESC
      `);

      let totalOutstanding = 0;
      const records = customerBalances.map((c: any) => {
        const billed = Number(c.total_aed || 0);
        const paid = Number(c.total_paid || 0);
        const balance = roundTo(billed - paid, 2);
        totalOutstanding += balance;
        return {
          customerCode: c.code,
          customerName: c.name,
          totalBilledAed: roundTo(billed, 2),
          totalPaidAed: roundTo(paid, 2),
          outstandingAed: balance,
        };
      });

      return {
        topic: "Outstanding Customer Receivables",
        asOf: todayStr,
        metrics: {
          totalCustomersWithBalance: records.length,
          totalOutstandingReceivablesAed: roundTo(totalOutstanding, 2),
        },
        records,
      };
    }

    case "INDIA_DISTRIBUTION": {
      const distName = entities.distributorName;
      const txnNumber = entities.transactionNumber;

      // Case A: Specific transaction split details
      if (txnNumber) {
        const txn = await queryOne(`
          SELECT t.id, t.transaction_number, t.inr_amount, c.name as customer_name, t.transaction_date
          FROM transactions t
          JOIN customers c ON c.id = t.customer_id
          WHERE UPPER(t.transaction_number) = UPPER($1)
        `, [txnNumber]);

        if (!txn) {
          return {
            topic: `Transaction ${txnNumber} Splits`,
            asOf: todayStr,
            insufficientData: true,
            metrics: { transactionNotFound: true, queriedNumber: txnNumber },
            summaryNotes: [`Transaction ${txnNumber} not found.`],
          };
        }

        const splits = await query(`
          SELECT 
            s.id,
            s.split_date,
            s.inr_amount,
            s.wholesale_rate,
            s.paid_amount_inr,
            s.balance_inr,
            s.status,
            d.name as distributor_name,
            d.code as distributor_code
          FROM distribution_splits s
          JOIN distributors d ON d.id = s.distributor_id
          WHERE s.transaction_id = $1
          ORDER BY s.split_date ASC
        `, [txn.id]);

        const totalSplitInr = splits.reduce((sum: number, s: any) => sum + Number(s.inr_amount || 0), 0);
        const remainingInr = roundTo(Number(txn.inr_amount) - totalSplitInr, 2);

        return {
          topic: `Distribution Splits for ${txn.transaction_number}`,
          asOf: todayStr,
          metrics: {
            transactionNumber: txn.transaction_number,
            customerName: txn.customer_name,
            totalOrderInr: roundTo(Number(txn.inr_amount), 2),
            totalAllocatedInr: roundTo(totalSplitInr, 2),
            unallocatedInr: remainingInr,
            splitCount: splits.length,
            isFullyAllocated: remainingInr <= 0,
          },
          records: splits.map((s: any) => ({
            distributor: s.distributor_name,
            code: s.distributor_code,
            date: s.split_date,
            amountInr: roundTo(Number(s.inr_amount), 2),
            wholesaleRate: s.wholesale_rate ? Number(s.wholesale_rate) : null,
            paidInr: roundTo(Number(s.paid_amount_inr || 0), 2),
            balanceInr: roundTo(Number(s.balance_inr || 0), 2),
            status: s.status,
          })),
        };
      }

      // Case B: Specific distributor (e.g. MK, SARABU, etc.)
      if (distName) {
        const distGroup = entities.distributorGroup;
        const requiresClarification = entities.requiresGroupClarification;

        // If SARABU (or other ambiguous name) without explicit group — ask for clarification
        if (requiresClarification && !distGroup) {
          return {
            topic: `Distributor Query: ${distName}`,
            asOf: todayStr,
            insufficientData: false,
            metrics: { requiresGroupClarification: true, distributorName: distName },
            summaryNotes: [
              `${distName} exists in BOTH the IND (India Distribution) and AED (AED Distribution) groups.`,
              `Please specify which group you mean, e.g.:`,
              `  • "How much was distributed to ${distName} under IND?"`,
              `  • "How much was distributed to ${distName} under AED?"`,
            ],
          };
        }

        // Query with group_type filter when available
        let distQuery = `SELECT id, code, name, partner_type, group_type FROM distributors WHERE UPPER(name) = UPPER($1)`;
        const distParams: any[] = [distName];
        if (distGroup) {
          distQuery += ` AND group_type = $2`;
          distParams.push(distGroup);
        }
        distQuery += ` LIMIT 1`;

        const dist = await queryOne(distQuery, distParams);

        if (!dist) {
          return {
            topic: `Distributor: ${distName}${distGroup ? ` (${distGroup})` : ""}`,
            asOf: todayStr,
            insufficientData: true,
            metrics: { distributorNotFound: true, queriedName: distName, queriedGroup: distGroup || "any" },
            summaryNotes: [`Distributor "${distName}"${distGroup ? ` in ${distGroup} group` : ""} was not found.`],
          };
        }

        const groupLabel = dist.group_type === "IND" ? "IND (India Distribution)" : "AED (AED Distribution)";

        const splits = await query(`
          SELECT
            s.id, s.split_date, s.inr_amount, s.wholesale_rate,
            s.paid_amount_inr, s.balance_inr, s.status,
            t.transaction_number
          FROM distribution_splits s
          JOIN transactions t ON t.id = s.transaction_id
          WHERE s.distributor_id = $1
          ORDER BY s.split_date DESC
          LIMIT 15
        `, [dist.id]);

        const totalInr = splits.reduce((sum: number, s: any) => sum + Number(s.inr_amount || 0), 0);
        const totalPaid = splits.reduce((sum: number, s: any) => sum + Number(s.paid_amount_inr || 0), 0);
        const outstandingBalance = roundTo(totalInr - totalPaid, 2);

        return {
          topic: `${dist.name} (${groupLabel}) — Distribution Summary`,
          asOf: todayStr,
          metrics: {
            distributorName: dist.name,
            distributorCode: dist.code,
            groupType: dist.group_type,
            groupLabel,
            partnerType: dist.partner_type,
            totalAllocatedInr: roundTo(totalInr, 2),
            totalPaidInr: roundTo(totalPaid, 2),
            outstandingBalanceInr: outstandingBalance,
            splitsCount: splits.length,
          },
          records: splits.map((s: any) => ({
            txn: s.transaction_number,
            date: s.split_date,
            inr: roundTo(Number(s.inr_amount), 2),
            wholesaleRate: s.wholesale_rate ? Number(s.wholesale_rate) : null,
            paidInr: roundTo(Number(s.paid_amount_inr || 0), 2),
            balanceInr: roundTo(Number(s.balance_inr || 0), 2),
          })),
        };
      }

      // Case C: General Distribution Splits Overview
      const from = resolvedRange.from || currentMonthStart;
      const to = resolvedRange.to || currentMonthEnd;

      // 1. Fetch individual detailed splits (with customer name, txn number, rates, etc.)
      let splits = await query(`
        SELECT 
          s.id,
          s.split_date,
          t.transaction_number,
          c.name as customer_name,
          d.name as distributor_name,
          d.code as distributor_code,
          COALESCE(d.group_type, 'IND') as distributor_group,
          d.partner_type,
          s.inr_amount,
          s.wholesale_rate,
          s.aed_equivalent,
          s.paid_amount_inr,
          s.balance_inr,
          s.status,
          s.notes
        FROM distribution_splits s
        JOIN transactions t ON t.id = s.transaction_id
        JOIN customers c ON c.id = t.customer_id
        JOIN distributors d ON d.id = s.distributor_id
        WHERE s.split_date >= $1 AND s.split_date <= $2
        ORDER BY s.split_date DESC, s.created_at DESC
        LIMIT 50
      `, [from, to]);

      // If no splits in month range, fetch latest splits overall
      if (splits.length === 0) {
        splits = await query(`
          SELECT 
            s.id,
            s.split_date,
            t.transaction_number,
            c.name as customer_name,
            d.name as distributor_name,
            d.code as distributor_code,
            COALESCE(d.group_type, 'IND') as distributor_group,
            d.partner_type,
            s.inr_amount,
            s.wholesale_rate,
            s.aed_equivalent,
            s.paid_amount_inr,
            s.balance_inr,
            s.status,
            s.notes
          FROM distribution_splits s
          JOIN transactions t ON t.id = s.transaction_id
          JOIN customers c ON c.id = t.customer_id
          JOIN distributors d ON d.id = s.distributor_id
          ORDER BY s.split_date DESC, s.created_at DESC
          LIMIT 50
        `);
      }

      const totalAllocatedInr = splits.reduce((sum: number, s: any) => sum + Number(s.inr_amount || 0), 0);
      const totalDisbursedInr = splits.reduce((sum: number, s: any) => sum + Number(s.paid_amount_inr || 0), 0);
      const pendingDisbursementInr = roundTo(totalAllocatedInr - totalDisbursedInr, 2);

      // Distinct distributors receiving splits in this dataset
      const uniqueDistributors = [...new Set(splits.map((s: any) => `${s.distributor_name} (${s.distributor_group})`))];

      return {
        topic: "Remittance Distribution Splits & Allocations",
        asOf: todayStr,
        periodLabel: resolvedRange.label,
        metrics: {
          totalSplitsCount: splits.length,
          totalAllocatedInr: roundTo(totalAllocatedInr, 2),
          totalDisbursedInr: roundTo(totalDisbursedInr, 2),
          pendingDisbursementInr,
          activeDistributorsCount: uniqueDistributors.length,
          activeDistributorsList: uniqueDistributors.join(", "),
        },
        records: splits.map((s: any) => ({
          splitDate: toDateStr(s.split_date),
          transactionNumber: s.transaction_number,
          customerName: s.customer_name,
          distributor: s.distributor_name,
          group: s.distributor_group,
          inrAllocated: roundTo(Number(s.inr_amount), 2),
          wholesaleRate: s.wholesale_rate ? Number(s.wholesale_rate) : null,
          aedEquivalent: s.aed_equivalent ? roundTo(Number(s.aed_equivalent), 2) : null,
          disbursedInr: roundTo(Number(s.paid_amount_inr || 0), 2),
          pendingBalanceInr: roundTo(Number(s.balance_inr || 0), 2),
          status: s.status || "ALLOCATED",
          notes: s.notes || "-",
        })),
        summaryNotes: [
          "Allocated INR represents the portion of the customer's remittance order assigned to this distributor.",
          "AED Equivalent = INR Amount / Wholesale Rate (backend calculated).",
          "Status 'ALLOCATED' indicates the split is assigned and pending disbursement/settlement.",
        ],
      };
    }

    case "BANK_DISTRIBUTION": {
      const distName = entities.distributorName;
      // Requirement: MK, SALA, etc. There is only ONE logical MK account.
      let accountWhere = "";
      const params: any[] = [];
      if (distName) {
        params.push(`%${distName}%`);
        accountWhere = `WHERE UPPER(a.account_name) LIKE UPPER($1) OR UPPER(a.account_code) LIKE UPPER($1)`;
      }

      const accounts = await query(`
        SELECT 
          a.id,
          a.account_code,
          a.account_name,
          a.bank_name,
          COALESCE(r.balance_inr, 0) as latest_balance_inr,
          COALESCE(r.record_date, a.created_at::date) as latest_record_date
        FROM bank_distrip_accounts a
        LEFT JOIN LATERAL (
          SELECT balance_inr, record_date 
          FROM bank_distrip_records 
          WHERE account_id = a.id 
          ORDER BY record_date DESC, created_at DESC 
          LIMIT 1
        ) r ON true
        ${accountWhere}
        ORDER BY a.account_name ASC
      `, params);

      // Monthly commission
      const from = resolvedRange.from || currentMonthStart;
      const to = resolvedRange.to || currentMonthEnd;
      const commissionStats = await queryOne(`
        SELECT 
          COALESCE(SUM(commission_inr), 0) as total_commission,
          COALESCE(SUM(order_inr), 0) as total_order,
          COALESCE(SUM(paid_inr), 0) as total_paid
        FROM bank_distrip_records
        WHERE record_date >= $1 AND record_date <= $2
      `, [from, to]);

      const totalPendingBalance = accounts.reduce((sum: number, a: any) => sum + Number(a.latest_balance_inr || 0), 0);

      return {
        topic: "Bank Distribution (Bank Distrip) Summary",
        asOf: todayStr,
        periodLabel: resolvedRange.label,
        metrics: {
          totalCommissionRecordedInr: roundTo(Number(commissionStats?.total_commission || 0), 2),
          totalOrdersInr: roundTo(Number(commissionStats?.total_order || 0), 2),
          totalPaidInr: roundTo(Number(commissionStats?.total_paid || 0), 2),
          totalPendingBankBalanceInr: roundTo(totalPendingBalance, 2),
          matchedAccountsCount: accounts.length,
        },
        records: accounts.map((a: any) => ({
          accountCode: a.account_code,
          accountName: a.account_name,
          bankName: a.bank_name || "N/A",
          currentBalanceInr: roundTo(Number(a.latest_balance_inr || 0), 2),
          asOfDate: a.latest_record_date,
        })),
      };
    }

    case "TRANSACTION_QUERY": {
      let where = "WHERE t.status = 'CONFIRMED'";
      const params: any[] = [];

      if (entities.customerName) {
        params.push(entities.customerName);
        where += ` AND UPPER(c.name) = UPPER($${params.length})`;
      }

      if (entities.minAmount) {
        params.push(entities.minAmount);
        where += ` AND t.inr_amount >= $${params.length}`;
      }

      if (entities.dateRange?.from) {
        params.push(entities.dateRange.from);
        where += ` AND t.transaction_date >= $${params.length}`;
      }
      if (entities.dateRange?.to) {
        params.push(entities.dateRange.to);
        where += ` AND t.transaction_date <= $${params.length}`;
      }

      const txns = await query(`
        SELECT 
          t.id,
          t.transaction_number,
          t.transaction_date,
          c.name as customer_name,
          t.inr_amount,
          t.customer_rate,
          t.aed_amount,
          t.cost_aed,
          t.net_profit_aed,
          COALESCE((
            SELECT SUM(cp.amount_aed) 
            FROM customer_payments cp 
            WHERE cp.transaction_id = t.id
          ), 0) as paid_aed,
          COALESCE((
            SELECT SUM(ds.inr_amount) 
            FROM distribution_splits ds 
            WHERE ds.transaction_id = t.id
          ), 0) as distributed_inr
        FROM transactions t
        JOIN customers c ON c.id = t.customer_id
        ${where}
        ORDER BY t.transaction_date DESC, t.created_at DESC
        LIMIT 20
      `, params);

      const totalInr = txns.reduce((sum: number, t: any) => sum + Number(t.inr_amount || 0), 0);
      const totalAed = txns.reduce((sum: number, t: any) => sum + Number(t.aed_amount || 0), 0);
      const totalProfit = txns.reduce((sum: number, t: any) => sum + Number(t.net_profit_aed || 0), 0);

      return {
        topic: "Filtered Transactions Query",
        asOf: todayStr,
        periodLabel: entities.dateRange?.label,
        metrics: {
          count: txns.length,
          totalInr: roundTo(totalInr, 2),
          totalAed: roundTo(totalAed, 2),
          totalNetProfitAed: roundTo(totalProfit, 2),
        },
        records: txns.map((t: any) => ({
          transactionNumber: t.transaction_number,
          date: t.transaction_date,
          customer: t.customer_name,
          inr: roundTo(Number(t.inr_amount), 2),
          rate: Number(t.customer_rate),
          aed: roundTo(Number(t.aed_amount), 2),
          paidAed: roundTo(Number(t.paid_aed), 2),
          pendingAed: roundTo(Math.max(0, Number(t.aed_amount) - Number(t.paid_aed)), 2),
          allocatedInr: roundTo(Number(t.distributed_inr), 2),
        })),
      };
    }

    case "DISTRIBUTORS_LIST": {
      const groupFilter = entities.distributorGroup; // "IND" | "AED" | undefined

      let whereClause = "";
      const params: any[] = [];
      if (groupFilter) {
        params.push(groupFilter);
        whereClause = `WHERE d.group_type = $${params.length}`;
      }

      const rows = await query(`
        SELECT 
          d.id,
          d.code,
          d.name,
          d.group_type,
          d.partner_type,
          d.default_settlement_currency,
          d.status,
          COALESCE((SELECT SUM(s.inr_amount) FROM distribution_splits s WHERE s.distributor_id = d.id), 0) as total_splits_inr,
          COALESCE((SELECT SUM(s.paid_amount_inr) FROM distribution_splits s WHERE s.distributor_id = d.id), 0) as total_splits_paid_inr,
          COALESCE((SELECT SUM(s.balance_inr) FROM distribution_splits s WHERE s.distributor_id = d.id), 0) as splits_balance_inr
        FROM distributors d
        ${whereClause}
        ORDER BY d.group_type ASC, d.name ASC
      `, params);

      const indList = rows.filter((d: any) => d.group_type === "IND");
      const aedList = rows.filter((d: any) => d.group_type === "AED" && d.partner_type !== "BANK_ACCOUNT");

      const totalIndAllocated = indList.reduce((sum: number, d: any) => sum + Number(d.total_splits_inr || 0), 0);
      const totalIndPaid = indList.reduce((sum: number, d: any) => sum + Number(d.total_splits_paid_inr || 0), 0);
      const totalIndBalance = indList.reduce((sum: number, d: any) => sum + Number(d.splits_balance_inr || 0), 0);

      return {
        topic: groupFilter ? `${groupFilter} Distribution Parties Roster (Neon DB)` : "Complete Distributors Structure (IND vs AED Groups)",
        asOf: todayStr,
        metrics: {
          requestedGroup: groupFilter || "ALL",
          indCount: indList.length,
          aedCount: aedList.length,
          totalIndAllocatedInr: roundTo(totalIndAllocated, 2),
          totalIndPaidInr: roundTo(totalIndPaid, 2),
          totalIndPendingBalanceInr: roundTo(totalIndBalance, 2),
          sarabuDistinction: "SARABU (IND) and SARABU (AED) are TWO SEPARATE accounts with distinct IDs and balances.",
          aedTotalRule: "AED Total is calculated as: SALA + SARABU(AED) + MK + ISMAIL + NNG = TOTAL",
          commisonRule: "COMMISON requires client confirmation before treating as a party.",
        },
        records: rows.map((d: any) => ({
          name: d.name,
          group: d.group_type,
          code: d.code,
          partnerType: d.partner_type,
          currency: d.default_settlement_currency,
          status: d.status,
          allocatedInr: d.group_type === "IND" ? roundTo(Number(d.total_splits_inr || 0), 2) : undefined,
          paidInr: d.group_type === "IND" ? roundTo(Number(d.total_splits_paid_inr || 0), 2) : undefined,
          balanceInr: d.group_type === "IND" ? roundTo(Number(d.splits_balance_inr || 0), 2) : undefined,
        })),
        summaryNotes: [
          "IND Distribution Group: AWAFI, NF2, HAJA, SARABU (IND), BASID (India-side parties for customer order splits)",
          "AED Distribution Group: SALA, SARABU (AED), MK, ISMAIL, NNG (AED-side parties)",
          "CRITICAL: SARABU exists in BOTH groups as two distinct accounts. Do NOT merge them.",
        ],
      };
    }

    case "CUSTOMERS_LIST": {
      const customers = await query(`
        SELECT 
          c.id,
          c.code,
          c.name,
          c.phone,
          c.default_rate,
          c.status,
          COALESCE((SELECT SUM(t.inr_amount) FROM transactions t WHERE t.customer_id = c.id AND t.status = 'CONFIRMED'), 0) as total_inr,
          COALESCE((SELECT SUM(t.aed_amount) FROM transactions t WHERE t.customer_id = c.id AND t.status = 'CONFIRMED'), 0) as total_aed,
          COALESCE((SELECT SUM(p.amount_aed) FROM customer_payments p WHERE p.customer_id = c.id), 0) as total_paid
        FROM customers c
        ORDER BY c.name ASC
      `);

      const totalInr = customers.reduce((sum: number, c: any) => sum + Number(c.total_inr || 0), 0);
      const totalAed = customers.reduce((sum: number, c: any) => sum + Number(c.total_aed || 0), 0);
      const totalPaid = customers.reduce((sum: number, c: any) => sum + Number(c.total_paid || 0), 0);
      const totalOutstanding = roundTo(totalAed - totalPaid, 2);

      return {
        topic: "Dubai Customers & Receivables Roster (Neon DB)",
        asOf: todayStr,
        metrics: {
          customerCount: customers.length,
          totalInrVolume: roundTo(totalInr, 2),
          totalAedBilled: roundTo(totalAed, 2),
          totalAedCollected: roundTo(totalPaid, 2),
          totalOutstandingReceivablesAed: totalOutstanding,
        },
        records: customers.map((c: any) => {
          const billed = roundTo(Number(c.total_aed || 0), 2);
          const paid = roundTo(Number(c.total_paid || 0), 2);
          return {
            name: c.name,
            code: c.code,
            phone: c.phone || "-",
            defaultRate: c.default_rate ? Number(c.default_rate) : null,
            totalInr: roundTo(Number(c.total_inr || 0), 2),
            totalAedBilled: billed,
            totalAedPaid: paid,
            outstandingBalanceAed: roundTo(billed - paid, 2),
            status: c.status,
          };
        }),
      };
    }

    case "DATABASE_OVERVIEW": {
      // Direct count queries against Neon
      const txnCount = await queryOne(`SELECT COUNT(*) as c, COALESCE(SUM(inr_amount), 0) as inr, COALESCE(SUM(aed_amount), 0) as aed, COALESCE(SUM(net_profit_aed), 0) as profit FROM transactions WHERE status = 'CONFIRMED'`);
      const custCount = await queryOne(`SELECT COUNT(*) as c FROM customers`);
      const payCount = await queryOne(`SELECT COUNT(*) as c, COALESCE(SUM(amount_aed), 0) as total FROM customer_payments`);
      const splitCount = await queryOne(`SELECT COUNT(*) as c, COALESCE(SUM(inr_amount), 0) as total FROM distribution_splits`);
      const distStats = await query(`SELECT group_type, COUNT(*) as c FROM distributors GROUP BY group_type`);
      const bankStats = await queryOne(`SELECT COUNT(*) as c FROM bank_distrip_records`);

      const totalBilled = Number(txnCount?.aed || 0);
      const totalCollected = Number(payCount?.total || 0);
      const outstandingReceivables = roundTo(totalBilled - totalCollected, 2);

      const indCount = distStats.find((d: any) => d.group_type === "IND")?.c || 0;
      const aedCount = distStats.find((d: any) => d.group_type === "AED")?.c || 0;

      return {
        topic: "Neon PostgreSQL Live Database Overview",
        asOf: todayStr,
        metrics: {
          neonConnected: true,
          databaseType: "Neon Serverless PostgreSQL",
          confirmedTransactionsCount: Number(txnCount?.c || 0),
          totalInrVolume: roundTo(Number(txnCount?.inr || 0), 2),
          totalAedBilled: roundTo(totalBilled, 2),
          totalProfitAed: roundTo(Number(txnCount?.profit || 0), 2),
          totalCustomersRegistered: Number(custCount?.c || 0),
          customerPaymentsCount: Number(payCount?.c || 0),
          totalAedCollected: roundTo(totalCollected, 2),
          outstandingReceivablesAed: outstandingReceivables,
          distributionSplitsCount: Number(splitCount?.c || 0),
          totalDistributedInr: roundTo(Number(splitCount?.total || 0), 2),
          indiaDistributorsCount: Number(indCount),
          aedDistributorsCount: Number(aedCount),
          bankLedgerRecordsCount: Number(bankStats?.c || 0),
        },
        summaryNotes: [
          "Database connection to Neon PostgreSQL is healthy and live.",
          "Single source of truth for all customer balances, remittance orders, and distributor allocations.",
        ],
      };
    }

    case "PERIOD_SUMMARY":
    default: {
      const from = resolvedRange.from || currentMonthStart;
      const to = resolvedRange.to || currentMonthEnd;

      const summary = await queryOne(`
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(inr_amount), 0) as total_inr,
          COALESCE(SUM(aed_amount), 0) as total_aed,
          COALESCE(SUM(gross_profit_aed), 0) as gross_profit,
          COALESCE(SUM(delivery_charge_aed), 0) as delivery_charges,
          COALESCE(SUM(net_profit_aed), 0) as net_profit
        FROM transactions
        WHERE status = 'CONFIRMED' AND transaction_date >= $1 AND transaction_date <= $2
      `, [from, to]);

      const paySummary = await queryOne(`
        SELECT COALESCE(SUM(amount_aed), 0) as total_collected
        FROM customer_payments
        WHERE payment_date >= $1 AND payment_date <= $2
      `, [from, to]);

      // General overview context so AI always has verified ground truth
      const allTxnStats = await queryOne(`
        SELECT 
          COUNT(*) as total_count,
          COALESCE(SUM(inr_amount), 0) as total_inr,
          COALESCE(SUM(aed_amount), 0) as total_aed,
          COALESCE(SUM(net_profit_aed), 0) as total_profit
        FROM transactions WHERE status = 'CONFIRMED'
      `);

      const custOverview = await queryOne(`
        SELECT 
          COUNT(*) as customer_count,
          COALESCE((SELECT SUM(t.aed_amount) FROM transactions t WHERE t.status = 'CONFIRMED'), 0) -
          COALESCE((SELECT SUM(p.amount_aed) FROM customer_payments p), 0) as outstanding_aed
        FROM customers
      `);

      const distCount = await queryOne(`
        SELECT 
          COUNT(CASE WHEN group_type = 'IND' THEN 1 END) as ind_count,
          COUNT(CASE WHEN group_type = 'AED' THEN 1 END) as aed_count
        FROM distributors
      `);

      return {
        topic: "Business & Financial Summary (Neon DB)",
        asOf: todayStr,
        periodLabel: resolvedRange.label,
        dateRange: { from, to },
        metrics: {
          periodTransactionCount: Number(summary?.count || 0),
          periodInrProcessed: roundTo(Number(summary?.total_inr || 0), 2),
          periodAedBilled: roundTo(Number(summary?.total_aed || 0), 2),
          periodAedCollected: roundTo(Number(paySummary?.total_collected || 0), 2),
          periodNetProfitAed: roundTo(Number(summary?.net_profit || 0), 2),
          allTimeTransactionCount: Number(allTxnStats?.total_count || 0),
          allTimeInrProcessed: roundTo(Number(allTxnStats?.total_inr || 0), 2),
          allTimeAedBilled: roundTo(Number(allTxnStats?.total_aed || 0), 2),
          allTimeProfitAed: roundTo(Number(allTxnStats?.total_profit || 0), 2),
          registeredCustomersCount: Number(custOverview?.customer_count || 0),
          totalOutstandingReceivablesAed: roundTo(Number(custOverview?.outstanding_aed || 0), 2),
          indDistributorsCount: Number(distCount?.ind_count || 0),
          aedDistributorsCount: Number(distCount?.aed_count || 0),
        },
        summaryNotes: [
          "IND Distributors: AWAFI, NF2, HAJA, SARABU (IND), BASID",
          "AED Distributors: SALA, SARABU (AED), MK, ISMAIL, NNG",
          "SARABU (IND) and SARABU (AED) are two separate accounts.",
        ],
      };
    }
  }
}
