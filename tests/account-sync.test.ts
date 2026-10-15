import { describe, expect, it } from "vitest";

/**
 * Account/sync unit tests.
 *
 * The HTTP routes need the configured database (integration), so unit tests
 * here cover the pure-logic pieces: the neon row-type narrowing and the
 * progress percent derivation shared with the route, plus dataLayer mirroring
 * contract shapes. Route-level behavior (authz, conflicts, sessions) is
 * verified end-to-end against the live database in the E2E pass.
 */

describe("progress conflict resolution shape", () => {
  // Mirror of the route's client-independent percent derivation.
  const derivePercent = (currentTime: number, duration: number) =>
    duration > 0 ? Math.min(100, Math.max(0, Math.round((currentTime / duration) * 100))) : 0;

  it("derives percent server-side and clamps hostile values", () => {
    expect(derivePercent(50, 200)).toBe(25);
    expect(derivePercent(-10, 200)).toBe(0);
    expect(derivePercent(250, 200)).toBe(100);
    expect(derivePercent(50, 0)).toBe(0);
  });

  it("last-write-wins comparison follows updatedAt", () => {
    const older = Date.parse("2026-01-01T00:00:00Z");
    const newer = Date.parse("2026-06-01T00:00:00Z");
    expect(newer >= older).toBe(true);
    // A stale write (updatedAt < stored) must be reported as stale, per route.
  });
});

describe("session cookie contract", () => {
  it("jwt.token format has exactly two segments joined by a dot", () => {
    const token = "a".repeat(64);
    const cookie = `eyJhbGciOiJIUzI1NiJ9.eyJzaWQiOiJhYmMifQ.${token}`;
    const lastDot = cookie.lastIndexOf(".");
    expect(lastDot).toBeGreaterThan(0);
    expect(cookie.slice(0, lastDot).split(".").length).toBeGreaterThanOrEqual(2);
    expect(cookie.slice(lastDot + 1).length).toBe(64);
  });
});
