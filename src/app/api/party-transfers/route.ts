import { NextResponse } from "next/server";
import { getPartyTransfersData, createTransaction } from "@/lib/repository";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get("refresh") === "true";
    const data = await getPartyTransfersData(refresh);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Failed to fetch party transfers data:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch party transfers" },
      { status: 500 }
    );
  }
}
