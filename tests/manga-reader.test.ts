import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, sanitizeSettings } from "@/lib/settings";

describe("manga reader settings", () => {
  it("defaults to continuous, LTR, fit-width reading", () => {
    const settings = sanitizeSettings(null);

    expect(settings.mangaReaderMode).toBe(DEFAULT_SETTINGS.mangaReaderMode);
    expect(settings.mangaReaderMode).toBe("continuous");
    expect(settings.mangaReadingDirection).toBe("ltr");
    expect(settings.mangaReaderFit).toBe("width");
  });

  it("keeps valid reader preferences the user saved", () => {
    const settings = sanitizeSettings({
      mangaReaderMode: "single-page",
      mangaReadingDirection: "rtl",
      mangaReaderFit: "original",
    } as never);

    expect(settings.mangaReaderMode).toBe("single-page");
    expect(settings.mangaReadingDirection).toBe("rtl");
    expect(settings.mangaReaderFit).toBe("original");
  });

  it("falls back to defaults for invalid reader values instead of crashing", () => {
    const settings = sanitizeSettings({
      mangaReaderMode: "side-scroll-diagonal",
      mangaReadingDirection: "upward",
      mangaReaderFit: "poster",
    } as never);

    expect(settings.mangaReaderMode).toBe("continuous");
    expect(settings.mangaReadingDirection).toBe("ltr");
    expect(settings.mangaReaderFit).toBe("width");
  });

  it("does not let reader prefs leak into unrelated settings keys", () => {
    const settings = sanitizeSettings({ mangaReaderMode: "single-page" } as never);

    expect(settings.websiteName).toBe(DEFAULT_SETTINGS.websiteName);
    expect(settings.featureToggles.manga).toBe(true);
  });
});

describe("manga reader page math", () => {
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const percentFor = (page: number, pageCount: number) =>
    pageCount <= 0 ? 0 : clamp(Math.round((page / pageCount) * 100), 1, 90);

  it("keeps progress below 100 so finished chapters still surface in Continue Reading", () => {
    expect(percentFor(20, 20)).toBe(90);
    expect(percentFor(1, 20)).toBe(5);
  });

  it("never divides by zero on an empty chapter", () => {
    expect(percentFor(0, 0)).toBe(0);
  });

  it("clamps restored page positions into the current chapter length", () => {
    expect(clamp(50, 1, 20)).toBe(20);
    expect(clamp(0, 1, 20)).toBe(1);
    expect(clamp(7, 1, 20)).toBe(7);
  });
});

describe("manga reader navigation order", () => {
  const chapters = ["c1", "c2", "c3"].map((id) => ({ id }));
  const neighbours = (direction: "ltr" | "rtl") => {
    const index = chapters.findIndex((chapter) => chapter.id === "c2");
    const previous =
      direction === "rtl"
        ? index >= 0 && index < chapters.length - 1
          ? chapters[index + 1]
          : null
        : index > 0
          ? chapters[index - 1]
          : null;
    const next =
      direction === "rtl"
        ? index > 0
          ? chapters[index - 1]
          : null
        : index >= 0 && index < chapters.length - 1
          ? chapters[index + 1]
          : null;
    return { previous, next };
  };

  it("reads forward through ascending chapters in LTR", () => {
    const { previous, next } = neighbours("ltr");
    expect(previous?.id).toBe("c1");
    expect(next?.id).toBe("c3");
  });

  it("reverses the neighbours in RTL so both buttons keep working", () => {
    const { previous, next } = neighbours("rtl");
    expect(previous?.id).toBe("c3");
    expect(next?.id).toBe("c1");
  });
});
