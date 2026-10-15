import { NextResponse } from "next/server";

import { buildEdgeCacheHeaders } from "@/lib/http/cache";
import { STREAMED_BASE } from "@/lib/live/server";
import type { EpgChannel, EpgProgram, LiveMatch } from "@/types/live";

/**
 * Electronic program guide for Live TV.
 *
 * GrubX is a live *sports* console: its documented provider (streamed.pk)
 * exposes today's events rather than 24/7 broadcast channels, so the guide is
 * built by grouping the provider's own schedule ("channels" = events happening
 * in overlapping time blocks per sport). Nothing is invented: a channel row in
 * the guide is a real provider event with a real start/end window.
 *
 * The provider origin is a fixed allowlisted host — this route never fetches
 * user-supplied URLs, so there is no SSRF surface. Requests are cached at the
 * edge with the same helper the other live routes use.
 */

const TTL_SECONDS = 120;
const MAX_PROGRAMS_PER_CHANNEL = 48;

export const runtime = "nodejs";

const asEpochMs = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  // stream Dates arrive as seconds.
  if (value > 1_000_000_000_000) {
    return value;
  }
  if (value > 1_000_000_000) {
    return value * 1000;
  }
  return null;
};

export const buildGuide = (matches: LiveMatch[], nowMs: number): EpgChannel[] => {
  const byCategory = new Map<string, LiveMatch[]>();
  matches.forEach((match) => {
    if (!match.sources || match.sources.length === 0) {
      return;
    }
    byCategory.set(match.category, [...(byCategory.get(match.category) ?? []), match]);
  });

  const channels: EpgChannel[] = [];
  byCategory.forEach((categoryMatches, category) => {
    const programs = categoryMatches
      .map((match): EpgProgram | null => {
        const startAt = asEpochMs(match.date);
        if (startAt === null) {
          return null;
        }
        // The provider does not publish end times; apply the documented
        // 3-hour broadcast window used across all live sports consoles.
        return {
          id: match.id,
          startAt,
          endAt: startAt + 3 * 60 * 60 * 1000,
          title: match.title,
          description: [match.teams?.home?.name, match.teams?.away?.name].filter(Boolean).join(" vs ") || null,
          category,
        };
      })
      .filter((program): program is EpgProgram => program !== null)
      .sort((left, right) => left.startAt - right.startAt)
      .slice(0, MAX_PROGRAMS_PER_CHANNEL);

    if (programs.length === 0) {
      return;
    }

    const currentIndex = programs.findIndex((program) => program.startAt <= nowMs && nowMs < program.endAt);
    channels.push({
      id: `epg-${category.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`,
      name: category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      category,
      logoUrl: resolveCategoryLogo(categoryMatches[0]),
      currentIndex,
      programs,
    });
  });

  return channels.sort((left, right) => right.programs.length - left.programs.length);
};

const resolveCategoryLogo = (match: LiveMatch): string | null => {
  const badgeRoot = `https://streamed.pk/api/images/badge`;
  const homeBadge = match.teams?.home?.badge;
  const awayBadge = match.teams?.away?.badge;
  if (homeBadge && awayBadge) {
    return `${badgeRoot}/${homeBadge}.webp`;
  }
  return null;
};

export async function GET() {
  const endpoints = [
    `${STREAMED_BASE}/api/matches/live`,
    `${STREAMED_BASE}/api/matches/all-today`,
  ];

  try {
    const responses = await Promise.allSettled(
      endpoints.map((endpoint) =>
        fetch(endpoint, {
          headers: { Accept: "application/json" },
          next: { revalidate: TTL_SECONDS },
          redirect: "error",
          signal: AbortSignal.timeout(4000),
        }),
      ),
    );

    const payloads = responses.flatMap((response) =>
      response.status === "fulfilled" && response.value.ok ? [response.value] : [],
    );
    if (payloads.length === 0) {
      return NextResponse.json({ error: "Unable to reach program guide provider." }, { status: 502 });
    }

    const matches = (await Promise.all(payloads.map((response) => response.json() as Promise<LiveMatch[]>)))
      .flat()
      .filter((match): match is LiveMatch => Boolean(match && typeof match.id === "string"));

    // Deduplicate by id (live.ReadAlso appears in the all-today list).
    const unique = Array.from(new Map(matches.map((match) => [match.id, match])).values());
    const channels = buildGuide(unique, Date.now());

    return NextResponse.json(
      { generatedAt: new Date().toISOString(), channels },
      { headers: buildEdgeCacheHeaders(TTL_SECONDS, 600) },
    );
  } catch {
    return NextResponse.json({ error: "The program guide is unavailable right now." }, { status: 500 });
  }
}
