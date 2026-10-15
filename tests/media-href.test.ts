import { describe, expect, it } from "vitest";

import { mediaHref, mediaImageUrl } from "@/lib/mediaHref";
import { isTmdbMediaType } from "@/types/media";

describe("mediaHref", () => {
  it("routes movies and TV to the title page", () => {
    expect(mediaHref("movie", "550")).toBe("/title/movie/550");
    expect(mediaHref("tv", "1399")).toBe("/title/tv/1399");
  });

  it("routes anime to the anime watch page with the episode preserved", () => {
    expect(mediaHref("anime", "154587")).toBe("/anime/154587");
    expect(mediaHref("anime", "154587", 12)).toBe("/anime/154587/watch?episode=12");
  });

  it("routes manga to the reader with the chapter id preserved", () => {
    expect(mediaHref("manga", "abc")).toBe("/manga/abc");
    expect(mediaHref("manga", "abc", "chapter-1")).toBe("/manga/abc/chapter-1");
  });
});

describe("mediaImageUrl", () => {
  it("expands TMDB paths and passes provider-hosted covers through", () => {
    expect(mediaImageUrl("/poster.jpg", "w500")).toBe("https://image.tmdb.org/t/p/w500/poster.jpg");
    expect(mediaImageUrl("https://ani.pm/api/anime/cover?anilistId=1", "w342")).toBe(
      "https://ani.pm/api/anime/cover?anilistId=1",
    );
    expect(mediaImageUrl(null, "w342")).toBeNull();
    expect(mediaImageUrl("", "w342")).toBeNull();
  });
});

describe("isTmdbMediaType", () => {
  it("keeps provider-specific types away from TMDB endpoints", () => {
    expect(isTmdbMediaType("movie")).toBe(true);
    expect(isTmdbMediaType("tv")).toBe(true);
    expect(isTmdbMediaType("anime")).toBe(false);
    expect(isTmdbMediaType("manga")).toBe(false);
  });
});
