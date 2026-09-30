import { NextResponse } from "next/server";
import { getPartySplitSummary } from "@/lib/repository";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const today = searchParams.get("today") || undefined;
    const summary = await getPartySplitSummary(today);
    return NextResponse.json(summary);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch party split summary" },
      { status: 500 }
    );
  }
}
