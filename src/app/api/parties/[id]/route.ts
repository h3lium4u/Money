import { NextResponse } from "next/server";
import { getCustomerLedger, updateCustomer, deleteCustomer } from "@/lib/repository";
import { z } from "zod";

const updatePartySchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().optional(),
  phone: z.string().optional(),
  default_rate: z.number().positive().optional(),
  status: z.string().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ledger = await getCustomerLedger(id);
    return NextResponse.json(ledger);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch party ledger" }, { status: 404 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = updatePartySchema.parse(body);

    const updated = await updateCustomer(id, validated);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update party" }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteCustomer(id);
    return NextResponse.json({ success: true, message: "Party deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete party" }, { status: 400 });
  }
}
