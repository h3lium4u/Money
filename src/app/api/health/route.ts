import { NextResponse } from 'next/server';
import { warmUp, isNeonEnabled, query, resolveDatabaseUrl } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const start = Date.now();
  try {
    await warmUp();

    let stats: any = {};
    if (isNeonEnabled()) {
      const [tStats, pStats, sStats, bStats] = await Promise.all([
        query("SELECT COUNT(*)::int as count, MIN(to_char(transaction_date, 'YYYY-MM-DD')) as min_d, MAX(to_char(transaction_date, 'YYYY-MM-DD')) as max_d, SUM(inr_amount)::numeric as sum_inr, SUM(aed_amount)::numeric as sum_aed FROM transactions"),
        query("SELECT COUNT(*)::int as count, MIN(to_char(payment_date, 'YYYY-MM-DD')) as min_d, MAX(to_char(payment_date, 'YYYY-MM-DD')) as max_d, SUM(amount_aed)::numeric as sum_aed FROM customer_payments"),
        query("SELECT COUNT(*)::int as count, MIN(to_char(split_date, 'YYYY-MM-DD')) as min_d, MAX(to_char(split_date, 'YYYY-MM-DD')) as max_d, SUM(inr_amount)::numeric as sum_inr FROM distribution_splits"),
        query("SELECT COUNT(*)::int as count, MIN(to_char(record_date, 'YYYY-MM-DD')) as min_d, MAX(to_char(record_date, 'YYYY-MM-DD')) as max_d FROM bank_distrip_records"),
      ]);

      const dbUrl = resolveDatabaseUrl() || "";
      const hostMatch = dbUrl.match(/@([^/:]+)/);
      const host = hostMatch ? hostMatch[1] : "unknown";

      stats = {
        host,
        transactions: tStats[0] || null,
        payments: pStats[0] || null,
        splits: sStats[0] || null,
        bankRecords: bStats[0] || null,
      };
    }

    return NextResponse.json({ 
      ok: true, 
      neon: isNeonEnabled(),
      warmupMs: Date.now() - start,
      databaseStats: stats,
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ 
      ok: false, 
      error: err?.message || "Health check failed",
      warmupMs: Date.now() - start 
    }, { 
      status: 500,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  }
}
