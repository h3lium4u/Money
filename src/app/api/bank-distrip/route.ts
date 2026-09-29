import { NextResponse } from "next/server";
import {
  listBankDistripAccounts,
  listBankDistripRecords,
  createBankDistripRecord,
  updateBankDistripRecord,
  deleteBankDistripRecord,
  createBankDistripAccount,
} from "@/lib/repository";
import { z } from "zod";

const createRecordSchema = z.object({
  record_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  account_id: z.string().min(1, "Account ID is required"),
  order_inr: z.number().default(0),
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
  order_inr: z.number().optional(),
  commission_inr: z.number().optional(),
  paid_inr: z.number().optional(),
  notes: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId") || undefined;
    const sort = (searchParams.get("sort") || "asc") as "asc" | "desc";

    const accounts = await listBankDistripAccounts();
    const records = await listBankDistripRecords(accountId, sort);

    return NextResponse.json({ accounts, records });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to load bank distrip data" },
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
    const record = await createBankDistripRecord(validated);
    return NextResponse.json(record, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create bank distrip record" },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const validated = updateRecordSchema.parse(body);

    const updated = await updateBankDistripRecord(validated.id, validated);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update bank distrip record" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await deleteBankDistripRecord(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete bank distrip record" },
      { status: 400 }
    );
  }
}
