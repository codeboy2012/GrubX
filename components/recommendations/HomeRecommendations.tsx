"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AnimeCard } from "@/components/anime/AnimeCard";
import { RecommendationRail } from "@/components/recommendations/RecommendationRail";
import { MangaCard } from "@/components/manga/MangaCard";
import { MovieCard } from "@/components/media/MovieCard";
import { useSettingsContext } from "@/context/SettingsContext";
import { useFilters } from "@/hooks/useFilters";
import { useRecommendations } from "@/hooks/useRecommendations";
import { clearRecommendationState } from "@/lib/recommendationEngine";
import { getClientAnimeTop } from "@/lib/anime/client";
import { getClientMangaList } from "@/lib/manga/client";
import { getClientMediaPage } from "@/lib/tmdb/client";
import {
  animeTitleToRecommendationItem,
  mangaSummaryToRecommendationItem,
  mediaItemToRecommendationItem,
  type RecommendationItem,
} from "@/lib/recommendationEngine";
import type { AnimeTitle } from "@/types/anime";
import type { MangaSummary } from "@/types/manga";
import type { MediaItem, MediaType } from "@/types/media";

/**
 * Home personal rails: cross-catalog "Recommended for You".
 *
 * Candidate pool = real catalogue pages this client session has available:
 * - popular movies and TV (TMDB via the server route),
 * - a genre probe on the anime catalogue from the user's top genres,
 * - popular manga.
 *
 * Ranking is explainable rules logic (lib/recommendationEngine.ts + docs/RANKING.md).
 * Everything is client-side, so a slow provider can't block the homepage, and
 * dismissed items are respected once the recommendations state updates.
 */

/**
 * Wrapper around a candidate record so one ranking pipeline can score items
 * whose native shapes differ per provider (TMDB rows, Ani.pm titles, MangaDex
 * summaries). native id and media type stay authoritative for the engine.
 */
type CatalogCandidate = {
  id: string;
  mediaType: MediaType;
  data: AnimeTitle | MangaSummary | MediaItem;
};

const recommendationItemOf = (candidate: CatalogCandidate): RecommendationItem => {
  if (candidate.mediaType === "anime") {
    return animeTitleToRecommendationItem(candidate.data as AnimeTitle);
  }
  if (candidate.mediaType === "manga") {
    return mangaSummaryToRecommendationItem(candidate.data as MangaSummary);
  }
  return mediaItemToRecommendationItem(candidate.data as MediaItem);
};

const useMemoItems = ({
  movies,
  tv,
  anime,
  manga,
}: {
  movies: MediaItem[];
  tv: MediaItem[];
  anime: AnimeTitle[];
  manga: MangaSummary[];
}): CatalogCandidate[] => [
  ...movies.map<CatalogCandidate>((data) => ({ id: `movie:${data.id}`, mediaType: "movie", data })),
  ...tv.map<CatalogCandidate>((data) => ({ id: `tv:${data.id}`, mediaType: "tv", data })),
  ...anime.map<CatalogCandidate>((data) => ({ id: `anime:${data.anilistId}`, mediaType: "anime", data })),
  ...manga.map<CatalogCandidate>((data) => ({ id: `manga:${data.id}`, mediaType: "manga", data })),
];

export function HomeRecommendations() {
  const { ready, settings } = useSettingsContext();
  const queryClient = useQueryClient();
  const { filters } = useFilters({ startYear: 1900, endYear: new Date().getFullYear() + 1 });
  const enabled = ready && settings.recommendationsEnabled && settings.trackingEnabled;

  const moviesQuery = useQuery({
    queryKey: ["rec", "movies"],
    enabled,
    staleTime: 1000 * 60 * 10,
    queryFn: ({ signal }) => getClientMediaPage({ mediaType: "movie", category: "popular", page: 1, signal }),
  });

  const tvQuery = useQuery({
    queryKey: ["rec", "tv"],
    enabled,
    staleTime: 1000 * 60 * 10,
    queryFn: ({ signal }) => getClientMediaPage({ mediaType: "tv", category: "popular", page: 1, signal }),
  });

  const animeQuery = useQuery({
    queryKey: ["rec", "anime-top"],
    enabled: enabled && settings.featureToggles.anime,
    staleTime: 1000 * 60 * 30,
    queryFn: ({ signal }) => getClientAnimeTop({ range: "all", limit: 24 }, signal),
  });

  const mangaQuery = useQuery({
    queryKey: ["rec", "manga-popular"],
    enabled: enabled && settings.featureToggles.manga,
    staleTime: 1000 * 60 * 15,
    queryFn: ({ signal }) => getClientMangaList({ kind: "popular", limit: 24 }, signal),
  });

  const candidates = useMemoItems({
    movies: moviesQuery.data?.results ?? [],
    tv: tvQuery.data?.results ?? [],
    anime: animeQuery.data ?? [],
    manga: (mangaQuery.data?.items ?? []) as MangaSummary[],
  });

  const recommendations = useRecommendations({
    content: candidates,
    filters,
    toRecommendationItem: recommendationItemOf,
    mediaType: undefined,
    limit: 18,
    enabled,
  });

  if (!enabled || recommendations.recommendedItems.length === 0) {
    // Cold start: engine ignores zero-score items (all equal), so we render the
    // normalized landing-state rather than pretending personalization exists.
    return null;
  }

  const clearPersonalization = () => {
    clearRecommendationState();
    void queryClient.invalidateQueries({ queryKey: ["rec"] });
  };

  return (
    <RecommendationRail
      title="Recommended for You"
      description="Rules-based suggestions from what you've opened, searched, and saved across movies, shows, anime, manga, and live events."
      items={recommendations.recommendedItems}
      getKey={(item) => `${item.mediaType}:${item.id}`}
      renderItem={(item) => <HomeRecommendationCard item={item} />}
      onNotInterested={recommendations.markNotInterested}
      onSaveForLater={recommendations.saveForLater}
      footer={
        <button
          type="button"
          onClick={clearPersonalization}
          className="text-xs text-[var(--muted)] underline underline-offset-4 hover:text-white"
        >
          Clear personalization data
        </button>
      }
    />
  );
}

function HomeRecommendationCard({ item }: { item: CatalogCandidate }) {
  if (item.mediaType === "anime") {
    return <AnimeCard anime={item.data as AnimeTitle} compact />;
  }
  if (item.mediaType === "manga") {
    return <MangaCard manga={item.data as MangaSummary} />;
  }
  return <MovieCard media={item.data as MediaItem} />;
}
