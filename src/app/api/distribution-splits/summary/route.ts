import { NextResponse } from "next/server";
import { getPartySplitSummary } from "@/lib/repository";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const today = searchParams.get("today") || undefined;
    const summary = await getPartySplitSummary(today);
    return NextResponse.json(summary, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch party split summary" },
      { status: 500 }
    );
  }
}
