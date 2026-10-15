import type { Metadata } from "next";
import Link from "next/link";
import { Github, MonitorPlay, Smartphone, TabletSmartphone } from "lucide-react";

import { SecurityNotice } from "@/components/legal/SecurityNotice";
import { INTENDED_OFFICIAL_DOMAINS, OFFICIAL_RELEASES_LATEST_URL, OFFICIAL_RELEASES_URL, OFFICIAL_REPO_URL, OFFICIAL_SECURITY_NOTICE_LAST_VERIFIED } from "@/lib/officialDomains";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Download GrubX",
  description:
    "Official GrubX downloads: Android (phone/tablet), Android TV, and the iOS IPA requirements — with SHA-256 verification steps.",
};

const STATUS_STYLES: Record<string, string> = {
  "not-resolving": "text-[var(--danger, #ff6a6a)]",
  "pending-configuration": "text-[var(--muted)]",
  "operational-verified": "text-[var(--success, #8ae7bd)]",
};

export default function DownloadPage() {
  return (
    <div className="page-shell space-y-6 pb-16 pt-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Get GrubX</h1>
        <p className="text-sm leading-7 text-[var(--muted)]">
          GrubX ships as open source from one place: the official GitHub repository. Installers are published as
          release assets there, with SHA-256 checksums and release notes for every version.
        </p>
        <Link
          href={OFFICIAL_RELEASES_LATEST_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-sm font-bold text-black"
        >
          <Github className="size-4" aria-hidden="true" />
          Open the releases page
        </Link>
      </header>

      <SecurityNotice />

      <section aria-labelledby="platforms-heading" className="space-y-4">
        <h2 id="platforms-heading" className="text-2xl font-semibold">Platforms</h2>

        <article className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 font-semibold"><Smartphone className="size-5" aria-hidden="true" /> Android — phone or tablet</div>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
            Download the release asset named <code>grubx-&lt;version&gt;-android-universal-release.apk</code> and the
            matching <code>SHA256SUMS.txt</code>. Android 8+ requires allowing &ldquo;Install unknown apps&rdquo; for
            your file manager before installing. GrubX is an unsigned developer release; Google Play is not used.
          </p>
        </article>

        <article className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 font-semibold"><MonitorPlay className="size-5" aria-hidden="true" /> Android TV</div>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
            The same universal APK installs on Android TV: it declares the leanback launcher, so it appears in the TV
            home&rsquo;s apps row. No separate TV download is needed. Use a USB sideload or your TV&rsquo;s file manager;
            install from the official repository release only.
          </p>
        </article>

        <article className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 font-semibold"><TabletSmartphone className="size-5" aria-hidden="true" /> iOS / iPadOS (unsigned IPA)</div>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
            An unsigned IPA requires a compatible, user-controlled signing and installation method (a personal Xcode
            install, your own certificate, or your chosen tooling). GrubX provides no certificates and cannot promise a
            direct install; free personal signing profiles also expire on Apple&rsquo;s schedule. If a release has no IPA,
            trust the release notes — GrubX never renames an Android APK into an &ldquo;iOS&rdquo; file.
          </p>
        </article>
      </section>

      <section aria-labelledby="verify-heading" className="space-y-3 rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-5">
        <h2 id="verify-heading" className="text-xl font-semibold">Verify your download</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-7 text-[var(--muted)]">
          <li>Download the installer and <code>SHA256SUMS.txt</code> from the official releases page.</li>
          <li>
            Compute the file hash and compare: on Windows use{" "}
            <code>certutil -hashfile &lt;file&gt; SHA256</code>; on macOS/Linux use <code>sha256sum -c SHA256SUMS.txt</code>.
          </li>
          <li>If a checksum or file size mismatches the release notes, do not install it — report the source instead.</li>
          <li>A GrubX logo, filename, or version banner proves nothing on its own; only the official release assets verified against their checksums count.</li>
        </ol>
      </section>

      <section aria-labelledby="domains-heading" className="space-y-3 rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-5">
        <h2 id="domains-heading" className="text-xl font-semibold">Official domains — status</h2>
        <p className="text-sm leading-7 text-[var(--muted)]">
          Domains listed below are the project&rsquo;s intended official web addresses, recorded honestly as of
          {OFFICIAL_SECURITY_NOTICE_LAST_VERIFIED}. They are <strong>pending deployment by design</strong> — they come
          online via a Cloudflare Tunnel after the Linux server setup, so a missing DNS response is not a failure.
          Similar-looking domains are never official; when unsure, always prefer the GitHub repository.
        </p>
        <ul className="space-y-3 text-sm">
          {INTENDED_OFFICIAL_DOMAINS.map((domain) => (
            <li key={domain.url} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{domain.url}</span>
                <span className={cn("text-xs font-semibold uppercase tracking-wider", STATUS_STYLES[domain.status])}>
                  {domain.status === "not-resolving" ? "not resolving (verify before use)" : "pending deployment"}
                </span>
              </div>
              <p className="mt-1 text-xs leading-6 text-[var(--muted)]">{domain.note}</p>
            </li>
          ))}
        </ul>
      </section>

      <footer className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4 text-xs leading-6 text-[var(--muted)]">
        Source code and releases: <Link href={OFFICIAL_REPO_URL} target="_blank" rel="noreferrer" className="underline underline-offset-4">{OFFICIAL_REPO_URL}</Link>
        {" · "}Release index: <Link href={OFFICIAL_RELEASES_URL} target="_blank" rel="noreferrer" className="underline underline-offset-4">{OFFICIAL_RELEASES_URL.replace("https://", "")}</Link>
      </footer>
    </div>
  );
}
