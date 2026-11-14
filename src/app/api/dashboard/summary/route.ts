import { NextResponse } from "next/server";
import { getDashboardKPIs } from "@/lib/repository";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    const data = await getDashboardKPIs({ from, to });
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load dashboard KPIs" }, { status: 500 });
  }
}
