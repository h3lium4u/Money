import { NextResponse } from "next/server";
import { validateSessionToken, verifyMasterPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { password, token } = body;

    if (password) {
      const isValid = await verifyMasterPassword(password);
      return NextResponse.json({ success: isValid });
    }

    if (token) {
      const isValid = validateSessionToken(token);
      return NextResponse.json({ success: isValid });
    }

    // Check cookie
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader.match(/petti_session=([^;]+)/);
    const cookieToken = match ? match[1] : null;

    const isValid = validateSessionToken(cookieToken);
    return NextResponse.json({ success: isValid });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/petti_session=([^;]+)/);
  const cookieToken = match ? match[1] : null;

  const isValid = validateSessionToken(cookieToken);
  return NextResponse.json({ authenticated: isValid });
}
