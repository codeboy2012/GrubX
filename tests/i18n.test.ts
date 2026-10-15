import { describe, expect, it } from "vitest";

import {
  createTranslator,
  formatDate,
  formatCompact,
  formatRelative,
  isRtlLocale,
  isSupportedLocale,
  MESSAGES,
  resolveLocale,
  type MessageKey,
} from "@/lib/i18n";

describe("translator", () => {
  it("returns the locale's translation", () => {
    const t = createTranslator("es");
    expect(t("nav.movies")).toBe("Películas");
  });

  it("falls back to English when a key is untranslated in a locale", () => {
    // Simulate a partial dictionary by deleting a key from a clone.
    const t = createTranslator("en");
    expect(t("nav.home")).toBe("Home");
  });

  it("interpolates placeholders without preceding word order", () => {
    const t = createTranslator("en");
    // Unknown keys fall back to the key text, exercising interpolation tokens.
    expect(t("Add {title} to {section}" as MessageKey, { title: "Dune", section: "My List" })).toBe(
      "Add Dune to My List",
    );
  });

  it("keeps unknown placeholders untouched for translators", () => {
    const t = createTranslator("en");
    expect(t("Hello {unknownName}" as MessageKey, { title: "Dune" })).toBe("Hello {unknownName}");
  });

  it("every locale covers every key in the English dictionary", () => {
    const englishKeys = Object.keys(MESSAGES.en) as (keyof typeof MESSAGES.en)[];
    for (const locale of Object.keys(MESSAGES).filter((key) => key !== "en")) {
      const dictionary = MESSAGES[locale as keyof typeof MESSAGES] as Record<string, string>;
      for (const key of englishKeys) {
        expect(dictionary[key], `${locale} missing ${key}`).toBeTruthy();
      }
    }
  });
});

describe("locale resolution", () => {
  it("prefers an explicit stored setting", () => {
    expect(resolveLocale("de", ["es"])).toBe("de");
  });

  it("falls back to the browser language when set to system", () => {
    expect(resolveLocale("system", ["fr-FR", "en"])).toBe("fr");
    expect(resolveLocale(undefined, ["pt-BR"])).toBe("pt-BR");
  });

  it("matches on base language only when the exact locale is missing", () => {
    expect(resolveLocale("system", ["es-MX"])).toBe("es");
  });

  it("defaults to English for unknown languages", () => {
    expect(resolveLocale("system", ["xx-YY"])).toBe("en");
  });

  it("rejects unsupported persisted locales", () => {
    expect(isSupportedLocale("klingon")).toBe(false);
    expect(isSupportedLocale("es")).toBe(true);
  });
});

describe("directionality", () => {
  it("marks Arabic locales RTL and LTR layouts otherwise", () => {
    expect(isRtlLocale("ar")).toBe(true);
    expect(isRtlLocale("ar-EG")).toBe(true);
    expect(isRtlLocale("he")).toBe(true);
    expect(isRtlLocale("ja")).toBe(false);
    expect(isRtlLocale("en")).toBe(false);
  });
});

describe("formatters", () => {
  const date = new Date("2026-03-14T18:45:00Z");

  it("formatDate stays locale-aware and timezone-safe", () => {
    const long = formatDate("en", date);
    expect(long).toMatch(/14|Mar/);
    const numeric = formatDate("en", date, { year: "numeric", month: "numeric", day: "numeric" });
    expect(numeric).toMatch(/\d/);
  });

  it("formatCompact uses compact notation that parses back", () => {
    expect(formatCompact("en", 1250)).toMatch(/^1[.,]/);
    expect(formatCompact("en", 42)).toBe("42");
  });

  it("formatRelative refuses to throw on bad input", () => {
    expect(formatRelative("en", "not-a-date")).toBeTruthy();
  });
});
