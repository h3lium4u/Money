import { NextResponse } from "next/server";
import { recordCustomerPayment, deleteCustomerPayment, listCustomerPayments } from "@/lib/repository";
import { z } from "zod";

const schema = z.object({
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  amount_aed: z.number().positive("Payment amount must be greater than zero"),
  payment_method: z.string().default("CASH"),
  reference_number: z.string().optional(),
  transaction_id: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payments = await listCustomerPayments({ customerId: id });
    return NextResponse.json(payments);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch payments" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = schema.parse(body);

    const payment = await recordCustomerPayment({
      customer_id: id,
      ...validated,
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to record payment" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get("paymentId");
    if (!paymentId) {
      return NextResponse.json({ error: "paymentId is required" }, { status: 400 });
    }

    await deleteCustomerPayment(paymentId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete payment" }, { status: 400 });
  }
}
