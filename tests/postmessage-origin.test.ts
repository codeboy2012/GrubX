import { describe, expect, it } from "vitest";

import { isAllowedGrubxEventOrigin } from "@/lib/grubx/events";

/**
 * Pins the postMessage policy of lib/grubx/events.ts: only HTTPS origins owned
 * by the configured providers (or the anime embed host) may dispatch playback
 * events. Every origin that is not on the trusted registrable-domain list must
 * be dropped, including null (sandboxed/popup pages) and localhost setups that
 * don't match on purpose.
 */
describe("grubx postMessage origin allowlist", () => {
  it("accepts provider origins including subdomains", () => {
    expect(isAllowedGrubxEventOrigin("https://www.vidking.net")).toBe(true);
    expect(isAllowedGrubxEventOrigin("https://vidking.net")).toBe(true);
    expect(isAllowedGrubxEventOrigin("https://dash.vidking.net")).toBe(true);
    expect(isAllowedGrubxEventOrigin("https://ani.pm")).toBe(true);
    expect(isAllowedGrubxEventOrigin("https://vidfast.pro")).toBe(true);
  });

  it("accepts localhost development origins for local embeds", () => {
    expect(isAllowedGrubxEventOrigin("http://localhost:9000")).toBe(true);
    expect(isAllowedGrubxEventOrigin("http://127.0.0.1:3000")).toBe(true);
  });

  it("accepts user-configured provider domains through extraDomains", () => {
    expect(isAllowedGrubxEventOrigin("https://my-provider.example", ["my-provider.example"])).toBe(true);
  });

  it("rejects lookalike and unrelated origins", () => {
    expect(isAllowedGrubxEventOrigin("https://evil-vidking.net")).toBe(false);
    expect(isAllowedGrubxEventOrigin("https://vidking.net.attacker.dev")).toBe(false);
    expect(isAllowedGrubxEventOrigin("https://example.com")).toBe(false);
  });

  it("rejects null origins (sandboxed frames, data: popups)", () => {
    expect(isAllowedGrubxEventOrigin("null")).toBe(false);
    expect(isAllowedGrubxEventOrigin("")).toBe(false);
  });

  it("rejects non-https non-local schemes", () => {
    expect(isAllowedGrubxEventOrigin("file:///etc/passwd")).toBe(false);
    expect(isAllowedGrubxEventOrigin("data:text/html,hi")).toBe(false);
  });

  it("rejects malformed origins without throwing", () => {
    expect(isAllowedGrubxEventOrigin("not a url")).toBe(false);
  });
});
