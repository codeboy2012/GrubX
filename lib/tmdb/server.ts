import "server-only";

import { isTmdbMediaType, type Genre, type MediaDetails, type MediaPage, type MediaType } from "@/types/media";
import {
  normalizeEpisodes,
  normalizeGenreList,
  normalizeMediaDetails,
  normalizeMediaPage,
  normalizeTrailer,
} from "@/lib/tmdb/normalizers";
import { ConfigError } from "@/lib/env";
import { fetchTmdbJson } from "@/lib/tmdb/request";

/** TMDB only serves movies and TV; anime and manga have their own providers. */
const assertTmdbMediaType = (mediaType: MediaType) => {
  if (!isTmdbMediaType(mediaType)) {
    throw new Error("TMDB metadata is only available for movies and TV shows.");
  }
  return mediaType;
};

export const getTrendingHero = async (): Promise<MediaPage> => {
  const { payload } = await fetchTmdbJson<Record<string, unknown>>("/trending/all/day");
  return normalizeMediaPage(payload);
};

export const getServerMediaPage = async (options: {
  mediaType: MediaType;
  genre?: string | null;
  genres?: string[];
  ratings?: string[];
  yearFrom?: number;
  yearTo?: number;
  page?: number;
  query?: string;
  category?: "popular" | "top_rated";
  revalidate?: number;
}): Promise<MediaPage> => {
  const { genre, genres = [], ratings = [], yearFrom, yearTo, page = 1, query, category = "popular", revalidate = 300 } = options;
  const mediaType = assertTmdbMediaType(options.mediaType);
  const selectedGenres = genres.length > 0 ? genres : genre ? [genre] : [];
  const selectedRatings = ratings.filter(Boolean);

  if (query && query.trim().length > 0) {
    const { payload } = await fetchTmdbJson<Record<string, unknown>>(
      `/search/${mediaType}`,
      { query, page },
      revalidate,
    );
    return normalizeMediaPage(payload, mediaType);
  }

  if (selectedGenres.length > 0 || selectedRatings.length > 0 || yearFrom || yearTo) {
    const datePrefix = mediaType === "movie" ? "primary_release_date" : "first_air_date";
    const ratingParams =
      mediaType === "movie"
        ? {
            certification_country: selectedRatings.length > 0 ? "US" : undefined,
            certification: selectedRatings.length > 0 ? selectedRatings.join("|") : undefined,
          }
        : {
            with_content_rating: selectedRatings.length > 0 ? selectedRatings.join("|") : undefined,
          };
    const { payload } = await fetchTmdbJson<Record<string, unknown>>(
      `/discover/${mediaType}`,
      {
        with_genres: selectedGenres.length > 0 ? selectedGenres.join(",") : undefined,
        page,
        sort_by: "popularity.desc",
        [`${datePrefix}.gte`]: yearFrom ? `${yearFrom}-01-01` : undefined,
        [`${datePrefix}.lte`]: yearTo ? `${yearTo}-12-31` : undefined,
        ...ratingParams,
      },
      revalidate,
    );
    return normalizeMediaPage(payload, mediaType);
  }

  const { payload } = await fetchTmdbJson<Record<string, unknown>>(`/${mediaType}/${category}`, { page }, revalidate);
  return normalizeMediaPage(payload, mediaType);
};

export const getServerMediaDetails = async (
  mediaType: MediaType,
  id: string,
  revalidate = 300,
): Promise<MediaDetails> => {
  const resolvedType = assertTmdbMediaType(mediaType);
  const { payload } = await fetchTmdbJson<Record<string, unknown>>(
    `/${resolvedType}/${id}`,
    { append_to_response: "videos,credits" },
    revalidate,
  );
  return normalizeMediaDetails(payload, resolvedType);
};

export const getServerSeasonEpisodes = async (id: string, season: number) => {
  const { payload } = await fetchTmdbJson<Record<string, unknown>>(`/tv/${id}/season/${season}`);
  return {
    seasonNumber: Number(payload.season_number ?? season),
    episodes: normalizeEpisodes(payload.episodes),
  };
};

export const getServerGenres = async (mediaType: MediaType): Promise<Genre[]> => {
  const resolvedType = assertTmdbMediaType(mediaType);
  const { payload } = await fetchTmdbJson<{ genres?: unknown[] }>(`/genre/${resolvedType}/list`);
  return normalizeGenreList(payload.genres);
};

export const getServerTrailer = async (mediaType: MediaType, id: string) => {
  const resolvedType = assertTmdbMediaType(mediaType);
  const { payload } = await fetchTmdbJson<{ results?: unknown[] }>(`/${resolvedType}/${id}/videos`);
  return normalizeTrailer(payload.results);
};

/**
 * Logs a metadata problem without echoing credentials, then lets the caller
 * decide what to render.
 */
const reportMetadataIssue = (error: unknown, context: string) => {
  if (error instanceof ConfigError) {
    console.error(`[GrubX] ${context}: TMDB is not configured (${error.variable}). ${error.hint}`);
    return;
  }
  console.error(`[GrubX] ${context}: TMDB request failed.`, error instanceof Error ? error.message : error);
};

/**
 * Non-throwing wrappers used by server components.
 *
 * A missing or unreachable metadata provider must never take down a page that
 * only decorates itself with that data (the homepage and the 404 boundary are
 * rendered while generating static routes such as the legal pages), so these
 * return null instead of throwing and the page renders its honest empty state.
 */
export const safeTrendingHero = async (): Promise<MediaPage | null> => {
  try {
    return await getTrendingHero();
  } catch (error) {
    reportMetadataIssue(error, "Homepage hero");
    return null;
  }
};

export const safeServerMediaPage = async (
  options: Parameters<typeof getServerMediaPage>[0],
): Promise<MediaPage | null> => {
  try {
    return await getServerMediaPage(options);
  } catch (error) {
    reportMetadataIssue(error, `Catalogue (${options.mediaType}/${options.category ?? "popular"})`);
    return null;
  }
};
