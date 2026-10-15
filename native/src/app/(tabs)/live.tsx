import { Pressable, ScrollView, StyleSheet, Text, View , Image , Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";

import { Loading, ErrorState, EmptyState } from "@/components/Feedback";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { liveBadgeUrl, livePosterUrl } from "@/lib/urls";
import { palette, radius, spacing, typography } from "@/theme";

type MatchScope = "live" | "all-today";

/** Live TV on GrubX native — public match data and provider-hosted streams. */
export default function LiveScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ scope?: string }>();
  const [scope, setScope] = useState<MatchScope>(params.scope === "all-today" ? "all-today" : "live");

  const matches = useAsync((signal) => api.liveMatches(scope), [scope], {});

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.heading}>Live TV</Text>
      <Text style={styles.subheading}>Streams are served by their own providers inside the player screen</Text>

      <View style={styles.scopeRow}>
        {(["live", "all-today"] as MatchScope[]).map((option) => (
          <Text
            key={option}
            accessibilityRole="button"
            onPress={() => setScope(option)}
            style={[styles.scope, scope === option ? styles.scopeActive : null]}
          >
            {option === "live" ? "Live now" : "Today"}
          </Text>
        ))}
      </View>

      {matches.loading ? (
        <Loading label="Loading matches" />
      ) : matches.error ? (
        <ErrorState title="Live TV is unavailable" detail={matches.error} />
      ) : (matches.data ?? []).length === 0 ? (
        <EmptyState title="No matches reported" detail="The provider has not published matches for this window." />
      ) : (
        <View style={styles.list}>
          {(matches.data ?? []).map((match) => (
            <Pressable
              key={match.id}
              onPress={() => router.push({ pathname: `/live/${match.id}`, params: { scope } })}
              style={styles.card}
            >
              <Image
                style={styles.poster}
                source={{ uri: livePosterUrl(match) ?? "https://streamed.pk/512x512.png" }}
                resizeMode="cover"
              />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {match.title}
                </Text>
                <Text style={styles.cardMeta}>
                  {match.category}
                  {match.popular ? " · Popular" : ""}
                  {match.teams?.home?.badge ? " · " : ""}
                  {liveBadgeUrl(match.teams?.home?.badge) ? "home/away" : ""}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
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
  scopeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  scope: {
    color: palette.muted,
    backgroundColor: palette.surface,
    borderRadius: radius.pill,
    overflow: "hidden",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.caption,
  },
  scopeActive: {
    color: palette.background,
    backgroundColor: palette.accent,
    fontWeight: "700",
  },
  list: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  card: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
    backgroundColor: palette.surfaceStrong,
    borderRadius: radius.card,
    overflow: "hidden",
  },
  poster: {
    width: 96,
    height: 64,
  },
  cardBody: {
    flex: 1,
    gap: spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    paddingRight: spacing.md,
  },
  cardTitle: {
    color: palette.foreground,
    fontSize: typography.body,
    fontWeight: "600",
  },
  cardMeta: {
    color: palette.muted,
    fontSize: typography.caption,
  },
});
