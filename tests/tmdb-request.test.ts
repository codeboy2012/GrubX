import { describe, expect, it } from "vitest";

import { buildTmdbUrl, getTmdbRouteConfig } from "@/lib/tmdb/request";

describe("TMDB path allowlist", () => {
  it("accepts allowlisted paths", () => {
    for (const path of [
      "/trending/all/day",
      "/search/movie",
      "/search/tv",
      "/discover/movie",
      "/discover/tv",
      "/movie/popular",
      "/tv/top_rated",
      "/movie/550",
      "/tv/1399",
      "/movie/550/videos",
      "/tv/1399/season/3",
      "/genre/movie/list",
      "/genre/tv/list",
    ]) {
      expect(getTmdbRouteConfig(path).path, path).toBe(path);
    }
  });

  it("rejects absolute URLs, traversal, and backslashes", () => {
    for (const path of [
      "https://evil.example/steal",
      "//evil.example/steal",
      "/\\\\evil.example",
      "/movie/../../account",
      "../account",
      "/movie\\550",
      "/.",
    ]) {
      expect(() => getTmdbRouteConfig(path), path).toThrow();
    }
  });

  it("rejects paths that are not on the allowlist", () => {
    for (const path of ["/account", "/movie/abc", "/search/person", "/configuration", "/authentication/token/new"]) {
      expect(() => getTmdbRouteConfig(path), path).toThrow();
    }
  });

  it("rejects empty and whitespace-only paths", () => {
    expect(() => getTmdbRouteConfig("")).toThrow();
    expect(() => getTmdbRouteConfig("   ")).toThrow();
  });

  it("only forwards allowlisted query parameters and always sends the server-side key", () => {
    const url = buildTmdbUrl("/search/movie", { query: "dune", page: 2, hijack: "1" }, ["query", "page"]);
    const parsed = new URL(url);

    expect(parsed.origin).toBe("https://mtd.example.test");
    expect(parsed.pathname).toBe("/search/movie");
    expect(parsed.searchParams.get("query")).toBe("dune");
    expect(parsed.searchParams.get("page")).toBe("2");
    expect(parsed.searchParams.get("hijack")).toBeNull();
    expect(parsed.searchParams.get("api_key")).toBe("test-key");
  });
});
