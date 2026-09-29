import { NextResponse } from "next/server";
import { listCustomers, createCustomer } from "@/lib/repository";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Customer name is required"),
  code: z.string().optional(),
  phone: z.string().optional(),
  default_rate: z.number().positive().optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "CUSTOMER";
    const customers = await listCustomers(type);
    return NextResponse.json(customers);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to list customers" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = schema.parse(body);

    const created = await createCustomer(validated);
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create customer" }, { status: 400 });
  }
}
