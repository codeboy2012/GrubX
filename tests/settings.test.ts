import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, sanitizeSettings } from "@/lib/settings";

const LEGACY_HERO_SUBTITLE = "Movies, TV, live streams, music, and external media in one quiet console.";

describe("settings sanitization", () => {
  it("falls back to defaults for empty input", () => {
    const settings = sanitizeSettings(null);

    expect(settings.websiteName).toBe("GrubX");
    expect(settings.homeHeroSubtitle).toBe(DEFAULT_SETTINGS.homeHeroSubtitle);
    expect(settings.blockPopups).toBe(true);
  });

  it("migrates the legacy hero subtitle that advertised removed integrations", () => {
    const settings = sanitizeSettings({ homeHeroSubtitle: LEGACY_HERO_SUBTITLE });

    expect(settings.homeHeroSubtitle).toBe(DEFAULT_SETTINGS.homeHeroSubtitle);
    expect(settings.homeHeroSubtitle).not.toMatch(/music|external media/i);
  });

  it("keeps a user-authored hero subtitle", () => {
    const settings = sanitizeSettings({ homeHeroSubtitle: "My own tagline" });

    expect(settings.homeHeroSubtitle).toBe("My own tagline");
  });

  it("rejects out-of-range enum values and keeps booleans honest", () => {
    const settings = sanitizeSettings({
      navStyle: "gigantic" as never,
      textSize: "enormous" as never,
      showLogo: "yes" as never,
    });

    expect(settings.navStyle).toBe(DEFAULT_SETTINGS.navStyle);
    expect(settings.textSize).toBe(DEFAULT_SETTINGS.textSize);
    expect(settings.showLogo).toBe(DEFAULT_SETTINGS.showLogo);
  });

  it("stores only supported interface locales", () => {
    expect(sanitizeSettings({ locale: "es" }).locale).toBe("es");
    expect(sanitizeSettings({ locale: "system" }).locale).toBe("system");
    expect(sanitizeSettings({ locale: "klingon" }).locale).toBe(DEFAULT_SETTINGS.locale);
  });

  it("merges partial feature toggles instead of dropping the rest", () => {
    const settings = sanitizeSettings({ featureToggles: { movies: false } as never });

    expect(settings.featureToggles.movies).toBe(false);
    expect(settings.featureToggles.tv).toBe(DEFAULT_SETTINGS.featureToggles.tv);
    expect(settings.featureToggles.manga).toBe(true);
  });

  it("keeps only https custom providers with a complete definition", () => {
    const settings = sanitizeSettings({
      customProviders: [
        { id: "ok", name: "Fine", baseUrl: "https://example.com", embedUrlPattern: "https://example.com/{id}", enabled: true, supportsMovie: true, supportsTv: true },
        { id: "insecure", name: "Insecure", baseUrl: "http://example.com", embedUrlPattern: "http://example.com/{id}", enabled: true, supportsMovie: true, supportsTv: true },
        { id: "partial", name: "", baseUrl: "https://example.com", embedUrlPattern: "", enabled: true, supportsMovie: true, supportsTv: true },
      ] as never,
    });

    expect(settings.customProviders).toHaveLength(1);
    expect(settings.customProviders[0]?.id).toBe("ok");
  });
});
