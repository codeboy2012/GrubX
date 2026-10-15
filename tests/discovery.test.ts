import { describe, expect, it } from "vitest";

import {
  applySearchFilters,
  dedupeResults,
  EMPTY_SEARCH_FILTERS,
  filtersActive,
  groupResults,
  matchLiveChannels,
  pushSearchHistory,
  slideWindow,
  titlesMatch,
  tmdbToResult,
  type UnifiedResult,
} from "@/lib/discovery";
import type { EpgChannel } from "@/types/live";
import type { MediaItem, MediaType } from "@/types/media";

const tmdbItem = (overrides: Partial<MediaItem> & { id: string; mediaType: MediaType; title: string }): MediaItem => ({
  tmdbId: Number.parseInt(overrides.id, 10) || 1,
  overview: "",
  posterPath: null,
  backdropPath: null,
  releaseDate: null,
  rating: null,
  voteCount: null,
  genreIds: [],
  ...overrides,
});

const result = (overrides: Partial<UnifiedResult> & { id: string; title: string }): UnifiedResult => ({
  kind: "movie",
  detail: null,
  year: null,
  posterUrl: null,
  route: "/x",
  provider: "TMDB",
  genres: [],
  ...overrides,
  title: overrides.title ?? "Sample",
});

describe("title normalization and matching", () => {
  it("matches titles ignoring articles, punctuation, and diacritics", () => {
    expect(titlesMatch("The Office", "Office")).toBe(true);
    expect(titlesMatch("Amélie", "Amelie")).toBe(true);
    expect(titlesMatch("Spider-Man: No Way Home", "spider man no way home")).toBe(true);
  });

  it("does not merge different works with similar names", () => {
    expect(titlesMatch("Office Space", "The Office")).toBe(false);
    expect(titlesMatch("Dune", "Dune: Part Two")).toBe(false);
  });
});

describe("cross-source deduplication", () => {
  it("drops duplicate TMDB rows that describe the same title and year", () => {
    const a = tmdbToResult(tmdbItem({ id: "100", mediaType: "movie", title: "The Matrix", releaseDate: "1999-03-31" }));
    const b = tmdbToResult(tmdbItem({ id: "100-dup", mediaType: "movie", title: "Matrix, The", releaseDate: "1999-03-31" }));
    // tmdb ids differ, so only title/year matching should dedupe them.
    const deduped = dedupeResults([a, b]);
    expect(deduped).toHaveLength(1);
  });

  it("keeps an anime and a movie with the same name as separate works", () => {
    const anime = result({ id: "anime:21", kind: "anime", title: "Dune", provider: "Ani.pm" });
    const movie = result({ id: "movie:422", kind: "movie", title: "Dune" });
    expect(dedupeResults([anime, movie])).toHaveLength(2);
  });

  it("keeps two movies with the same title but different years", () => {
    const old = result({ id: "movie:1", title: "The Lion King", year: 1994 });
    const newer = result({ id: "movie:2", title: "The Lion King", year: 2019 });
    expect(dedupeResults([old, newer])).toHaveLength(2);
  });
});

describe("filters", () => {
  it("filters by kind, year range, and genre", () => {
    const items = [
      result({ id: "movie:1", kind: "movie", title: "Retro", year: 1999, genres: ["Action"] }),
      result({ id: "tv:1", kind: "tv", title: "Series", year: 2016, genres: ["Drama"] }),
      result({ id: "anime:1", kind: "anime", title: "Show", year: 2014, genres: ["Action"] }),
    ];

    expect(applySearchFilters(items, { ...EMPTY_SEARCH_FILTERS, kind: "anime" })).toHaveLength(1);
    expect(applySearchFilters(items, { ...EMPTY_SEARCH_FILTERS, yearFrom: 2000 })).toHaveLength(2);
    expect(applySearchFilters(items, { ...EMPTY_SEARCH_FILTERS, genre: "action" })).toHaveLength(2);
    expect(applySearchFilters(items, { ...EMPTY_SEARCH_FILTERS, yearFrom: 1990, yearTo: 1999 })).toHaveLength(1);
  });

  it("drops undated items when a year filter is active instead of guessing", () => {
    const items = [result({ id: "movie:1", title: "Undated", year: null })];
    expect(applySearchFilters(items, { ...EMPTY_SEARCH_FILTERS, yearFrom: 2000 })).toHaveLength(0);
  });

  it("reports whether any filter is active", () => {
    expect(filtersActive(EMPTY_SEARCH_FILTERS)).toBe(false);
    expect(filtersActive({ ...EMPTY_SEARCH_FILTERS, kind: "manga" })).toBe(true);
  });
});

describe("grouping", () => {
  it("groups into labeled sections and drops empty kinds", () => {
    const items = [
      result({ id: "movie:1", kind: "movie", title: "A Movie" }),
      result({ id: "anime:1", kind: "anime", title: "Anime One" }),
      result({ id: "anime:2", kind: "anime", title: "Anime Two" }),
    ];
    const groups = groupResults(items);
    expect(groups.map(([kind]) => kind)).toEqual(["movie", "anime"]);
    expect(groups[1][1]).toHaveLength(2);
  });
});

describe("search history privacy", () => {
  it("is a pure ring of trimmed, deduplicated entries", () => {
    let history = pushSearchHistory([], "one");
    expect(history).toEqual(["one"]);
    history = pushSearchHistory(history, "two");
    history = pushSearchHistory(history, "one");
    expect(history).toEqual(["one", "two"]);
    history = pushSearchHistory(history, "s");
    expect(history).toHaveLength(2);
    expect(pushSearchHistory(history, "  ")).toBe(history);
  });
});

describe("live channel matching", () => {
  const channels: EpgChannel[] = [
    {
      id: "epg-football",
      name: "Football",
      category: "football",
      logoUrl: null,
      currentIndex: -1,
      programs: [
        { id: "p1", startAt: Date.now() - 60_000, endAt: Date.now() + 60_000, title: "Lyon vs Crystal Palace" },
        { id: "p2", startAt: Date.now() + 3_600_000, endAt: Date.now() + 7_200_000, title: "Benfica vs Celtic" },
      ],
    },
  ];

  it("finds programs by partial title and channel name", () => {
    expect(matchLiveChannels(channels, "lyon").map((r) => r.id)).toEqual(["live:p1"]);
    expect(matchLiveChannels(channels, "football").length).toBeGreaterThan(0);
  });

  it("routes a live program to the player and an upcoming one to the guide", () => {
    const live = matchLiveChannels(channels, "lyon")[0];
    const upcoming = matchLiveChannels(channels, "benfica")[0];
    expect(live.route).toBe("/live");
    expect(upcoming.route).toBe("/live/guide");
  });

  it("ignores short queries", () => {
    expect(matchLiveChannels(channels, "l")).toHaveLength(0);
  });
});

describe("TV remote paging", () => {    const items = Array.from({ length: 25 }, (_, index) => result({ id: `r${index}`, title: `Result ${index}` }));

  it("slides in fixed-size windows", () => {
    expect(slideWindow(items, 0, 12)).toHaveLength(12);
    expect(slideWindow(items, 12, 12)).toHaveLength(12);
    expect(slideWindow(items, 24, 12)).toHaveLength(1);
  });

  it("clamps out-of-range starts", () => {
    expect(slideWindow(items, 999, 12)).toHaveLength(1);
    expect(slideWindow([], 0, 12)).toHaveLength(0);
  });
});
