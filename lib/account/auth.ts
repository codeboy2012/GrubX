import "server-only";

import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { SignJWT, jwtVerify } from "jose";

import { getSql, ensureAccountSchema } from "@/lib/account/db";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

/**
 * Server-only auth core.
 *
 * Sessions: random opaque token in an HttpOnly cookie + a signed JWT carrying
 * the session id, both verified server-side against the sessions table. Token
 * hashes (never raw tokens) are stored. Passwords use scrypt with per-user
 * salt. Rate limiting is an in-memory fixed window per IP+route (per server
 * instance), sufficient to blunt credential stuffing on a single-instance
 * deployment; a Redis backend can replace it without changing call sites.
 */

const SESSION_COOKIE = "grubx_session";
const SESSION_TTL_DAYS = 30;
const JWT_ISSUER = "grubx-account";
const JWT_AUDIENCE = "grubx-web";

const readSecret = (): Uint8Array => {
  const value = process.env.AUTH_SESSION_SECRET;
  if (!value || value.trim().length === 0) {
    throw new Error("AUTH_SESSION_SECRET is not configured.");
  }
  return new TextEncoder().encode(value);
};

/* ---------------------------------- passwords --------------------------------- */

export const hashPassword = async (password: string) => {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${derived.toString("hex")}`;
};

export const verifyPassword = async (password: string, stored: string) => {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) {
    return false;
  }
  const derived = await scrypt(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
};

/* ----------------------------------- tokens ----------------------------------- */

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/* --------------------------------- rate limiting ------------------------------- */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export const rateLimit = (key: string, limit: number, windowMs: number) => {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { ok: true, retryAfterSeconds: 0 };
};

const clientIp = (request: Request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

/* ---------------------------------- sessions ----------------------------------- */

export type SessionUser = { userId: string; email: string; sessionId: string };

export const createSession = async (userId: string, deviceLabel: string | null) => {
  await ensureAccountSchema();
  const sql = getSql();

  const sessionId = randomBytes(16).toString("hex");
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await sql`
    INSERT INTO account_sessions (id, user_id, token_hash, device_label, expires_at)
    VALUES (${sessionId}, ${userId}, ${sha256(token)}, ${deviceLabel}, ${expiresAt.toISOString()})
  `;

  const jwt = await new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(`${SESSION_TTL_DAYS}d`)
    .sign(readSecret());

  return { cookieValue: `${jwt}.${token}`, bearerToken: token, expiresAt };
};

export const resolveSession = async (request: Request): Promise<SessionUser | null> => {
  // Native clients authenticate with `Authorization: Bearer <raw token>`; the
  // token hash lookup is the same as the cookie's second half.
  const bearer = request.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) {
    const rawToken = bearer.slice(7).trim();
    if (!rawToken) {
      return null;
    }
    try {
      const sql = getSql();
      const rows = await sql`
        SELECT s.id, s.user_id, s.expires_at, s.revoked_at, u.email
        FROM account_sessions s
        JOIN account_users u ON u.id = s.user_id
        WHERE s.token_hash = ${sha256(rawToken)}
        LIMIT 1
      `;
      const row = rows[0];
      if (!row || row.revoked_at !== null || new Date(row.expires_at as string).getTime() <= Date.now()) {
        return null;
      }
      return { userId: row.user_id as string, email: row.email as string, sessionId: row.id as string };
    } catch {
      return null;
    }
  }

  const raw = readSessionCookie(request);
  if (!raw) {
    return null;
  }
  return resolveSessionFromCookie(raw);
};

const resolveSessionFromCookie = async (cookieValue: string): Promise<SessionUser | null> => {
  const lastDot = cookieValue.lastIndexOf(".");
  if (lastDot === -1) {
    return null;
  }
  const jwtPart = cookieValue.slice(0, lastDot);
  const tokenPart = cookieValue.slice(lastDot + 1);

  let sid: string;
  try {
    const verified = await jwtVerify(jwtPart, readSecret(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    const candidate = verified.payload.sid;
    if (typeof candidate !== "string" || candidate.length === 0) {
      return null;
    }
    sid = candidate;
  } catch {
    return null;
  }

  try {
    const sql = getSql();
    const rows = await sql`
      SELECT s.id, s.user_id, s.token_hash, s.expires_at, s.revoked_at, u.email
      FROM account_sessions s
      JOIN account_users u ON u.id = s.user_id
      WHERE s.id = ${sid}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) {
      return null;
    }
    if (row.revoked_at !== null || new Date(row.expires_at as string).getTime() <= Date.now()) {
      return null;
    }
    if (row.token_hash !== sha256(tokenPart)) {
      return null;
    }
    return { userId: row.user_id as string, email: row.email as string, sessionId: sid };
  } catch {
    // Database unavailable: treat as signed-out rather than crashing the route.
    return null;
  }
};

const readSessionCookie = (request: Request): string | null => {
  const header = request.headers.get("cookie");
  if (!header) {
    return null;
  }
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) {
      return rest.join("=");
    }
  }
  return null;
};

export const revokeSession = async (sessionId: string) => {
  const sql = getSql();
  await sql`UPDATE account_sessions SET revoked_at = now() WHERE id = ${sessionId}`;
};

export const revokeAllSessions = async (userId: string) => {
  const sql = getSql();
  await sql`UPDATE account_sessions SET revoked_at = now() WHERE user_id = ${userId} AND revoked_at IS NULL`;
};

export const sessionCookieHeader = (value: string, expiresAt: Date) => {
  const parts = [
    `${SESSION_COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${expiresAt.toUTCString()}`,
  ];
  // Secure is set when the request is https; on localhost http it must stay off.
  return { name: SESSION_COOKIE, value, parts, secureHint: true };
};

export const clearSessionCookieHeader = () => ({
  name: SESSION_COOKIE,
  value: "",
  expiry: "Thu, 01 Jan 1970 00:00:00 GMT",
});
