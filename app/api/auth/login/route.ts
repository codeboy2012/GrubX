import { NextResponse } from "next/server";

import { applySessionCookie } from "@/lib/account/cookies";
import { createSession, rateLimit, verifyPassword } from "@/lib/account/auth";
import { ensureAccountSchema, getSql } from "@/lib/account/db";

export const runtime = "nodejs";

/**
 * Native clients (Expo) do not share the web cookie jar, so when the request
 * carries the documented marker it receives the raw session token as a JSON
 * `token` field for use as `Authorization: Bearer …`. The web flow ignores
 * this field; the cookie remains the only web transport.
 */
const wantsBearer = (request: Request) =>
  request.headers.get("x-grubx-client") === "native";

const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

const UNAUTHORIZED = { error: "Email or password is incorrect." };

/**
 * POST /api/auth/login — sign in and issue a session cookie.
 *
 * Rate limit: 10 attempts per IP per 10 minutes. Verification always runs
 * (against a dummy hash when the user is unknown) so response timing does not
 * reveal whether the email exists.
 */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limit = rateLimit(`login:${ip}`, 10, 10 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let body: { email?: unknown; password?: unknown; deviceLabel?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const deviceLabel = typeof body.deviceLabel === "string" ? body.deviceLabel.slice(0, 80) : null;

  if (!EMAIL_PATTERN.test(email) || password.length === 0) {
    return NextResponse.json(UNAUTHORIZED, { status: 401 });
  }

  try {
    await ensureAccountSchema();
    const sql = getSql();
    const rows = await sql`
      SELECT id, password_hash FROM account_users WHERE email = ${email} LIMIT 1
    `;
    const row = rows[0];

    const valid = row
      ? await verifyPassword(password, row.password_hash as string)
      : await verifyPassword(password, "scrypt$00000000000000000000000000000000$" + "0".repeat(128));

    if (!row || !valid) {
      return NextResponse.json(UNAUTHORIZED, { status: 401 });
    }

    const session = await createSession(row.id as string, deviceLabel);
    const response = NextResponse.json(
      wantsBearer(request)
        ? { userId: row.id, email, token: session.bearerToken, expiresAt: session.expiresAt.toISOString() }
        : { userId: row.id, email },
    );
    return wantsBearer(request) ? response : applySessionCookie(response, request, session.cookieValue, session.expiresAt);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "Account storage is not configured." }, { status: 503 });
    }
    return NextResponse.json({ error: "Unable to sign in right now." }, { status: 500 });
  }
}
