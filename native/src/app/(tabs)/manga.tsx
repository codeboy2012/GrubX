import { ScrollView, StyleSheet, Text, View , Platform } from "react-native";
import { useRouter } from "expo-router";
import React, { useState } from "react";

import { Row } from "@/components/Row";
import { Loading, ErrorState, EmptyState } from "@/components/Feedback";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { palette, spacing, typography } from "@/theme";

const KINDS = [
  { id: "popular", label: "Popular" },
  { id: "recent", label: "Newest" },
] as const;
type Kind = (typeof KINDS)[number]["id"];

/** Manga on GrubX native — the MangaDex-backed catalogue, same as the web. */
export default function MangaScreen() {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("popular");

  const list = useAsync((signal) => api.mangaList(kind, { limit: 30 }), [kind], {});

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.heading}>Manga</Text>
      <Text style={styles.subheading}>Read chapters in a distraction-free reader</Text>

      <View style={styles.kindRow}>
        {KINDS.map((option) => (
          <Text
            key={option.id}
            accessibilityRole="button"
            onPress={() => setKind(option.id)}
            style={[styles.kind, kind === option.id ? styles.kindActive : null]}
          >
            {option.label}
          </Text>
        ))}
      </View>

      {list.loading ? (
        <Loading label="Loading manga" />
      ) : list.error ? (
        <ErrorState title="Manga is unavailable" detail={list.error} />
      ) : (list.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="No manga found" detail="Try a different section." />
      ) : (
        <Row
          title={kind === "popular" ? "Popular manga" : "Recently updated chapters"}
          items={(list.data?.items ?? []).map((manga) => ({
            key: manga.id,
            uri: manga.coverUrl,
            title: manga.title,
            subtitle: manga.authorName ?? null,
            onPress: () => router.push(`/manga/${manga.id}`),
          }))}
        />
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
  kindRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  kind: {
    color: palette.muted,
    backgroundColor: palette.surface,
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.caption,
  },
  kindActive: {
    color: palette.background,
    backgroundColor: palette.accent,
    fontWeight: "700",
  },
});
