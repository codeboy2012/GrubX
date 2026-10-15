import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { api } from "@/lib/api";
import { mangaPageUrl } from "@/lib/urls";
import { library, type Progress } from "@/lib/storage";
import { palette, spacing, typography } from "@/theme";
import { EmptyState } from "@/components/Feedback";

/**
 * Distraction-free manga reader for phones, tablets, TV, and the web export.
 *
 * Pages come from MangaDex's own CDN (`/at-home` payload passed through the
 * GrubX API); data-saver files are preferred, matching the web reader.
 * Reading progress per chapter is stored locally and restored on return.
 */
export default function MangaReaderScreen() {
  const params = useLocalSearchParams<{ id?: string; chapterId?: string }>();
  const router = useRouter();
  const mangaId = String(params.id ?? "");
  const chapterId = String(params.chapterId ?? "");

  const scrollRef = useRef<ScrollView>(null);
  const [pages, setPages] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const payload = await api.mangaPages(chapterId);
        if (!alive) {
          return;
        }
        const files = (payload.dataSaver.length > 0 ? payload.dataSaver : payload.data).filter(
          (file) => typeof file === "string" && file.length > 0,
        );
        setPages(files.map((file) => mangaPageUrl(payload.baseUrl, payload.hash, file)));
      } catch (caught) {
        if (alive) {
          setError(caught instanceof Error ? caught.message : "Unable to load this chapter.");
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [chapterId]);

  // Restore the saved reading position for this exact chapter, once pages exist.
  useEffect(() => {
    if (!pages || pages.length === 0) {
      return;
    }
    void (async () => {
      try {
        const history = await library.progress();
        const record = history.find((item) => item.mediaId === mangaId && item.chapterId === chapterId);
        if (record && record.percent > 0 && record.percent < 100) {
          scrollRef.current?.scrollTo({
            y: (record.percent / 100) * (estimatedPageHeight * pages.length),
            animated: false,
          });
        }
      } catch {
        // A failed local read must never block reading; progress starts at 0.
      }
    })();
  }, [chapterId, mangaId, pages]);

  const persist = useCallback(
    async (percent: number) => {
      const record: Progress = {
        mediaId: mangaId,
        mediaType: "manga",
        title: `Chapter ${chapterId.slice(0, 8)}`,
        coverUrl: null,
        season: null,
        chapterId,
        episode: null,
        // Percent-based records use a fixed 0–100 window.
        currentTime: Math.round(percent),
        duration: 100,
        percent: Math.round(percent),
        updatedAt: new Date().toISOString(),
      };
      await library.saveProgress(record);
    },
    [chapterId, mangaId],
  );

  if (error) {
    return <EmptyState title="Chapter unavailable" detail={error} />;
  }

  if (!pages || pages.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={palette.accent} />
        <Text style={styles.hint}>Loading chapter pages…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        scrollEventThrottle={120}
        onScroll={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          const height = Math.max(contentSize.height - layoutMeasurement.height, 1);
          const percent = Math.min(100, Math.max(0, Math.round(((contentOffset.y || 0) / height) * 100)));
          void persist(percent);
        }}
      >
        {pages.map((uri, index) => (
          <View key={`${index}-${uri}`} style={styles.pageFrame}>
            <Image
              source={{ uri }}
              style={styles.pageImage}
              resizeMode="contain"
              onError={() => undefined}
              progressiveRenderingEnabled
            />
          </View>
        ))}
        <Text style={styles.endNote}>End of chapter — {pages.length} pages from MangaDex</Text>
      </ScrollView>
      <Pressable onPress={() => router.back()} style={styles.pageLabel} accessibilityLabel="Close reader">
        <Text style={styles.pageLabelText}>Tap to close reader</Text>
      </Pressable>
    </View>
  );
}

/** Estimated layout height per page, used before remote page images load. */
const estimatedPageHeight = 1_000;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  hint: {
    color: palette.muted,
    fontSize: typography.caption,
  },
  content: {
    gap: spacing.xs,
    paddingBottom: spacing.xl * 3,
  },
  pageFrame: {
    width: "100%",
    minHeight: estimatedPageHeight,
    backgroundColor: palette.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  pageImage: {
    width: "100%",
    height: estimatedPageHeight,
  },
  endNote: {
    color: palette.muted,
    fontSize: typography.caption,
    textAlign: "center",
    padding: spacing.lg,
  },
  pageLabel: {
    position: "absolute",
    bottom: spacing.md,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  pageLabelText: {
    color: palette.foreground,
    fontSize: typography.caption,
  },
});
