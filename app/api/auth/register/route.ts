import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { applySessionCookie } from "@/lib/account/cookies";
import { createSession, hashPassword, rateLimit } from "@/lib/account/auth";
import { ensureAccountSchema, getSql } from "@/lib/account/db";

export const runtime = "nodejs";

/** Native clients receive the raw bearer token; see login route. */
const wantsBearer = (request: Request) =>
  request.headers.get("x-grubx-client") === "native";

const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

/**
 * POST /api/auth/register — create an account and sign in.
 *
 * Rate limit: 5 attempts per IP per 10 minutes. The response never reveals
 * whether an email already exists beyond what a duplicate-key error forces
 * (409), and the generic shape is kept stable for timing-equal behavior.
 */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limit = rateLimit(`register:${ip}`, 5, 10 * 60 * 1000);
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

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 10 || password.length > 200) {
    return NextResponse.json({ error: "Password must be at least 10 characters." }, { status: 400 });
  }

  try {
    await ensureAccountSchema();
    const sql = getSql();

    const userId = randomUUID();
    const passwordHash = await hashPassword(password);
    await sql`
      INSERT INTO account_users (id, email, password_hash) VALUES (${userId}, ${email}, ${passwordHash})
    `;

    // Default profile so the library/progress APIs have an owner immediately.
    await sql`
      INSERT INTO account_profiles (id, user_id, name, is_default)
      VALUES (${randomUUID()}, ${userId}, ${"Main"}, TRUE)
    `;

    const session = await createSession(userId, deviceLabel);
    const response = NextResponse.json(
      wantsBearer(request)
        ? { userId, email, token: session.bearerToken, expiresAt: session.expiresAt.toISOString() }
        : { userId, email },
      { status: 201 },
    );
    return wantsBearer(request) ? response : applySessionCookie(response, request, session.cookieValue, session.expiresAt);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("duplicate key") || message.includes("unique")) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }
    if (message.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "Account storage is not configured." }, { status: 503 });
    }
    return NextResponse.json({ error: "Unable to create the account right now." }, { status: 500 });
  }
}
