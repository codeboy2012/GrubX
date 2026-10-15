import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { OFFICIAL_RELEASES_URL, OFFICIAL_REPO_URL } from "@/lib/officialDomains";

/**
 * Official-sources security notice, shared by the download page, install
 * documentation, and release notes. The wording is approved project copy —
 * keep it readable and non-alarmist; do not soften or exaggerate it.
 */
export function SecurityNotice() {
  return (
    <section
      aria-labelledby="official-sources-heading"
      className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-6"
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-1 size-5 shrink-0 text-[var(--accent)]" aria-hidden="true" />
        <h2 id="official-sources-heading" className="text-lg font-semibold">Download GrubX from our official GitHub repository</h2>
      </div>

      <p className="mt-3 text-sm leading-7">
        Official repository:{" "}
        <Link
          href={OFFICIAL_REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 font-semibold transition hover:border-white/30"
        >
          {OFFICIAL_REPO_URL.replace("https://", "")}
        </Link>
      </p>

      <p className="mt-3 text-sm leading-7">
        For your safety, avoid downloading GrubX APKs, IPAs, or other installers from unofficial websites, re-uploads,
        file-sharing links, or accounts claiming to represent GrubX without verification. Unofficial copies may be
        modified, contain malicious code, collect unnecessary information, or compromise your privacy. Websites can also
        collect information about your browser and device; do not assume an unfamiliar mirror is safe.
      </p>

      <p className="mt-3 text-sm leading-7">
        Only treat a domain as an official GrubX service when its ownership and configuration have been verified.
        Similar-looking domain names do not establish authenticity. Release downloads on this page always point at{" "}
        <Link href={OFFICIAL_RELEASES_URL} target="_blank" rel="noreferrer" className="underline decoration-white/30 underline-offset-4">
          the official repository releases
        </Link>
        .
      </p>
    </section>
  );
}
