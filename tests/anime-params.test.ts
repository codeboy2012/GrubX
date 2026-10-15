import { describe, expect, it } from "vitest";

import {
  normalizeAnimeEpisodeList,
  normalizeAnimeRecentList,
  normalizeAnimeSchedule,
  normalizeAnimeSearchPage,
  normalizeAnimeSeries,
  normalizeAnimeTitleList,
} from "@/lib/anime/normalize";
import { MAX_LIMIT, validateAnimeRequest } from "@/lib/anime/params";

const parse = (query: string) => validateAnimeRequest(new URLSearchParams(query));

const validTitle = {
  anilistId: 154587,
  malId: 52991,
  title: "Frieren: Beyond Journey's End",
  nativeTitle: "葬送のフリーレン",
  format: "TV",
  status: "FINISHED",
  year: 2023,
  season: "FALL",
  score: 9.3,
  rating: "PG-13",
  durationMinutes: 24,
  episodes: { total: 28, sub: 28, dub: 12 },
  genres: ["Adventure", "Drama"],
  studios: ["Madhouse"],
  adult: false,
  synopsis: "An elf mage reflects on a lifetime.",
  poster: "https://ani.pm/api/anime/cover?anilistId=154587",
  banner: "https://ani.pm/banner.jpg",
  url: "https://ani.pm/ani/154587",
  embed: "https://ani.pm/embed/ani/154587/1/sub",
};

describe("anime request validation", () => {
  it("accepts search requests with defaults", () => {
    const result = parse("resource=search&query=dandadan");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.resource).toBe("search");
    expect(result.request.query).toBe("dandadan");
    expect(result.request.page).toBe(1);
    expect(result.request.limit).toBe(24);
  });

  it("rejects a too-short or oversized search query", () => {
    expect(parse("resource=search&query=a").ok).toBe(false);
    expect(parse(`resource=search&query=${"x".repeat(200)}`).ok).toBe(false);
    expect(parse("resource=search").ok).toBe(false);
  });

  it("rejects malformed ids on id-based resources", () => {
    expect(parse("resource=title").ok).toBe(false);
    expect(parse("resource=series&id=../1").ok).toBe(false);
    expect(parse("resource=episodes&id=abc").ok).toBe(false);
    expect(parse("resource=series&id=mal-52991").ok).toBe(true);
    expect(parse("resource=title&id=154587").ok).toBe(true);
  });

  it("clamps pagination into a safe window", () => {
    const result = parse(`resource=recent&page=9999&limit=9999`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.limit).toBe(MAX_LIMIT);
    expect(result.request.page).toBe(20);

    const lowPage = parse("resource=recent&page=-3");
    expect(lowPage.ok).toBe(true);
    if (lowPage.ok) {
      expect(lowPage.request.page).toBe(1);
    }
  });

  it("rejects unknown resources and unsafe genre payloads", () => {
    expect(parse("resource=secret").ok).toBe(false);
    const genre = parse("resource=top&genre=<script>alert(1)</script>");
    expect(genre.ok).toBe(true);
    if (!genre.ok) return;
    expect(genre.request.genre).toBeUndefined();
    expect(genre.request.range).toBe("week");
  });

  it("accepts only documented formats and ranges", () => {
    const result = parse("resource=top&format=movie&range=all");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.format).toBe("MOVIE");
    expect(result.request.range).toBe("all");
    expect(parse("resource=top&format=notreal").ok).toBe(true);
  });
});

describe("anime catalogue normalization", () => {
  it("parses a documented title payload and rebuilds a missing cover", () => {
    const page = normalizeAnimeSearchPage(
      { data: [{ ...validTitle, poster: undefined }], page: 2, limit: 24, total: 41, hasMore: true },
      { page: 1, limit: 12 },
    );

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.anilistId).toBe(154587);
    expect(page.items[0]?.malId).toBe(52991);
    expect(page.items[0]?.posterUrl).toContain("anilistId=154587");
    expect(page.items[0]?.episodeCounts).toEqual({ total: 28, sub: 28, dub: 12 });
    expect(page.page).toBe(2);
    expect(page.hasMore).toBe(true);
  });

  it("drops titles without a usable id or name instead of inventing one", () => {
    const list = normalizeAnimeTitleList({
      data: [validTitle, { anilistId: 0, title: "Bad" }, { anilistId: 5, title: "" }, null, "nope"],
    });
    expect(list).toHaveLength(1);
  });

  it("reads episode availability from booleans only", () => {
    // `normalizeAnimeSeries` receives the already-unwrapped `data` object.
    const series = normalizeAnimeSeries({
      ...validTitle,
      episodeList: [
        { number: 2, available: { sub: true, dub: false }, embed: { sub: "https://ani.pm/embed/ani/154587/2/sub" } },
        { number: 1, available: { sub: 1, dub: "yes" } },
        { number: 0, available: { sub: true } },
        { available: { sub: true } },
      ],
    });

    expect(series?.episodes.map((entry) => entry.number)).toEqual([1, 2]);
    expect(series?.episodes[0]?.available.sub).toBe(false);
    expect(series?.episodes[1]?.available.sub).toBe(true);
    expect(series?.episodes[1]?.embed?.sub).toContain("/2/sub");
  });

  it("unwraps both array and object episode payloads", () => {
    const fromArray = normalizeAnimeEpisodeList({ data: [{ number: 1 }, { number: 3 }] });
    const fromObject = normalizeAnimeEpisodeList({ data: { episodes: [{ number: 2 }] } });

    expect(fromArray.map((entry) => entry.number)).toEqual([1, 3]);
    expect(fromObject.map((entry) => entry.number)).toEqual([2]);
    expect(normalizeAnimeEpisodeList(null)).toEqual([]);
  });

  it("keeps only recent episodes with a real episode number", () => {
    const recent = normalizeAnimeRecentList({
      data: [
        { anilistId: 20, title: "Show", episode: 5, sub: true, dub: false, addedAt: "2026-10-01T00:00:00Z" },
        { anilistId: 20, title: "Show", episode: 0, sub: true },
        { anilistId: 0, title: "Show", episode: 1 },
      ],
    });

    expect(recent).toHaveLength(1);
    expect(recent[0]?.available).toEqual({ sub: true, dub: false });
  });

  it("defaults an unknown schedule kind to sub and normalizes its flags", () => {
    const schedule = normalizeAnimeSchedule({
      data: [
        { anilistId: 30, title: "Show", episode: 4, kind: "dub", airingAt: "2026-10-02T12:00:00Z", onAniPm: true, final: true },
        { anilistId: 31, title: "Show 2", episode: 4, kind: "weird", delayed: 1, adult: true },
        { anilistId: 32, title: "Show 3" },
      ],
    });

    expect(schedule).toHaveLength(2);
    expect(schedule[0]?.kind).toBe("dub");
    expect(schedule[0]?.onProvider).toBe(true);
    expect(schedule[0]?.final).toBe(true);
    expect(schedule[1]?.kind).toBe("sub");
    expect(schedule[1]?.delayed).toBe(false);
    expect(schedule[1]?.onProvider).toBe(false);
  });
});
