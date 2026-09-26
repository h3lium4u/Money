import { NextResponse } from "next/server";
import { getDashboardKPIs } from "@/lib/repository";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    const data = getDashboardKPIs({ from, to });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load dashboard KPIs" }, { status: 500 });
  }
}
