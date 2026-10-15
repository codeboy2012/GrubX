"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, Download, Home, Search, Settings2, Tv } from "lucide-react";

import { useI18n } from "@/hooks/useI18n";
import { useSettingsContext } from "@/context/SettingsContext";
import { cn } from "@/lib/cn";
import type { FeatureToggles } from "@/types/settings";

/**
 * Mobile-first web shell for the dedicated mobile site.
 *
 * Compact top bar (identity + search) and a fixed bottom tab bar with
 * thumb-reachable targets. It renders the same routes as the desktop shell, so
 * page content, the API client, and business logic are shared 1:1.
 */

const isActivePath = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

type TabKey = "nav.home" | "nav.search" | "nav.live" | "nav.mylist" | "nav.download" | "nav.settings";

const tabs: Array<{ href: string; key: TabKey; icon: typeof Home; feature?: keyof FeatureToggles }> = [
  { href: "/", key: "nav.home", icon: Home },
  { href: "/search", key: "nav.search", icon: Search, feature: "search" },
  { href: "/live", key: "nav.live", icon: Tv, feature: "live" },
  { href: "/mylist", key: "nav.mylist", icon: Bookmark, feature: "watchlist" },
  { href: "/download", key: "nav.download", icon: Download },
  { href: "/settings", key: "nav.settings", icon: Settings2 },
];

export function MobileShell({
  children,
  banner,
}: {
  children: React.ReactNode;
  /** Optional status surface (e.g. the offline banner) above page content. */
  banner?: React.ReactNode;
}) {
  const pathname = usePathname();
  const { settings } = useSettingsContext();
  const { t } = useI18n();

  const visibleTabs = tabs.filter((tab) => !tab.feature || settings.featureToggles[tab.feature]);

  // Player pages go full-bleed; the tab bar disappears there just like the
  // desktop navbar does (both honor the `grubx-player-open` route rules).
  const tabBarHidden = pathname.startsWith("/player") || pathname.startsWith("/embed");

  return (
    <div data-mobile-shell="true" className="min-h-screen">
      <header className="site-navbar fixed inset-x-0 top-0 z-50">
        <div className="liquid-glass border-b border-white/10">
          <div className="flex h-[calc(var(--nav-height)-8px)] items-center justify-between pl-4 pr-3">
            <Link
              href="/"
              aria-label="GrubX home"
              className="flex items-center gap-2 rounded-full px-1 py-1.5"
            >
              <Image src="/64x64.png" alt="" width={28} height={28} className="rounded-full" />
              <span className="font-semibold">{settings.websiteName}</span>
            </Link>
            <Link
              href="/search"
              aria-label="Open search"
              className="inline-flex size-10 items-center justify-center rounded-full border border-white/10"
            >
              <Search className="size-5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <div className="app-shell-content pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        {banner}
        <main id="main" tabIndex={-1}>{children}</main>
      </div>

      {!tabBarHidden && (
        <nav
          aria-label={t("nav.label")}
          className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/85 backdrop-blur-xl"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <ul className="grid auto-cols-fr grid-flow-col">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const active = isActivePath(pathname, tab.href);
              return (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-14 flex-col items-center justify-center gap-0.5 py-2 text-[11px]",
                      active ? "text-[var(--accent)]" : "text-white/60",
                    )}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                    {t(tab.key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
