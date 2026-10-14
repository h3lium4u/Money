import { toast } from "sonner";

export interface DownloadExcelOptions {
  from?: string;
  to?: string;
  filename?: string;
}

/**
 * Downloads the master Excel workbook cleanly using browser fetch and blob URL.
 * Avoids Next.js client-side router interception and never leaves the page stuck in "rendering".
 */
export async function downloadMasterExcel(options?: DownloadExcelOptions): Promise<boolean> {
  const toastId = toast.loading("Generating Excel workbook... Please wait a moment.");
  try {
    const params = new URLSearchParams();
    if (options?.from) params.set("from", options.from);
    if (options?.to) params.set("to", options.to);
    const qs = params.toString() ? `?${params.toString()}` : "";

    const res = await fetch(`/api/reports/export-excel${qs}`, {
      method: "GET",
      headers: {
        "Accept": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream",
      },
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Server returned error (${res.status})`);
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;

    // Extract filename from header or fallback
    let downloadName = options?.filename;
    if (!downloadName) {
      const disposition = res.headers.get("content-disposition");
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) {
          downloadName = match[1];
        }
      }
    }
    if (!downloadName) {
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadName = `Petti_Remittance_Master_${dateStr}.xlsx`;
    }

    a.download = downloadName;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      try {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } catch {
        // cleanup ignore
      }
    }, 200);

    toast.success("Excel workbook downloaded successfully!", { id: toastId });
    return true;
  } catch (error: any) {
    console.error("Excel download error:", error);
    toast.error("Failed to download Excel: " + (error?.message || "Unknown error"), { id: toastId });
    return false;
  }
}
