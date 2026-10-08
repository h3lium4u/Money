import { NextResponse } from "next/server";
import { getPartiesPriorTransfersSummary } from "@/lib/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getPartiesPriorTransfersSummary();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Failed to fetch party prior transfers summary:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch party prior transfers" },
      { status: 500 }
    );
  }
}
