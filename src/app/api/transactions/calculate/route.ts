import { NextResponse } from "next/server";
import { calculateTransaction } from "@/lib/calculations";
import { z } from "zod";

const schema = z.object({
  inrAmount: z.number().positive("INR Amount must be greater than zero"),
  customerRate: z.number().positive("Customer rate must be greater than zero"),
  baseRate: z.number().positive("Base rate must be greater than zero"),
  deliveryChargePct: z.number().min(0).max(1).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = schema.parse(body);

    const result = calculateTransaction(validated);

    // Rate sanity check (soft warning):
    let warning = null;
    if (result.customerRate < 35.0 || result.customerRate > 45.0) {
      warning = `Customer rate (${result.customerRate}) is outside typical range (35.00 - 45.00 AED/1000). Please verify.`;
    }

    return NextResponse.json({ ...result, warning });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Invalid calculation parameters" }, { status: 400 });
  }
}
