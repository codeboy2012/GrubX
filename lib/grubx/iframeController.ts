import { embedOrigin } from "@/lib/grubx/playerEvents";
import type { GrubXControlMessage } from "@/types/grubx";

/**
 * iframe control sender.
 *
 * Security: messages are only sent to a target origin derived from the iframe's
 * own src (api-docs.txt §9 — "Avoid using '*' as the target origin"). A send is
 * silently dropped when the iframe is unmounted, cross-origin-unknown, or its
 * src cannot be resolved to an http(s) origin — never sent to "*".
 */
const postControlMessage = (iframe: HTMLIFrameElement | null, message: GrubXControlMessage) => {
  if (!iframe?.contentWindow) {
    return;
  }

  const targetOrigin = embedOrigin(iframe.src);
  if (!targetOrigin) {
    return;
  }

  iframe.contentWindow.postMessage(message, targetOrigin);
};

export const createGrubXIframeController = (getIframe: () => HTMLIFrameElement | null) => ({
  play() {
    postControlMessage(getIframe(), { type: "GRUBX_CONTROL", action: "play" });
  },
  pause() {
    postControlMessage(getIframe(), { type: "GRUBX_CONTROL", action: "pause" });
  },
  seek(time: number) {
    postControlMessage(getIframe(), { type: "GRUBX_CONTROL", action: "seek", time });
  },
  setVolume(value: number) {
    postControlMessage(getIframe(), { type: "GRUBX_CONTROL", action: "setVolume", value });
  },
  mute(muted: boolean) {
    postControlMessage(getIframe(), { type: "GRUBX_CONTROL", action: "mute", muted });
  },
  getStatus() {
    postControlMessage(getIframe(), { type: "GRUBX_CONTROL", action: "getStatus" });
  },
});

export type GrubXIframeController = ReturnType<typeof createGrubXIframeController>;
