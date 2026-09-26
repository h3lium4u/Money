import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { numberToIndianWords } from "./number-to-words";

export function generateTransactionReceipt(txn: any, businessName = "REMITTANCE BUSINESS LLC") {
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

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Customer:", 20, 59);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  const custDisplay = txn.customer_code ? `${txn.customer_name} (${txn.customer_code})` : (txn.customer_name || "Unknown");
  doc.text(custDisplay, 55, 59);

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

  // Amounts Table
  const tableData = [
    ["Transfer Amount (INR)", `Rs. ${Number(txn.inr_amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
    ["Exchange Rate", String(txn.customer_rate)],
    ["Total Payable (AED)", `${Number(txn.aed_amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`]
  ];

  if ((txn.paid_aed || 0) > 0) {
    tableData.push(["Amount Paid (AED)", `${Number(txn.paid_aed).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`]);
    tableData.push(["Amount Due (AED)", `${Number(txn.pending_aed).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`]);
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
  const words = numberToIndianWords(String(txn.inr_amount));
  doc.text(words ? `${words} Rupees Only` : "", 20, finalY + 16);

  // Footer
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text("Thank you for your business.", 105, 280, { align: "center" });
  doc.text(`Generated on ${new Date().toLocaleString()}`, 105, 285, { align: "center" });

  // Save the PDF
  doc.save(`Receipt_${txn.transaction_number}.pdf`);
}
