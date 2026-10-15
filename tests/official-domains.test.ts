import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  DOWNLOADABLE_ARTIFACTS,
  INTENDED_OFFICIAL_DOMAINS,
  OFFICIAL_RELEASES_URL,
  OFFICIAL_REPO_URL,
} from "@/lib/officialDomains";
import { MESSAGES } from "@/lib/i18n";

const read = (relative: string) => readFileSync(join(__dirname, "..", relative), "utf8");

describe("official distribution trust anchors", () => {
  it("points downloads exclusively at the official repository", () => {
    expect(OFFICIAL_REPO_URL).toBe("https://github.com/CodeBoy2012/GrubX");
    expect(OFFICIAL_RELEASES_URL).toBe(`${OFFICIAL_REPO_URL}/releases`);
  });

  it("never lists a third-party APK/IPA mirror as an official source", () => {
    const domains = JSON.stringify(INTENDED_OFFICIAL_DOMAINS).toLowerCase();
    const preview = JSON.stringify(DOWNLOADABLE_ARTIFACTS).toLowerCase();
    for (const text of [domains, preview]) {
      expect(text).not.toMatch(/apkpure|apkcombo|appmirror|uptodown|iosninja|tweakbox|appvalley/);
    }
  });

  it("records the intended domains without claiming they are operational", () => {
    expect(INTENDED_OFFICIAL_DOMAINS.map((domain) => domain.url)).toEqual([
      "https://grubx.dpdns.org",
      "https://mobile.grubx.dpdns.org",
      "https://grubx.xx.kg",
      "https://mobile.grubx.xx.kg",
    ]);
    for (const domain of INTENDED_OFFICIAL_DOMAINS) {
      expect(domain.status).not.toBe("operational-verified");
    }
  });

  it("renders the security notice on the download page", () => {
    const page = read("app/(routes)/download/page.tsx");
    expect(page).toContain("SecurityNotice");
    expect(page).toContain("user-controlled signing and installation method");
    expect(page).toContain("never renames an Android APK");
  });

  it("stamps every generated release-notes scaffold with the official-source warning", () => {
    const scaffold = read("scripts/collect-release-artifacts.sh");
    expect(scaffold).toContain("https://github.com/CodeBoy2012/GrubX");
    expect(scaffold).toContain("avoid downloading GrubX APKs, IPAs, or other installers from unofficial websites");
    expect(scaffold).toContain("similar-looking domains do not establish authenticity");
  });

  it("is navigable in every translated locale", () => {
    for (const locale of Object.keys(MESSAGES)) {
      const dictionary = MESSAGES[locale as keyof typeof MESSAGES] as Record<string, string>;
      expect(dictionary["nav.download"], `${locale} nav.download`).toBeTruthy();
    }
  });
});
