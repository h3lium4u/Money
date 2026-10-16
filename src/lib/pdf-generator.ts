import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { numberToIndianWords } from "./number-to-words";
import { getDayMonthYearString } from "./date-utils";

export function generateTransactionReceipt(txn: any, businessName = "ACCOUNTS MANAGEMENT LLC") {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(businessName, 105, 20, { align: "center" });

  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text("Official Transfer Receipt", 105, 28, { align: "center" });

  // Divider
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.line(20, 35, 190, 35);

  // Transaction Details (Left)
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text("Transaction No:", 20, 45);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text(txn.transaction_number, 55, 45);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Date:", 20, 52);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text(txn.transaction_date, 55, 52);

  // Detect whether this is a Party Transfer or Customer Transfer
  const isPartyTransfer = Boolean(txn.party_name || txn.customer_id?.startsWith?.("pty_") || txn.party_id);
  const partyOrCustLabel = isPartyTransfer ? "Party:" : "Customer:";
  const entityName = txn.party_name || txn.customer_name || txn.name || "Unknown";
  const entityCode = txn.party_code || txn.customer_code || txn.code;
  const entityDisplay = entityCode ? `${entityName} (${entityCode})` : entityName;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(partyOrCustLabel, 20, 59);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text(entityDisplay, 55, 59);

  // Status (Right)
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Status:", 140, 45);
  if (txn.status === "CONFIRMED") {
    doc.setTextColor(16, 185, 129); // emerald-500
  } else {
    doc.setTextColor(244, 63, 94); // rose-500
  }
  doc.setFont("helvetica", "bold");
  doc.text(txn.status || "UNKNOWN", 160, 45);
  doc.setTextColor(15, 23, 42); // reset

  // Payment Status
  const isPaid = (txn.paid_aed || 0) >= (txn.aed_amount || 0);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Payment:", 140, 52);
  doc.setFont("helvetica", "bold");
  if (isPaid) {
    doc.setTextColor(16, 185, 129);
    doc.text("PAID", 160, 52);
  } else {
    doc.setTextColor(245, 158, 11);
    doc.text("PENDING", 160, 52);
  }
  doc.setTextColor(15, 23, 42);

  const totalInr = Number(txn.total ?? txn.inr_amount ?? 0);
  const manualRate = Number(txn.manual_rate ?? txn.customer_rate ?? txn.rate ?? 0);
  const wholesaleRate = Number(txn.wholesale_rate ?? txn.base_rate ?? (manualRate > 0 ? (1000 / manualRate) : 0));
  const inDhirams = Number(txn.in_dhirams ?? txn.aed_amount ?? 0);
  const paidAmt = Number(txn.paid_amount ?? txn.paid_aed ?? 0);
  const balanceToPaid = Number(txn.balance_to_paid ?? (inDhirams > 0 ? inDhirams - paidAmt : 0));

  // Amounts Table
  const tableData: [string, string][] = [];
  if (totalInr > 0) {
    tableData.push(["Total Amount (INR)", `Rs. ${totalInr.toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`]);
  }
  if (manualRate > 0) {
    const rateText = manualRate >= 30 ? `${manualRate.toFixed(3)} AED/1000` : `${manualRate.toFixed(3)} INR/AED`;
    tableData.push([isPartyTransfer ? "Agreed Rate" : "Manual Rate Value", rateText]);
  }
  if (wholesaleRate > 0) {
    tableData.push(["Wholesale / Base Rate", wholesaleRate.toFixed(3)]);
  }
  if (inDhirams > 0) {
    tableData.push(["In Dhirams (AED)", `${inDhirams.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} AED`]);
  }

  if (paidAmt > 0 || balanceToPaid > 0) {
    tableData.push(["Paid Amount (AED)", `${paidAmt.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} AED`]);
    tableData.push(["Balance to Paid (AED)", `${balanceToPaid.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} AED`]);
  }

  autoTable(doc, {
    startY: 70,
    head: [["Description", "Amount"]],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 100, fontStyle: 'bold' },
      1: { cellWidth: 70, halign: 'right' },
    },
    styles: { fontSize: 10, cellPadding: 5 }
  });

  // Amount in words
  const finalY = (doc as any).lastAutoTable.finalY || 100;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Amount in Words:`, 20, finalY + 10);
  
  doc.setFont("helvetica", "bolditalic");
  doc.setTextColor(15, 23, 42);
  const words = totalInr > 0
    ? (numberToIndianWords(String(totalInr)) ? `${numberToIndianWords(String(totalInr))} Rupees Only` : "")
    : inDhirams > 0
    ? `${inDhirams.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} AED`
    : "";
  doc.text(words, 20, finalY + 16);

  // Footer
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text("Thank you for your business.", 105, 280, { align: "center" });
  doc.text(`Generated on ${new Date().toLocaleString()}`, 105, 285, { align: "center" });

  // Save the PDF with standardized filename: Receipt_[TxnNo]_[Day-Month-Year].pdf
  const dateStr = getDayMonthYearString();
  const safeNumber = String(txn.transaction_number || txn.id || "TXN").replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`Receipt_${safeNumber}_${dateStr}.pdf`);
}
