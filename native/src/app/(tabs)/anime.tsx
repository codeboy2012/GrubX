import { ScrollView, StyleSheet, Text, View , Platform } from "react-native";
import { useRouter } from "expo-router";
import React, { useState } from "react";

import { Row } from "@/components/Row";
import { Loading, ErrorState, EmptyState } from "@/components/Feedback";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { palette, spacing, typography } from "@/theme";

const RANGES = ["today", "week", "month", "all"] as const;
type Range = (typeof RANGES)[number];

/**
 * Anime on GrubX native — the Ani.pm catalogue as served by `/api/anime`.
 *
 * Availability is whatever Ani.pm reports (SUB/DUB flags, episode counts);
 * nothing is invented when the provider has no data.
 */
export default function AnimeScreen() {
  const router = useRouter();
  const [range, setRange] = useState<Range>("week");

  const top = useAsync((signal) => api.animeTop(range, 24), [range], {});
  const recent = useAsync((signal) => api.animeRecent(18), [], {});

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.heading}>Anime</Text>
      <Text style={styles.subheading}>Catalogue and playback by Ani.pm · no key required</Text>

      <View style={styles.rangeRow}>
        {RANGES.map((option) => (
          <Text
            key={option}
            accessibilityRole="button"
            onPress={() => setRange(option)}
            style={[styles.range, range === option ? styles.rangeActive : null]}
          >
            {option}
          </Text>
        ))}
      </View>

      {top.loading || recent.loading ? (
        <Loading label="Contacting the Ani.pm catalogue" />
      ) : top.error && recent.error ? (
        <ErrorState title="The anime catalogue is unavailable" detail={top.error} />
      ) : (
        <>
          <Row
            title="Trending anime"
            description={`Top rated on Ani.pm during the last ${range}.`}
            items={(top.data ?? []).map((title) => ({
              key: String(title.anilistId),
              uri: title.posterUrl,
              title: title.title,
              subtitle: title.score ? `★ ${title.score.toFixed(1)}` : null,
              onPress: () => router.push(`/anime/${title.anilistId}`),
            }))}
          />
          <Row
            title="Recently updated episodes"
            description="Newest episodes Ani.pm has added, with SUB and DUB flags."
            items={(recent.data ?? []).map((entry) => ({
              key: `${entry.anilistId}-${entry.episode}`,
              uri: entry.posterUrl,
              title: entry.title,
              subtitle: `Episode ${entry.episode}${entry.available.dub ? " · DUB" : entry.available.sub ? " · SUB" : ""}`,
              onPress: () => router.push(`/anime/${entry.anilistId}`),
            }))}
          />
          {(top.data ?? []).length === 0 && (recent.data ?? []).length === 0 ? (
            <EmptyState title="No anime in this view" detail="Ani.pm returned no titles for this range." />
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: Platform.isTV ? 0 : spacing.lg,
    paddingBottom: spacing.xl * 2,
    gap: spacing.lg,
  },
  heading: {
    color: palette.foreground,
    fontSize: typography.hero,
    fontWeight: "800",
    paddingHorizontal: spacing.md,
  },
  subheading: {
    color: palette.muted,
    fontSize: typography.caption,
    paddingHorizontal: spacing.md,
  },
  rangeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  range: {
    color: palette.muted,
    backgroundColor: palette.surface,
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.caption,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  rangeActive: {
    color: palette.background,
    backgroundColor: palette.accent,
    fontWeight: "700",
  },
});
