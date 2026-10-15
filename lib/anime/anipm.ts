import { ANIME_PROVIDER_STATUS, resolveAnimeApiBase } from "@/lib/anime/config";
import { isMyAnimeListId, normalizeAnimeId } from "@/lib/anime/embed";
import {
  asString,
  isRecord,
  normalizeAnimeEpisodeList,
  normalizeAnimeRecentList,
  normalizeAnimeSchedule,
  normalizeAnimeSearchPage,
  normalizeAnimeSeries,
  normalizeAnimeTitle,
  normalizeAnimeTitleList,
  unwrapData,
} from "@/lib/anime/normalize";
import type { AnimeProvider, AnimeRecentQuery, AnimeSearchQuery, AnimeTopQuery } from "@/lib/anime/provider";
import type { AnimeEpisode, AnimeSeries, AnimeTitle } from "@/types/anime";

/**
 * Ani.pm catalogue provider (api-docs-RAW.txt §09).
 *
 * Only documented endpoints are called, every response field is treated as
 * untrusted, and identifiers are validated before a request is built. All
 * parsing is delegated to `lib/anime/normalize` so the server and the
 * browser-direct client can never drift apart.
 */

const REQUEST_TIMEOUT_MS = 8_000;
const REVALIDATE = {
  title: 60 * 60,
  series: 60 * 60,
  episodes: 60 * 60,
  recent: 60 * 5,
  schedule: 60 * 15,
  search: 60 * 5,
  top: 60 * 30,
} as const;

export class AniPmError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 502, code = "anipm-request-failed") {
    super(message);
    this.name = "AniPmError";
    this.status = status;
    this.code = code;
  }
}

const requestJson = async (
  path: string,
  params: Record<string, string | number | undefined>,
  revalidate: number,
): Promise<unknown> => {
  const url = new URL(`${resolveAnimeApiBase()}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      next: { revalidate },
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new AniPmError(
      timedOut ? "The anime catalogue timed out." : "Unable to reach the anime catalogue.",
      timedOut ? 504 : 502,
      timedOut ? "anipm-timeout" : "anipm-unreachable",
    );
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const errorInfo = isRecord(payload) && isRecord(payload.error) ? payload.error : null;
    throw new AniPmError(
      asString(errorInfo?.message) ?? "The anime catalogue rejected that request.",
      response.status,
      asString(errorInfo?.code) ?? "anipm-error",
    );
  }

  return payload;
};

/** Ani.pm accepts `154587` or `mal-52991`; MyAnimeList ids stay prefixed. */
const toProviderId = (id: string) => (isMyAnimeListId(id) ? id : normalizeAnimeId(id));

const isNotFound = (error: unknown) =>
  error instanceof AniPmError && (error.status === 404 || error.status === 410 || error.code === "title-not-found");

export const anipmProvider: AnimeProvider = {
  id: "anipm",
  label: "Ani.pm",
  requiresKey: false,

  // Static facts, reported even while the catalogue is unreachable.
  status: () => ANIME_PROVIDER_STATUS,

  async search({ query, page = 1, limit = 24 }: AnimeSearchQuery) {
    const payload = await requestJson("/titles", { q: query.trim(), page, limit }, REVALIDATE.search);
    return normalizeAnimeSearchPage(payload, { page, limit });
  },

  async title(id: string): Promise<AnimeTitle | null> {
    const providerId = toProviderId(id);
    if (!providerId) {
      return null;
    }

    try {
      const payload = await requestJson(`/titles/${encodeURIComponent(providerId)}`, {}, REVALIDATE.title);
      return normalizeAnimeTitle(unwrapData(payload));
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }
      throw error;
    }
  },

  async series(id: string): Promise<AnimeSeries | null> {
    const providerId = toProviderId(id);
    if (!providerId) {
      return null;
    }

    try {
      const payload = await requestJson(`/series/${encodeURIComponent(providerId)}`, {}, REVALIDATE.series);
      return normalizeAnimeSeries(unwrapData(payload));
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }
      throw error;
    }
  },

  async episodes(id: string): Promise<AnimeEpisode[]> {
    const providerId = toProviderId(id);
    if (!providerId) {
      return [];
    }

    const payload = await requestJson(`/titles/${encodeURIComponent(providerId)}/episodes`, {}, REVALIDATE.episodes);
    return normalizeAnimeEpisodeList(payload);
  },

  async recent({ page = 1, limit = 24 }: AnimeRecentQuery) {
    const payload = await requestJson("/recent", { page, limit }, REVALIDATE.recent);
    return normalizeAnimeRecentList(payload);
  },

  async schedule() {
    const payload = await requestJson("/schedule", {}, REVALIDATE.schedule);
    return normalizeAnimeSchedule(payload);
  },

  async top({ range, genre, format, limit = 24 }: AnimeTopQuery) {
    const payload = await requestJson("/top", { range, genre, format, limit }, REVALIDATE.top);
    return normalizeAnimeTitleList(payload);
  },
};
