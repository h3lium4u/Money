import { NextResponse } from "next/server";
import { generateNormalizedMasterWorkbook } from "@/lib/reports/normalized-master-generator";
import { scheduleWipe, WipeScope } from "@/lib/scheduled-wipe";
import { verifyMasterPassword } from "@/lib/auth";
import { getDayMonthYearString } from "@/lib/date-utils";

async function handleDownloadBackup(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    let bodyPassword = "";
    let bodySchedule: boolean | undefined;
    let bodyMinutes: number | undefined;
    let bodyScope: WipeScope | undefined;

    if (request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      bodyPassword = body.password || "";
      if (typeof body.schedule === "boolean") bodySchedule = body.schedule;
      if (typeof body.minutes === "number") bodyMinutes = body.minutes;
      if (typeof body.scope === "string") bodyScope = body.scope as WipeScope;
    }

    const shouldSchedule = bodySchedule !== undefined ? bodySchedule : searchParams.get("schedule") === "true";
    const minutes = bodyMinutes || Number(searchParams.get("minutes")) || 10;
    const scope = bodyScope || (searchParams.get("scope") as WipeScope) || "all";

    const headerPassword = request.headers.get("x-wipe-password") || request.headers.get("x-master-password");
    const password = headerPassword || bodyPassword || searchParams.get("password") || "";

    // Master password authorization is strictly required to download confidential ledger backup
    const isAuth = await verifyMasterPassword(password);
    if (!isAuth) {
      return NextResponse.json(
        { error: "Incorrect or missing master password. Backup download and wipe authorization denied." },
        { status: 401 }
      );
    }

    if (shouldSchedule) {
      await scheduleWipe(minutes, scope);
    }

    const buffer = await generateNormalizedMasterWorkbook();
    const dateStr = getDayMonthYearString();
    const filename = `Accounts_Backup_${scope}_${dateStr}.xlsx`;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("Failed to generate pre-wipe backup workbook:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate backup Excel file" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handleDownloadBackup(request);
}

export async function POST(request: Request) {
  return handleDownloadBackup(request);
}
