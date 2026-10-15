import { Image , Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";

import { Loading, ErrorState, EmptyState } from "@/components/Feedback";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { library } from "@/lib/storage";
import { palette, radius, spacing, typography } from "@/theme";

/** Anime detail — Ani.pm catalogue entry with its real episode availability. */
export default function AnimeDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const id = String(params.id ?? "");
  const [lang, setLang] = useState<"sub" | "dub">("sub");

  const series = useAsync((signal) => api.animeSeries(id), [id], {});
  const [saved, setSaved] = useState<boolean | null>(null);

  const episodes = useMemo(() => series.data?.episodes ?? [], [series.data]);
  const playable = episodes.filter((episode) => episode.available.sub || episode.available.dub);

  const openPlayer = async (episode: number) => {
    const data = series.data;
    if (!data) {
      return;
    }
    await library.saveProgress({
      mediaId: String(data.anilistId),
      mediaType: "anime",
      title: data.title,
      coverUrl: data.posterUrl,
      season: null,
      episode,
      currentTime: 0,
      duration: 1440,
      percent: 0,
      updatedAt: new Date().toISOString(),
    });
    router.push(`/player/anime/${data.anilistId}?episode=${episode}&lang=${lang}&title=${encodeURIComponent(data.title)}`);
  };

  if (series.loading) {
    return <Loading label="Loading anime" />;
  }
  if (series.error) {
    return <ErrorState title="Anime is unavailable" detail={series.error} />;
  }
  if (!series.data) {
    return <EmptyState title="Title not found on Ani.pm" />;
  }

  const data = series.data;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        {data.bannerUrl ?? data.posterUrl ? (
          <Image style={styles.banner} source={{ uri: (data.bannerUrl ?? data.posterUrl)! }} resizeMode="cover" />
        ) : null}
        <View style={styles.headerBody}>
          <Text style={styles.title}>{data.title}</Text>
          <Text style={styles.meta}>
            {[data.year ? String(Math.trunc(data.year)) : null, data.format, data.status]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          <Text style={styles.meta}>
            {playable.length} playable episodes · {data.episodeCounts.sub} SUB / {data.episodeCounts.dub} DUB
          </Text>
          {data.synopsis ? <Text style={styles.synopsis}>{data.synopsis}</Text> : null}

          <View style={styles.langRow}>
            {(["sub", "dub"] as const).map((option) => (
              <Pressable key={option} onPress={() => setLang(option)} style={[styles.lang, lang === option ? styles.langActive : null]}>
                <Text style={lang === option ? styles.langActiveText : styles.langText}>{option.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={async () => {
              const next = await library.toggle({
                mediaId: String(data.anilistId),
                mediaType: "anime",
                title: data.title,
                coverUrl: data.posterUrl,
                rating: data.score,
              });
              setSaved(next);
            }}
            style={styles.saveButton}
          >
            <Text style={styles.saveText}>{saved ? "Added — in My List" : saved === false ? "Add to My List" : "Add to My List"}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.episodes}>
        <Text style={styles.sectionTitle}>Episodes</Text>
        {episodes.map((episode) => {
          const available = lang === "dub" ? episode.available.dub : episode.available.sub;
          const any = episode.available.sub || episode.available.dub;
          return (
            <Pressable
              key={episode.number}
              disabled={!any}
              onPress={() => void openPlayer(episode.number)}
              style={[styles.episode, any ? null : styles.episodeDisabled]}
            >
              <Text style={styles.episodeTitle}>
                Episode {episode.number}
                {episode.title ? ` — ${episode.title}` : ""}
              </Text>
              <Text style={styles.episodeMeta}>
                {episode.available.sub ? "SUB" : ""}
                {episode.available.sub && episode.available.dub ? " · " : ""}
                {episode.available.dub ? "DUB" : ""}
                {!any ? " · not listed" : !available ? ` · no ${lang.toUpperCase()}` : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingBottom: spacing.xl * 2,
  },
  header: {
    gap: spacing.md,
    padding: spacing.md,
  },
  banner: {
    width: "100%",
    aspectRatio: 2.4,
    borderRadius: radius.card,
    backgroundColor: palette.surfaceStrong,
  },
  headerBody: {
    gap: spacing.xs,
  },
  title: {
    color: palette.foreground,
    fontSize: typography.title,
    fontWeight: "800",
  },
  meta: {
    color: palette.muted,
    fontSize: typography.caption,
  },
  synopsis: {
    color: palette.muted,
    fontSize: typography.body,
    lineHeight: typography.body * 1.5,
    marginTop: spacing.xs,
  },
  langRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  lang: {
    borderRadius: radius.pill,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  langActive: {
    backgroundColor: palette.foreground,
  },
  langText: {
    color: palette.muted,
    fontSize: typography.caption,
    fontWeight: "700",
  },
  langActiveText: {
    color: palette.background,
    fontSize: typography.caption,
    fontWeight: "700",
  },
  saveButton: {
    alignSelf: "flex-start",
    backgroundColor: palette.accent,
    borderRadius: radius.pill,
    overflow: "hidden",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + spacing.xs,
    marginTop: spacing.xs,
  },
  saveText: {
    color: palette.background,
    fontWeight: "700",
    fontSize: typography.caption,
  },
  sectionTitle: {
    color: palette.foreground,
    fontSize: typography.title,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  episodes: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  episode: {
    backgroundColor: palette.surfaceStrong,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + spacing.xs,
    gap: 2,
  },
  episodeDisabled: {
    opacity: 0.45,
  },
  episodeTitle: {
    color: palette.foreground,
    fontSize: typography.body,
    fontWeight: "600",
  },
  episodeMeta: {
    color: palette.muted,
    fontSize: typography.caption,
  },
});
