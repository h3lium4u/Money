import { NextResponse } from "next/server";
import { listDistributors, createDistributor } from "@/lib/repository";
import { z } from "zod";

const createDistributorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().optional(),
  group_type: z.union([z.literal("IND"), z.literal("AED")], { error: "group_type must be IND or AED" }),
  partner_type: z.string().optional(),
  default_settlement_currency: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const group = searchParams.get("group") as "IND" | "AED" | null;
    const distributors = await listDistributors(group || undefined);
    return NextResponse.json(distributors);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to list distributors" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = createDistributorSchema.parse(body);
    const distributor = await createDistributor(validated);
    return NextResponse.json(distributor, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create distributor" }, { status: 400 });
  }
}
