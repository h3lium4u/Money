import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { listDistributors, listDistributionSplits } from "@/lib/repository";

// In-memory server cache to eliminate round-trip latency on repeated page hits
let memoryCache: {
  data: any;
  timestamp: number;
} | null = null;

const CACHE_TTL_MS = 15000; // 15 seconds

export function invalidateDistributorsPageCache() {
  memoryCache = null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "true";

    const now = Date.now();
    if (!forceRefresh && memoryCache && (now - memoryCache.timestamp) < CACHE_TTL_MS) {
      return NextResponse.json(memoryCache.data, {
        headers: {
          "X-Cache": "HIT",
          "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
        },
      });
    }

    // Run parallel high-speed queries on the server side
    const [dists, targetTxns, recentSplits, poolStats] = await Promise.all([
      // 1. All distributors with pre-aggregated split totals
      listDistributors(),

      // 2. Customer Transactions with aggregated split details
      query(`
        WITH target_txns AS (
          SELECT t.*, c.code as customer_code, c.name as customer_name, c.entity_type, c.party_type
          FROM transactions t
          JOIN customers c ON c.id = t.customer_id
          WHERE COALESCE(c.entity_type, 'CUSTOMER') = 'CUSTOMER'
          ORDER BY t.transaction_date DESC, t.created_at DESC
          LIMIT 120
        ),
        split_agg AS (
          SELECT s2.transaction_id,
                 STRING_AGG(DISTINCT d2.name, ', ' ORDER BY d2.name) AS distributor_names,
                 STRING_AGG(d2.name || ' (₹' || s2.inr_amount::text || ')', ', ') AS distributor_split_details,
                 SUM(s2.inr_amount) AS total_distributed_inr
          FROM distribution_splits s2
          JOIN distributors d2 ON d2.id = s2.distributor_id
          WHERE s2.transaction_id IN (SELECT id FROM target_txns)
          GROUP BY s2.transaction_id
        ),
        pay_agg AS (
          SELECT cp.transaction_id, SUM(cp.amount_aed) AS paid_aed
          FROM customer_payments cp
          WHERE cp.transaction_id IN (SELECT id FROM target_txns)
          GROUP BY cp.transaction_id
        )
        SELECT
          t.*,
          d.name as distributor_name,
          COALESCE(sa.distributor_names, d.name, '-') as distributor_names,
          COALESCE(sa.distributor_split_details, '-') as distributor_split_details,
          COALESCE(sa.total_distributed_inr, 0) as total_distributed_inr,
          COALESCE(pa.paid_aed, 0) as paid_aed
        FROM target_txns t
        LEFT JOIN distributors d ON d.id = t.distributor_id
        LEFT JOIN split_agg sa ON sa.transaction_id = t.id
        LEFT JOIN pay_agg pa ON pa.transaction_id = t.id
        ORDER BY t.transaction_date DESC, t.created_at DESC;
      `),

      // 3. Most recent splits (250 items for rapid initial load)
      listDistributionSplits({ limit: 250 }),

      // 4. Instant aggregate pool stats across all customer orders
      query<{ total_orders_inr: string; total_allocated_inr: string; total_splits_count: string }>(`
        SELECT 
          (SELECT COALESCE(SUM(t.inr_amount), 0) FROM transactions t JOIN customers c ON c.id = t.customer_id WHERE COALESCE(c.entity_type, 'CUSTOMER') = 'CUSTOMER' AND t.status = 'CONFIRMED') as total_orders_inr,
          (SELECT COALESCE(SUM(inr_amount), 0) FROM distribution_splits) as total_allocated_inr,
          (SELECT COUNT(*)::text FROM distribution_splits) as total_splits_count;
      `),
    ]);

    // Compute overview pool metrics across the entire business database
    const totalOrdersInr = poolStats[0]?.total_orders_inr ? Number(poolStats[0].total_orders_inr) : targetTxns.reduce((sum: number, t: any) => sum + (Number(t.inr_amount) || 0), 0);
    const totalAllocatedInr = poolStats[0]?.total_allocated_inr ? Number(poolStats[0].total_allocated_inr) : 0;
    const totalPendingInr = Math.max(0, Math.round((totalOrdersInr - totalAllocatedInr) * 100) / 100);

    const payload = {
      distributors: dists || [],
      transactions: targetTxns || [],
      splits: recentSplits || [],
      summaryStats: {
        totalOrdersInr,
        totalAllocatedInr,
        totalPendingInr,
        totalSplitsCount: Number(poolStats[0]?.total_splits_count || recentSplits.length),
      },
    };

    memoryCache = {
      data: payload,
      timestamp: now,
    };

    return NextResponse.json(payload, {
      headers: {
        "X-Cache": "MISS",
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
      },
    });
  } catch (error: any) {
    console.error("Distributors page-data API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch distribution page data" },
      { status: 500 }
    );
  }
}
