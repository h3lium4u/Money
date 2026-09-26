import { NextResponse } from "next/server";
import { getTransaction, voidTransaction, getAuditLogs } from "@/lib/repository";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const txn = await getTransaction(id);
    if (!txn) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const auditLogs = await getAuditLogs('TRANSACTION', id);
    return NextResponse.json({ transaction: txn, auditLogs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch transaction" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = body.reason || "Voided by user";

    const voided = await voidTransaction(id, reason);
    return NextResponse.json(voided);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to void transaction" }, { status: 400 });
  }
}
