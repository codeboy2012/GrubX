import { useRef } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { palette, spacing, typography } from "@/theme";
import { Poster } from "./Poster";

export type RowItem = {
  key: string;
  /** Poster art is always an absolute URL (TMDB-expanded, provider covers, live badges); GrubX never mirrors provider artwork. */
  uri: string | null;
  title: string;
  subtitle?: string | null;
  ratio?: number;
  width?: number;
  onPress?: () => void;
};

/**
 * Horizontal, screen-reader labelled poster rail shared by every section.
 *
 * On Android TV the focused tile also scrolls into view (D-pad navigation across
 * a long rail keeps the selection on screen instead of hiding it).
 */
export function Row({
  title,
  description,
  items,
  onItemPress,
}: {
  title: string;
  description?: string;
  items: RowItem[];
  onItemPress?: (item: RowItem) => void;
}) {
  const railRef = useRef<ScrollView>(null);

  const scrollToTile = (index: number) => {
    const scroll = railRef.current;
    if (!scroll || !Platform.isTV || index < 0 || index >= items.length) {
      return;
    }
    scroll.scrollTo({ x: index * spacing.md, animated: true });
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{title}</Text>
      {description ? <Text style={styles.subheading} numberOfLines={2}>{description}</Text> : null}
      <ScrollView
        ref={railRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        accessibilityLabel={`${title} rail`}
      >
        {items.map((item, index) => (
          <Poster
            key={item.key}
            uri={item.uri}
            title={item.title}
            subtitle={item.subtitle}
            ratio={item.ratio}
            width={item.width ?? 156}
            onFocus={() => scrollToTile(index)}
            onPress={item.onPress ?? (onItemPress ? () => onItemPress(item) : undefined)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  heading: {
    color: palette.foreground,
    fontSize: typography.title,
    fontWeight: "700",
  },
  subheading: {
    color: palette.muted,
    fontSize: typography.caption,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  rail: {
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
});
