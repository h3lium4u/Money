import { NextResponse } from "next/server";
import { getTransaction, voidTransaction, updateTransaction, deleteTransaction, getAuditLogs } from "@/lib/repository";
import { z } from "zod";

const updateSchema = z.object({
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").optional(),
  customer_id: z.string().min(1).optional(),
  total: z.number().positive().optional(),
  inr_amount: z.number().positive().optional(),
  manual_rate: z.number().positive().optional(),
  customer_rate: z.number().positive().optional(),
  base_rate: z.number().positive().optional(),
  wholesale_rate: z.number().positive().optional(),
  paid_amount: z.number().min(0).optional(),
  paid_aed: z.number().min(0).optional(),
  delivery_charge_pct: z.number().min(0).max(1).optional(),
  notes: z.string().optional(),
  reason: z.string().optional(),
  splits: z.array(z.object({
    id: z.string().optional(),
    distributor_id: z.string().min(1, "Party / Distributor is required"),
    inr_amount: z.number().positive("Split amount must be greater than 0"),
    notes: z.string().optional(),
  })).optional(),
});

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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = updateSchema.parse(body);

    const updated = await updateTransaction(id, validated);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update transaction" }, { status: 400 });
  }
}

export const PATCH = PUT;

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action"); // 'void' or 'delete'

    if (action === "void") {
      const body = await request.json().catch(() => ({}));
      const reason = body.reason || "Voided by user";
      const voided = await voidTransaction(id, reason);
      return NextResponse.json(voided);
    } else {
      // Permanent delete
      await deleteTransaction(id);
      return NextResponse.json({ success: true, message: "Transaction permanently deleted" });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete transaction" }, { status: 400 });
  }
}
