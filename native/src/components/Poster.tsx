import { useState } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { palette, radius, spacing, typography } from "@/theme";

/**
 * Poster card used across Movies, TV, Anime, Manga, and Live rows.
 *
 * Remote image: provider artwork only — TMDB/anime/manga/live sources serve
 * their own images and GrubX never mirrors or re-hosts them. A neutral tile is
 * rendered when the source has no art.
 *
 * On Android TV every poster is D-pad focusable with a visible focus ring
 * (accent border + slight zoom) so a remote can always see which tile is live.
 */
export function Poster({
  uri,
  title,
  subtitle,
  ratio = 2 / 3,
  width,
  onPress,
  onFocus,
  onBlur,
  focusable,
  preferredFocus,
}: {
  uri: string | null;
  title: string;
  subtitle?: string | null;
  ratio?: number;
  width: number;
  onPress?: () => void;
  /** Fired with the card's own tile when TV focus lands here (used by rails to auto-scroll). */
  onFocus?: () => void;
  onBlur?: () => void;
  /** Force focusability on/off; defaults to TV-on / touch-off. */
  focusable?: boolean;
  preferredFocus?: boolean;
}) {
  const shouldFocus = focusable ?? Platform.isTV;
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityState={focused ? { selected: true } : undefined}
      onPress={onPress}
      onFocus={() => {
        setFocused(true);
        onFocus?.();
      }}
      onBlur={() => {
        setFocused(false);
        onBlur?.();
      }}
      focusable={shouldFocus}
      hasTVPreferredFocus={preferredFocus}
      style={({ pressed }) => [
        styles.card,
        { width },
        (pressed || focused) && shouldFocus ? styles.cardFocused : null,
      ]}
    >
      <View style={[styles.art, { aspectRatio: ratio }]}>
        {uri ? (
          <Image source={{ uri }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Text style={styles.placeholderText}>{title.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
      </View>
      <Text numberOfLines={2} style={styles.title}>
        {title}
      </Text>
      {subtitle ? (
        <Text numberOfLines={1} style={styles.subtitle}>
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  cardFocused: {
    transform: [{ scale: 1.06 }],
    borderWidth: 2,
    borderRadius: radius.poster + 2,
    borderColor: palette.accent,
  },
  art: {
    width: "100%",
    borderRadius: radius.poster,
    overflow: "hidden",
    backgroundColor: palette.surfaceStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    color: palette.muted,
    fontSize: typography.title,
    fontWeight: "700",
  },
  title: {
    color: palette.foreground,
    fontSize: typography.body,
    fontWeight: "600",
  },
  subtitle: {
    color: palette.muted,
    fontSize: typography.caption,
  },
});
