import { NextResponse } from "next/server";
import {
  getScheduledWipeStatus,
  scheduleWipe,
  revokeWipe,
  executeWipeNow,
  WipeScope,
} from "@/lib/scheduled-wipe";
import { verifyMasterPassword } from "@/lib/auth";

let cachedStatus: any = null;
let lastStatusFetchTime = 0;
const STATUS_CACHE_TTL = 5000;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "revoke") {
      cachedStatus = null;
      const status = await revokeWipe();
      return NextResponse.json(status);
    }

    const now = Date.now();
    if (cachedStatus && now - lastStatusFetchTime < STATUS_CACHE_TTL) {
      return NextResponse.json(cachedStatus);
    }

    const status = await getScheduledWipeStatus();
    cachedStatus = status;
    lastStatusFetchTime = now;
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
    cachedStatus = null;
    const body = await request.json().catch(() => ({}));
    const action = body.action || "schedule";

    if (action === "revoke") {
      const status = await revokeWipe();
      return NextResponse.json(status);
    }

    // Wiping data strictly requires master password authorization
    if (action === "execute_now" || action === "schedule") {
      const password = body.password;
      if (!password || typeof password !== "string") {
        return NextResponse.json(
          { error: "Master password is required to authorize data wipe." },
          { status: 401 }
        );
      }
      const isAuth = await verifyMasterPassword(password);
      if (!isAuth) {
        return NextResponse.json(
          { error: "Incorrect password. Data wipe unauthorized." },
          { status: 401 }
        );
      }
    }

    if (action === "execute_now") {
      const scope = (body.scope as WipeScope) || "all";
      await executeWipeNow(undefined, scope);
      return NextResponse.json({ status: "EXECUTED", message: "Ledger cleared successfully", scope });
    }

    // Default action: schedule wipe with safety buffer (default 10 minutes)
    const minutes = Number(body.minutes) || 10;
    const scope = (body.scope as WipeScope) || "all";
    const status = await scheduleWipe(minutes, scope);
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
