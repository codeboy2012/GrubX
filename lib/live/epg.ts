import type { EpgChannel, EpgProgram } from "@/types/live";

/**
 * Pure guide/time helpers for Live TV — no I/O, fully unit-testable.
 *
 * All program boundaries are absolute epoch milliseconds; rendering converts
 * them with the user's own locale so the guide is always timezone-correct
 * regardless of server location.
 */

export const GUIDE_WINDOW_MS = 60 * 60 * 1000; // 1h look-back
export const AIRING_WINDOW_MS = 3 * 60 * 60 * 1000; // provider broadcast window

export type ProgramState = "past" | "live" | "upcoming";

export const programState = (program: EpgProgram, nowMs: number): ProgramState => {
  if (nowMs >= program.endAt) {
    return "past";
  }
  if (nowMs >= program.startAt) {
    return "live";
  }
  return "upcoming";
};

type FormatOptions = { timeZone?: string };

export const formatProgramTime = (timestamp: number, locale?: string, options?: FormatOptions) =>
  new Intl.DateTimeFormat(locale ?? undefined, {
    hour: "numeric",
    minute: "2-digit",
    ...(options ?? {}),
  }).format(new Date(timestamp));

export const formatProgramDay = (timestamp: number, locale?: string, options?: FormatOptions) =>
  new Intl.DateTimeFormat(locale ?? undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(options ?? {}),
  }).format(new Date(timestamp));

export const formatProgramRange = (program: EpgProgram, locale?: string, options?: FormatOptions) =>
  `${formatProgramTime(program.startAt, locale, options)} – ${formatProgramTime(program.endAt, locale, options)}`;

/**
 * Programs to show for a channel's guide lane: the one airing now (or the
 * last one that aired) plus everything inside the forward window.
 */
export const visiblePrograms = (channel: EpgChannel, nowMs: number, forwardMs = 4 * 60 * 60 * 1000) =>
  channel.programs.filter(
    (program) => program.endAt > nowMs - GUIDE_WINDOW_MS && program.startAt < nowMs + forwardMs,
  );

export const currentProgram = (channel: EpgChannel, nowMs: number): EpgProgram | null =>
  channel.programs.find((program) => program.startAt <= nowMs && nowMs < program.endAt) ?? null;

export const nextProgram = (channel: EpgChannel, nowMs: number): EpgProgram | null =>
  channel.programs.find((program) => program.startAt > nowMs) ?? null;

/** Progress [0..1] through the live program, for the "now" bar. */
export const programProgress = (program: EpgProgram, nowMs: number): number => {
  if (nowMs <= program.startAt) {
    return 0;
  }
  if (nowMs >= program.endAt) {
    return 1;
  }
  return (nowMs - program.startAt) / (program.endAt - program.startAt);
};

/** Time label like "in 25 min" or "8 min left". Clamped to whole minutes. */
export const relativeTimeLabel = (timestamp: number, nowMs: number): string => {
  const deltaMin = Math.round((timestamp - nowMs) / 60_000);
  if (deltaMin >= 1) {
    return `in ${deltaMin} min`;
  }
  if (deltaMin <= -1) {
    return `${Math.abs(deltaMin)} min ago`;
  }
  return "now";
};
