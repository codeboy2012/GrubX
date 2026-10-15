import { buildAnimeCoverUrl } from "@/lib/anime/embed";
import type {
  AnimeAvailability,
  AnimeEpisode,
  AnimeRecentEpisode,
  AnimeScheduleEntry,
  AnimeSearchPage,
  AnimeSeries,
  AnimeTitle,
} from "@/types/anime";

/**
 * Defensive parsing for Ani.pm catalogue payloads.
 *
 * The same parsers run on the server (provider) and in the browser (direct
 * catalogue calls), so provider changes are absorbed in exactly one place.
 * Every field is treated as untrusted input.
 */

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const asString = (value: unknown): string | null => (typeof value === "string" ? value : null);

export const asFiniteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asBoolean = (value: unknown): boolean => value === true;

const asPositiveInt = (value: unknown): number | null => {
  const numeric = asFiniteNumber(value);
  return numeric !== null && Number.isInteger(numeric) && numeric > 0 ? numeric : null;
};

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 50) : [];

export const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** Catalogue responses wrap their payload in `data`. */
export const unwrapData = (payload: unknown): unknown => (isRecord(payload) ? payload.data : null);

export const normalizeAvailability = (value: unknown): AnimeAvailability => {
  const record = isRecord(value) ? value : {};
  return {
    sub: asBoolean(record.sub),
    dub: asBoolean(record.dub),
    subHard: asBoolean(record.subHard),
    dubHard: asBoolean(record.dubHard),
  };
};

export const normalizeAnimeEpisode = (value: unknown): AnimeEpisode | null => {
  if (!isRecord(value)) {
    return null;
  }

  const number = asPositiveInt(value.number);
  if (number === null) {
    return null;
  }

  const embedRecord = isRecord(value.embed) ? value.embed : null;

  return {
    number,
    title: asString(value.title),
    runtimeSeconds: asFiniteNumber(value.runtimeSeconds),
    aired: asString(value.aired),
    thumbnail: asString(value.thumbnail),
    available: normalizeAvailability(value.available),
    embed: embedRecord ? { sub: asString(embedRecord.sub), dub: asString(embedRecord.dub) } : null,
  };
};

export const normalizeAnimeTitle = (value: unknown): AnimeTitle | null => {
  if (!isRecord(value)) {
    return null;
  }

  const anilistId = asPositiveInt(value.anilistId);
  const title = asString(value.title);
  if (anilistId === null || !title) {
    return null;
  }

  const malId = asPositiveInt(value.malId);
  const counts = isRecord(value.episodes) ? value.episodes : {};

  return {
    anilistId,
    malId,
    title,
    nativeTitle: asString(value.nativeTitle),
    format: asString(value.format),
    status: asString(value.status),
    year: asFiniteNumber(value.year),
    season: asString(value.season),
    score: asFiniteNumber(value.score),
    rating: asString(value.rating),
    durationMinutes: asFiniteNumber(value.durationMinutes),
    episodeCounts: {
      total: asFiniteNumber(counts.total) ?? 0,
      sub: asFiniteNumber(counts.sub) ?? 0,
      dub: asFiniteNumber(counts.dub) ?? 0,
    },
    genres: asStringArray(value.genres),
    studios: asStringArray(value.studios),
    adult: asBoolean(value.adult),
    synopsis: asString(value.synopsis) ?? "",
    // The provider normally returns its own cover URL; rebuild it if absent.
    posterUrl: asString(value.poster) ?? buildAnimeCoverUrl(anilistId, malId),
    bannerUrl: asString(value.banner),
    siteUrl: asString(value.url),
    embedUrl: asString(value.embed),
  };
};

/**
 * Episode lists arrive as `data.episodes` or as a bare array depending on the
 * endpoint, so both cases are unwrapped here.
 */
export const normalizeAnimeEpisodeList = (payload: unknown): AnimeEpisode[] => {
  const data = unwrapData(payload);
  const rows = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray(data.episodes)
      ? data.episodes
      : [];

  return asArray(rows)
    .map(normalizeAnimeEpisode)
    .filter((episode): episode is AnimeEpisode => episode !== null)
    .sort((left, right) => left.number - right.number);
};

export const normalizeAnimeSeries = (value: unknown): AnimeSeries | null => {
  const title = normalizeAnimeTitle(value);
  if (!title || !isRecord(value)) {
    return null;
  }

  const episodes = asArray(value.episodeList)
    .map(normalizeAnimeEpisode)
    .filter((episode): episode is AnimeEpisode => episode !== null)
    .sort((left, right) => left.number - right.number);

  return { ...title, episodes };
};

export const normalizeAnimeSearchPage = (
  payload: unknown,
  fallback: { page: number; limit: number },
): AnimeSearchPage => {
  const record = isRecord(payload) ? payload : {};
  const items = asArray(unwrapData(payload))
    .map(normalizeAnimeTitle)
    .filter((item): item is AnimeTitle => item !== null);

  return {
    items,
    page: asFiniteNumber(record.page) ?? fallback.page,
    limit: asFiniteNumber(record.limit) ?? fallback.limit,
    total: asFiniteNumber(record.total),
    hasMore: asBoolean(record.hasMore),
  };
};

export const normalizeAnimeTitleList = (payload: unknown): AnimeTitle[] =>
  asArray(unwrapData(payload))
    .map(normalizeAnimeTitle)
    .filter((item): item is AnimeTitle => item !== null);

export const normalizeAnimeRecentList = (payload: unknown): AnimeRecentEpisode[] =>
  asArray(unwrapData(payload))
    .map((value): AnimeRecentEpisode | null => {
      if (!isRecord(value)) {
        return null;
      }

      const anilistId = asPositiveInt(value.anilistId);
      const title = asString(value.title);
      const episode = asPositiveInt(value.episode);
      if (anilistId === null || !title || episode === null) {
        return null;
      }

      return {
        anilistId,
        title,
        posterUrl: asString(value.poster) ?? buildAnimeCoverUrl(anilistId),
        episode,
        episodeTitle: asString(value.episodeTitle),
        available: { sub: asBoolean(value.sub), dub: asBoolean(value.dub) },
        addedAt: asString(value.addedAt),
        runtimeSeconds: asFiniteNumber(value.runtimeSeconds),
        embedUrl: asString(value.embed),
      };
    })
    .filter((entry): entry is AnimeRecentEpisode => entry !== null);

export const normalizeAnimeSchedule = (payload: unknown): AnimeScheduleEntry[] =>
  asArray(unwrapData(payload))
    .map((value): AnimeScheduleEntry | null => {
      if (!isRecord(value)) {
        return null;
      }

      const anilistId = asPositiveInt(value.anilistId);
      const title = asString(value.title);
      const episode = asPositiveInt(value.episode);
      if (anilistId === null || !title || episode === null) {
        return null;
      }

      return {
        anilistId,
        title,
        episode,
        kind: value.kind === "dub" ? "dub" : "sub",
        airingAt: asString(value.airingAt),
        final: asBoolean(value.final),
        delayed: asBoolean(value.delayed),
        onProvider: asBoolean(value.onAniPm),
        adult: asBoolean(value.adult),
        embedUrl: asString(value.embed),
      };
    })
    .filter((entry): entry is AnimeScheduleEntry => entry !== null);
