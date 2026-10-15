"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Star } from "lucide-react";

import { AnimeCard } from "@/components/anime/AnimeCard";
import { AnimeTitleActions } from "@/components/anime/AnimeTitleActions";
import { EmptyState } from "@/components/feedback/EmptyState";
import { FeatureGate } from "@/components/feedback/FeatureGate";
import { LoadingState } from "@/components/feedback/LoadingState";
import { cn } from "@/lib/cn";
import { getClientAnimeSeries, getClientAnimeStatus, getClientAnimeTop } from "@/lib/anime/client";
import { normalizeAnimeId } from "@/lib/anime/embed";
import type { AnimeLanguage } from "@/types/anime";

export default function AnimeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const rawId = params?.id ?? "";
  const animeId = useMemo(() => normalizeAnimeId(rawId), [rawId]);
  const [language, setLanguage] = useState<AnimeLanguage>("sub");

  const statusQuery = useQuery({
    queryKey: ["anime", "status"],
    queryFn: () => getClientAnimeStatus(),
    staleTime: Infinity,
  });

  const seriesQuery = useQuery({
    queryKey: ["anime", "series", animeId],
    enabled: Boolean(animeId),
    staleTime: 1000 * 60 * 60,
    queryFn: ({ signal }) => getClientAnimeSeries(animeId!, signal),
  });

  const series = seriesQuery.data ?? null;

  // Related titles: real catalogue rows sharing a genre with this title,
  // loaded from the same provider. Nothing invented; hidden when data is thin.
  const relatedQuery = useQuery({
    queryKey: ["anime", "related", series?.anilistId ?? null],
    enabled: (series?.genres.length ?? 0) > 0,
    staleTime: 1000 * 60 * 30,
    queryFn: ({ signal }) => getClientAnimeTop({ range: "all", genre: series?.genres[0], limit: 24 }, signal),
  });

  const relatedTitles = useMemo(
    () =>
      (relatedQuery.data ?? [])
        .filter((title) => title.anilistId !== series?.anilistId && title.genres.some((genreName) => series?.genres.includes(genreName)))
        .slice(0, 12),
    [relatedQuery.data, series?.anilistId, series?.genres],
  );
  const playableEpisodes = (series?.episodes ?? []).filter((episode) => episode.available.sub || episode.available.dub);
  const alternativeLanguage: AnimeLanguage = language === "sub" ? "dub" : "sub";
  const alternativeCount = playableEpisodes.filter((episode) =>
    alternativeLanguage === "dub" ? episode.available.dub : episode.available.sub,
  ).length;

  const openEpisode = (episodeNumber: number) => {
    router.push(`/anime/${animeId}/watch?episode=${episodeNumber}&lang=${language}`);
  };

  if (!animeId) {
    return (
      <FeatureGate feature="anime">
        <section className="page-shell py-16">
          <EmptyState
            title="Unknown anime id"
            description="Anime routes use AniList ids from Ani.pm, for example /anime/154587. That id was not valid."
          />
        </section>
      </FeatureGate>
    );
  }

  return (
    <FeatureGate feature="anime">
      <section className="pb-16 pt-6">
        {seriesQuery.isPending ? (
          <div className="page-shell py-10">
            <LoadingState title="Loading anime" description="Reading the title from the Ani.pm catalogue." />
          </div>
        ) : seriesQuery.isError ? (
          <div className="page-shell py-10">
            <EmptyState
              title="Anime catalogue unavailable"
              description={
                seriesQuery.error instanceof Error
                  ? seriesQuery.error.message
                  : "Ani.pm could not be reached from this network."
              }
            />
          </div>
        ) : !series ? (
          <div className="page-shell py-10">
            <EmptyState
              title="Title not found on Ani.pm"
              description="Ani.pm does not list this title, so GrubX cannot show metadata or episodes for it."
            />
          </div>
        ) : (
          <>
            <div className="relative">
              <div className="absolute inset-0 h-[46vh] min-h-[280px] overflow-hidden md:h-[54vh]">
                {series.bannerUrl ?? series.posterUrl ? (
                  <Image
                    src={(series.bannerUrl ?? series.posterUrl)!}
                    alt=""
                    fill
                    priority
                    unoptimized
                    sizes="100vw"
                    className="object-cover"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface)] via-black/72 to-black/48" />
              </div>

              <div className="page-shell relative space-y-8 pt-[150px] md:pt-[190px]">
                <div className="grid gap-7 lg:grid-cols-[240px,minmax(0,1fr)] lg:items-end">
                  <div className="relative mx-auto hidden aspect-[2/3] w-[240px] overflow-hidden rounded-[1.1rem] border border-white/10 bg-black lg:block">
                    {series.posterUrl ? (
                      <Image src={series.posterUrl} alt={series.title} fill unoptimized sizes="240px" className="object-cover" />
                    ) : null}
                  </div>

                  <div className="min-w-0 space-y-5">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full border border-white/12 bg-black/40 px-3 py-1.5 uppercase tracking-[0.22em] text-white/84">
                          Anime
                        </span>
                        {series.format ? (
                          <span className="rounded-full border border-white/12 bg-black/40 px-3 py-1.5 text-[var(--muted)]">
                            {series.format}
                          </span>
                        ) : null}
                        {series.year ? (
                          <span className="rounded-full border border-white/12 bg-black/40 px-3 py-1.5 text-[var(--muted)]">
                            {Math.trunc(series.year)}
                          </span>
                        ) : null}
                        {series.status ? (
                          <span className="rounded-full border border-white/12 bg-black/40 px-3 py-1.5 text-[var(--muted)]">
                            {series.status}
                          </span>
                        ) : null}
                        {series.score ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/40 px-3 py-1.5 text-[var(--muted)]">
                            <Star className="size-3.5 fill-[var(--accent)] text-[var(--accent)]" />
                            {series.score.toFixed(1)}
                          </span>
                        ) : null}
                      </div>

                      <h1 className="text-4xl font-bold leading-tight md:text-6xl">{series.title}</h1>
                      {series.nativeTitle ? (
                        <p className="text-sm text-[var(--muted)]">{series.nativeTitle}</p>
                      ) : null}
                    </div>

                    <AnimeTitleActions series={series} />

                    <div className="flex flex-wrap gap-2 text-xs">
                      {series.genres.map((genreName) => (
                        <span key={genreName} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[var(--muted)]">
                          {genreName}
                        </span>
                      ))}
                      {series.studios.map((studio) => (
                        <span key={studio} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[var(--muted)]">
                          {studio}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {series.synopsis ? (
                  <p className="max-w-4xl text-base leading-8 text-[var(--muted)]">{series.synopsis}</p>
                ) : null}

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="liquid-glass-soft rounded-2xl px-5 py-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Episodes on Ani.pm</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{playableEpisodes.length}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {series.episodeCounts.total > 0 ? `${series.episodeCounts.total} reported in total` : "Total not reported"}
                    </p>
                  </div>
                  <div className="liquid-glass-soft rounded-2xl px-5 py-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">SUB / DUB</p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {series.episodeCounts.sub} / {series.episodeCounts.dub}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">Counted from per-episode availability</p>
                  </div>
                  <div className="liquid-glass-soft rounded-2xl px-5 py-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Episode length</p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {series.durationMinutes ? `${Math.round(series.durationMinutes)} min` : "—"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">Reported by the catalogue</p>
                  </div>
                </div>

                {series.episodes.length === 0 ? (
                  <EmptyState
                    title="No episode list"
                    description="Ani.pm returned this title without an episode list, so no episodes are shown rather than guessed."
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-2xl font-bold md:text-3xl">Episodes</h2>
                      <div className="flex items-center gap-2">
                        {(["sub", "dub"] as AnimeLanguage[]).map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setLanguage(option)}
                            className={cn(
                              "rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition",
                              language === option
                                ? "border-white/18 bg-white text-black"
                                : "border-white/10 bg-white/6 text-[var(--muted)] hover:text-white",
                            )}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>

                    <p className="text-xs text-[var(--muted)]">
                      {language === "dub"
                        ? `${series.episodeCounts.dub} episode${series.episodeCounts.dub === 1 ? "" : "s"} with English audio`
                        : `${series.episodeCounts.sub} episode${series.episodeCounts.sub === 1 ? "" : "s"} with subtitles`}
                      {alternativeCount > 0
                        ? ` · ${alternativeCount} also available in ${alternativeLanguage.toUpperCase()}`
                        : ` · no ${alternativeLanguage.toUpperCase()} versions listed`}
                    </p>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      {series.episodes.map((entry) => {
                        const playableInLanguage =
                          language === "dub" ? entry.available.dub : entry.available.sub;
                        const playableInAny = entry.available.sub || entry.available.dub;
                        return (
                          <button
                            key={entry.number}
                            type="button"
                            disabled={!playableInAny}
                            onClick={() => openEpisode(entry.number)}
                            className={cn(
                              "group flex items-center gap-3 rounded-2xl border p-2.5 text-left transition",
                              playableInAny ? "border-white/8 hover:border-white/18" : "cursor-not-allowed border-white/6 opacity-45",
                            )}
                          >
                            <span className="relative h-14 w-24 shrink-0 overflow-hidden rounded-xl bg-black">
                              {entry.thumbnail ? (
                                <Image src={entry.thumbnail} alt="" fill unoptimized sizes="96px" className="object-cover" />
                              ) : null}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-white">Episode {entry.number}</span>
                              <span className="block truncate text-xs text-[var(--muted)]">
                                {entry.title ?? (entry.aired ? new Date(entry.aired).toLocaleDateString() : "No title listed")}
                              </span>
                              <span className="mt-1 block text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                                {entry.available.sub ? "SUB" : ""}
                                {entry.available.sub && entry.available.dub ? " · " : ""}
                                {entry.available.dub ? "DUB" : ""}
                                {!playableInAny ? "Not listed" : playableInLanguage ? "" : ` · ${language.toUpperCase()} missing`}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {relatedTitles.length > 0 ? (
                  <div className="space-y-4">
                    <h2 className="text-2xl font-bold md:text-3xl">Related in {series.genres[0]}</h2>
                    <p className="text-xs text-[var(--muted)]">
                      Real catalogue rows that share the {series.genres[0]} genre. Populated from the same Ani.pm data as
                      this page — never a generated suggestion.
                    </p>
                    <div className="grid grid-cols-2 gap-[var(--card-gap)] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                      {relatedTitles.map((title) => (
                        <AnimeCard key={title.anilistId} anime={title} compact />
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--muted)]">
                  {series.siteUrl ? (
                    <a
                      href={series.siteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 hover:text-white"
                    >
                      <ExternalLink className="size-3.5" />
                      View on {statusQuery.data?.label ?? "Ani.pm"}
                    </a>
                  ) : null}
                  <span>
                    AniList {series.anilistId}
                    {series.malId ? ` · MyAnimeList ${series.malId}` : ""} — these ids are not interchangeable with TMDB
                    ids.
                  </span>
                </div>

                {statusQuery.data ? (
                  <p className="text-xs leading-6 text-[var(--muted)]">
                    Catalogue and playback by {statusQuery.data.label}. {statusQuery.data.notes}{" "}
                    <Link href="/anime" className="underline underline-offset-4 hover:text-white">
                      Browse more anime
                    </Link>
                  </p>
                ) : null}
              </div>
            </div>
          </>
        )}
      </section>
    </FeatureGate>
  );
}
