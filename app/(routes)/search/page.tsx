"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Filter, LoaderCircle, Search, Star, Trash2, X } from "lucide-react";

import { EmptyState } from "@/components/feedback/EmptyState";
import { FeatureGate } from "@/components/feedback/FeatureGate";
import { useSettingsContext } from "@/context/SettingsContext";
import { cn } from "@/lib/cn";
import { dataLayer } from "@/lib/dataLayer";
import {
  EMPTY_SEARCH_FILTERS,
  GROUP_LABELS,
  applySearchFilters,
  clearSearchHistory,
  dedupeResults,
  filtersActive,
  groupResults,
  matchLiveChannels,
  pushSearchHistory,
  readHistoryEnabled,
  readSearchHistory,
  slideWindow,
  tmdbToResult,
  writeHistoryEnabled,
  writeSearchHistory,
  type SearchFilters,
  type UnifiedResult,
} from "@/lib/discovery";
import { queryKeys } from "@/lib/queryKeys";
import { trackSearchQuery } from "@/lib/recommendationEngine";
import { getClientAnimeSearch } from "@/lib/anime/client";
import { getClientMangaList } from "@/lib/manga/client";
import { getClientMediaPage } from "@/lib/tmdb/client";
import type { EpgChannel } from "@/types/live";

const kindOptions: Array<{ value: SearchFilters["kind"]; label: string }> = [
  { value: "all", label: "All" },
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV" },
  { value: "anime", label: "Anime" },
  { value: "manga", label: "Manga" },
  { value: "live", label: "Live" },
];

const readUrlQuery = () => {
  if (typeof window === "undefined") {
    return "";
  }
  return new URLSearchParams(window.location.search).get("q")?.trim() ?? "";
};

function ResultCard({ result }: { result: UnifiedResult }) {
  return (
    <article className="group relative flex h-full w-full flex-col transition-transform duration-300 hover:-translate-y-1 active:scale-[0.985]">
      <a
        href={result.route}
        className={cn(
          "relative flex h-full flex-col overflow-hidden rounded-[var(--card-radius)] border border-white/8 bg-white/[var(--panel-opacity,0.035)] p-3",
        )}
      >
        <div className="relative block aspect-[2/3] w-full overflow-hidden rounded-[var(--poster-radius)] border border-white/8 bg-black">
          {result.posterUrl ? (
            // Provider-hosted artwork (absolute URLs from TMDB/Ani.pm/MangaDex).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={result.posterUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.045]"
            />
          ) : (
            <span className="grid h-full place-items-center text-xs text-[var(--muted)]">
              {result.kind === "live" ? "Live event" : "No artwork reported"}
            </span>
          )}
          <span className="absolute inset-x-3 top-3 rounded-full border border-white/10 bg-black/58 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-white/82 backdrop-blur-md">
            {result.kind}
          </span>
        </div>

        <h3 className="line-clamp-2 text-base font-semibold leading-tight text-white pt-3">{result.title}</h3>
        <p className="mt-1.5 text-xs text-[var(--muted)]">
          {[result.detail, result.year ? String(result.year) : null].filter(Boolean).join(" · ") || result.provider}
        </p>
        <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">via {result.provider}</p>
      </a>
    </article>
  );
}

const SUGGESTIONS = ["Dune", "Breaking Bad", "Solo Leveling", "Chainsaw Man", "NBA", "One Piece"];

