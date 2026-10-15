import { describe, expect, it } from "vitest";

import {
  clearOutbox,
  enqueueOutbox,
  flushOutbox,
  outboxSize,
  OUTBOX_STORAGE_KEY,
  type OutboxItem,
} from "@/lib/account/outbox";
import { memoryKV } from "@/tests/helpers/memoryKv";

const BASE = { enqueuedAt: "2026-01-01T00:00:00Z", payloadAt: "2026-01-01T00:00:00Z" };

describe("sync outbox", () => {
  it("queues failed writes with last-write-wins per target", () => {
    const kv = memoryKV();
    enqueueOutbox({ kind: "progress", key: "movie-1", payload: { currentTime: 10 }, ...BASE, now: BASE.enqueuedAt }, kv);
    enqueueOutbox({ kind: "progress", key: "movie-1", payload: { currentTime: 20 }, ...BASE, now: "2026-01-01T01:00:00Z" }, kv);
    enqueueOutbox({ kind: "libraryAdd", key: "movie-2", payload: { mediaId: "movie-2" }, ...BASE }, kv);

    const raw = JSON.parse(kv.getItem(OUTBOX_STORAGE_KEY) ?? "[]") as OutboxItem[];
    expect(raw).toHaveLength(2);
    const movieOne = raw.find((item) => item.id === "progress:movie-1");
    expect(movieOne?.payload).toEqual({ currentTime: 20 });
  });

  it("flushes in chronological order and clears successes", async () => {
    const kv = memoryKV();
    enqueueOutbox({ kind: "progress", key: "movie-1", payload: { currentTime: 10 }, ...BASE, now: "2026-01-01T00:00:00Z" }, kv);
    enqueueOutbox({ kind: "libraryAdd", key: "movie-2", payload: { mediaId: "movie-2" }, ...BASE, now: "2026-01-01T02:00:00Z" }, kv);

    const flushed: string[] = [];
    const result = await flushOutbox(
      {
        progress: async () => void flushed.push("progress:movie-1"),
        libraryAdd: async () => void flushed.push("libraryAdd:movie-2"),
        libraryRemove: async () => undefined,
        settings: async () => undefined,
      },
      kv,
    );

    expect(result.flushed).toBe(2);
    expect(result.remaining).toBe(0);
    expect(flushed).toEqual(["progress:movie-1", "libraryAdd:movie-2"]);
    expect(outboxSize(kv)).toBe(0);
  });

  it("stops at the first failure and keeps the rest for retry", async () => {
    const kv = memoryKV();
    enqueueOutbox({ kind: "progress", key: "movie-1", payload: {}, ...BASE, now: "2026-01-01T00:00:00Z" }, kv);
    enqueueOutbox({ kind: "libraryAdd", key: "movie-2", payload: {}, ...BASE, now: "2026-01-01T02:00:00Z" }, kv);

    const result = await flushOutbox(
      {
        progress: async () => {
          throw new Error("network down");
        },
        libraryAdd: async () => undefined,
        libraryRemove: async () => undefined,
        settings: async () => undefined,
      },
      kv,
    );

    expect(result.flushed).toBe(0);
    expect(result.remaining).toBe(2);
    expect(outboxSize(kv)).toBe(2);
  });

  it("queues settings changes as a single item and flushes them", async () => {
    const kv = memoryKV();
    enqueueOutbox({ kind: "settings", key: "settings", payload: { locale: "es" }, ...BASE }, kv);
    let received: unknown = null;
    const result = await flushOutbox(
      {
        progress: async () => undefined,
        libraryAdd: async () => undefined,
        libraryRemove: async () => undefined,
        settings: async (input) => {
          received = input;
        },
      },
      kv,
    );
    expect(result.flushed).toBe(1);
    expect(received).toEqual({ locale: "es" });
    expect(outboxSize(kv)).toBe(0);
  });

  it("removes an outbox cleanly and never queues more than the cap", () => {
    const kv = memoryKV();
    for (let index = 0; index < 700; index += 1) {
      enqueueOutbox({ kind: "progress", key: `media-${index}`, payload: {}, ...BASE, now: new Date(Date.parse(BASE.enqueuedAt) + index * 1000).toISOString() }, kv);
    }
    expect(outboxSize(kv)).toBe(500);
    clearOutbox(kv);
    expect(outboxSize(kv)).toBe(0);
  });
});
