"use client";

import Link from "next/link";

import { useSettingsContext } from "@/context/SettingsContext";

export function Footer() {
  const { settings } = useSettingsContext();
  const legalLinks = [
    { href: "/download", label: "Download" },
    { href: "/safety", label: "Safety" },
    { href: "/terms", label: "Terms" },
    { href: "/privacy", label: "Privacy" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <footer className="page-shell pb-10 pt-14 text-sm text-[var(--muted)]">
      <div className="grid gap-4 rounded-[1rem] border border-white/8 bg-white/[0.03] px-5 py-5 md:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em]">Local Queue</p>
          <p className="mt-2 leading-6">{settings.footerText}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em]">Quick Relaunch</p>
          <p className="mt-2 leading-6">The shell stays ready for fast return visits.</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em]">Cinema Mode</p>
          <p className="mt-2 leading-6">{settings.websiteSubtitle}</p>
        </div>
      </div>
      <nav className="mt-5 flex flex-wrap gap-3 rounded-[1rem] border border-white/8 bg-white/[0.03] px-5 py-4">
        {legalLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex min-h-11 items-center rounded-full border border-white/10 bg-black/22 px-4 text-sm font-semibold text-white transition hover:border-white/20"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
