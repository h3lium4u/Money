import { NextResponse } from "next/server";
import { changeMasterPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { current_password, new_password, confirm_password, confirm_password_2 } = body;

    if (!current_password) {
      return NextResponse.json(
        { success: false, error: "Please enter your current password" },
        { status: 400 }
      );
    }

    if (!new_password) {
      return NextResponse.json(
        { success: false, error: "Please enter a new password" },
        { status: 400 }
      );
    }

    if (new_password.length < 6) {
      return NextResponse.json(
        { success: false, error: "New password must be at least 6 characters" },
        { status: 400 }
      );
    }

    if (new_password !== confirm_password) {
      return NextResponse.json(
        { success: false, error: "New password and first confirmation do not match" },
        { status: 400 }
      );
    }

    if (confirm_password_2 !== undefined && new_password !== confirm_password_2) {
      return NextResponse.json(
        { success: false, error: "New password and second confirmation do not match" },
        { status: 400 }
      );
    }

    const result = await changeMasterPassword(current_password, new_password);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (error: any) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to change password" },
      { status: 500 }
    );
  }
}
