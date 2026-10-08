import { NextResponse } from "next/server";
import {
  getScheduledWipeStatus,
  scheduleWipe,
  revokeWipe,
  executeWipeNow,
} from "@/lib/scheduled-wipe";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "revoke") {
      const status = await revokeWipe();
      return NextResponse.json(status);
    }

    if (action === "schedule") {
      const hours = Number(searchParams.get("hours")) || 24;
      const status = await scheduleWipe(hours);
      return NextResponse.json(status);
    }

    const status = await getScheduledWipeStatus();
    return NextResponse.json(status);
  } catch (error: any) {
    console.error("Scheduled wipe API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to handle scheduled wipe" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || "schedule";

    if (action === "revoke") {
      const status = await revokeWipe();
      return NextResponse.json(status);
    }

    if (action === "execute_now") {
      await executeWipeNow();
      return NextResponse.json({ status: "EXECUTED", message: "Ledger cleared successfully" });
    }

    // Default action: schedule wipe with delay (default 24 hours)
    const hours = Number(body.hours) || 24;
    const status = await scheduleWipe(hours);
    return NextResponse.json(status);
  } catch (error: any) {
    console.error("Scheduled wipe POST error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process wipe schedule" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const status = await revokeWipe();
    return NextResponse.json(status);
  } catch (error: any) {
    console.error("Scheduled wipe DELETE error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to revoke wipe schedule" },
      { status: 500 }
    );
  }
}
