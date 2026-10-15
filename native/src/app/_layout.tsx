import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { palette } from "@/theme";

/**
 * Root navigation for GrubX native.
 *
 * `(tabs)` holds the phone/web experience; `player/[kind]/[id]` renders
 * full-screen over it. Android TV relies on the same tab set with a focusable
 * top bar supplied by the `(tabs)/_layout` for D-pad navigation.
 */
export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background } }} />
    </>
  );
}
