import { describe, expect, it, beforeEach } from "vitest";

import type { FilterState } from "@/hooks/useFilters";
import {
  animeTitleToRecommendationItem,
  clearRecommendationState,
  getRecommendationState,
  getSimilarityScore,
  mangaSummaryToRecommendationItem,
  scoreRecommendationItem,
  trackNotInterested,
  trackViewedItem,
  type RecommendationItem,
} from "@/lib/recommendationEngine";
import type { AnimeTitle } from "@/types/anime";
import type { MangaSummary } from "@/types/manga";

const animeTitle = (overrides: Partial<AnimeTitle> & { anilistId: number }): AnimeTitle => ({
  malId: null,
  title: "Shock Anime",
  nativeTitle: null,
  format: "TV",
  status: null,
  year: 2024,
  season: null,
  score: 8,
  rating: null,
  durationMinutes: null,
  episodeCounts: { total: 0, sub: 0, dub: 0 },
  genres: ["Action", "Sci-Fi"],
  studios: [],
  adult: false,
  synopsis: "",
  posterUrl: null,
  bannerUrl: null,
  siteUrl: null,
  embedUrl: null,
  ...overrides,
});

const mangaSummary = (overrides: Partial<MangaSummary> & { id: string }): MangaSummary => ({
  title: "Shock Manga",
  description: "",
  coverUrl: null,
  status: "ongoing",
  year: 2021,
  contentRating: null,
  tags: [{ id: "t1", name: "Action" }],
  authorName: null,
  lastChapter: null,
  updatedAt: null,
  availableLanguages: ["en"],
  ...overrides,
});

const filters: FilterState = {
  genres: [],
  ratings: [],
  yearFrom: 1900,
  yearTo: 2100,
  sort: "popular",
  search: "",
} as unknown as FilterState;

// --- localStorage stub for the engine (happy-dom not configured here) ---
const storage = new Map<string, string>();
const windowStub = {
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
};

beforeEach(() => {
  storage.clear();
  // recommendationEngine reads globalThis window lazily in browser envs,
  // keep tests environment-independent by defining it.
  (globalThis as { window?: unknown }).window = windowStub;
});

describe("cross-catalog recommendation items", () => {
  it("namespaces anime ids so they can never collide with TMDB ids", () => {
    const item = animeTitleToRecommendationItem(animeTitle({ anilistId: 21 }));
    expect(item.id).toBe("anime:21");
    expect(item.mediaType).toBe("anime");
    expect(item.genres).toContain("Action");
  });

  it("namespaces manga ids by uuid", () => {
    const item = mangaSummaryToRecommendationItem(mangaSummary({ id: "abc-uuid" }));
    expect(item.id).toBe("manga:abc-uuid");
    expect(item.mediaType).toBe("manga");
  });
});

describe("dismissal and privacy", () => {
  it("hard-blocks an explicitly dismissed item from scoring positive", () => {
    const dismissed: RecommendationItem = animeTitleToRecommendationItem(animeTitle({ anilistId: 21 }));
    trackNotInterested(dismissed);

    // Store an empty view graph first (dismissal alone does not need views).
    const state = getRecommendationState();
    const score = scoreRecommendationItem(dismissed, filters, state);
    expect(score).toBeLessThanOrEqual(0);
  });

  it("clears the whole graph so rails return to cold-start", () => {
    trackViewedItem(animeTitleToRecommendationItem(animeTitle({ anilistId: 1 })));
    expect(getRecommendationState().viewedItems).toHaveLength(1);

    clearRecommendationState();
    expect(getRecommendationState().viewedItems).toHaveLength(0);
    expect(getRecommendationState().searchHistory).toHaveLength(0);
  });
});

describe("similarity", () => {
  it("scores shared genres and same media type higher across catalogs", () => {
    const base = animeTitleToRecommendationItem(animeTitle({ anilistId: 21, genres: ["Action", "Sci-Fi"], year: 2024 }));
    const similarAnime = animeTitleToRecommendationItem(animeTitle({ anilistId: 22, genres: ["Action", "Sci-Fi"], year: 2023 }));
    const differentManga = mangaSummaryToRecommendationItem(mangaSummary({ id: "x", tags: [{ id: "r", name: "Romance" }], year: 1990 }));

    expect(getSimilarityScore(similarAnime, base)).toBeGreaterThan(0);
    expect(getSimilarityScore(differentManga, base)).toBeLessThan(getSimilarityScore(similarAnime, base));
  });
});
