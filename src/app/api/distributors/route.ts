import { NextResponse } from "next/server";
import { listDistributors } from "@/lib/repository";

export async function GET() {
  try {
    const distributors = await listDistributors();
    return NextResponse.json(distributors);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to list distributors" }, { status: 500 });
  }
}
