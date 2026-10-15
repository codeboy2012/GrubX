import { NextResponse } from "next/server";

import { readMediaId, resolveSyncContext } from "@/lib/account/syncAccess";
import { ensureAccountSchema, getSql } from "@/lib/account/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Playback / reading progress sync.
 *
 * Conflict resolution is **server-side last-write-wins by wall clock**: a
 * write whose `updatedAt` is older than the stored row is accepted but does
 * not overwrite newer state (the route answers `ok: false, stale: true` so
 * the client can re-pull). Simultaneous sessions therefore converge on the
 * most recent position instead of thrashing. Percent is derived server-side
 * from position/duration and never trusted from the client.
 *
 * `position_seconds` is the stored column for the playback position; the
 * client-facing field stays `currentTime`.
 */
export async function GET(request: Request) {
  const context = await resolveSyncContext(request, new URL(request.url).searchParams.get("profileId"));
  if (!context.ok) {
    return context.response;
  }

  try {
    const sql = getSql();
    const rows = await sql`
      SELECT media_id, media_type, title, poster_path, backdrop_path, season, episode,
             chapter_id, position_seconds, duration_seconds, percent, updated_at
      FROM account_progress WHERE profile_id = ${context.profileId}
      ORDER BY updated_at DESC
    `;

    const items = rows.map((row) => ({
      mediaId: row.media_id,
      mediaType: row.media_type,
      title: row.title,
      posterPath: row.poster_path,
      backdropPath: row.backdrop_path,
      season: row.season,
      episode: row.episode,
      chapterId: row.chapter_id,
      currentTime: Number(row.position_seconds),
      duration: Number(row.duration_seconds),
      percent:
        Number(row.duration_seconds) > 0
          ? Math.min(100, Math.max(0, Math.round((Number(row.position_seconds) / Number(row.duration_seconds)) * 100)))
          : Number(row.percent) || 0,
      updatedAt: new Date(row.updated_at as string).toISOString(),
    }));

    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to load progress right now." }, { status: 500 });
  }
}

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
  const mediaType =
    body.mediaType === "movie" || body.mediaType === "tv" || body.mediaType === "anime" || body.mediaType === "manga"
      ? body.mediaType
      : null;
  const title =
    typeof body.title === "string" && body.title.trim().length > 0 ? body.title.trim().slice(0, 240) : null;
  const currentTime =
    typeof body.currentTime === "number" && Number.isFinite(body.currentTime) && body.currentTime >= 0
      ? Math.min(body.currentTime, 60 * 60 * 14)
      : null;
  const duration =
    typeof body.duration === "number" && Number.isFinite(body.duration) && body.duration >= 0
      ? Math.min(body.duration, 60 * 60 * 14)
      : null;
  const updatedAt = typeof body.updatedAt === "string" ? body.updatedAt : null;
  const updatedAtTime =
    updatedAt !== null && !Number.isNaN(Date.parse(updatedAt)) ? Date.parse(updatedAt) : Date.now();

  if (!mediaId || !mediaType || currentTime === null || duration === null) {
    return NextResponse.json(
      { error: "mediaId, mediaType, currentTime, and duration are required." },
      { status: 400 },
    );
  }

  try {
    await ensureAccountSchema();
    const sql = getSql();

    const existing = await sql`
      SELECT updated_at FROM account_progress
      WHERE profile_id = ${context.profileId} AND media_id = ${mediaId}
      LIMIT 1
    `;

    if (existing[0]) {
      const storedAt = new Date(existing[0].updated_at as string).getTime();
      if (updatedAtTime < storedAt) {
        return NextResponse.json({ ok: false, stale: true });
      }
    }

    const percent = duration > 0 ? Math.min(100, Math.max(0, Math.round((currentTime / duration) * 100))) : 0;
    const season =
      typeof body.season === "number" && Number.isInteger(body.season) && body.season > 0 ? body.season : null;
    const episode =
      typeof body.episode === "number" && Number.isInteger(body.episode) && body.episode > 0 ? body.episode : null;
    const chapterId = readMediaId(body.chapterId);

    await sql`
      INSERT INTO account_progress
        (profile_id, media_id, media_type, title, poster_path, backdrop_path, season, episode,
         chapter_id, position_seconds, duration_seconds, percent, updated_at)
      VALUES (
        ${context.profileId}, ${mediaId}, ${mediaType}, ${title ?? mediaId},
        ${typeof body.posterPath === "string" ? body.posterPath.slice(0, 400) : null},
        ${typeof body.backdropPath === "string" ? body.backdropPath.slice(0, 400) : null},
        ${season}, ${episode}, ${chapterId}, ${currentTime}, ${duration}, ${percent},
        ${new Date(updatedAtTime).toISOString()}
      )
      ON CONFLICT (profile_id, media_id) DO UPDATE SET
        media_type = EXCLUDED.media_type,
        title = EXCLUDED.title,
        poster_path = COALESCE(EXCLUDED.poster_path, account_progress.poster_path),
        backdrop_path = COALESCE(EXCLUDED.backdrop_path, account_progress.backdrop_path),
        season = EXCLUDED.season,
        episode = EXCLUDED.episode,
        chapter_id = EXCLUDED.chapter_id,
        position_seconds = EXCLUDED.position_seconds,
        duration_seconds = EXCLUDED.duration_seconds,
        percent = EXCLUDED.percent,
        updated_at = EXCLUDED.updated_at
    `;

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to save progress right now." }, { status: 500 });
  }
}
