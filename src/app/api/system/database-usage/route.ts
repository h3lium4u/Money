import { NextResponse } from "next/server";
import { getDatabaseUsage } from "@/lib/system-health";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scenario = searchParams.get("scenario") || null;
    const simulatePercentStr = searchParams.get("simulatePercent");
    const simulatePercent = simulatePercentStr ? parseFloat(simulatePercentStr) : null;

    const data = await getDatabaseUsage({
      scenario,
      simulatePercent: simulatePercent !== null && !isNaN(simulatePercent) ? simulatePercent : undefined,
    });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("Failed to retrieve database storage usage:", error);
    // Never expose database credentials or connection strings in error responses
    return NextResponse.json(
      {
        error: "Failed to retrieve database storage usage. Please check database connectivity.",
        status: "unknown",
        checkedAt: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
