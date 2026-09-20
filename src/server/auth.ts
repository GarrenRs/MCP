import { get, run, query } from "./db";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Password hashing (PBKDF2-SHA256) ─────────────────────────────

function bytesToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt.buffer as ArrayBuffer, iterations: 100000 },
    key,
    256,
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveKey(password, salt);
  return `pbkdf2:100000:${bytesToHex(salt.buffer)}:${bytesToHex(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = parseInt(parts[1], 10);
  if (isNaN(iterations) || iterations < 10000 || iterations > 1000000) return false;
  const salt = hexToBytes(parts[2]);
  if (salt.length !== 16) return false;
  const expectedHash = parts[3];
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt.buffer as ArrayBuffer, iterations },
    key,
    256,
  );
  return bytesToHex(derived) === expectedHash;
}

// ── Session helpers ───────────────────────────────────────────────

async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return bytesToHex(buf);
}

export function generateSessionToken(): string {
  return crypto.randomUUID();
}

export async function createSession(userId: number): Promise<{ token: string; expiresAt: string }> {
  const token = generateSessionToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await run(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
    [tokenHash, userId, expiresAt],
  );
  return { token, expiresAt };
}

export interface SessionUser {
  userId: number;
  email: string;
  role: string;
  display_name: string;
}

export async function getSessionFromToken(token: string): Promise<SessionUser | null> {
  const tokenHash = await hashToken(token);
  const now = new Date().toISOString();
  const row = await get<{ user_id: number; email: string; role: string; display_name: string }>(
    `SELECT u.id as user_id, u.email, u.role, u.display_name
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
    [tokenHash, now],
  );
  if (!row) return null;
  // Clean up expired sessions opportunistically (1 in 100 chance)
  if (Math.random() < 0.01) {
    await run("DELETE FROM sessions WHERE expires_at <= ?", [now]).catch(() => {});
  }
  return {
    userId: row.user_id,
    email: row.email,
    role: row.role,
    display_name: row.display_name,
  };
}

export async function deleteSessionByToken(token: string): Promise<void> {
  const tokenHash = await hashToken(token);
  await run("DELETE FROM sessions WHERE token_hash = ?", [tokenHash]);
}

export async function deleteUserSessions(userId: number): Promise<void> {
  await run("DELETE FROM sessions WHERE user_id = ?", [userId]);
}

// ── Cookie helpers ────────────────────────────────────────────────

/** Detect HTTPS from URL scheme or X-Forwarded-Proto header (for proxy setups). */
export function isSecureRequest(req: { url: string; header(name: string): string | undefined }): boolean {
  if (req.url.startsWith("https")) return true;
  return req.header("x-forwarded-proto")?.toLowerCase() === "https";
}

export function parseCookieHeader(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${name}=`));
  return match ? match.split("=").slice(1).join("=") : undefined;
}

export function setSessionCookie(token: string, expiresAt: string, secure: boolean): string {
  const parts = [
    `session_token=${token}`,
    "HttpOnly",
    `Path=/`,
    "SameSite=Strict",
    `Expires=${new Date(expiresAt).toUTCString()}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(secure: boolean): string {
  const parts = [
    "session_token=",
    "HttpOnly",
    "Path=/",
    "SameSite=Strict",
    "Max-Age=0",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

// ── Role helpers ──────────────────────────────────────────────────

export const ROLE_HIERARCHY: Record<string, number> = {
  manager: 0,
  admin: 1,
  owner: 2,
};

export function hasMinimumRole(userRole: string, requiredRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole];
  const requiredLevel = ROLE_HIERARCHY[requiredRole];
  if (userLevel === undefined || requiredLevel === undefined) return false;
  return userLevel >= requiredLevel;
}

// ── AUTH_ENABLED check ────────────────────────────────────────────

let authEnabledCache: { value: boolean; checkedAt: number } | null = null;
const AUTH_CACHE_TTL_MS = 5000;

export async function isAuthEnabled(): Promise<boolean> {
  const now = Date.now();
  if (authEnabledCache && now - authEnabledCache.checkedAt < AUTH_CACHE_TTL_MS) {
    return authEnabledCache.value;
  }
  const row = await get<{ value: string }>("SELECT value FROM settings WHERE key = 'AUTH_ENABLED'");
  const enabled = row?.value === "true";
  authEnabledCache = { value: enabled, checkedAt: now };
  return enabled;
}

export function resetAuthCache(): void {
  authEnabledCache = null;
}
