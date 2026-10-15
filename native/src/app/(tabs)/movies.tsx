import { ScrollView, StyleSheet, Text, Platform } from "react-native";
import { useRouter } from "expo-router";
import React from "react";

import { Row } from "@/components/Row";
import { Loading, ErrorState } from "@/components/Feedback";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { catalogueItems, catalogCard } from "@/lib/ui";
import { palette, spacing, typography } from "@/theme";

/**
 * Movies on GrubX native.
 *
 * Sourced from the same `/api/tmdb` layer as the website; provider artwork is
 * loaded directly from TMDB's image CDN and never mirrored.
 */
export default function MoviesScreen() {
  const router = useRouter();

  const popular = useAsync((signal) => api.list("movie", "popular", 1), [], {});
  const topRated = useAsync((signal) => api.list("movie", "top_rated", 1), [], {});

  if (popular.loading || topRated.loading) {
    return <Loading label="Loading movies" />;
  }

  if (popular.error && topRated.error) {
    return <ErrorState title="The catalog is unavailable" detail={popular.error} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.heading}>Movies</Text>
      <Row
        title="Popular Movies"
        description="Big-screen films with momentum."
        items={catalogueItems([popular.data]).map(catalogCard)}
        onItemPress={(item) => router.push(`/player/movie/${item.key.split("-")[1]}`)}
      />
      <Row
        title="Top Rated"
        description="Critic and audience favorites with staying power."
        items={catalogueItems([topRated.data]).map(catalogCard)}
        onItemPress={(item) => router.push(`/player/movie/${item.key.split("-")[1]}`)}
      />
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
});
