import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

import { hashPassword, rateLimit, revokeAllSessions, sha256 } from "@/lib/account/auth";
import { ensureAccountSchema, getSql } from "@/lib/account/db";

export const runtime = "nodejs";

const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

/**
 * POST /api/auth/recover { email }         → issue a reset token
 * POST /api/auth/recover { token, password } → consume token, set password
 *
 * The token is returned in the response because GrubX has no mail service
 * configured; in a deployment with email, this is where the token would be
 * emailed instead. Tokens are single-use, hashed at rest, and expire in
 * 30 minutes. Any successful reset revokes every existing session.
 */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limit = rateLimit(`recover:${ip}`, 5, 15 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let body: { email?: unknown; token?: unknown; password?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    await ensureAccountSchema();
    const sql = getSql();

    if (typeof body.token === "string" && typeof body.password === "string") {
      const tokenHash = sha256(body.token.trim());
      const password = body.password;
      if (password.length < 10 || password.length > 200) {
        return NextResponse.json({ error: "Password must be at least 10 characters." }, { status: 400 });
      }

      const rows = await sql`
        SELECT u.id FROM account_users u
        WHERE u.recovery_token_hash = ${tokenHash}
          AND u.recovery_expires_at > now()
        LIMIT 1
      `;
      const row = rows[0];
      if (!row) {
        return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
      }

      const passwordHash = await hashPassword(password);
      await sql`
        UPDATE account_users
        SET password_hash = ${passwordHash},
            recovery_token_hash = NULL,
            recovery_expires_at = NULL
        WHERE id = ${row.id}
      `;
      await revokeAllSessions(row.id as string);
      return NextResponse.json({ ok: true, message: "Password updated. Sign in with the new password." });
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!EMAIL_PATTERN.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const rows = await sql`SELECT id FROM account_users WHERE email = ${email} LIMIT 1`;
    if (!rows[0]) {
      // Same response shape either way: do not reveal account existence.
      return NextResponse.json({ ok: true, message: "If that account exists, a reset token was issued." });
    }

    const token = randomBytes(24).toString("hex");
    await sql`
      UPDATE account_users
      SET recovery_token_hash = ${sha256(token)},
          recovery_expires_at = ${new Date(Date.now() + 30 * 60 * 1000).toISOString()}
      WHERE id = ${rows[0].id}
    `;
    return NextResponse.json({ ok: true, resetToken: token, expiresInMinutes: 30 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "Account storage is not configured." }, { status: 503 });
    }
    return NextResponse.json({ error: "Unable to process recovery right now." }, { status: 500 });
  }
}
