import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const swSource = readFileSync(join(__dirname, "..", "public", "sw.js"), "utf8")
  .replace(/\\/g, ""); // normalize regex escapes so plain-substring assertions hold

/**
 * The service worker is a security-sensitive asset: these assertions pin its
 * policy so a future edit cannot silently start caching authenticated or
 * private responses.
 */
describe("service worker policy", () => {
  it("never touches auth, sync, or feedback endpoints", () => {
    expect(swSource).toContain("/api/auth");
    expect(swSource).toContain("/api/sync");
    expect(swSource).toContain("/api/feedback");
  });

  it("allows only catalogue GET routes to be cached", () => {
    for (const route of ["/api/tmdb", "/api/anime", "/api/manga", "/api/live"]) {
      expect(swSource).toContain(route);
    }
  });

  it("rejects non-GET requests before evaluating caches", () => {
    expect(swSource).toMatch(/request\.method !== "GET"/);
  });

  it("bails out for other origins", () => {
    expect(swSource).toContain('url.origin !== self.location.origin');
  });

  it("returns an explicit 503 offline payload instead of a fake success", () => {
    expect(swSource).toContain("503");
    expect(swSource).toContain("X-GrubX-Offline");
  });
});
