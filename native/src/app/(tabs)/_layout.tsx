import { Tabs } from "expo-router";
import { Platform } from "react-native";

import { TvTabBar } from "@/components/TvTabBar";
import { palette, typography } from "@/theme";

/** Routes exposed as top-level destinations on every platform. */
export const TAB_ROUTES = [
  { name: "index", label: "Home" },
  { name: "movies", label: "Movies" },
  { name: "tv", label: "TV" },
  { name: "anime", label: "Anime" },
  { name: "manga", label: "Manga" },
  { name: "live", label: "Live" },
  { name: "search", label: "Search" },
  { name: "mylist", label: "My List" },
] as const;

/**
 * Top-level navigation.
 *
 * Phone/tablet/web use the platform tab bar; Android TV swaps in a focusable
 * top bar (TvTabBar) so D-pad users can move between sections with a remote.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.line,
        },
        tabBarLabelStyle: { fontSize: typography.caption },
        sceneStyle: { backgroundColor: palette.background },
      }}
      tabBar={Platform.isTV ? (props) => <TvTabBar routes={TAB_ROUTES} state={props.state} /> : undefined}
    >
      {TAB_ROUTES.map((route) => (
        <Tabs.Screen key={route.name} name={route.name} options={{ title: route.label }} />
      ))}
    </Tabs>
  );
}
