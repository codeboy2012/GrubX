import { absoluteUrl } from "./api";

/**
 * Image URL resolvers for the native apps.
 *
 * Mirrors the web helpers (`lib/mediaHref.ts`, `lib/live/client.ts`): TMDB
 * posters arrive as bare paths and get expanded to image.tmdb.org URLs, while
 * anime covers, MangaDex uploads, and live badges are already absolute and pass
 * through untouched.
 */

const TMDB_IMAGE = "https://image.tmdb.org/t/p";

export const posterUrl = (posterPath: string | null | undefined, width: "w342" | "w500" | "original" = "w500") =>
  posterPath ? `${TMDB_IMAGE}/${width}${posterPath}` : null;

export const backdropUrl = (
  backdropPath: string | null | undefined,
  width: "w780" | "w1280" | "original" = "w780",
) => (backdropPath ? `${TMDB_IMAGE}/${width}${backdropPath}` : null);

const STREAMED_BASE = "https://streamed.pk";

export const livePosterUrl = (match: { poster?: string; teams?: { home?: { badge?: string | null }; away?: { badge?: string | null } } }) => {
  if (match.poster) {
    const path = match.poster.startsWith("/") ? match.poster : `/${match.poster}`;
    return path.endsWith(".webp") ? `${STREAMED_BASE}${path}` : `${STREAMED_BASE}${path}.webp`;
  }

  const home = match.teams?.home?.badge;
  const away = match.teams?.away?.badge;
  if (home && away) {
    return `${STREAMED_BASE}/api/images/poster/${home}/${away}.webp`;
  }
  return null;
};

export const liveBadgeUrl = (badge?: string | null) => (badge ? `${STREAMED_BASE}/api/images/badge/${badge}.webp` : null);

/**
 * Documented Ani.pm embed URL (api-docs.txt §6.2):
 * https://ani.pm/embed/{ani|mal}/{id}/{episode}/{sub|dub|vostfr}
 */
export const animeEmbedUrl = (anilistId: number, episode: number, lang: "sub" | "dub" = "sub") => {
  if (!Number.isInteger(anilistId) || anilistId <= 0) {
    return null;
  }
  const safeEpisode = Math.min(Math.max(Math.floor(episode), 1), 9999);
  return `https://ani.pm/embed/ani/${anilistId}/${safeEpisode}/${lang}`;
};

export const mangaPageUrl = (baseUrl: string, hash: string, file: string) =>
  `${trimTrailingSlash(baseUrl)}/${hash}/${file}`;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const grubxUrl = (path: string) => absoluteUrl(path);

/**
 * External manga reading destinations.
 *
 * Toonkotsu publishes no API GrubX is permitted to use (its robots.txt
 * disallows `/api/` and its reader sits behind verification), so it stays an
 * external destination: GrubX links to its public site root and integrates
 * nothing. Only the root URL is used — no undocumented paths are guessed.
 */
export const externalSourcesUrl = () => "https://toonkotsu.com/";