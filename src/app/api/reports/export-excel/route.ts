import { NextResponse } from "next/server";
import { generateNormalizedMasterWorkbook } from "@/lib/reports/normalized-master-generator";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    const buffer = await generateNormalizedMasterWorkbook({ from, to });
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `Petti_Remittance_Master_${dateStr}.xlsx`;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("Failed to generate master Excel workbook:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate Excel export" },
      { status: 500 }
    );
  }
}
