"use client";

import { ANIME_PROVIDER_STATUS, resolveAnimeApiBase } from "@/lib/anime/config";
import { isMyAnimeListId, normalizeAnimeId } from "@/lib/anime/embed";
import {
  normalizeAnimeEpisodeList,
  normalizeAnimeRecentList,
  normalizeAnimeSchedule,
  normalizeAnimeSearchPage,
  normalizeAnimeSeries,
  normalizeAnimeTitle,
  normalizeAnimeTitleList,
  unwrapData,
} from "@/lib/anime/normalize";
import type {
  AnimeEpisode,
  AnimeProviderStatus,
  AnimeRecentEpisode,
  AnimeScheduleEntry,
  AnimeSearchPage,
  AnimeSeries,
  AnimeTitle,
  AnimeTopRange,
} from "@/types/anime";

/**
 * Anime catalogue access from the browser.
 *
 * Ani.pm's partner API is keyless and documented as CORS-open, so the browser
 * calls it directly and the shared normalizers run on the raw payload. When the
 * direct call fails for a transport reason (CORS, offline DNS, regional block)
 * the request is retried through `/api/anime`, which returns the same normalized
 * shapes from the server. Only transport failures trigger the fallback: a real
 * 4xx from the provider is surfaced as-is instead of being retried.
 */

const REQUEST_TIMEOUT_MS = 8_000;

type AnimeResource = "search" | "title" | "series" | "episodes" | "recent" | "schedule" | "top";

type ResourceParams = {
  query?: string;
  page?: number;
  limit?: number;
  genre?: string;
  format?: string;
  range?: AnimeTopRange;
  id?: string;
};

class AnimeRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AnimeRequestError";
    this.status = status;
  }
}

const isAbortError = (error: unknown) =>
  error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError");

const withTimeout = (signal?: AbortSignal): { signal: AbortSignal; done: () => void } => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);

  return {
    signal: controller.signal,
    done: () => {
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
  };
};

const requestJson = async (url: string, signal?: AbortSignal): Promise<unknown> => {
  const { signal: scoped, done } = withTimeout(signal);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      signal: scoped,
    });

    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      const message =
        typeof payload === "object" && payload !== null && typeof (payload as { error?: unknown }).error === "string"
          ? (payload as { error: string }).error
          : `The anime catalogue request failed (${response.status}).`;
      throw new AnimeRequestError(message, response.status);
    }

    return payload;
  } finally {
    done();
  }
};

const PROVIDER_PATH: Record<AnimeResource, (params: ResourceParams) => string | null> = {
  search: (params) => (params.query ? "/titles" : null),
  title: (params) => (params.id ? `/titles/${encodeURIComponent(params.id)}` : null),
  series: (params) => (params.id ? `/series/${encodeURIComponent(params.id)}` : null),
  episodes: (params) => (params.id ? `/titles/${encodeURIComponent(params.id)}/episodes` : null),
  recent: () => "/recent",
  schedule: () => "/schedule",
  top: () => "/top",
};

const PROVIDER_QUERY_KEYS: Record<AnimeResource, Array<keyof ResourceParams>> = {
  search: ["query", "page", "limit"],
  title: [],
  series: [],
  episodes: [],
  recent: ["page", "limit"],
  schedule: [],
  top: ["range", "genre", "format", "limit"],
};

const appendParams = (search: URLSearchParams, params: ResourceParams, keys: Array<keyof ResourceParams>) => {
  keys.forEach((key) => {
    const value = params[key];
    if (value !== undefined && value !== null && value !== "") {
      search.set(key === "query" ? "q" : key, String(value));
    }
  });
};

const load = async <T>(
  resource: AnimeResource,
  params: ResourceParams,
  normalizeDirect: (payload: unknown) => T,
  signal?: AbortSignal,
): Promise<T> => {
  const path = PROVIDER_PATH[resource](params);
  let directFailure: unknown = null;

  if (path) {
    const query = new URLSearchParams();
    appendParams(query, params, PROVIDER_QUERY_KEYS[resource]);
    const queryString = query.toString();
    const suffix = queryString.length > 0 ? `?${queryString}` : "";

    try {
      const payload = await requestJson(`${resolveAnimeApiBase()}${path}${suffix}`, signal);
      return normalizeDirect(payload);
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      // A provider-side rejection is the real answer; only transport problems
      // are worth retrying through our own route.
      if (error instanceof AnimeRequestError && error.status < 500) {
        throw error;
      }
      directFailure = error;
    }
  }

  const serverQuery = new URLSearchParams({ resource });
  appendParams(serverQuery, params, ["query", "page", "limit", "genre", "format", "range"]);
  if (params.id) {
    serverQuery.set("id", params.id);
  }

  try {
    // The route already returns normalized shapes, so this response is used as-is.
    return (await requestJson(`/api/anime?${serverQuery.toString()}`, signal)) as T;
  } catch (error) {
    throw directFailure instanceof Error ? directFailure : error;
  }
};

/** Static provider facts; no network call, so this never fails. */
export const getClientAnimeStatus = (): AnimeProviderStatus => ANIME_PROVIDER_STATUS;

export const getClientAnimeSearch = (
  params: { query: string; page?: number; limit?: number },
  signal?: AbortSignal,
) => {
  const query = params.query.trim();
  const page = params.page ?? 1;
  const limit = params.limit ?? 24;

  return load<AnimeSearchPage>(
    "search",
    { query, page, limit },
    (payload) => normalizeAnimeSearchPage(payload, { page, limit }),
    signal,
  );
};

export const getClientAnimeTitle = (id: string, signal?: AbortSignal) =>
  load<AnimeTitle | null>(
    "title",
    { id },
    (payload) => normalizeAnimeTitle(unwrapData(payload)),
    signal,
  );

export const getClientAnimeSeries = (id: string, signal?: AbortSignal) =>
  load<AnimeSeries | null>(
    "series",
    { id },
    (payload) => normalizeAnimeSeries(unwrapData(payload)),
    signal,
  );

export const getClientAnimeEpisodes = (id: string, signal?: AbortSignal) =>
  load<AnimeEpisode[]>("episodes", { id }, normalizeAnimeEpisodeList, signal);

export const getClientAnimeRecent = (params: { page?: number; limit?: number } = {}, signal?: AbortSignal) =>
  load<AnimeRecentEpisode[]>("recent", { page: params.page ?? 1, limit: params.limit ?? 24 }, normalizeAnimeRecentList, signal);

export const getClientAnimeSchedule = (signal?: AbortSignal) =>
  load<AnimeScheduleEntry[]>("schedule", {}, normalizeAnimeSchedule, signal);

export const getClientAnimeTop = (
  params: { range?: AnimeTopRange; genre?: string; format?: string; limit?: number } = {},
  signal?: AbortSignal,
) =>
  load<AnimeTitle[]>(
    "top",
    { range: params.range ?? "week", genre: params.genre, format: params.format, limit: params.limit ?? 24 },
    normalizeAnimeTitleList,
    signal,
  );

/** Canonical id for an in-app anime route. */
export const animeRouteId = (id: string | number): string | null => normalizeAnimeId(id);

export { isMyAnimeListId };
