import { NextResponse } from "next/server";
import { getCustomerLedger } from "@/lib/repository";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ledger = await getCustomerLedger(id);
    return NextResponse.json(ledger);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch customer ledger" }, { status: 404 });
  }
}
