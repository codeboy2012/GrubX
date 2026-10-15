import { describe, expect, it, vi, beforeEach } from "vitest";

import { createProgressEngine } from "@/lib/grubx/progressEngine";
import {
  FALLBACK_ADAPTER,
  getProviderAdapter,
  validateAndNormalizeMessage,
  vidfastAdapter,
  vidlinkAdapter,
} from "@/lib/grubx/playerAdapters";
import { embedOrigin } from "@/lib/grubx/playerEvents";

const sink = vi.fn();
const baseOptions = {
  context: { provider: "vidfast", mediaType: "movie" as const, mediaId: "533535", season: null, episode: null },
  title: "Example Movie",
  saveIntervalMs: 10_000,
  sink: { save: sink },
};

describe("progress engine", () => {
  beforeEach(() => {
    sink.mockClear();
  });

  it("ignores a zero-duration timeupdate (cannot establish progress)", async () => {
    const engine = createProgressEngine(baseOptions);
    const result = await engine.handle({
      provider: "vidfast",
      event: "timeupdate",
      currentTime: 120,
      duration: 0,
      mediaType: "movie",
      mediaId: "533535",
      season: null,
      episode: null,
    });
    expect(result).toBe("ignored");
    expect(sink).not.toHaveBeenCalled();
  });

  it("ignores impossible positions (currentTime > duration)", async () => {
    const engine = createProgressEngine(baseOptions);
    const result = await engine.handle({
      provider: "vidfast",
      event: "timeupdate",
      currentTime: 900,
      duration: 600,
      mediaType: "movie",
      mediaId: "533535",
      season: null,
      episode: null,
    });
    expect(result).toBe("ignored");
    expect(sink).not.toHaveBeenCalled();
  });

  it("marks a title watched on an explicit ended event, even at 0 duration", async () => {
    const engine = createProgressEngine(baseOptions);
    const result = await engine.handle({
      provider: "vidfast",
      event: "ended",
      currentTime: null,
      duration: 0,
      mediaType: "movie",
      mediaId: "533535",
      season: null,
      episode: null,
    });
    expect(result).toBe("saved");
    expect(sink).toHaveBeenCalled();
    expect((sink.mock.calls[0] as unknown[])[0] ? ((sink.mock.calls[0] as unknown[])[0] as { progress: number }).progress : undefined).toBe(100);
  });

  it("does not falsely claim watched from a single early timeupdate", async () => {
    const engine = createProgressEngine(baseOptions);
    await engine.handle({
      provider: "vidfast",
      event: "timeupdate",
      currentTime: 40,
      duration: 4800,
      mediaType: "movie",
      mediaId: "533535",
      season: null,
      episode: null,
    });
    expect(engine.isCompleted()).toBe(false);
  });

  it("marks watched when the completion threshold is crossed by position", async () => {
    const engine = createProgressEngine(baseOptions);
    const result = await engine.handle({
      provider: "vidfast",
      event: "timeupdate",
      currentTime: 4700,
      duration: 4800, // 97.9% >= 95%
      mediaType: "movie",
      mediaId: "533535",
      season: null,
      episode: null,
    });
    expect(result).toBe("saved");
    expect(engine.isCompleted()).toBe(true);
  });

  it("never persists older progress over newer (monotonic guard)", async () => {
    const engine = createProgressEngine(baseOptions);
    await engine.handle({
      provider: "vidfast",
      event: "timeupdate",
      currentTime: 300,
      duration: 4800,
      mediaType: "movie",
      mediaId: "533535",
      season: null,
      episode: null,
    });
    const result = await engine.handle({
      provider: "vidfast",
      event: "timeupdate",
      currentTime: 120,
      duration: 4800,
      mediaType: "movie",
      mediaId: "533535",
      season: null,
      episode: null,
    });
    expect(result).toBe("saved");
    expect(engine.isCompleted()).toBe(false);
  });

  it("manual correction with a plausible timestamp persists it", async () => {
    const engine = createProgressEngine(baseOptions);
    await engine.correct(2520, 4800);
    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink.mock.calls[0][0].currentTime).toBe(2520);
  });
});

describe("provider adapters", () => {
  it("records command-less providers as such (vidlink, vidrock)", () => {
    expect(vidlinkAdapter.supportsCommands).toBe(false);
    expect(getProviderAdapter("vidrock")?.supportsCommands).toBe(false);
    expect(vidlinkAdapter.buildCommand({ command: "play" })).toBeNull();
  });

  it("vidfast builds a clamped seek command", () => {
    const wire = vidfastAdapter.buildCommand({ command: "seek", time: -20 });
    expect(wire).toEqual({ command: "seek", time: 0 });
  });

  it("fallback adapter trusts no messages and sends no commands", () => {
    expect(FALLBACK_ADAPTER.parseEvent({ type: "PLAYER_EVENT", data: { event: "play" } }, baseOptions.context)).toBeNull();
    expect(FALLBACK_ADAPTER.buildCommand({ command: "play" })).toBeNull();
  });
});

describe("strict message validation", () => {
  const iframe = {
    src: "https://vidfast.vc/movie/533535",
    contentWindow: { postMessage: vi.fn() },
    dataset: {},
  } as unknown as HTMLIFrameElement;

  const payload = (event: string) => ({
    type: "PLAYER_EVENT",
    data: { event, currentTime: 60, duration: 120, mediaType: "movie", tmdbId: "533535" },
  });

  const messageEvent = (data: unknown, origin: string, source: unknown) =>
    ({ data, origin, source } as unknown as MessageEvent);

  it("accepts a valid same-frame, correct-origin message", () => {
    const result = validateAndNormalizeMessage(
      messageEvent(payload("timeupdate"), "https://vidfast.vc", iframe.contentWindow),
      iframe,
      baseOptions.context,
    );
    expect(result?.event).toBe("timeupdate");
    expect(result?.duration).toBe(120);
    expect(result?.provider).toBe("vidfast");
  });

  it("rejects a message from a different window (spoofed source)", () => {
    const result = validateAndNormalizeMessage(
      messageEvent(payload("timeupdate"), "https://vidfast.vc", {}),
      iframe,
      baseOptions.context,
    );
    expect(result).toBeNull();
  });

  it("rejects a message whose origin does not match the iframe URL", () => {
    const result = validateAndNormalizeMessage(
      messageEvent(payload("timeupdate"), "https://evil.example", iframe.contentWindow),
      iframe,
      baseOptions.context,
    );
    expect(result).toBeNull();
  });

  it("rejects an unknown event name", () => {
    const result = validateAndNormalizeMessage(
      messageEvent(payload("autoplayattack"), "https://vidfast.vc", iframe.contentWindow),
      iframe,
      baseOptions.context,
    );
    expect(result).toBeNull();
  });

  it("embedOrigin rejects non-http(s) iframe srcs", () => {
    expect(embedOrigin("javascript:alert(1)")).toBeNull();
    expect(embedOrigin("https://vidfast.vc/x")).toBe("https://vidfast.vc");
  });
});
