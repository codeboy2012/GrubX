import { Platform } from "react-native";

// Platform.select has no "tv" key in its typings; branch explicitly instead.

/**
 * GrubX design tokens for the native apps.
 *
 * Mirrors the values declared in the web app's `app/globals.css`
 * (`--background`, `--accent`, `--muted`, …) so the shared "cinematic dark"
 * identity stays consistent across platforms. Keep changes in sync: update the
 * CSS variables and these constants together.
 */
export const palette = {
  background: "#030304",
  foreground: "#f6f3ee",
  muted: "#a9a39a",
  surface: "#111111",
  surfaceStrong: "#1a1917",
  line: "rgba(255, 255, 255, 0.1)",
  accent: "#f2b35a",
  accentSoft: "rgba(242, 179, 90, 0.17)",
  success: "#8ae7bd",
  danger: "#ff6a6a",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  poster: 13,
  card: 17,
  pill: 999,
} as const;

export const typography = {
  hero: Platform.isTV ? 44 : 34,
  title: Platform.isTV ? 30 : 22,
  body: Platform.isTV ? 18 : 15,
  caption: Platform.isTV ? 15 : 12,
} as const;

/** Target row width for poster tiles; TV uses bigger cards for 10-foot UI. */
export const posterWidth = (fromApi: number) => (Platform.isTV ? Math.min(fromApi * 1.6, 320) : fromApi);
