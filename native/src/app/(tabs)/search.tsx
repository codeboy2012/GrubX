import { ScrollView, StyleSheet, Text, TextInput, Platform } from "react-native";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";

import { Row, type RowItem } from "@/components/Row";
import { Loading, ErrorState, EmptyState } from "@/components/Feedback";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { palette, spacing, typography } from "@/theme";
import { searchCard } from "@/lib/ui";

type Section = "movies" | "tv" | "anime" | "manga";
const SECTIONS: Section[] = ["movies", "tv", "anime", "manga"];

/** One search across movies, TV (TMDB), anime (Ani.pm), and manga (MangaDex). */
export default function SearchScreen() {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setQuery(raw.trim()), 400);
    return () => clearTimeout(timer);
  }, [raw]);

  const movie = useAsync((signal) => api.search("movie", query, 1), [query], { enabled: query.length > 1 });
  const show = useAsync((signal) => api.search("tv", query, 1), [query], { enabled: query.length > 1 });
  const anime = useAsync((signal) => api.animeSearch(query, 12), [query], { enabled: query.length > 1 });
  const manga = useAsync((signal) => api.mangaList("search", { query, limit: 12 }), [query], { enabled: query.length > 1 });

  const results: Record<Section, RowItem[]> = {
    movies: (movie.data?.results ?? []).map((item) => ({
      ...searchCard(item),
      onPress: () => router.push(`/player/movie/${item.id}`),
    })),
    tv: (show.data?.results ?? []).map((item) => ({
      ...searchCard(item),
      onPress: () => router.push(`/player/tv/${item.id}`),
    })),
    anime: (anime.data?.items ?? []).map((item) => ({
      key: String(item.anilistId),
      uri: item.posterUrl,
      title: item.title,
      subtitle: null,
      onPress: () => router.push(`/anime/${item.anilistId}`),
    })),
    manga: (manga.data?.items ?? []).map((item) => ({
      key: item.id,
      uri: item.coverUrl,
      title: item.title,
      subtitle: null,
      onPress: () => router.push(`/manga/${item.id}`),
    })),
  };

  const anyError = [movie, show, anime, manga].every((q) => q.error);
  const anyLoading = [movie, show, anime, manga].some((q) => q.loading);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.heading}>Search</Text>
      <TextInput
        value={raw}
        onChangeText={setRaw}
        placeholder="Search movies, TV, anime, or manga"
        placeholderTextColor={palette.muted}
        style={styles.input}
        accessibilityLabel="Search GrubX"
        autoCapitalize="none"
      />

      {query.length <= 1 ? (
        <EmptyState title="Search to begin" detail="Type at least two characters." />
      ) : anyLoading ? (
        <Loading label="Searching" />
      ) : anyError ? (
        <ErrorState title="Search failed" detail={movie.error ?? anime.error ?? manga.error} />
      ) : SECTIONS.every((section) => results[section].length === 0) ? (
        <EmptyState title="No results found" detail="Try another phrase or provider." />
      ) : (
        SECTIONS.map((section) => {
          const rows = results[section];
          if (rows.length === 0) {
            return null;
          }
          const label = section === "movies" ? "Movies" : section === "tv" ? "TV Shows" : section === "anime" ? "Anime" : "Manga";
          return <Row key={section} title={label} items={rows} />;
        })
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
  input: {
    marginHorizontal: spacing.md,
    color: palette.foreground,
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + spacing.xs,
    fontSize: typography.body,
  },
});
