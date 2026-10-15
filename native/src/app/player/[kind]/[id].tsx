import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import * as ScreenOrientation from "expo-screen-orientation";

import { api, absoluteUrl } from "@/lib/api";
import { animeEmbedUrl } from "@/lib/urls";
import { library } from "@/lib/storage";
import { palette, spacing, typography } from "@/theme";

/**
 * Full-screen player for GrubX native.
 *
 * Playback always happens inside the provider's own player page — the GrubX
 * embed page (loaded via the same `/api/player/resolve` selection as the web)
 * or Ani.pm's documented embed URL. GrubX never proxies or re-hosts the stream.
 *
 * Watching progress is recorded for movie/TV/anime entries when the player
 * opens, so Continue Watching offers a resume point; live matches are excluded.
 */
export default function PlayerScreen() {
  const params = useLocalSearchParams<{ kind: string; id: string; season?: string; episode?: string; title?: string; lang?: string }>();
  const router = useRouter();
  const kind = params.kind ?? "movie";
  const id = params.id ?? "";
  const season = Number(params.season ?? 1) || 1;
  const episode = Number(params.episode ?? 1) || 1;
  const title = params.title ?? "";
  const lang = params.lang === "dub" ? "dub" : "sub";

  const webRef = useRef<WebView>(null);
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closeFocused, setCloseFocused] = useState(false);

  useEffect(() => {
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => undefined);
    return () => {
      void ScreenOrientation.unlockAsync().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (!id) {
      return;
    }
    void (async () => {
      try {
        if (kind === "movie" || kind === "tv") {
          // Same server-side provider selection as the web app; fall back to the
          // default embed page when the resolver is unreachable.
          const path =
            kind === "movie"
              ? await api.resolveEmbed("movie", String(id))
              : await api.resolveEmbed("tv", String(id), season, episode);
          setSource(path ? absoluteUrl(path) : null);
          if (!path) {
            setSource(
              kind === "movie"
                ? absoluteUrl(`/embed/movie/vidking/${id}`)
                : absoluteUrl(`/embed/tv/vidking/${id}/${season}/${episode}`),
            );
          }
        } else {
          setSource(animeEmbedUrl(Number(id), episode, lang));
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to start playback.");
      }
    })();
  }, [episode, id, kind, lang, season]);

  // Record the resume point when playback starts (movies/series/anime only).
  useEffect(() => {
    if (!id || !title || kind === "live") {
      return;
    }
    const mediaType = kind === "anime" ? "anime" : kind;
    void library.saveProgress({
      mediaId: String(id),
      mediaType: mediaType as "movie" | "tv",
      title,
      coverUrl: null,
      season: kind === "tv" ? season : null,
      episode: kind === "tv" ? episode : kind === "anime" ? episode : null,
      currentTime: 0,
      duration: 1440,
      percent: 0,
      updatedAt: new Date().toISOString(),
    });
  }, [episode, id, kind, season, title]);

  const back = () => router.back();
  // D-pad users need somewhere reliable to rest focus: the exit control gets
  // preferred focus on TV, and Back on the remote also closes the player.

  const content = useMemo(() => {
    if (error) {
      return (
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Playback unavailable</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }
    if (!source) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.accent} />
          <Text style={styles.loadingText}>Starting the player…</Text>
        </View>
      );
    }
    return (
      <WebView
        ref={webRef}
        source={{ uri: source }}
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        onHttpError={(event) => setError(`The player page responded with ${event.nativeEvent.statusCode}.`)}
      />
    );
  }, [error, source]);

  return (
    <View style={styles.screen}>
      {content}
      <Pressable
        focusable
        hasTVPreferredFocus
        onPress={back}
        onFocus={() => setCloseFocused(true)}
        onBlur={() => setCloseFocused(false)}
        style={[styles.back, closeFocused && styles.backFocused]}
        accessibilityLabel="Close player"
      >
        <Text style={styles.backText}>✕ Close</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000",
  },
  centered: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.xl,
  },
  loadingText: {
    color: palette.muted,
    fontSize: typography.caption,
  },
  errorTitle: {
    color: palette.foreground,
    fontSize: typography.body,
    fontWeight: "700",
  },
  errorText: {
    color: palette.muted,
    fontSize: typography.caption,
    textAlign: "center",
  },
  back: {
    position: "absolute",
    top: spacing.lg,
    right: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.lg,
    minWidth: 64,
    minHeight: 44,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  backFocused: {
    backgroundColor: "rgba(0,0,0,0.85)",
    borderWidth: 2,
    borderColor: palette.accent,
  },
  backText: {
    color: palette.foreground,
    fontSize: typography.body,
  },
});
