"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, LoaderCircle, Search, Sparkles, TrendingUp } from "lucide-react";

import { AnimeCard } from "@/components/anime/AnimeCard";
import { EmptyState } from "@/components/feedback/EmptyState";
import { FeatureGate } from "@/components/feedback/FeatureGate";
import { LoadingState } from "@/components/feedback/LoadingState";
import { useSettingsContext } from "@/context/SettingsContext";
import { cn } from "@/lib/cn";
import {
  getClientAnimeRecent,
  getClientAnimeSchedule,
  getClientAnimeSearch,
  getClientAnimeStatus,
  getClientAnimeTop,
} from "@/lib/anime/client";
import { buildAnimeSiteUrl } from "@/lib/anime/embed";
import type { AnimeScheduleEntry, AnimeTopRange } from "@/types/anime";

type TabId = "trending" | "top" | "recent" | "schedule" | "search";

const tabs: Array<{ id: TabId; label: string; description: string }> = [
  { id: "trending", label: "Trending", description: "What the Ani.pm catalogue is surfacing this week." },
  { id: "top", label: "Top rated", description: "The highest-scoring titles on Ani.pm across all time." },
  { id: "recent", label: "Recently updated", description: "Fresh episodes with confirmed SUB or DUB availability." },
  { id: "schedule", label: "Schedule", description: "Episodes airing now and next, exactly as Ani.pm reports them." },
  { id: "search", label: "Search", description: "Find a title by name across the Ani.pm catalogue." },
];

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const formatAiring = (value: string | null) => {
  if (!value) {
    return "Airing time not reported";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Airing time not reported";
  }
  return `${weekdays[date.getDay()]} · ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
};

export default function AnimePage() {
  const { settings } = useSettingsContext();
  const [tab, setTab] = useState<TabId>("trending");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState<string | null>(null);
  const [range, setRange] = useState<AnimeTopRange>("week");

  const statusQuery = useQuery({
    queryKey: ["anime", "status"],
    queryFn: () => getClientAnimeStatus(),
    staleTime: Infinity,
  });

  const trendingQuery = useQuery({
    queryKey: ["anime", "top", "week", genre],
    enabled: tab === "trending" || tab === "top",
    staleTime: 1000 * 60 * 30,
    queryFn: ({ signal }) =>
      getClientAnimeTop({ range: tab === "trending" ? range : "all", genre: tab === "trending" ? genre ?? undefined : undefined, limit: 30 }, signal),
  });

  const recentQuery = useQuery({
    queryKey: ["anime", "recent"],
    enabled: tab === "recent",
    staleTime: 1000 * 60 * 5,
    queryFn: ({ signal }) => getClientAnimeRecent({ limit: 30 }, signal),
  });

  const scheduleQuery = useQuery({
    queryKey: ["anime", "schedule"],
    enabled: tab === "schedule",
    staleTime: 1000 * 60 * 15,
    queryFn: ({ signal }) => getClientAnimeSchedule(signal),
  });

  const searchQuery = useQuery({
    queryKey: ["anime", "search", query],
    enabled: tab === "search" && query.length > 1,
    staleTime: 1000 * 60 * 5,
    queryFn: ({ signal }) => getClientAnimeSearch({ query, limit: 30 }, signal),
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(queryInput.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  /** Genres are derived from real catalogue results so no label is invented. */
  const genres = useMemo(() => {
    const counts = new Map<string, number>();
    (trendingQuery.data ?? []).forEach((title) => {
      title.genres.forEach((genreName) => counts.set(genreName, (counts.get(genreName) ?? 0) + 1));
    });
    return Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 12)
      .map(([name]) => name);
  }, [trendingQuery.data]);

  const scheduleByDay = useMemo(() => {
    const grouped = new Map<string, AnimeScheduleEntry[]>();
    (scheduleQuery.data ?? []).forEach((entry) => {
      if (!entry.airingAt) {
        return;
      }
      const date = new Date(entry.airingAt);
      if (Number.isNaN(date.getTime())) {
        return;
      }
      const key = date.toISOString().slice(0, 10);
      grouped.set(key, [...(grouped.get(key) ?? []), entry]);
    });

    return Array.from(grouped.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .slice(0, 10);
  }, [scheduleQuery.data]);

  const activeQuery =
    tab === "search"
      ? searchQuery
      : tab === "recent"
        ? recentQuery
        : tab === "schedule"
          ? scheduleQuery
          : trendingQuery;

  const activeTab = tabs.find((option) => option.id === tab) ?? tabs[0];

  return (
    <FeatureGate feature="anime">
      <section className="page-shell space-y-8 py-8 md:space-y-10 md:py-12">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[var(--accent)]">Anime</p>
          <h1 className="mt-4 text-5xl font-bold leading-none md:text-6xl">Anime, sourced from Ani.pm</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-7 text-[var(--muted)]">
            Ani.pm&rsquo;s public catalogue, its episode availability, and its player. Availability is exactly what the
            provider reports — never assumed, never invented.
          </p>
          <p className="mt-3 text-xs text-[var(--muted)]">{activeTab.description}</p>

          <div className="mt-7 flex flex-col gap-4">
            <div className="liquid-glass-soft flex items-center gap-3 rounded-full px-5 py-4">
              <Search className="size-4 text-[var(--muted)]" />
              <input
                value={queryInput}
                onChange={(event) => {
                  setQueryInput(event.target.value);
                  setTab("search");
                  setGenre(null);
                }}
                placeholder="Search anime by title"
                aria-label="Search anime by title"
                className="w-full bg-transparent text-base text-white outline-none placeholder:text-[var(--muted)]"
              />
              {searchQuery.isFetching ? <LoaderCircle className="size-4 animate-spin text-[var(--accent)]" /> : null}
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              {tabs.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={tab === option.id}
                  onClick={() => {
                    setTab(option.id);
                    if (option.id !== "trending") {
                      setGenre(null);
                    }
                  }}
                  className={cn(
                    "min-h-11 rounded-full border px-4 py-2.5 text-sm font-semibold transition",
                    tab === option.id
                      ? "border-white/18 bg-white text-black"
                      : "border-white/10 bg-white/6 text-[var(--muted)] hover:border-white/20 hover:text-white",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {tab === "trending" ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap justify-center gap-2">
                  {(["today", "week", "month", "all"] as AnimeTopRange[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setRange(option)}
                      className={cn(
                        "rounded-full border px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition",
                        range === option
                          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-white"
                          : "border-white/10 bg-white/5 text-[var(--muted)] hover:text-white",
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>

                {genres.length > 0 ? (
                  <div className="scrollbar-hidden flex gap-2 overflow-x-auto pb-2">
                    <button
                      type="button"
                      onClick={() => setGenre(null)}
                      className={cn(
                        "shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition",
                        genre === null
                          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-white"
                          : "border-white/10 bg-white/5 text-[var(--muted)] hover:text-white",
                      )}
                    >
                      All genres
                    </button>
                    {genres.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setGenre(name)}
                        className={cn(
                          "shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition",
                          genre === name
                            ? "border-[var(--accent)] bg-[var(--accent-soft)] text-white"
                            : "border-white/10 bg-white/5 text-[var(--muted)] hover:text-white",
                        )}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {tab === "search" ? (
          query.length <= 1 ? (
            <EmptyState title="Search anime" description="Type at least two characters to search the Ani.pm catalogue." />
          ) : searchQuery.isPending ? (
            <LoadingState title="Searching anime" description="Querying the Ani.pm catalogue." />
          ) : searchQuery.isError ? (
            <EmptyState
              title="Anime search unavailable"
              description={
                searchQuery.error instanceof Error
                  ? searchQuery.error.message
                  : "Ani.pm could not be reached from this network."
              }
            />
          ) : (searchQuery.data?.items.length ?? 0) === 0 ? (
            <EmptyState title="No anime found" description="Try another title." />
          ) : (
            <div className="grid grid-cols-2 gap-[var(--card-gap)] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {(searchQuery.data?.items ?? []).map((title) => (
                <AnimeCard key={title.anilistId} anime={title} />
              ))}
            </div>
          )
        ) : activeQuery.isPending ? (
          <LoadingState title="Loading anime" description="Contacting the Ani.pm catalogue." />
        ) : activeQuery.isError ? (
          <EmptyState
            title="The anime catalogue is unavailable"
            description={
              activeQuery.error instanceof Error
                ? activeQuery.error.message
                : "Ani.pm could not be reached from this network. Browsing continues to work for movies, TV, and manga."
            }
          />
        ) : tab === "schedule" ? (
          scheduleByDay.length === 0 ? (
            <EmptyState
              title="No schedule reported"
              description="Ani.pm has not published upcoming episodes for this window. Nothing is fabricated to fill the gap."
            />
          ) : (
            <div className="space-y-8">
              {scheduleByDay.map(([day, entries]) => (
                <div key={day} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="size-4 text-[var(--accent)]" />
                    <h2 className="text-lg font-semibold">
                      {new Date(`${day}T00:00:00`).toLocaleDateString([], {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}
                    </h2>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {entries.map((entry) => (
                      <article
                        key={`${entry.anilistId}-${entry.episode}-${entry.kind}`}
                        className="liquid-glass-soft flex items-center justify-between gap-4 rounded-2xl px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{entry.title}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            Episode {entry.episode} · {entry.kind.toUpperCase()} · {formatAiring(entry.airingAt)}
                            {entry.delayed ? " · delayed" : ""}
                            {entry.final ? " · finale" : ""}
                          </p>
                        </div>
                        {entry.onProvider ? (
                          <a
                            href={`/anime/${entry.anilistId}/watch?episode=${entry.episode}&lang=${entry.kind}`}
                            className="shrink-0 rounded-full bg-white px-4 py-2 text-xs font-bold text-black transition hover:brightness-95"
                          >
                            Watch
                          </a>
                        ) : (
                          <span className="shrink-0 rounded-full border border-white/10 px-3 py-2 text-xs text-[var(--muted)]">
                            Not on Ani.pm yet
                          </span>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : tab === "recent" ? (
          (recentQuery.data ?? []).length === 0 ? (
            <EmptyState
              title="No recent episodes"
              description="Ani.pm is not reporting newly added episodes right now."
            />
          ) : (
            <div className="grid grid-cols-2 gap-[var(--card-gap)] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {(recentQuery.data ?? []).map((entry) => (
                <AnimeCard
                  key={`${entry.anilistId}-${entry.episode}`}
                  anime={{
                    anilistId: entry.anilistId,
                    malId: null,
                    title: entry.title,
                    nativeTitle: null,
                    format: `Episode ${entry.episode}`,
                    status: null,
                    year: null,
                    season: null,
                    score: null,
                    rating: null,
                    durationMinutes: null,
                    episodeCounts: { total: entry.episode, sub: entry.available.sub ? entry.episode : 0, dub: entry.available.dub ? entry.episode : 0 },
                    genres: [],
                    studios: [],
                    adult: false,
                    synopsis: entry.episodeTitle ?? "",
                    posterUrl: entry.posterUrl,
                    bannerUrl: null,
                    siteUrl: buildAnimeSiteUrl(entry.anilistId),
                    embedUrl: entry.embedUrl,
                  }}
                />
              ))}
            </div>
          )
        ) : (
          (() => {
            const items = trendingQuery.data ?? [];
            if (items.length === 0) {
              return (
                <EmptyState
                  title="No titles in this view"
                  description="Ani.pm returned no titles for this range or genre."
                />
              );
            }

            return (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                  {tab === "trending" ? <TrendingUp className="size-4 text-[var(--accent)]" /> : <Sparkles className="size-4 text-[var(--accent)]" />}
                  <span>
                    {items.length} titles · range {tab === "trending" ? range : "all"}
                    {genre ? ` · ${genre}` : ""}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-[var(--card-gap)] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {items.map((title) => (
                    <AnimeCard key={title.anilistId} anime={title} />
                  ))}
                </div>
              </div>
            );
          })()
        )}

        {statusQuery.data ? (
          <p className="text-center text-xs leading-6 text-[var(--muted)]">
            Catalogue and playback by {statusQuery.data.label}. {statusQuery.data.notes}
          </p>
        ) : null}
      </section>
    </FeatureGate>
  );
}
