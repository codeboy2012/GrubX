import { describe, expect, it } from "vitest";

import {
  AIRING_WINDOW_MS,
  currentProgram,
  formatProgramRange,
  nextProgram,
  programProgress,
  programState,
  relativeTimeLabel,
  visiblePrograms,
} from "@/lib/live/epg";
import { buildGuide } from "@/app/api/live/epg/route";
import type { LiveMatch } from "@/types/live";

const NOW = Date.parse("2026-10-15T20:00:00Z");
const HOUR = 60 * 60 * 1000;

const match = (overrides: Partial<LiveMatch> & { id: string }): LiveMatch => ({
  title: `Match ${overrides.id}`,
  category: "basketball",
  date: NOW,
  sources: [{ source: "alpha", id: "1" }],
  ...overrides,
});

describe("EPG guide building", () => {
  it("groups provider events into one channel per sport category", () => {
    const guide = buildGuide(
      [
        match({ id: "a", category: "basketball" }),
        match({ id: "b", category: "basketball", date: NOW + HOUR }),
        match({ id: "c", category: "hockey", date: NOW + 2 * HOUR }),
      ],
      NOW,
    );

    expect(guide).toHaveLength(2);
    const basketball = guide.find((channel) => channel.category === "basketball");
    expect(basketball?.programs).toHaveLength(2);
    expect(basketball?.programs[0].startAt).toBeLessThan(basketball?.programs[1].startAt ?? Infinity);
  });

  it("skips events without playable sources instead of inventing guide rows", () => {
    const guide = buildGuide([match({ id: "a", sources: [] })], NOW);
    expect(guide).toHaveLength(0);
  });

  it("applies the documented broadcast window as the program end", () => {
    const guide = buildGuide([match({ id: "a", date: NOW })], NOW);
    expect(guide[0].programs[0].endAt - guide[0].programs[0].startAt).toBe(AIRING_WINDOW_MS);
  });

  it("marks the currently airing program index", () => {
    const guide = buildGuide(
      [match({ id: "a", date: NOW - HOUR }), match({ id: "b", date: NOW + HOUR })],
      NOW,
    );
    expect(guide[0].currentIndex).toBe(0);
  });

  it("is safe when the provider reports a date far in the past or future", () => {
    const guide = buildGuide(
      [match({ id: "a", date: 86400 }), match({ id: "b", date: NOW + 400 * 24 * HOUR })],
      NOW,
    );
    // The ambiguous 5-digit timestamp (either 86400 seconds or garbage) is
    // rejected rather than guessed; the unambiguous far-future event keeps its row.
    expect(guide[0].programs).toHaveLength(1);
    expect(guide[0].programs[0].id).toBe("b");
  });
});

describe("program state math", () => {
  const program = { id: "p", startAt: NOW - HOUR, endAt: NOW + HOUR, title: "Live now" };

  it("classifies live/past/upcoming", () => {
    expect(programState(program, NOW)).toBe("live");
    expect(programState(program, NOW + 2 * HOUR)).toBe("past");
    expect(programState({ ...program, startAt: NOW + HOUR, endAt: NOW + 2 * HOUR }, NOW)).toBe("upcoming");
  });

  it("computes progress correctly", () => {
    expect(programProgress(program, NOW)).toBeCloseTo(0.5);
    expect(programProgress(program, NOW - 2 * HOUR)).toBe(0);
    expect(programProgress(program, NOW + 2 * HOUR)).toBe(1);
  });
});

describe("guide navigation helpers", () => {
  const programs = [
    { id: "p1", startAt: NOW - 2 * HOUR, endAt: NOW - HOUR, title: "Early" },
    { id: "p2", startAt: NOW - HOUR, endAt: NOW + HOUR, title: "Now" },
    { id: "p3", startAt: NOW + HOUR, endAt: NOW + 2 * HOUR, title: "Later" },
  ];
  const channel = { id: "c", name: "Basketball", category: "basketball", logoUrl: null, currentIndex: 1, programs };

  it("finds current and next programs", () => {
    expect(currentProgram(channel, NOW)?.id).toBe("p2");
    expect(nextProgram(channel, NOW)?.id).toBe("p3");
  });

  it("selects the visible window including recent past", () => {
    const visible = visiblePrograms(channel, NOW);
    expect(visible.map(( program) => program.id)).toEqual(["p2", "p3"]);
  });
});

describe("timezone-aware rendering", () => {
  it("formats in a fixed timezone deterministically", () => {
    const program = { id: "p", startAt: Date.parse("2026-10-15T20:30:00Z"), endAt: Date.parse("2026-10-15T22:00:00Z"), title: "x" };
    expect(formatProgramRange(program, "en-US", { timeZone: "America/New_York" })).toBe("4:30 PM – 6:00 PM");
    expect(formatProgramRange(program, "en-GB", { timeZone: "Europe/London" })).toBe("21:30 – 23:00"); // BST in October
  });

  it("labels relative time round-trip", () => {
    expect(relativeTimeLabel(NOW + 25 * 60_000, NOW)).toBe("in 25 min");
    expect(relativeTimeLabel(NOW - 3 * 60_000, NOW)).toBe("3 min ago");
    expect(relativeTimeLabel(NOW, NOW)).toBe("now");
  });
});
