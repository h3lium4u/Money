import { NextResponse } from "next/server";
import { verifyMasterPassword, generateSessionToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const password = body.password;

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { success: false, error: "Password is required" },
        { status: 400 }
      );
    }

    const isValid = await verifyMasterPassword(password);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Incorrect password. Please try again." },
        { status: 401 }
      );
    }

    const token = generateSessionToken();
    const response = NextResponse.json({
      success: true,
      token,
      message: "Authentication successful"
    });

    // Set secure HTTP-only cookie
    response.cookies.set({
      name: "petti_session",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 // 24 hours
    });

    return response;
  } catch (error: any) {
    console.error("Auth login error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Authentication error" },
      { status: 500 }
    );
  }
}
