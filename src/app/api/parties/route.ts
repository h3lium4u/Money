import { NextResponse } from "next/server";
import { listParties, createParty } from "@/lib/repository";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Party name is required"),
  code: z.string().optional(),
  phone: z.string().optional(),
  default_rate: z.number().positive().optional(),
});

export async function GET() {
  try {
    const parties = await listParties();
    return NextResponse.json(parties);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to list parties" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = schema.parse(body);

    const created = await createParty(validated);
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create party" }, { status: 400 });
  }
}
