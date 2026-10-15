"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck, Play, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { useSettingsContext } from "@/context/SettingsContext";
import { useWatchlistSubscription } from "@/hooks/useWatchlistSubscription";
import { dataLayer } from "@/lib/dataLayer";
import { queryKeys } from "@/lib/queryKeys";
import type { AnimeSeries } from "@/types/anime";

/**
 * Play/resume plus My List for an anime title. Progress is stored against the
 * AniList id, so it never collides with a TMDB id or a manga chapter id.
 */
export function AnimeTitleActions({ series }: { series: AnimeSeries }) {
  const queryClient = useQueryClient();
  const { ready } = useSettingsContext();
  const watchlistQuery = useWatchlistSubscription();

  const progressQuery = useQuery({
    queryKey: queryKeys.progress(String(series.anilistId)),
    queryFn: () => dataLayer.getPlaybackProgress(String(series.anilistId)),
    enabled: ready,
    staleTime: 1000 * 30,
  });

  const isSaved = useMemo(
    () => (watchlistQuery.data ?? []).some((item) => item.mediaId === String(series.anilistId)),
    [series.anilistId, watchlistQuery.data],
  );

  const progress = progressQuery.data;
  const resumableEpisode =
    progress && progress.episode && progress.progress > 0 && progress.progress < 95 ? progress.episode : null;
  const firstEpisode = series.episodes[0] ?? null;
  const firstAvailable = series.episodes.find((episode) => episode.available.sub || episode.available.dub) ?? null;
  const targetEpisode = resumableEpisode ?? firstAvailable?.number ?? firstEpisode?.number ?? null;

  const playable = series.episodes.some((episode) => episode.available.sub || episode.available.dub);

  const toggleWatchlist = async () => {
    const result = await dataLayer.toggleWatchlist({
      mediaId: String(series.anilistId),
      mediaType: "anime",
      title: series.title,
      posterPath: series.posterUrl,
      backdropPath: series.bannerUrl,
      rating: series.score,
    });

    queryClient.setQueryData(queryKeys.watchlist, result.items ?? []);
    toast.success(result.saved ? "Added to My List." : "Removed from My List.");
  };

  return (
    <div className="relative z-20 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      {playable && targetEpisode ? (
        <Link
          href={`/anime/${series.anilistId}/watch?episode=${targetEpisode}`}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-black transition hover:brightness-95 active:scale-[0.98]"
        >
          <Play className="size-4 fill-current" />
          {resumableEpisode ? "Resume episode" : "Start episode 1"}
        </Link>
      ) : (
        <span className="inline-flex items-center justify-center gap-2 rounded-full border border-white/12 bg-black/30 px-6 py-3.5 text-sm font-semibold text-[var(--muted)]">
          <TriangleAlert className="size-4" />
          Ani.pm has not listed a streamable episode
        </span>
      )}

      <button
        type="button"
        onClick={() => void toggleWatchlist()}
        className="liquid-glass-soft inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white transition hover:border-white/15 active:scale-[0.98]"
      >
        {isSaved ? <BookmarkCheck className="size-4 text-[var(--accent)]" /> : <Bookmark className="size-4" />}
        {isSaved ? "In My List" : "Add to My List"}
      </button>
    </div>
  );
}
