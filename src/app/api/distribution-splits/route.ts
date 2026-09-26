import { NextResponse } from "next/server";
import { listDistributionSplits, createDistributionSplit, deleteDistributionSplit } from "@/lib/repository";
import { z } from "zod";

const createSplitSchema = z.object({
  transaction_id: z.string().min(1, "Transaction ID is required"),
  distributor_id: z.string().min(1, "Distributor ID is required"),
  split_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  inr_amount: z.number().positive("Distribution amount must be greater than zero"),
  wholesale_rate: z.number().positive().optional(),
  notes: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get("transaction_id") || undefined;
    const distributorId = searchParams.get("distributor_id") || undefined;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    const splits = await listDistributionSplits({
      transaction_id: transactionId,
      distributor_id: distributorId,
      from,
      to,
    });

    return NextResponse.json(splits);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to list distribution splits" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = createSplitSchema.parse(body);

    const created = await createDistributionSplit(validated);
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create distribution split" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Split ID is required" }, { status: 400 });
    }

    await deleteDistributionSplit(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete distribution split" }, { status: 500 });
  }
}
