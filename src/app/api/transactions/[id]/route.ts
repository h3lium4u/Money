import { NextResponse } from "next/server";
import { getTransaction, voidTransaction } from "@/lib/repository";
import { getDb } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const txn = getTransaction(id);
    if (!txn) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const db = getDb();
    const auditLogs = db.prepare(`
      SELECT * FROM audit_logs 
      WHERE entity_id = ? AND entity_name = 'TRANSACTION'
      ORDER BY created_at DESC
    `).all(id);

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

    const voided = voidTransaction(id, reason);
    return NextResponse.json(voided);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to void transaction" }, { status: 400 });
  }
}
