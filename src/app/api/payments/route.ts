import { NextResponse } from "next/server";
import { listCustomerPayments } from "@/lib/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId") || undefined;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    const payments = await listCustomerPayments({ customerId, from, to });
    return NextResponse.json(payments);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch payments" },
      { status: 500 }
    );
  }
}
