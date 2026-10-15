"use client";

import { useEffect, useRef } from "react";

import { createProgressEngine, type ProgressEngine, type ProgressSink } from "@/lib/grubx/progressEngine";
import { validateAndNormalizeMessage } from "@/lib/grubx/playerAdapters";
import type { NormalizedPlayerEvent, PlayableMediaContext } from "@/lib/grubx/playerEvents";

/**
 * Binds a live iframe to the provider adapters + progress engine.
 *
 * Registers the `message` listener inside an effect with stable deps
 * (api-docs.txt §9 "React and Next.js": stable callback, cleanup on unmount),
 * feeds validated events to the progress engine, and flushes on pagehide /
 * unmount so in-flight progress survives navigation.
 */
export const useStrictPlayerBridge = ({
  iframeRef,
  context,
  title,
  sink,
  enabled,
  onEvent,
}: {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  context: PlayableMediaContext;
  title?: string;
  sink: ProgressSink;
  enabled: boolean;
  onEvent?: (event: NormalizedPlayerEvent) => void;
}) => {
  const engineRef = useRef<ProgressEngine | null>(null);
  const contextRef = useRef(context);
  contextRef.current = context;
  const sinkRef = useRef(sink);
  sinkRef.current = sink;
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  // One engine per media key (media id + season/episode).
  const mediaKey = `${context.provider}:${context.mediaId}:${context.season ?? 0}:${context.episode ?? 0}`;
  const mediaKeyRef = useRef(mediaKey);
  if (mediaKeyRef.current !== mediaKey) {
    mediaKeyRef.current = mediaKey;
    engineRef.current = null;
  }

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!engineRef.current) {
      engineRef.current = createProgressEngine({
        context: contextRef.current,
        title,
        sink: { save: (input) => sinkRef.current.save(input) },
      });
    }
    const engine = engineRef.current;

    const handleMessage = (messageEvent: MessageEvent) => {
      const normalized = validateAndNormalizeMessage(messageEvent, iframeRef.current, contextRef.current);
      if (!normalized) {
        return;
      }

      onEventRef.current?.(normalized);
      void engine.handle(normalized);
    };

    window.addEventListener("message", handleMessage);

    const flush = () => void engine.flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
    };
    // title is intentionally excluded: engine is keyed by media, not metadata.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, iframeRef, mediaKey]);

  return {
    engine: engineRef,
  };
};
