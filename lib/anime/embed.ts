import type { AnimeEmbedLanguage, AnimeEpisode, AnimeLanguage } from "@/types/anime";

/**
 * Ani.pm integration constants and URL builders.
 *
 * This module is intentionally isomorphic: the watch page builds embed URLs in
 * the browser, so nothing here may read secrets or import `server-only`.
 * Documented in api-docs-RAW.txt §04 (embed URL formats and parameters).
 */

export const ANI_PM_ORIGIN = "https://ani.pm";
export const ANI_PM_EMBED_BASE = `${ANI_PM_ORIGIN}/embed`;
export const ANI_PM_API_BASE = `${ANI_PM_ORIGIN}/api/partner/v1`;
export const ANI_PM_COVER_BASE = `${ANI_PM_ORIGIN}/api/anime/cover`;

export const ANIME_LANGUAGES: AnimeLanguage[] = ["sub", "dub"];
export const ANIME_EMBED_LANGUAGES: AnimeEmbedLanguage[] = ["sub", "dub", "vostfr"];

const MAX_ID = 2_147_483_647;
const MAX_EPISODE = 9_999;

/**
 * Accepts an AniList id ("154587") or a MyAnimeList reference ("mal-52991").
 * Returns the canonical string form, or null when the value is unusable.
 */
export const normalizeAnimeId = (value: string | number | null | undefined): string | null => {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 && value <= MAX_ID ? String(value) : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  const malMatch = /^mal-(\d{1,10})$/i.exec(trimmed);
  if (malMatch) {
    const numeric = Number(malMatch[1]);
    return numeric > 0 && numeric <= MAX_ID ? `mal-${numeric}` : null;
  }

  if (!/^\d{1,10}$/.test(trimmed)) {
    return null;
  }

  const numeric = Number(trimmed);
  return numeric > 0 && numeric <= MAX_ID ? String(numeric) : null;
};

export const isMyAnimeListId = (id: string) => id.startsWith("mal-");

export const normalizeEpisodeNumber = (value: number | string | null | undefined): number | null => {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : value;
  if (typeof parsed !== "number" || !Number.isInteger(parsed) || parsed < 1 || parsed > MAX_EPISODE) {
    return null;
  }
  return parsed;
};

export const normalizeAnimeLanguage = (value: string | null | undefined): AnimeLanguage =>
  value === "dub" ? "dub" : "sub";

export const normalizeEmbedLanguage = (value: string | null | undefined): AnimeEmbedLanguage =>
  value === "dub" || value === "vostfr" ? value : "sub";

export const normalizeStartSeconds = (value: number | null | undefined): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.min(Math.floor(value), 60 * 60 * 12);
};

export type AnimeEmbedOptions = {
  episode?: number | null;
  lang?: AnimeEmbedLanguage | null;
  start?: number | null;
  autoplay?: boolean;
  muted?: boolean;
  poster?: boolean;
  autoNext?: boolean;
  autoSkip?: boolean;
  theater?: boolean;
  episodes?: boolean;
  hardsub?: boolean;
  adult?: boolean;
  subtitles?: string | null;
  color?: string | null;
  /** Optional publishable app key (`pk_live_…`). Never a secret key. */
  appKey?: string | null;
};

const pushBoolean = (params: URLSearchParams, key: string, value: boolean | undefined) => {
  if (typeof value === "boolean") {
    params.set(key, value ? "1" : "0");
  }
};

const normalizeColor = (value: string | null | undefined) => {
  if (typeof value !== "string") {
    return null;
  }
  const hex = value.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : null;
};

const normalizeAppKey = (value: string | null | undefined) => {
  if (typeof value !== "string") {
    return null;
  }
  const key = value.trim();
  return /^pk_[a-z0-9_]{3,64}$/i.test(key) ? key : null;
};

const normalizeSubtitleChoice = (value: string | null | undefined) => {
  if (typeof value !== "string") {
    return null;
  }
  const choice = value.trim().slice(0, 40);
  if (!choice || choice === "off") {
    return choice === "off" ? "off" : null;
  }
  return /^[a-zA-Z0-9 -]+$/.test(choice) ? choice : null;
};

/**
 * Builds a documented Ani.pm embed URL:
 *   https://ani.pm/embed/{ani|mal}/{id}/{episode}/{sub|dub|vostfr}
 * Never returns a URL for an unusable identifier.
 */
export const buildAnimeEmbedUrl = (
  id: string | number | null | undefined,
  options: AnimeEmbedOptions = {},
): string | null => {
  const canonicalId = normalizeAnimeId(id);
  if (!canonicalId) {
    return null;
  }

  const episode = normalizeEpisodeNumber(options.episode ?? 1);
  if (!episode) {
    return null;
  }

  const scope = isMyAnimeListId(canonicalId) ? "mal" : "ani";
  const numericId = canonicalId.replace(/^mal-/, "");
  const lang = normalizeEmbedLanguage(options.lang ?? "sub");

  const url = new URL(`${ANI_PM_EMBED_BASE}/${scope}/${numericId}/${episode}/${lang}`);

  pushBoolean(url.searchParams, "autoplay", options.autoplay);
  pushBoolean(url.searchParams, "muted", options.muted);
  pushBoolean(url.searchParams, "poster", options.poster);
  pushBoolean(url.searchParams, "autonext", options.autoNext);
  pushBoolean(url.searchParams, "autoskip", options.autoSkip);
  pushBoolean(url.searchParams, "theater", options.theater);
  pushBoolean(url.searchParams, "episodes", options.episodes);
  pushBoolean(url.searchParams, "hardsub", options.hardsub);
  pushBoolean(url.searchParams, "adult", options.adult);

  const start = normalizeStartSeconds(options.start);
  if (start) {
    url.searchParams.set("start", String(start));
  }

  const color = normalizeColor(options.color);
  if (color) {
    url.searchParams.set("color", color);
  }

  const subtitles = normalizeSubtitleChoice(options.subtitles);
  if (subtitles) {
    url.searchParams.set("subtitles", subtitles);
  }

  const key = normalizeAppKey(options.appKey);
  if (key) {
    url.searchParams.set("key", key);
  }

  return url.toString();
};

/** Provider-hosted cover image for a title (documented cover endpoint). */
export const buildAnimeCoverUrl = (anilistId: number, malId?: number | null): string | null => {
  if (!Number.isInteger(anilistId) || anilistId <= 0) {
    return null;
  }

  const url = new URL(ANI_PM_COVER_BASE);
  url.searchParams.set("anilistId", String(anilistId));
  if (malId && Number.isInteger(malId) && malId > 0) {
    url.searchParams.set("malId", String(malId));
  }
  return url.toString();
};

export const buildAnimeSiteUrl = (id: string | number | null | undefined): string | null => {
  const canonicalId = normalizeAnimeId(id);
  if (!canonicalId || isMyAnimeListId(canonicalId)) {
    return null;
  }
  return `${ANI_PM_ORIGIN}/ani/${canonicalId}`;
};

/** True only when the catalogue confirmed that version exists for this episode. */
export const hasAnimeLanguage = (episode: AnimeEpisode, language: AnimeLanguage): boolean =>
  language === "dub" ? episode.available.dub : episode.available.sub;
