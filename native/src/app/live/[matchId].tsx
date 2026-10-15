import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { WebView } from "react-native-webview";

import { Loading, ErrorState, EmptyState } from "@/components/Feedback";
import { api, absoluteUrl } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { palette, radius, spacing, typography } from "@/theme";
import { formatMatchTime } from "@/lib/live";

/**
 * Live stream picker.
 *
 * Sources come from `/api/live/streams`; playback happens in the provider's own
 * player page opened inside a WebView. GrubX never proxies the stream itself.
 */
export default function LiveMatchScreen() {
  const params = useLocalSearchParams<{ matchId?: string; scope?: string }>();
  const router = useRouter();
  const matchId = String(params.matchId ?? "");
  const scope = params.scope === "all-today" ? "all-today" : "live";
  const [selected, setSelected] = useState<string | null>(null);

  const matches = useAsync((signal) => api.liveMatches(scope), [scope], {});
  const match = (matches.data ?? []).find((entry) => entry.id === matchId) ?? null;

  const streams = useAsync((signal) => (match ? api.liveStreams(match.sources[0]) : Promise.resolve([])), [match?.id], {
    enabled: Boolean(match),
  });

  if (matches.loading) {
    return <Loading label="Loading match" />;
  }
  if (matches.error || !match) {
    return <ErrorState title="Match unavailable" detail={matches.error ?? "That match is no longer listed."} />;
  }

  const openStream = (embedUrl?: string) => {
    if (!embedUrl) {
      return;
    }
    setSelected(absoluteUrl(embedUrl));
  };

  if (selected) {
    return (
      <View style={styles.player}>
        <WebView source={{ uri: selected }} allowsFullscreenVideo javaScriptEnabled domStorageEnabled />
        <Pressable onPress={() => setSelected(null)} style={styles.back} accessibilityLabel="Back to stream list">
          <Text style={styles.backText}>✕</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Pressable onPress={() => router.back()} accessibilityLabel="Back to live matches">
        <Text style={styles.backLink}>‹ Live</Text>
      </Pressable>

      <Text style={styles.title}>{match.title}</Text>
      <Text style={styles.meta}>
        {match.category} · {formatMatchTime(match.date)}
      </Text>

      {streams.loading ? (
        <Loading label="Finding streams" />
      ) : streams.error ? (
        <ErrorState title="Streams unavailable" detail={streams.error} />
      ) : (streams.data ?? []).length === 0 ? (
        <EmptyState title="No streams yet" detail="The provider has not published a stream for this match." />
      ) : (
        <View style={styles.list}>
          <Text style={styles.sectionTitle}>Streams</Text>
          {(streams.data ?? []).map((stream) => (
            <Pressable key={`${stream.source}-${stream.streamNo}`} onPress={() => openStream(stream.embedUrl)} style={styles.stream}>
              <Text style={styles.streamTitle}>
                Stream {stream.streamNo} · {stream.source}
                {stream.hd ? " · HD" : ""}
                {stream.language ? ` · ${stream.language}` : ""}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
    gap: spacing.md,
  },
  backLink: {
    color: palette.muted,
    fontSize: typography.caption,
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
  sectionTitle: {
    color: palette.accent,
    fontSize: typography.caption,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  list: {
    gap: spacing.sm,
  },
  stream: {
    backgroundColor: palette.surfaceStrong,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + spacing.xs,
  },
  streamTitle: {
    color: palette.foreground,
    fontSize: typography.body,
  },
  player: {
    flex: 1,
    backgroundColor: "#000",
  },
  back: {
    position: "absolute",
    top: spacing.lg,
    right: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    color: palette.foreground,
    fontSize: typography.body,
  },
});
