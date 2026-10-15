import { NextResponse } from "next/server";

import { resolveSyncContext } from "@/lib/account/syncAccess";
import { ensureAccountSchema, getSql } from "@/lib/account/db";
import { sanitizeSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Preference sync (language, subtitle, audio, accessibility, and the rest of
 * the standard settings model).
 *
 * The server never trusts raw client settings: everything passes through the
 * same `sanitizeSettings` the local data layer uses before it is stored, so a
 * malformed or hostile payload cannot poison another device's experience.
 */
export async function GET(request: Request) {
  const context = await resolveSyncContext(request, new URL(request.url).searchParams.get("profileId"));
  if (!context.ok) {
    return context.response;
  }

  try {
    const sql = getSql();
    const rows = await sql`
      SELECT settings, updated_at FROM account_settings WHERE profile_id = ${context.profileId} LIMIT 1
    `;
    return NextResponse.json(
      {
        settings: rows[0] ? sanitizeSettings(rows[0].settings as Partial<import("@/types/settings").Settings> | null) : null,
        updatedAt: rows[0] ? new Date(rows[0].updated_at as string).toISOString() : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Unable to load your preferences right now." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const context = await resolveSyncContext(
    request,
    typeof body.profileId === "string" ? body.profileId : null,
  );
  if (!context.ok) {
    return context.response;
  }

  try {
    await ensureAccountSchema();
    const sql = getSql();
    const sanitized = sanitizeSettings(body.settings as Partial<import("@/types/settings").Settings> | null);
    await sql`
      INSERT INTO account_settings (profile_id, settings, updated_at)
      VALUES (${context.profileId}, ${JSON.stringify(sanitized)}, now())
      ON CONFLICT (profile_id) DO UPDATE SET
        settings = EXCLUDED.settings,
        updated_at = now()
    `;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to save your preferences right now." }, { status: 500 });
  }
}
