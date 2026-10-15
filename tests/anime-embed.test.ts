import { describe, expect, it } from "vitest";

import {
  buildAnimeCoverUrl,
  buildAnimeEmbedUrl,
  buildAnimeSiteUrl,
  hasAnimeLanguage,
  normalizeAnimeId,
  normalizeAnimeLanguage,
  normalizeEpisodeNumber,
} from "@/lib/anime/embed";
import type { AnimeEpisode } from "@/types/anime";

const episode = (available: Partial<AnimeEpisode["available"]> = {}): AnimeEpisode => ({
  number: 1,
  title: null,
  runtimeSeconds: null,
  aired: null,
  thumbnail: null,
  available: { sub: false, dub: false, subHard: false, dubHard: false, ...available },
  embed: null,
});

describe("anime identifier handling", () => {
  it("accepts AniList ids and prefixed MyAnimeList ids only", () => {
    expect(normalizeAnimeId("154587")).toBe("154587");
    expect(normalizeAnimeId(154587)).toBe("154587");
    expect(normalizeAnimeId("mal-52991")).toBe("mal-52991");
    expect(normalizeAnimeId("MAL-52991")).toBe("mal-52991");
  });

  it("rejects traversal, ids disguised as URLs, zero, negatives, and junk", () => {
    for (const value of [
      "0",
      "-5",
      "mal-0",
      "mal-",
      "../154587",
      "https://ani.pm/ani/154587",
      "154587/9/sub",
      "abc",
      "",
      null,
      undefined,
    ]) {
      expect(normalizeAnimeId(value as never)).toBeNull();
    }
  });

  it("trims surrounding whitespace but never accepts anything else", () => {
    // Ids copied out of a URL field sometimes carry padding; trimming keeps that
    // working while the remainder still has to be pure digits.
    expect(normalizeAnimeId(" 154587 ")).toBe("154587");
    expect(normalizeAnimeId(" 154587 x ")).toBeNull();
  });

  it("keeps MyAnimeList and AniList ids distinct types", () => {
    expect(buildAnimeSiteUrl("mal-52991")).toBeNull();
    expect(buildAnimeSiteUrl("154587")).toBe("https://ani.pm/ani/154587");
  });

  it("bounds episode numbers and language values", () => {
    expect(normalizeEpisodeNumber("12")).toBe(12);
    expect(normalizeEpisodeNumber(0)).toBeNull();
    expect(normalizeEpisodeNumber("12abc")).toBe(12);
    expect(normalizeEpisodeNumber(100000)).toBeNull();
    expect(normalizeAnimeLanguage("dub")).toBe("dub");
    expect(normalizeAnimeLanguage("vostfr")).toBe("sub");
    expect(normalizeAnimeLanguage(null)).toBe("sub");
  });
});

describe("buildAnimeEmbedUrl", () => {
  it("builds the documented AniList and MyAnimeList paths", () => {
    expect(buildAnimeEmbedUrl(154587, { episode: 1, lang: "sub" })).toBe(
      "https://ani.pm/embed/ani/154587/1/sub",
    );
    expect(buildAnimeEmbedUrl("mal-52991", { episode: 3, lang: "dub" })).toBe(
      "https://ani.pm/embed/mal/52991/3/dub",
    );
  });

  it("never returns a URL for an unusable id or episode", () => {
    expect(buildAnimeEmbedUrl("../../etc/passwd", { episode: 1 })).toBeNull();
    expect(buildAnimeEmbedUrl(154587, { episode: 0 })).toBeNull();
    expect(buildAnimeEmbedUrl(154587, { episode: 99999 })).toBeNull();
    expect(buildAnimeEmbedUrl(null)).toBeNull();
  });

  it("only emits documented parameters", () => {
    const url = new URL(
      buildAnimeEmbedUrl(154587, {
        episode: 2,
        lang: "vostfr",
        autoplay: true,
        muted: false,
        start: 61.9,
        color: "#FF7AA8",
        autoNext: true,
        theater: true,
        subtitles: "English",
      })!,
    );

    expect(url.pathname).toBe("/embed/ani/154587/2/vostfr");
    expect(url.searchParams.get("autoplay")).toBe("1");
    expect(url.searchParams.get("muted")).toBe("0");
    expect(url.searchParams.get("start")).toBe("61");
    expect(url.searchParams.get("color")).toBe("ff7aa8");
    expect(url.searchParams.get("autonext")).toBe("1");
    expect(url.searchParams.get("theater")).toBe("1");
    expect(url.searchParams.get("subtitles")).toBe("English");
  });

  it("drops a key that is not a publishable app key and rejects injection attempts", () => {
    const withBadKey = new URL(buildAnimeEmbedUrl(154587, { appKey: "secret_live_abc" })!);
    expect(withBadKey.searchParams.get("key")).toBeNull();

    const withSecretLookingKey = new URL(buildAnimeEmbedUrl(154587, { appKey: "sk_secret" })!);
    expect(withSecretLookingKey.searchParams.get("key")).toBeNull();

    const withPublishableKey = new URL(buildAnimeEmbedUrl(154587, { appKey: "pk_live_abc123" })!);
    expect(withPublishableKey.searchParams.get("key")).toBe("pk_live_abc123");

    const withBadColor = new URL(buildAnimeEmbedUrl(154587, { color: "javascript:alert(1)" })!);
    expect(withBadColor.searchParams.get("color")).toBeNull();
  });

  it("clamps an absurd start offset", () => {
    const url = new URL(buildAnimeEmbedUrl(154587, { start: 10_000_000 })!);
    expect(Number(url.searchParams.get("start"))).toBe(60 * 60 * 12);
  });

  it("builds a cover URL only for a real AniList id", () => {
    expect(buildAnimeCoverUrl(154587)?.startsWith("https://ani.pm/api/anime/cover?anilistId=154587")).toBe(true);
    expect(buildAnimeCoverUrl(0)).toBeNull();
    expect(buildAnimeCoverUrl(154587, 52991)).toContain("malId=52991");
  });
});

describe("hasAnimeLanguage", () => {
  it("reports availability exactly as the catalogue does", () => {
    expect(hasAnimeLanguage(episode({ sub: true }), "dub")).toBe(false);
    expect(hasAnimeLanguage(episode({ sub: true }), "sub")).toBe(true);
    expect(hasAnimeLanguage(episode(), "sub")).toBe(false);
    expect(hasAnimeLanguage(episode({ dubHard: true }), "dub")).toBe(false);
  });
});
