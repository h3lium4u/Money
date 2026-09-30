import { NextResponse } from "next/server";
import {
  getBankDistributionSettlement,
  saveBankDistributionEntry,
  updateBankDistripRecord,
  deleteBankDistripRecord,
  createBankDistripAccount,
  recalculateBankDistripBalances,
  getDistributorOrderForDate,
} from "@/lib/repository";
import { z } from "zod";

const createRecordSchema = z.object({
  record_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  account_id: z.string().min(1, "Account ID is required"),
  commission_inr: z.number().default(0),
  paid_inr: z.number().default(0),
  notes: z.string().optional(),
});

const createAccountSchema = z.object({
  account_code: z.string().min(1, "Account code is required"),
  account_name: z.string().min(1, "Account name is required"),
  bank_name: z.string().optional(),
  account_number: z.string().optional(),
});

const updateRecordSchema = z.object({
  id: z.string().min(1, "Record ID is required"),
  record_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").optional(),
  account_id: z.string().optional(),
  commission_inr: z.number().optional(),
  paid_inr: z.number().optional(),
  notes: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "order") {
      const accountId = searchParams.get("accountId");
      const date = searchParams.get("date");
      if (accountId && date) {
        const order = await getDistributorOrderForDate(accountId, date);
        return NextResponse.json({ order_inr: order });
      }
      return NextResponse.json({ order_inr: 0 });
    }

    const accountId = searchParams.get("accountId") || undefined;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const sort = (searchParams.get("sort") || "asc") as "asc" | "desc";

    const settlementData = await getBankDistributionSettlement(accountId, {
      from,
      to,
      sortOrder: sort,
    });

    return NextResponse.json(settlementData);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to load bank distribution settlement data" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Check if creating a new account
    if (body.action === "create_account") {
      const validated = createAccountSchema.parse(body);
      const acc = await createBankDistripAccount(validated);
      return NextResponse.json(acc, { status: 201 });
    }

    const validated = createRecordSchema.parse(body);
    await saveBankDistributionEntry(validated);

    const updated = await getBankDistributionSettlement(validated.account_id);
    return NextResponse.json(updated, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to save bank distribution settlement record" },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const validated = updateRecordSchema.parse(body);

    if (validated.account_id && validated.record_date) {
      await saveBankDistributionEntry({
        account_id: validated.account_id,
        record_date: validated.record_date,
        commission_inr: validated.commission_inr ?? 0,
        paid_inr: validated.paid_inr ?? 0,
        notes: validated.notes,
      });
      const updated = await getBankDistributionSettlement(validated.account_id);
      return NextResponse.json(updated);
    } else {
      const updated = await updateBankDistripRecord(validated.id, validated);
      return NextResponse.json(updated);
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update bank distribution settlement record" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const accountId = searchParams.get("accountId") || undefined;
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await deleteBankDistripRecord(id);
    if (accountId) {
      await recalculateBankDistripBalances(accountId);
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete bank distribution record" },
      { status: 400 }
    );
  }
}
