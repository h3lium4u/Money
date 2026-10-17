import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_API_ROUTES = new Set([
  "/api/auth/login",
  "/api/auth/verify",
  "/api/health",
]);

async function verifyHmacSha256(data: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const base64 = signature.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (base64.length % 4)) % 4;
    const padded = base64 + "=".repeat(padLen);
    const binarySig = atob(padded);
    const sigBytes = new Uint8Array(binarySig.length);
    for (let i = 0; i < binarySig.length; i++) {
      sigBytes[i] = binarySig.charCodeAt(i);
    }

    const dataBytes = encoder.encode(data);
    return await crypto.subtle.verify("HMAC", key, sigBytes, dataBytes);
  } catch {
    return false;
  }
}

function decodePayload(data: string): any {
  try {
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (base64.length % 4)) % 4;
    const padded = base64 + "=".repeat(padLen);
    const jsonStr = atob(padded);
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

async function verifyToken(token?: string | null): Promise<boolean> {
  if (!token || typeof token !== "string") return false;
  const cleanToken = token.replace(/^"(.*)"$/, "$1").trim();
  const parts = cleanToken.split(".");
  if (parts.length !== 2) return false;
  const [data, signature] = parts;
  if (!data || !signature) return false;

  const secret = process.env.AUTH_SECRET || "petti-remittance-secure-session-salt-2026";
  const isValidHmac = await verifyHmacSha256(data, signature, secret);
  if (!isValidHmac) return false;

  const payload = decodePayload(data);
  if (!payload || payload.auth !== true) return false;

  const now = Date.now();
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

  if (typeof payload.exp === "number") {
    if (now > payload.exp) return false;
  } else if (typeof payload.iat === "number") {
    if (now - payload.iat > TWENTY_FOUR_HOURS_MS) return false;
  } else {
    return false;
  }

  return true;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only guard API routes
  if (!pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Allow public endpoints (handling potential trailing slashes)
  const cleanPath = pathname.replace(/\/+$/, "") || "/";
  if (PUBLIC_API_ROUTES.has(cleanPath)) {
    return NextResponse.next();
  }

  // Check petti_session cookie or authorization header
  const cookieToken = request.cookies.get("petti_session")?.value;
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const token = cookieToken || bearerToken;

  if (!token || !(await verifyToken(token))) {
    return NextResponse.json(
      { success: false, error: "Unauthorized access: valid session required" },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const proxy = middleware;
export default middleware;

export const config = {
  matcher: ["/api/:path*"],
};
