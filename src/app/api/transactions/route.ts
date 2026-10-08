import { NextResponse } from "next/server";
import { listTransactions, createTransaction } from "@/lib/repository";
import { z } from "zod";

const createSchema = z.object({
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  customer_id: z.string().min(1, "Dubai client is required"),
  total: z.number().positive("Total must be greater than 0").optional(),
  inr_amount: z.number().positive("Amount must be greater than 0").optional(),
  manual_rate: z.number().positive("Manual rate must be positive").optional(),
  customer_rate: z.number().positive("Customer rate must be positive").optional(),
  base_rate: z.number().positive("Base rate must be positive").optional(),
  wholesale_rate: z.number().positive().optional(),
  paid_amount: z.number().min(0, "Paid amount cannot be negative").optional(),
  paid_aed: z.number().min(0).optional(),
  delivery_charge_pct: z.number().min(0).max(1).optional(),
  distributor_id: z.string().nullable().optional(),
  notes: z.string().optional(),
  splits: z.array(z.object({
    distributor_id: z.string().min(1),
    inr_amount: z.number().positive(),
    paid_amount_inr: z.number().min(0).optional(),
    balance_inr: z.number().min(0).optional(),
    notes: z.string().optional()
  })).optional(),
}).refine(data => data.total !== undefined || data.inr_amount !== undefined, {
  message: "Total INR amount is required",
  path: ["total"],
}).refine(data => data.manual_rate !== undefined || data.customer_rate !== undefined, {
  message: "Manual rate value is required",
  path: ["manual_rate"],
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const customerId = searchParams.get("customerId") || undefined;
    const status = searchParams.get("status") || undefined;
    const entityType = searchParams.get("entityType") || "CUSTOMER";
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 100;

    const data = await listTransactions({ from, to, customerId, status, limit, entityType });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to list transactions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = createSchema.parse(body);

    const created = await createTransaction(validated);
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create transaction" }, { status: 400 });
  }
}
