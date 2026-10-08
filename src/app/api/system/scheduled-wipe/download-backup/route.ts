import { NextResponse } from "next/server";
import { generateNormalizedMasterWorkbook } from "@/lib/reports/normalized-master-generator";
import { scheduleWipe } from "@/lib/scheduled-wipe";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shouldSchedule = searchParams.get("schedule") !== "false";

    if (shouldSchedule) {
      await scheduleWipe(24);
    }

    const buffer = await generateNormalizedMasterWorkbook();
    const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `Petti_Remittance_PreWipe_Backup_${dateStr}.xlsx`;

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
