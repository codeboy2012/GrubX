import { NextResponse } from "next/server";

import { resolveSession } from "@/lib/account/auth";
import { ensureAccountSchema, getSql } from "@/lib/account/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/session — who is signed in?
 * Returns 200 { user: null } when signed out (cheap probe for the client).
 */
export async function GET(request: Request) {
  const session = await resolveSession(request);
  if (!session) {
    return NextResponse.json({ user: null }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    await ensureAccountSchema();
    const sql = getSql();
    const profiles = await sql`
      SELECT id, name, is_default FROM account_profiles WHERE user_id = ${session.userId} ORDER BY created_at
    `;
    return NextResponse.json(
      {
        user: { userId: session.userId, email: session.email },
        profiles: profiles.map((row) => ({
          id: row.id,
          name: row.name,
          isDefault: row.is_default === true,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ user: null }, { headers: { "Cache-Control": "no-store" } });
  }
}
