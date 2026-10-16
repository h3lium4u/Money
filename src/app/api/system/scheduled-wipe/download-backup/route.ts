import { NextResponse } from "next/server";
import { generateNormalizedMasterWorkbook } from "@/lib/reports/normalized-master-generator";
import { scheduleWipe, WipeScope } from "@/lib/scheduled-wipe";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shouldSchedule = searchParams.get("schedule") !== "false";
    const minutes = Number(searchParams.get("minutes")) || 10;
    const scope = (searchParams.get("scope") as WipeScope) || "all";

    if (shouldSchedule) {
      await scheduleWipe(minutes, scope);
    }

    const buffer = await generateNormalizedMasterWorkbook();
    const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `Remittance_PreWipe_Backup_${scope}_${dateStr}.xlsx`;

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
