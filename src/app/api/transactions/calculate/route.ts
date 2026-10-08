import { NextResponse } from "next/server";
import { calculateDubaiClientTransfer, calculateTransaction } from "@/lib/calculations";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Check if total or manualRate or customerRate is provided
    const totalVal = body.total !== undefined ? Number(body.total) : (body.inrAmount !== undefined ? Number(body.inrAmount) : (body.inr_amount !== undefined ? Number(body.inr_amount) : NaN));
    const manualRateVal = body.manualRate !== undefined ? Number(body.manualRate) : (body.manual_rate !== undefined ? Number(body.manual_rate) : (body.customerRate !== undefined ? Number(body.customerRate) : (body.customer_rate !== undefined ? Number(body.customer_rate) : NaN)));
    const paidAmountVal = body.paidAmount !== undefined ? Number(body.paidAmount) : (body.paid_amount !== undefined ? Number(body.paid_amount) : (body.paid_aed !== undefined ? Number(body.paid_aed) : 0));

    // If baseRate is not explicitly passed or is a Dubai client call:
    if (!isNaN(totalVal) && !isNaN(manualRateVal) && body.baseRate === undefined && body.base_rate === undefined) {
      if (totalVal <= 0) {
        return NextResponse.json({ error: "Total amount must be greater than zero" }, { status: 400 });
      }
      if (manualRateVal <= 0) {
        return NextResponse.json({ error: "Manual rate value must be greater than zero" }, { status: 400 });
      }
      if (paidAmountVal < 0) {
        return NextResponse.json({ error: "Paid amount cannot be negative" }, { status: 400 });
      }

      const result = calculateDubaiClientTransfer({
        total: totalVal,
        manualRate: manualRateVal,
        paidAmount: paidAmountVal,
      });

      return NextResponse.json({
        ...result,
        // Also provide standard aliases for seamless backward compatibility
        inrAmount: result.total,
        inr_amount: result.total,
        customerRate: result.manualRate,
        customer_rate: result.manualRate,
        baseRate: result.wholesaleRate,
        base_rate: result.wholesaleRate,
        aedAmount: result.inDhirams,
        aed_amount: result.inDhirams,
        costAed: result.inDhirams,
        cost_aed: result.inDhirams,
        grossProfitAed: 0,
        gross_profit_aed: 0,
        deliveryChargePct: 0,
        delivery_charge_pct: 0,
        deliveryChargeAed: 0,
        delivery_charge_aed: 0,
        netProfitAed: 0,
        net_profit_aed: 0,
        marginPct: 0,
        paid_aed: result.paidAmount,
        pending_aed: result.balanceToPaid,
      });
    }

    // Fallback if baseRate was explicitly passed
    const inr = !isNaN(totalVal) ? totalVal : Number(body.inrAmount);
    const custRate = !isNaN(manualRateVal) ? manualRateVal : Number(body.customerRate);
    const baseRate = Number(body.baseRate || body.base_rate);
    const deliveryPct = body.deliveryChargePct !== undefined ? Number(body.deliveryChargePct) : (body.delivery_charge_pct !== undefined ? Number(body.delivery_charge_pct) : undefined);
    const deliveryChargeAed = body.deliveryChargeAed !== undefined ? Number(body.deliveryChargeAed) : (body.delivery_charge_aed !== undefined ? Number(body.delivery_charge_aed) : (body.deliveryAmount !== undefined ? Number(body.deliveryAmount) : undefined));

    const result = calculateTransaction({
      inrAmount: inr,
      customerRate: custRate,
      baseRate,
      deliveryChargePct: deliveryPct,
      deliveryChargeAed,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Invalid calculation parameters" }, { status: 400 });
  }
}
