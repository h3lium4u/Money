"use client";

import { useState, useEffect, useRef } from "react";
import { ReceiptPrinter, ReceiptPrinterStage } from "./ReceiptPrinter";
import styles from "./ReceiptPrinterModal.module.css";

export interface ReceiptPrinterModalProps {
  isOpen: boolean;
  reportType?: "customer-statement" | "financial-report";
  customerData?: {
    name?: string;
    code?: string;
    totalInr?: number;
    totalPaid?: number;
    outstanding?: number;
    entriesCount?: number;
    entries?: {
      date?: string;
      type?: string;
      reference?: string;
      amount?: number;
      currency?: string;
    }[];
  } | null;
  reportData?: {
    title?: string;
    period?: string;
    totalInr?: number;
    totalAed?: number;
    netProfit?: number;
    txnCount?: number;
  } | null;
  onCompletePrint: () => void;
  onClose: () => void;
}

export function ReceiptPrinterModal({
  isOpen,
  reportType = "customer-statement",
  customerData,
  reportData,
  onCompletePrint,
  onClose,
}: ReceiptPrinterModalProps) {
  const [stage, setStage] = useState<ReceiptPrinterStage>("processing");

  const onCompleteRef = useRef(onCompletePrint);
  useEffect(() => {
    onCompleteRef.current = onCompletePrint;
  }, [onCompletePrint]);

  const printFiredRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setStage("processing");
      printFiredRef.current = false;
      return;
    }

    printFiredRef.current = false;

    // Stage 1: Processing (600ms)
    const timer1 = setTimeout(() => {
      setStage("printing");
    }, 600);

    // Stage 2: Printing paper emerges (until 2800ms)
    const timer2 = setTimeout(() => {
      setStage("complete");
      if (!printFiredRef.current) {
        printFiredRef.current = true;
        onCompleteRef.current();
      }
    }, 2800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const todayStr = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const formatINR = (val?: number) =>
    `₹ ${(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatAED = (val?: number) =>
    `${(val || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`;

  const items = (customerData?.entries || []).slice(0, 5);

  return (
    <div className={`${styles.overlay} no-print`} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>
            {reportType === "customer-statement" ? "Printing Customer Statement" : "Printing Business Report"}
          </span>
          <button onClick={onClose} className={styles.closeBtn} title="Close">
            ✕
          </button>
        </div>

        <ReceiptPrinter.Root stage={stage} className={styles.printerRoot}>
          <ReceiptPrinter.Machine>
            <ReceiptPrinter.Header>
              <ReceiptPrinter.Screen className={styles.screenFull}>
                <ReceiptPrinter.Status>
                  {stage === "processing" &&
                    (reportType === "customer-statement"
                      ? "Generating Ledger Statement..."
                      : "Calculating Financial Summary...")}
                  {stage === "printing" &&
                    (reportType === "customer-statement"
                      ? "Printing Statement Receipt..."
                      : "Printing Financial Report...")}
                  {stage === "complete" && "Statement Ready to Print"}
                </ReceiptPrinter.Status>
              </ReceiptPrinter.Screen>
            </ReceiptPrinter.Header>

            <ReceiptPrinter.Output>
              <ReceiptPrinter.Paper>
                {/* Header */}
                <div className={styles.receiptHeader}>
                  <span className={styles.receiptCompany}>PETTI REMITTANCE</span>
                  <span className={styles.receiptSubtitle}>DUBAI ➔ INDIA</span>
                  <span className={styles.receiptTitle}>
                    {reportType === "customer-statement"
                      ? "CUSTOMER LEDGER STATEMENT"
                      : "BUSINESS FINANCIAL REPORT"}
                  </span>
                  <span className={styles.receiptPeriod}>DATE: {todayStr}</span>
                </div>

                {/* Details Section */}
                {reportType === "customer-statement" ? (
                  <>
                    <div className={styles.receiptSection}>
                      <div className={styles.receiptRow}>
                        <span className={styles.receiptLabel}>CUSTOMER</span>
                        <span className={styles.receiptValueBold}>
                          {customerData?.name || "CUSTOMER"}
                        </span>
                      </div>
                      {customerData?.code && (
                        <div className={styles.receiptRow}>
                          <span className={styles.receiptLabel}>CODE</span>
                          <span className={styles.receiptValue}>{customerData.code}</span>
                        </div>
                      )}
                      <div className={styles.receiptRow}>
                        <span className={styles.receiptLabel}>TOTAL INR SENT</span>
                        <span className={styles.receiptValueBold}>
                          {formatINR(customerData?.totalInr)}
                        </span>
                      </div>
                      <div className={styles.receiptRow}>
                        <span className={styles.receiptLabel}>TOTAL PAID</span>
                        <span className={styles.receiptValueGreen}>
                          {formatAED(customerData?.totalPaid)}
                        </span>
                      </div>
                      <div className={styles.receiptRow}>
                        <span className={styles.receiptLabel}>OUTSTANDING</span>
                        <span
                          className={
                            (customerData?.outstanding || 0) > 0.01
                              ? styles.receiptValueRose
                              : styles.receiptValueGreen
                          }
                        >
                          {formatAED(customerData?.outstanding)}
                        </span>
                      </div>
                    </div>

                    {/* Entries breakdown */}
                    {items.length > 0 && (
                      <div className={styles.receiptItemsSection}>
                        <div className={styles.receiptItemHeader}>
                          <span className={styles.colDate}>DATE</span>
                          <span className={styles.colType}>TYPE</span>
                          <span className={styles.colDetails}>DETAILS</span>
                          <span className={styles.colAmount}>AMOUNT</span>
                        </div>
                        {items.map((item, idx) => (
                          <div key={idx} className={styles.receiptItemRow}>
                            <span className={styles.colDate}>{item.date || "—"}</span>
                            <span className={styles.colType}>{item.type || "TXN"}</span>
                            <span className={styles.colDetails}>{item.reference || "Transfer"}</span>
                            <span className={styles.colAmount}>
                              {item.currency === "INR"
                                ? formatINR(item.amount)
                                : formatAED(item.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className={styles.receiptSection}>
                    <div className={styles.receiptRow}>
                      <span className={styles.receiptLabel}>REPORT PERIOD</span>
                      <span className={styles.receiptValueBold}>
                        {reportData?.period || "ALL TIME"}
                      </span>
                    </div>
                    <div className={styles.receiptRow}>
                      <span className={styles.receiptLabel}>TOTAL INR VOLUME</span>
                      <span className={styles.receiptValueBold}>
                        {formatINR(reportData?.totalInr)}
                      </span>
                    </div>
                    <div className={styles.receiptRow}>
                      <span className={styles.receiptLabel}>AED CHARGED</span>
                      <span className={styles.receiptValue}>
                        {formatAED(reportData?.totalAed)}
                      </span>
                    </div>
                    <div className={styles.receiptRow}>
                      <span className={styles.receiptLabel}>NET PROFIT</span>
                      <span className={styles.receiptValueGreen}>
                        {formatAED(reportData?.netProfit)}
                      </span>
                    </div>
                    <div className={styles.receiptRow}>
                      <span className={styles.receiptLabel}>TRANSFERS</span>
                      <span className={styles.receiptValueBold}>
                        {reportData?.txnCount || 0} Transfers
                      </span>
                    </div>
                    <div className={styles.receiptRow}>
                      <span className={styles.receiptLabel}>STATUS</span>
                      <span className={styles.receiptValueBold}>CONFIRMED LEDGER</span>
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className={styles.receiptFooter}>
                  <span>OFFICIAL REMITTANCE STATEMENT</span>
                  <span className={styles.receiptTimestamp}>
                    GENERATED ON {new Date().toLocaleString("en-IN")}
                  </span>
                </div>
              </ReceiptPrinter.Paper>
            </ReceiptPrinter.Output>
          </ReceiptPrinter.Machine>
        </ReceiptPrinter.Root>

        {stage === "complete" && (
          <div className={styles.modalFooter}>
            <span className={styles.successText}>✓ Print Dialog Ready</span>
            <button onClick={onClose} className={styles.doneBtn}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
