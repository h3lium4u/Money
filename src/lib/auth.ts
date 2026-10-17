import { query, queryOne, execute } from "./db.ts";
import crypto from "node:crypto";

const MASTER_AUTH_ID = "master_auth";
const DEFAULT_PASSWORD = "12345678";
const ITERATIONS = 100000;
const KEYLEN = 64;
const DIGEST = "sha512";

/**
 * Computes salted PBKDF2 hash
 */
export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString("hex");
}

/**
 * Initializes the app_security table if it doesn't exist and seeds default password.
 */
export async function ensureAuthInitialized(): Promise<void> {
  await execute(`
    CREATE TABLE IF NOT EXISTS app_security (
      id VARCHAR(50) PRIMARY KEY DEFAULT 'master_auth',
      password_hash VARCHAR(255) NOT NULL,
      salt VARCHAR(100) NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  const existing = await queryOne(
    `SELECT id FROM app_security WHERE id = $1 LIMIT 1`,
    [MASTER_AUTH_ID]
  );

  if (!existing) {
    const salt = crypto.randomBytes(32).toString("hex");
    const passwordHash = hashPassword(DEFAULT_PASSWORD, salt);
    await execute(
      `INSERT INTO app_security (id, password_hash, salt, updated_at) VALUES ($1, $2, $3, NOW())`,
      [MASTER_AUTH_ID, passwordHash, salt]
    );
  }
}

/**
 * Verifies entered password against the stored salted hash in database.
 */
export async function verifyMasterPassword(password: string): Promise<boolean> {
  if (!password || typeof password !== "string") return false;

  await ensureAuthInitialized();

  const record = await queryOne<{ password_hash: string; salt: string }>(
    `SELECT password_hash, salt FROM app_security WHERE id = $1 LIMIT 1`,
    [MASTER_AUTH_ID]
  );

  if (!record || !record.salt || !record.password_hash) {
    return false;
  }

  const computedHash = hashPassword(password.trim(), record.salt);
  // Constant-time comparison to prevent timing attacks
  const bufferA = Buffer.from(computedHash, "hex");
  const bufferB = Buffer.from(record.password_hash, "hex");

  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}

/**
 * Updates master password requiring the current password for verification.
 */
export async function changeMasterPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  if (!currentPassword) {
    return { success: false, message: "Current password is required" };
  }
  if (!newPassword || newPassword.trim().length < 6) {
    return { success: false, message: "New password must be at least 6 characters long" };
  }

  const isValidCurrent = await verifyMasterPassword(currentPassword);
  if (!isValidCurrent) {
    return { success: false, message: "Current password is incorrect" };
  }

  // Generate new random salt and hash
  const newSalt = crypto.randomBytes(32).toString("hex");
  const newHash = hashPassword(newPassword.trim(), newSalt);

  await execute(
    `UPDATE app_security SET password_hash = $1, salt = $2, updated_at = NOW() WHERE id = $3`,
    [newHash, newSalt, MASTER_AUTH_ID]
  );

  // Record audit log
  await execute(
    `INSERT INTO audit_logs (id, entity_name, entity_id, action, new_values, reason)
     VALUES ($1, 'SECURITY', $2, 'CHANGE_PASSWORD', $3, $4)`,
    [
      crypto.randomUUID(),
      MASTER_AUTH_ID,
      JSON.stringify({ updated: true, timestamp: new Date().toISOString() }),
      "Master password changed securely by user"
    ]
  ).catch(() => {});

  return { success: true, message: "Password updated successfully" };
}

/**
 * Generates a signed session token with 24-hour expiration.
 */
export function generateSessionToken(): string {
  const now = Date.now();
  const payload = {
    auth: true,
    iat: now,
    exp: now + 24 * 60 * 60 * 1000,
    nonce: crypto.randomBytes(16).toString("hex")
  };
  const secret = process.env.AUTH_SECRET || "petti-remittance-secure-session-salt-2026";
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${signature}`;
}

/**
 * Validates a signed session token and checks 24-hour expiration.
 */
export function validateSessionToken(token?: string | null): boolean {
  if (!token || typeof token !== "string") return false;
  const cleanToken = token.replace(/^"(.*)"$/, "$1").trim();
  const parts = cleanToken.split(".");
  if (parts.length !== 2) return false;
  const [data, signature] = parts;
  if (!data || !signature) return false;

  const secret = process.env.AUTH_SECRET || "petti-remittance-secure-session-salt-2026";
  const expectedSig = crypto.createHmac("sha256", secret).update(data).digest("base64url");

  const sigA = Buffer.from(signature);
  const sigB = Buffer.from(expectedSig);
  if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf-8"));
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
  } catch {
    return false;
  }
}