export default function SearchPage() {
  const { settings } = useSettingsContext();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_SEARCH_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyEnabled, setHistoryEnabled] = useState(false);
  const [slide, setSlide] = useState(0);
  const SLIDE_SIZE = 12;

  useEffect(() => {
    const urlQuery = readUrlQuery();
    setQuery(urlQuery);
    setDebouncedQuery(urlQuery);
  }, []);

  useEffect(() => {
    setHistory(readSearchHistory());
    setHistoryEnabled(readHistoryEnabled());
    const onCustom = () => {
      setHistory(readSearchHistory());
      setHistoryEnabled(readHistoryEnabled());
    };
    window.addEventListener("grubx:storage", onCustom);
    return () => window.removeEventListener("grubx:storage", onCustom);
  }, []);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    const focus = () => window.requestAnimationFrame(() => input.focus());
    if (new URLSearchParams(window.location.search).get("focus") === "1" && settings.autoFocusSearch) {
      focus();
    }
    const onEvent = () => focus();
    window.addEventListener("grubx:focus-search", onEvent);
    return () => window.removeEventListener("grubx:focus-search", onEvent);
  }, [settings.autoFocusSearch]);

  // Debounce with cancellation: only the newest value lands.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = query.trim();
      setDebouncedQuery(next);
      if (settings.rememberSearchFilters) {
        void dataLayer.saveSearchPreferences({ lastQuery: next });
      }
      if (historyEnabled && next.length > 1) {
        const nextHistory = pushSearchHistory(history, next);
        if (nextHistory !== history) {
          setHistory(nextHistory);
          writeSearchHistory(nextHistory);
        }
      }
    }, 280);
    return () => window.clearTimeout(timer);
    // history depends on itself; only query/hist-enabled changes retrigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, settings.rememberSearchFilters, historyEnabled]);

  useEffect(() => {
    if (debouncedQuery.length > 1 && settings.trackingEnabled && settings.recommendationsEnabled) {
      trackSearchQuery(debouncedQuery);
    }
  }, [debouncedQuery, settings.trackingEnabled, settings.recommendationsEnabled]);

  useEffect(() => setSlide(0), [debouncedQuery, filters.kind, filters.yearFrom, filters.yearTo, filters.genre]);

  const enabled = debouncedQuery.length > 1;

  ///live guide channels for live matching (cheap; revalidates with the guide).
  const guideQuery = useQuery({
    queryKey: ["live", "epg"],
    enabled: enabled && filters.kind !== "manga" && filters.kind !== "anime" && settings.featureToggles.live,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/live/epg", { credentials: "same-origin", signal });
      if (!response.ok) {
        return { channels: [] as EpgChannel[] };
      }
      return (await response.json()) as { channels: EpgChannel[] };
    },
  });

  const tmdbQuery = useQuery({
    queryKey: queryKeys.search("tmdb", debouncedQuery),
    enabled: enabled && (filters.kind === "all" || filters.kind === "movie" || filters.kind === "tv"),
    staleTime: 1000 * 60 * 5,
    queryFn: async ({ signal }) => {
      const [moviePage, tvPage] = await Promise.all([
        getClientMediaPage({ mediaType: "movie", query: debouncedQuery, signal }),
        getClientMediaPage({ mediaType: "tv", query: debouncedQuery, signal }),
      ]);
      return [...moviePage.results, ...tvPage.results].map(tmdbToResult);
    },
  });

  const animeQuery = useQuery({
    queryKey: ["anime", "search", debouncedQuery],
    enabled: enabled && (filters.kind === "all" || filters.kind === "anime"),
    staleTime: 1000 * 60 * 5,
    queryFn: ({ signal }) => getClientAnimeSearch({ query: debouncedQuery, limit: 24 }, signal),
  });

  const mangaQuery = useQuery({
    queryKey: ["manga", "search", debouncedQuery],
    enabled: enabled && (filters.kind === "all" || filters.kind === "manga"),
    staleTime: 1000 * 60 * 5,
    queryFn: ({ signal }) => getClientMangaList({ kind: "search", query: debouncedQuery, limit: 24 }, signal),
  });

  const unified = useMemo<UnifiedResult[]>(() => {
    const collected: UnifiedResult[] = [
      ...(tmdbQuery.data ?? []),
      ...(animeQuery.data?.items ?? []).map((anime) => ({
        id: `anime:${anime.anilistId}`,
        kind: "anime" as const,
        title: anime.title,
        detail: anime.format ?? null,
        year: anime.year ? Math.trunc(anime.year) : null,
        posterUrl: anime.posterUrl,
        route: `/anime/${anime.anilistId}`,
        provider: "Ani.pm" as const,
        genres: anime.genres,
      })),
      ...(mangaQuery.data?.items ?? []).map((manga) => ({
        id: `manga:${manga.id}`,
        kind: "manga" as const,
        title: manga.title,
        detail: manga.status ? `Manga · ${manga.status}` : "Manga",
        year: manga.year ?? null,
        posterUrl: manga.coverUrl,
        route: `/manga/${manga.id}`,
        provider: "MangaDex" as const,
        genres: manga.tags.map((tag) => tag.name),
      })),
      ...(filters.kind === "all" || (filters.kind as string) === "live" ? matchLiveChannels(guideQuery.data?.channels ?? [], debouncedQuery) : []),
    ];
    return dedupeResults(collected);
  }, [tmdbQuery.data, animeQuery.data, mangaQuery.data, guideQuery.data?.channels, debouncedQuery, filters.kind]);

  const filtered = useMemo(() => applySearchFilters(unified, filters), [unified, filters]);
  const grouped = useMemo(() => groupResults(filtered), [filtered]);
  const visible = useMemo(() => slideWindow(filtered, slide, SLIDE_SIZE), [filtered, slide]);
  const anyLoading = tmdbQuery.isFetching || animeQuery.isFetching || mangaQuery.isFetching || guideQuery.isFetching;
  const anyError = Boolean(
    (tmdbQuery.isError && (filters.kind === "all" || filters.kind === "movie" || filters.kind === "tv")) ||
      (animeQuery.isError && (filters.kind === "all" || filters.kind === "anime")) ||
      (mangaQuery.isError && (filters.kind === "all" || filters.kind === "manga")),
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    clearSearchHistory();
  }, []);

  return (
    <FeatureGate feature="search">
      <section className="page-shell space-y-7 py-8 md:space-y-9 md:py-12">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[var(--accent)]">Search</p>
          <h1 className="mt-4 text-5xl font-bold leading-none md:text-6xl">Find your next favorite story</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-7 text-[var(--muted)]">
            Across movies and TV (TMDB), anime (Ani.pm), manga (MangaDex), and live sports — identity, availability,
            and provenance always come from the source that owns the title.
          </p>

          <div className="mt-7 flex flex-col gap-4">
            <div className="liquid-glass-soft flex items-center gap-3 rounded-full px-5 py-4">
              <Search className="size-4 text-[var(--muted)]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search movies, TV, anime, manga, or live sports"
                aria-label="Search across all catalogs"
                className="w-full bg-transparent text-base text-white outline-none placeholder:text-[var(--muted)]"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="rounded-full border border-white/10 bg-black/25 p-2 text-[var(--muted)] hover:text-white"
                >
                  <X className="size-4" />
                </button>
              ) : null}
              {anyLoading ? <LoaderCircle className="size-4 animate-spin text-[var(--accent)]" /> : null}
            </div>

            <div className="flex items-center justify-center gap-3">
              <div className="scrollbar-hidden flex gap-3 overflow-x-auto pb-2">
                {kindOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={filters.kind === option.value}
                    onClick={() => setFilters((current) => ({ ...current, kind: option.value }))}
                    className={cn(
                      "shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold transition",
                      filters.kind === option.value
                        ? "border-white/18 bg-white text-black"
                        : "border-white/10 bg-white/6 text-[var(--muted)] hover:border-white/20 hover:text-white",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowFilters((value) => !value)}
                aria-expanded={showFilters}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition",
                  filtersActive(filters) || showFilters
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-white"
                    : "border-white/10 bg-white/6 text-[var(--muted)] hover:text-white",
                )}
              >
                <Filter className="size-4" />
                Filters
              </button>
            </div>

            {showFilters ? (
              <div className="liquid-glass-soft mx-auto grid max-w-2xl gap-4 rounded-[1.3rem] p-5 text-left sm:grid-cols-3">
                <label className="text-sm">
                  <span className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Year from</span>
                  <input
                    type="number"
                    min={1900}
                    max={2100}
                    value={filters.yearFrom ?? ""}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        yearFrom: event.target.value ? Number.parseInt(event.target.value, 10) || null : null,
                      }))
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-white outline-none"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Year to</span>
                  <input
                    type="number"
                    min={1900}
                    max={2100}
                    value={filters.yearTo ?? ""}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        yearTo: event.target.value ? Number.parseInt(event.target.value, 10) || null : null,
                      }))
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-white outline-none"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Genre contains</span>
                  <input
                    value={filters.genre ?? ""}
                    onChange={(event) => setFilters((current) => ({ ...current, genre: event.target.value || null }))}
                    placeholder="e.g. Action"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-white outline-none"
                  />
                </label>
                {filtersActive(filters) ? (
                  <button
                    type="button"
                    onClick={() => setFilters((current) => ({ ...current, yearFrom: null, yearTo: null, genre: null }))}
                    className="justify-self-start rounded-full border border-white/10 bg-black/25 px-4 py-2 text-xs font-semibold text-[var(--muted)] transition hover:text-white sm:col-span-3"
                  >
                    Reset year and genre filters
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {historyEnabled && history.length > 0 && debouncedQuery.length <= 1 ? (
          <div className="mx-auto max-w-4xl">
            <div className="liquid-glass-soft flex flex-wrap items-center gap-2 rounded-[1.2rem] p-4">
              <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                <Clock className="size-4" />
                Recent searches
              </span>
              {history.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setQuery(entry)}
                  className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs text-[var(--muted)] transition hover:text-white"
                >
                  {entry}
                </button>
              ))}
              <button
                type="button"
                onClick={clearHistory}
                className="ml-auto inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-[var(--muted)] transition hover:text-white"
                aria-label="Clear search history"
              >
                <Trash2 className="size-3.5" />
                Clear
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-[var(--muted)]">
              History is off by default and stored only on this device.{" "}
              <button type="button" onClick={() => writeHistoryEnabled(false)} className="underline underline-offset-4 hover:text-white">
                Turn it off
              </button>
            </p>
          </div>
        ) : debouncedQuery.length <= 1 ? (
          <>
            <div className="mx-auto max-w-4xl">
              <div className="liquid-glass-soft flex flex-wrap items-center justify-center gap-2 rounded-[1.2rem] p-4">
                <Star className="size-4 text-[var(--accent)]" />
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setQuery(suggestion)}
                    className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs text-[var(--muted)] transition hover:text-white"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
            {!historyEnabled ? (
              <p className="text-center text-xs text-[var(--muted)]">
                <button
                  type="button"
                  onClick={() => {
                    setHistoryEnabled(true);
                    writeHistoryEnabled(true);
                  }}
                  className="underline underline-offset-4 hover:text-white"
                >
                  Turn on private, on-device search history
                </button>
              </p>
            ) : null}
          </>
        ) : null}

        {enabled && anyLoading && filtered.length === 0 ? (
          <div className="grid grid-cols-2 gap-[var(--card-gap)] sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-[360px] animate-pulse rounded-[1rem] border border-white/8 bg-white/[0.04]" />
            ))}
          </div>
        ) : enabled && anyError && filtered.length === 0 ? (
          <EmptyState
            title="Some catalogs are unreachable"
            description="One or more providers could not be reached from this network. Visible results below come from providers that answered; nothing is invented to fill the gaps."
          />
        ) : filtered.length === 0 && enabled && !anyLoading ? (
          <EmptyState
            title="No results found"
            description={
              filtersActive(filters)
                ? "Nothing matches these filters. Reset year or genre, or try a broader query."
                : "Try a shorter query. Movies/TV come from TMDB, anime from Ani.pm, manga from MangaDex, and live sports from the schedule."
            }
          />
        ) : filtered.length > 0 ? (
          <div className="space-y-10">
            {grouped.map(([kind, items]) => (
              <div key={kind} className="space-y-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-2xl font-bold">{GROUP_LABELS[kind]}</h2>
                  <p className="text-xs text-[var(--muted)]">
                    {items.length} result{items.length === 1 ? "" : "s"} · from the{" "}
                    {[...new Set(items.map((item) => item.provider))].join(", ")} catalog
                  </p>
                </div>
                <div
                  className="grid grid-cols-2 gap-[var(--card-gap)] sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6"
                  role="list"
                >
                  {items.map((item) => (
                    <ResultCard key={item.id} result={item} />
                  ))}
                </div>
              </div>
            ))}

            {filtered.length > SLIDE_SIZE ? (
              <div className="flex items-center justify-center gap-3" data-tv-paging>
                <button
                  type="button"
                  onClick={() => setSlide((current) => Math.max(0, current - SLIDE_SIZE))}
                  disabled={slide === 0}
                  className="rounded-full border border-white/12 bg-black/30 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-white/25 disabled:opacity-40"
                  aria-label="Previous results page"
                >
                  Prev
                </button>
                <span className="text-sm text-[var(--muted)]">
                  Showing {slide + 1}–{Math.min(filtered.length, slide + SLIDE_SIZE)} of {filtered.length}
                </span>
                <button
                  type="button"
                  onClick={() => setSlide((current) => Math.min(filtered.length - 1, current + SLIDE_SIZE))}
                  disabled={slide + SLIDE_SIZE >= filtered.length}
                  className="rounded-full border border-white/12 bg-black/30 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-white/25 disabled:opacity-40"
                  aria-label="Next results page"
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </FeatureGate>
  );
}
