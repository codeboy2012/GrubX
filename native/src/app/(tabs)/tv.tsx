import { ScrollView, StyleSheet, Text , Platform } from "react-native";
import { useRouter } from "expo-router";

import { Row } from "@/components/Row";
import { Loading, ErrorState } from "@/components/Feedback";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { catalogueItems, catalogCard } from "@/lib/ui";
import { palette, spacing, typography } from "@/theme";

/**
 * TV on GrubX native — same `/api/tmdb` seam as Movies, provider art unmodified.
 */
export default function TvScreen() {
  const router = useRouter();

  const popular = useAsync((signal) => api.list("tv", "popular", 1), [], {});
  const topRated = useAsync((signal) => api.list("tv", "top_rated", 1), [], {});

  if (popular.loading || topRated.loading) {
    return <Loading label="Loading TV shows" />;
  }

  if (popular.error && topRated.error) {
    return <ErrorState title="The catalog is unavailable" detail={popular.error} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.heading}>TV Shows</Text>
      <Row
        title="Popular Shows"
        description="Series worth adding to your queue."
        items={catalogueItems([popular.data]).map(catalogCard)}
        onItemPress={(item) => router.push(`/player/tv/${item.key.split("-")[1]}`)}
      />
      <Row
        title="Top Rated"
        description="Critically acclaimed series with staying power."
        items={catalogueItems([topRated.data]).map(catalogCard)}
        onItemPress={(item) => router.push(`/player/tv/${item.key.split("-")[1]}`)}
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
