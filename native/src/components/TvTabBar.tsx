import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { palette, radius, spacing, typography } from "@/theme";

type RouteName = string;

type TabRoute = {
  readonly name: RouteName;
  readonly label: string;
};

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: "home",
  movies: "film",
  tv: "tv",
  anime: "sparkles",
  manga: "book",
  live: "radio",
  search: "search",
  mylist: "bookmark",
};

/**
 * Focusable top tab bar for Android TV.
 *
 * Every tab is focusable so D-pad users can highlight and select sections with
 * the remote; the focused tab is visually pinned to the shared accent token.
 */
export function TvTabBar({
  routes,
  state,
}: {
  routes: readonly TabRoute[];
  state: { index: number; routes: { key: string }[] };
}) {
  const activeIndex = state.index;

  return (
    <View style={styles.wrap}>
      {routes.map((route, index) => {
        const active = index === activeIndex;
        const focusedSegment = state.routes[index]?.key ?? route.name;
        return (
          <Pressable
            key={focusedSegment}
            accessibilityRole="tab"
            accessibilityLabel={route.label}
            accessibilityState={{ selected: active }}
            hasTVPreferredFocus={active}
            focusable
            android_ripple={{ color: palette.accentSoft, radius: radius.pill, foreground: true }}
            onPress={() => router.replace(`/${route.name === "index" ? "" : route.name}` as never)}
            style={({ pressed }) => [styles.tab, pressed ? styles.tabFocused : null, active ? styles.tabActive : null]}
          >
            <Ionicons
              name={(ICONS[route.name] ?? "ellipse") as keyof typeof Ionicons.glyphMap}
              size={typography.body}
              color={active ? palette.accent : palette.muted}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
    backgroundColor: palette.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.line,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + spacing.xs,
    borderRadius: radius.pill,
    minWidth: 92,
  },
  tabFocused: {
    backgroundColor: palette.accentSoft,
  },
  tabActive: {
    backgroundColor: "rgba(242, 179, 90, 0.10)",
  },
});
