"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck, BookOpen, Play } from "lucide-react";
import { toast } from "sonner";

import { useSettingsContext } from "@/context/SettingsContext";
import { useWatchlistSubscription } from "@/hooks/useWatchlistSubscription";
import { dataLayer } from "@/lib/dataLayer";
import { queryKeys } from "@/lib/queryKeys";
import type { MangaSummary } from "@/types/manga";

export function MangaTitleActions({
  manga,
  firstChapter,
}: {
  manga: MangaSummary;
  firstChapter: { id: string; chapter: string | null } | null;
}) {
  const queryClient = useQueryClient();
  const { ready } = useSettingsContext();
  const watchlistQuery = useWatchlistSubscription();

  const progressQuery = useQuery({
    queryKey: queryKeys.progress(manga.id),
    queryFn: () => dataLayer.getPlaybackProgress(manga.id),
    enabled: ready,
    staleTime: 1000 * 30,
  });

  const isSaved = useMemo(
    () => (watchlistQuery.data ?? []).some((item) => item.mediaId === manga.id),
    [manga.id, watchlistQuery.data],
  );

  const progress = progressQuery.data;
  const canResume = Boolean(progress?.chapterId && (progress?.progress ?? 0) > 0);
  const readHref = canResume ? `/manga/${manga.id}/${progress!.chapterId}` : firstChapter ? `/manga/${manga.id}/${firstChapter.id}` : null;

  const toggleWatchlist = async () => {
    const result = await dataLayer.toggleWatchlist({
      mediaId: manga.id,
      mediaType: "manga",
      title: manga.title,
      posterPath: manga.coverUrl,
      backdropPath: null,
      rating: null,
    });
    queryClient.setQueryData(queryKeys.watchlist, result.items ?? []);
    toast.success(result.saved ? "Added to My List." : "Removed from My List.");
  };

  return (
    <div className="relative z-20 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      {readHref ? (
        <Link
          href={readHref}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-black transition hover:brightness-95 active:scale-[0.98]"
        >
          <Play className="size-4 fill-current" />
          {canResume ? "Continue Reading" : "Read now"}
        </Link>
      ) : (
        <span className="inline-flex items-center justify-center gap-2 rounded-full border border-white/12 bg-black/30 px-6 py-3.5 text-sm font-semibold text-[var(--muted)]">
          <BookOpen className="size-4" />
          No readable chapters available
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
