import { NextResponse } from "next/server";

import { readMediaId, resolveSyncContext } from "@/lib/account/syncAccess";
import { ensureAccountSchema, getSql } from "@/lib/account/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LibraryRow = {
  mediaId: string;
  mediaType: string;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  addedAt: string;
};

const MEDIA_TYPES = new Set(["movie", "tv", "anime", "manga"]);

/** GET — the signed-in profile's saved library. */
export async function GET(request: Request) {
  const requestedProfileId = new URL(request.url).searchParams.get("profileId");
  const context = await resolveSyncContext(request, requestedProfileId);
  if (!context.ok) {
    return context.response;
  }

  try {
    const sql = getSql();
    const rows = await sql`
      SELECT media_id, media_type, title, poster_path, backdrop_path, added_at
      FROM account_library WHERE profile_id = ${context.profileId}
      ORDER BY added_at DESC
    `;
    const items: LibraryRow[] = rows.map((row) => ({
      mediaId: row.media_id as string,
      mediaType: row.media_type as string,
      title: row.title as string,
      posterPath: (row.poster_path as string | null) ?? null,
      backdropPath: (row.backdrop_path as string | null) ?? null,
      addedAt: new Date(row.added_at as string).toISOString(),
    }));
    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to load your library right now." }, { status: 500 });
  }
}

/** POST — idempotent upsert of one saved title. */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const requestedProfileId = typeof body.profileId === "string" ? body.profileId : null;
  const context = await resolveSyncContext(request, requestedProfileId);
  if (!context.ok) {
    return context.response;
  }

  const mediaId = readMediaId(body.mediaId);
  const mediaType = typeof body.mediaType === "string" && MEDIA_TYPES.has(body.mediaType) ? body.mediaType : null;
  const title = typeof body.title === "string" && body.title.trim().length > 0 ? body.title.trim().slice(0, 240) : null;

  if (!mediaId || !mediaType || !title) {
    return NextResponse.json({ error: "mediaId, mediaType, and title are required." }, { status: 400 });
  }

  try {
    await ensureAccountSchema();
    const sql = getSql();
    await sql`
      INSERT INTO account_library (profile_id, media_id, media_type, title, poster_path, backdrop_path)
      VALUES (
        ${context.profileId}, ${mediaId}, ${mediaType}, ${title},
        ${typeof body.posterPath === "string" ? body.posterPath.slice(0, 400) : null},
        ${typeof body.backdropPath === "string" ? body.backdropPath.slice(0, 400) : null}
      )
      ON CONFLICT (profile_id, media_id) DO UPDATE SET title = EXCLUDED.title
    `;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to save this title right now." }, { status: 500 });
  }
}

/** DELETE — remove one saved title (ownership enforced). */
export async function DELETE(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const requestedProfileId = typeof body.profileId === "string" ? body.profileId : null;
  const context = await resolveSyncContext(request, requestedProfileId);
  if (!context.ok) {
    return context.response;
  }

  const mediaId = readMediaId(body.mediaId);
  if (!mediaId) {
    return NextResponse.json({ error: "mediaId is required." }, { status: 400 });
  }

  try {
    const sql = getSql();
    await sql`
      DELETE FROM account_library WHERE profile_id = ${context.profileId} AND media_id = ${mediaId}
    `;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to remove this title right now." }, { status: 500 });
  }
}
