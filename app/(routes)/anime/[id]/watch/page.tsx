"use client";

import { Suspense, useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { AnimeWatch } from "@/components/anime/AnimeWatch";
import { EmptyState } from "@/components/feedback/EmptyState";
import { FeatureGate } from "@/components/feedback/FeatureGate";
import { LoadingState } from "@/components/feedback/LoadingState";
import { getClientAnimeSeries } from "@/lib/anime/client";
import { normalizeAnimeId, normalizeAnimeLanguage, normalizeEpisodeNumber } from "@/lib/anime/embed";
import type { AnimeLanguage } from "@/types/anime";

function AnimeWatchRoute() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const animeId = useMemo(() => normalizeAnimeId(params?.id ?? ""), [params?.id]);
  const episodeNumber = normalizeEpisodeNumber(searchParams.get("episode")) ?? 1;
  const language: AnimeLanguage = normalizeAnimeLanguage(searchParams.get("lang"));

  const seriesQuery = useQuery({
    queryKey: ["anime", "series", animeId],
    enabled: Boolean(animeId),
    staleTime: 1000 * 60 * 60,
    queryFn: ({ signal }) => getClientAnimeSeries(animeId!, signal),
  });

  const selectEpisode = useCallback(
    (episode: number, nextLanguage: AnimeLanguage) => {
      if (!animeId) {
        return;
      }
      router.replace(`/anime/${animeId}/watch?episode=${episode}&lang=${nextLanguage}`);
    },
    [animeId, router],
  );

  if (!animeId) {
    return (
      <div className="page-shell py-16">
        <EmptyState title="Unknown anime id" description="This watch route needs a valid AniList or MyAnimeList id." />
      </div>
    );
  }

  if (seriesQuery.isPending) {
    return (
      <div className="page-shell py-16">
        <LoadingState title="Preparing playback" description="Reading episodes from the Ani.pm catalogue." />
      </div>
    );
  }

  if (seriesQuery.isError || !seriesQuery.data) {
    return (
      <div className="page-shell py-16">
        <EmptyState
          title="Playback unavailable"
          description={
            seriesQuery.error instanceof Error
              ? seriesQuery.error.message
              : "Ani.pm did not return this title, so there is nothing to play."
          }
        />
      </div>
    );
  }

  return (
    <section className="page-shell space-y-6 py-6 md:py-9">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--accent)]">Now playing</p>
        <h1 className="text-3xl font-bold md:text-4xl">{seriesQuery.data.title}</h1>
        <p className="text-sm text-[var(--muted)]">
          Episode {episodeNumber} · {language.toUpperCase()} · streamed by Ani.pm
        </p>
      </div>

      <AnimeWatch
        series={seriesQuery.data}
        episodeNumber={episodeNumber}
        language={language}
        onSelectEpisode={selectEpisode}
      />
    </section>
  );
}

export default function AnimeWatchPage() {
  return (
    <FeatureGate feature="anime">
      {/* useSearchParams needs a Suspense boundary for the static shell. */}
      <Suspense
        fallback={
          <div className="page-shell py-16">
            <LoadingState title="Preparing playback" description="Contacting the Ani.pm catalogue." />
          </div>
        }
      >
        <AnimeWatchRoute />
      </Suspense>
    </FeatureGate>
  );
}
