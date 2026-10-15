import { ScrollView, StyleSheet, Text, View , Platform } from "react-native";
import { useRouter } from "expo-router";

import { Row } from "@/components/Row";
import { Loading, ErrorState } from "@/components/Feedback";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { catalogueItems, catalogCard } from "@/lib/ui";
import { palette, spacing, typography } from "@/theme";

/**
 * Home on GrubX native.
 *
 * Rows are client-loaded, so one slow provider (TMDB or Ani.pm) can never block
 * the whole screen — failed providers simply render nothing, exactly like the
 * web app's rails.
 */
export default function HomeScreen() {
  const router = useRouter();

  const trending = useAsync((signal) => api.trending(), [], {});
  const anime = useAsync((signal) => api.animeTop("week", 12), [], {});
  const shows = useAsync((signal) => api.list("tv", "popular", 1), [], {});

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>GrubX</Text>
        <Text style={styles.heroText}>Movies, TV, anime, manga, and live flows in one quiet console.</Text>
      </View>

      {trending.loading && anime.loading && shows.loading ? (
        <Loading label="Bringing tonight's picks into view" />
      ) : trending.error && anime.error && shows.error ? (
        <ErrorState title="Rows are unavailable" detail={trending.error} />
      ) : (
        <>
          <Row
            title="Trending Now"
            description="Fresh picks people are opening tonight."
            items={catalogueItems([trending.data]).map(catalogCard)}
            onItemPress={(item) => router.push(`/player/${item.key.split("-")[0]}/${item.key.split("-")[1]}`)}
          />
          {anime.data?.length ? (
            <Row
              title="Trending Anime"
              description="What the Ani.pm catalogue is surfacing this week."
              items={anime.data.map((title) => ({
                key: String(title.anilistId),
                uri: title.posterUrl,
                title: title.title,
                subtitle: title.score ? `★ ${title.score.toFixed(1)}` : null,
                onPress: () => router.push(`/anime/${title.anilistId}`),
              }))}
            />
          ) : null}
          {shows.data ? (
            <Row
              title="Popular TV"
              description="Series worth adding to your queue."
              items={catalogueItems([shows.data]).map(catalogCard)}
              onItemPress={(item) => router.push(`/player/tv/${item.key.split("-")[1]}`)}
            />
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
  hero: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  heroTitle: {
    color: palette.foreground,
    fontSize: typography.hero + 6,
    fontWeight: "800",
  },
  heroText: {
    color: palette.muted,
    fontSize: typography.body,
    lineHeight: typography.body * 1.5,
  },
});
