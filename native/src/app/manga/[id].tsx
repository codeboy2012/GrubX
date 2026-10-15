import React, { useState } from "react";
import { Image , Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Loading, ErrorState, EmptyState } from "@/components/Feedback";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { library } from "@/lib/storage";
import { externalSourcesUrl } from "@/lib/urls";
import { palette, radius, spacing, typography } from "@/theme";

/** Manga detail — MangaDex entry with its available chapter list. */
export default function MangaDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const id = String(params.id ?? "");
  const [saved, setSaved] = useState(false);

  const details = useAsync((signal) => api.mangaDetails(id), [id], {});
  const chapters = useAsync((signal) => api.mangaChapters(id, "en"), [id], {});

  if (details.loading) {
    return <Loading label="Loading manga" />;
  }
  if (details.error) {
    return <ErrorState title="Manga is unavailable" detail={details.error} />;
  }
  if (!details.data) {
    return <EmptyState title="Title not found" />;
  }

  const data = details.data;
  const chapterList = chapters.data ?? [];

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        {data.coverUrl ? <Image style={styles.cover} source={{ uri: data.coverUrl }} resizeMode="cover" /> : null}
        <View style={styles.headerBody}>
          <Text style={styles.title}>{data.title}</Text>
          <Text style={styles.meta}>
            {[data.status, data.year ? String(data.year) : null, data.authorName].filter(Boolean).join(" · ")}
          </Text>
          {chapterList.length > 0 ? (
            <Text style={styles.meta}>
              {chapterList.length} chapter{chapterList.length === 1 ? "" : "s"} in English
            </Text>
          ) : null}
          {data.description ? <Text style={styles.synopsis}>{data.description}</Text> : null}

          <Pressable
            onPress={async () => {
              const next = await library.toggle({
                mediaId: data.id,
                mediaType: "manga",
                title: data.title,
                coverUrl: data.coverUrl,
                rating: null,
              });
              setSaved(next);
            }}
            style={styles.saveButton}
          >
            <Text style={styles.saveText}>{saved ? "Added — in My List" : "Add to My List"}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.chapters}>
        {chapters.loading ? (
          <Loading label="Loading chapters" />
        ) : chapters.error ? (
          <ErrorState title="Chapters unavailable" detail={chapters.error} />
        ) : chapterList.length === 0 ? (
          <EmptyState
            title="No English chapters yet"
            detail="MangaDex has not published local-language chapters for this title. Nothing is substituted."
          />
        ) : (
          chapterList.map((chapter) => (
            <Pressable
              key={chapter.id}
              onPress={() => router.push(`/mangareader/${id}/${chapter.id}?pages=${chapter.pages}`)}
              style={styles.chapter}
            >
              <Text style={styles.chapterTitle} numberOfLines={1}>
                {chapter.title ? `${chapter.title}` : ""}
                {chapter.volume ? `Vol. ${chapter.volume} ` : ""}
                {chapter.chapter ? `Ch. ${chapter.chapter}` : ""}
              </Text>
              <Text style={styles.chapterMeta}>{chapter.pages} pages</Text>
            </Pressable>
          ))
        )}
      </View>

      <Text style={styles.attribution}>
        Catalogue and pages by MangaDex. Pages are loaded from MangaDex&apos;s own CDN and never re-hosted by GrubX.
      </Text>
      <Text style={styles.attribution}>
        More manga sources: Toonkotsu is available as an external reading destination only — it publishes no API that
        GrubX is permitted to use, so its catalogue is not integrated here. {externalSourcesUrl()}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingBottom: spacing.xl * 2,
  },
  header: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
  },
  cover: {
    width: 120,
    aspectRatio: 2 / 3,
    borderRadius: radius.poster,
    backgroundColor: palette.surfaceStrong,
  },
  headerBody: {
    flex: 1,
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
  chapters: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  chapter: {
    backgroundColor: palette.surfaceStrong,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + spacing.xs,
    gap: 2,
  },
  chapterTitle: {
    color: palette.foreground,
    fontSize: typography.body,
    fontWeight: "600",
  },
  chapterMeta: {
    color: palette.muted,
    fontSize: typography.caption,
  },
  attribution: {
    color: palette.muted,
    fontSize: typography.caption,
    lineHeight: typography.caption * 1.5,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
});
