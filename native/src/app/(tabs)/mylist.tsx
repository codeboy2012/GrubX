import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View , Platform } from "react-native";
import { useRouter } from "expo-router";

import { EmptyState } from "@/components/Feedback";
import { library, type Progress, type SavedItem } from "@/lib/storage";
import { palette, radius, spacing, typography } from "@/theme";

/**
 * My List on GrubX native.
 *
 * Local-first by design: saved titles and playback progress live in this
 * device's storage (AsyncStorage), matching the web app's data layer shape.
 * Nothing is synced, and nothing is tied to a single provider by GrubX.
 */
export default function MyListScreen() {
  const router = useRouter();
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    setSaved(await library.list());
    setProgress(await library.progress());
    setLoaded(true);
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await Promise.resolve();
      if (alive) {
        await refresh();
      }
    })();
    return () => {
      alive = false;
    };
  }, [refresh]);

  const remove = async (mediaId: string) => {
    await library.remove(mediaId);
    await refresh();
  };

  if (!loaded) {
    return <EmptyState title="Loading your list" />;
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.heading}>My List</Text>

      <Text style={styles.subheading}>Continue watching</Text>
      {progress.length === 0 ? (
        <EmptyState title="Nothing to resume yet" detail="Start a title and it will appear here." />
      ) : (
        progress.map((item) => (
          <View key={item.mediaId} style={styles.card}>
            <Pressable
              onPress={() =>
                router.push(
                  item.mediaType === "anime"
                    ? `/anime/${item.mediaId}`
                    : `/player/${item.mediaType}/${item.mediaId}`,
                )
              }
              style={styles.cardBody}
            >
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.cardMeta}>
                {item.percent}% · {item.mediaType}
                {item.episode ? ` · EP ${item.episode}` : ""}
              </Text>
            </Pressable>
          </View>
        ))
      )}

      <Text style={styles.subheading}>Saved titles</Text>
      {saved.length === 0 ? (
        <EmptyState title="Your list is empty" detail="Save a movie, show, anime, or manga to add it here." />
      ) : (
        saved.map((item) => (
          <View key={item.mediaId} style={styles.card}>
            <Pressable
              onPress={() =>
                router.push(
                  item.mediaType === "anime"
                    ? `/anime/${item.mediaId}`
                    : item.mediaType === "manga"
                      ? `/manga/${item.mediaId}`
                      : `/player/${item.mediaType}/${item.mediaId}`,
                )
              }
              style={styles.cardBody}
            >
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.cardMeta}>{item.mediaType}</Text>
            </Pressable>
            <Pressable onPress={() => void remove(item.mediaId)} style={styles.remove} accessibilityLabel={`Remove ${item.title}`}>
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: Platform.isTV ? 0 : spacing.lg,
    paddingBottom: spacing.xl * 2,
    gap: spacing.md,
  },
  heading: {
    color: palette.foreground,
    fontSize: typography.hero,
    fontWeight: "800",
    paddingHorizontal: spacing.md,
  },
  subheading: {
    color: palette.accent,
    fontSize: typography.caption,
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.surfaceStrong,
    borderRadius: radius.card,
    overflow: "hidden",
    marginHorizontal: spacing.md,
  },
  cardBody: {
    flex: 1,
    gap: 2,
    padding: spacing.md,
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
  remove: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    backgroundColor: "rgba(255, 106, 106, 0.14)",
  },
  removeText: {
    color: palette.danger,
    fontSize: typography.caption,
    fontWeight: "600",
  },
});
