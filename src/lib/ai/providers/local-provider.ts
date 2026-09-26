import type { AIProvider, AIMessage, AIGenerateResult } from "../types.ts";

/**
 * Local verified engine that turns verified PostgreSQL financial facts
 * into clean business markdown when external API keys are not yet configured.
 */
export class LocalVerifiedProvider implements AIProvider {
  readonly name = "local" as const;

  isConfigured(): boolean {
    return true; // Always available as local baseline
  }

  async generateText(messages: AIMessage[]): Promise<AIGenerateResult> {
    const startTime = Date.now();
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content || "";
    const systemMessage = messages.find((m) => m.role === "system")?.content || "";

    // Extract the JSON facts from the system prompt
    let factsJson: any = null;
    const jsonMatch = systemMessage.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        factsJson = JSON.parse(jsonMatch[1]);
      } catch {
        // Fallback if parsing fails
      }
    }

    if (!factsJson) {
      return {
        text: "I am ready to assist with your remittance business inquiries. Ask any question about transactions, customers, profit, India distributions, or bank accounts.",
        provider: "local",
        model: "verified-engine-local",
        executionTimeMs: Date.now() - startTime,
      };
    }

    // Format based on topic and metrics
    const topic = factsJson.topic || "Financial Summary";
    const metrics = factsJson.metrics || {};
    const records = factsJson.records || [];
    const notes = factsJson.summaryNotes || [];

    let response = `### ${topic}\n\n`;

    if (factsJson.insufficientData) {
      response += "I don't have enough verified data to answer that accurately.\n";
      if (notes.length > 0) {
        response += `\n*Note: ${notes.join(", ")}*`;
      }
      return {
        text: response,
        provider: "local",
        model: "verified-engine-local",
        executionTimeMs: Date.now() - startTime,
      };
    }

    // Format metrics into clean bullet points
    if (Object.keys(metrics).length > 0) {
      if (metrics.transactionCount !== undefined) {
        response += `* **Transactions**: ${metrics.transactionCount}\n`;
      }
      if (metrics.totalInrProcessed !== undefined) {
        response += `* **Total INR Processed**: ₹${Number(metrics.totalInrProcessed).toLocaleString('en-IN')}\n`;
      }
      if (metrics.totalInrVolume !== undefined) {
        response += `* **Total INR Volume**: ₹${Number(metrics.totalInrVolume).toLocaleString('en-IN')}\n`;
      }
      if (metrics.totalAedBilled !== undefined) {
        response += `* **Total AED Billed**: AED ${Number(metrics.totalAedBilled).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
      }
      if (metrics.totalAedCollected !== undefined) {
        response += `* **Total AED Collected**: AED ${Number(metrics.totalAedCollected).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
      }
      if (metrics.totalAedPaid !== undefined) {
        response += `* **Total AED Paid**: AED ${Number(metrics.totalAedPaid).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
      }
      if (metrics.outstandingBalanceAed !== undefined) {
        response += `* **Outstanding Balance**: AED ${Number(metrics.outstandingBalanceAed).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
      }
      if (metrics.totalOutstandingReceivablesAed !== undefined) {
        response += `* **Total Outstanding Receivables**: AED ${Number(metrics.totalOutstandingReceivablesAed).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
      }
      if (metrics.grossProfitAed !== undefined) {
        response += `* **Gross Profit**: AED ${Number(metrics.grossProfitAed).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
      }
      if (metrics.deliveryChargesAed !== undefined) {
        response += `* **Delivery Charges**: AED ${Number(metrics.deliveryChargesAed).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
      }
      if (metrics.netProfitAed !== undefined) {
        response += `* **Net Profit**: AED ${Number(metrics.netProfitAed).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
      }
      if (metrics.totalCommissionRecordedInr !== undefined) {
        response += `* **Commission Recorded**: ₹${Number(metrics.totalCommissionRecordedInr).toLocaleString('en-IN')}\n`;
      }
      if (metrics.totalAllocatedInr !== undefined) {
        response += `* **Total Allocated**: ₹${Number(metrics.totalAllocatedInr).toLocaleString('en-IN')}\n`;
      }
      if (metrics.totalDistributedInr !== undefined) {
        response += `* **Total Distributed to India**: ₹${Number(metrics.totalDistributedInr).toLocaleString('en-IN')}\n`;
      }
      if (metrics.totalPendingBankBalanceInr !== undefined) {
        response += `* **Bank Accounts Pending Balance**: ₹${Number(metrics.totalPendingBankBalanceInr).toLocaleString('en-IN')}\n`;
      }

      // Comparison metrics
      if (metrics.currentPeriod && metrics.previousPeriod) {
        response += `\n| Metric | ${metrics.currentPeriod.label} | ${metrics.previousPeriod.label} | Difference |\n`;
        response += `| :--- | :---: | :---: | :---: |\n`;
        response += `| Transactions | ${metrics.currentPeriod.transactions} | ${metrics.previousPeriod.transactions} | ${metrics.currentPeriod.transactions - metrics.previousPeriod.transactions} |\n`;
        response += `| Volume (INR) | ₹${Number(metrics.currentPeriod.inrAmount).toLocaleString('en-IN')} | ₹${Number(metrics.previousPeriod.inrAmount).toLocaleString('en-IN')} | ₹${Number(metrics.comparison?.inrDifference || 0).toLocaleString('en-IN')} |\n`;
        response += `| Net Profit (AED) | AED ${Number(metrics.currentPeriod.netProfitAed).toLocaleString('en-US')} | AED ${Number(metrics.previousPeriod.netProfitAed).toLocaleString('en-US')} | AED ${Number(metrics.comparison?.profitDifferenceAed || 0).toLocaleString('en-US')} |\n`;
      }
    }

    // Format records table if present
    if (records.length > 0) {
      response += `\n#### Details\n\n`;

      if (records[0].transactionNumber && records[0].customer) {
        response += `| Transaction | Date | Customer | INR | Rate | AED | Status |\n`;
        response += `| :--- | :--- | :--- | ---: | ---: | ---: | :--- |\n`;
        for (const r of records.slice(0, 10)) {
          const status = r.pendingAed === 0 ? "Paid" : `Pending AED ${r.pendingAed}`;
          response += `| \`${r.transactionNumber}\` | ${r.date} | ${r.customer} | ₹${Number(r.inr).toLocaleString('en-IN')} | ${r.rate} | AED ${Number(r.aed).toLocaleString('en-US')} | ${status} |\n`;
        }
      } else if (records[0].inrAllocated !== undefined && records[0].transactionNumber) {
        // Detailed remittance distribution splits table
        response += `| Split Date | Transaction | Customer | Distributor | Group | Allocated (INR) | Wholesale Rate | AED Equivalent | Status |\n`;
        response += `| :--- | :--- | :--- | :--- | :---: | ---: | ---: | ---: | :--- |\n`;
        for (const r of records) {
          response += `| ${r.splitDate} | \`${r.transactionNumber}\` | **${r.customerName}** | ${r.distributor} | \`${r.group}\` | **₹${Number(r.inrAllocated).toLocaleString('en-IN')}** | ${r.wholesaleRate || '-'} | ${r.aedEquivalent ? `${r.aedEquivalent} AED` : '-'} | \`${r.status}\` |\n`;
        }
      } else if (records[0].group && records[0].name) {
        // Distributor roster (IND and AED)
        response += `| Distributor | Group | Code | Type | Currency | Balance (INR) |\n`;
        response += `| :--- | :---: | :--- | :--- | :---: | ---: |\n`;
        for (const r of records) {
          const bal = r.balanceInr !== undefined ? `₹${Number(r.balanceInr).toLocaleString('en-IN')}` : "-";
          response += `| **${r.name}** | \`${r.group}\` | \`${r.code}\` | ${r.partnerType} | ${r.currency} | ${bal} |\n`;
        }
      } else if (records[0].outstandingBalanceAed !== undefined && records[0].name) {
        // Customers roster
        response += `| Customer | Code | Total INR | Total Billed (AED) | Total Paid (AED) | Outstanding (AED) |\n`;
        response += `| :--- | :--- | ---: | ---: | ---: | ---: |\n`;
        for (const r of records) {
          response += `| **${r.name}** | \`${r.code}\` | ₹${Number(r.totalInr || 0).toLocaleString('en-IN')} | AED ${Number(r.totalAedBilled || 0).toLocaleString('en-US')} | AED ${Number(r.totalAedPaid || 0).toLocaleString('en-US')} | **AED ${Number(r.outstandingBalanceAed || 0).toLocaleString('en-US')}** |\n`;
        }
      } else if (records[0].customerCode && records[0].outstandingAed !== undefined) {
        response += `| Customer | Code | Total Billed | Total Paid | Outstanding |\n`;
        response += `| :--- | :--- | ---: | ---: | ---: |\n`;
        for (const r of records) {
          response += `| **${r.customerName}** | \`${r.customerCode}\` | AED ${Number(r.totalBilledAed).toLocaleString('en-US')} | AED ${Number(r.totalPaidAed).toLocaleString('en-US')} | **AED ${Number(r.outstandingAed).toLocaleString('en-US')}** |\n`;
        }
      } else if (records[0].distributor && records[0].amountInr !== undefined) {
        response += `| Distributor | Date | Amount (INR) | Wholesale Rate | Paid (INR) | Balance (INR) |\n`;
        response += `| :--- | :--- | ---: | ---: | ---: | ---: |\n`;
        for (const r of records) {
          response += `| **${r.distributor}** | ${r.date} | ₹${Number(r.amountInr).toLocaleString('en-IN')} | ${r.wholesaleRate || 'N/A'} | ₹${Number(r.paidInr).toLocaleString('en-IN')} | ₹${Number(r.balanceInr).toLocaleString('en-IN')} |\n`;
        }
      } else if (records[0].accountName && records[0].currentBalanceInr !== undefined) {
        response += `| Account | Bank | Balance (INR) | As Of Date |\n`;
        response += `| :--- | :--- | ---: | :--- |\n`;
        for (const r of records) {
          response += `| **${r.accountName}** (\`${r.accountCode}\`) | ${r.bankName} | **₹${Number(r.currentBalanceInr).toLocaleString('en-IN')}** | ${r.asOfDate} |\n`;
        }
      }
    }

    return {
      text: response.trim(),
      provider: "local",
      model: "verified-engine-local",
      executionTimeMs: Date.now() - startTime,
    };
  }
}
