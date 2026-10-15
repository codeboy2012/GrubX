import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { resolveSession } from "@/lib/account/auth";
import { ensureAccountSchema, getSql } from "@/lib/account/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Family profiles: independent watch histories and preferences under one
 * account. Ownership is enforced server-side — every query filters by the
 * session user's id, and a profile deletion requires both the profile id and
 * proof of ownership in the same WHERE clause.
 */
export async function GET(request: Request) {
  const session = await resolveSession(request);
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  try {
    await ensureAccountSchema();
    const sql = getSql();
    const rows = await sql`
      SELECT id, name, is_default, created_at FROM account_profiles
      WHERE user_id = ${session.userId} ORDER BY created_at
    `;
    return NextResponse.json(
      {
        profiles: rows.map((row) => ({
          id: row.id,
          name: row.name,
          isDefault: row.is_default === true,
          createdAt: new Date(row.created_at as string).toISOString(),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Unable to load profiles right now." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await resolveSession(request);
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
  if (!name) {
    return NextResponse.json({ error: "Profile name is required." }, { status: 400 });
  }

  try {
    await ensureAccountSchema();
    const sql = getSql();

    const countRows = await sql`
      SELECT count(*)::int AS count FROM account_profiles WHERE user_id = ${session.userId}
    `;
    if (Number(countRows[0]?.count ?? 0) >= 5) {
      return NextResponse.json({ error: "Maximum of 5 profiles per account." }, { status: 409 });
    }

    const profileId = randomUUID();
    await sql`
      INSERT INTO account_profiles (id, user_id, name, is_default)
      VALUES (${profileId}, ${session.userId}, ${name}, FALSE)
    `;
    return NextResponse.json({ profileId, name }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create the profile right now." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await resolveSession(request);
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const profileId = typeof body.profileId === "string" ? body.profileId : "";
  if (!profileId) {
    return NextResponse.json({ error: "profileId is required." }, { status: 400 });
  }

  try {
    const sql = getSql();
    // Ownership check and delete in one statement; the default profile cannot
    // be removed so an account always keeps at least one.
    const deleted = await sql`
      DELETE FROM account_profiles
      WHERE id = ${profileId} AND user_id = ${session.userId} AND is_default = FALSE
      RETURNING id
    `;
    if (!deleted[0]) {
      return NextResponse.json(
        { error: "Profile not found, is your main profile, or belongs to another account." },
        { status: 403 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "Account storage is not configured." }, { status: 503 });
    }
    return NextResponse.json({ error: "Unable to delete the profile right now." }, { status: 500 });
  }
}
