"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, X, Bookmark, BookOpen, Clapperboard, Download as DownloadIcon, Sparkles, Home, MonitorPlay, Search, Settings2, Tv } from "lucide-react";
import { useSettingsContext } from "@/context/SettingsContext";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import type { FeatureToggles } from "@/types/settings";

type NavItem = { href: string; key: "nav.home" | "nav.movies" | "nav.tv" | "nav.anime" | "nav.manga" | "nav.live" | "nav.mylist" | "nav.search" | "nav.settings" | "nav.download"; icon: typeof Home; feature?: keyof FeatureToggles };
const navItems: NavItem[] = [
  { href: "/", key: "nav.home", icon: Home },
  { href: "/movies", key: "nav.movies", icon: Clapperboard, feature: "movies" },
  { href: "/tv", key: "nav.tv", icon: Tv, feature: "tv" },
  { href: "/anime", key: "nav.anime", icon: Sparkles, feature: "anime" },
  { href: "/manga", key: "nav.manga", icon: BookOpen, feature: "manga" },
  { href: "/live", key: "nav.live", icon: MonitorPlay, feature: "live" },
  { href: "/mylist", key: "nav.mylist", icon: Bookmark, feature: "watchlist" },
  { href: "/search", key: "nav.search", icon: Search, feature: "search" },
  { href: "/download", key: "nav.download", icon: DownloadIcon },
  { href: "/settings", key: "nav.settings", icon: Settings2 },
];
const isActivePath = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

export function Navbar() {
  const pathname = usePathname();
  const { settings } = useSettingsContext();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [playerChromeHidden, setPlayerChromeHidden] = useState(false);

  const effectiveNavStyle = settings.navStyle === "auto" ? "top-bar" : settings.navStyle;
  const effectiveMobileStyle = settings.mobileNavStyle === "auto" ? "drawer" : settings.mobileNavStyle;

  const nav = useMemo(() => {
    const order = settings.navItemOrder;
    const rank = (item: NavItem) => {
      const key = item.href === "/" ? "home" : item.href.replace(/^\//, "");
      const index = order.indexOf(key);
      return index === -1 ? order.length : index;
    };
    return navItems
      .filter((item) => !item.feature || settings.featureToggles[item.feature])
      .slice()
      .sort((left, right) => rank(left) - rank(right));
  }, [settings]);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onPop = () => setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("popstate", onPop); };
  }, []);

  // Focus lands in the drawer while it is pinned open (screen readers announce
  // entering, keyboard-only users continue from the first item); when it
  // closes from Escape we return focus to the opener.
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open && effectiveMobileStyle === "drawer") {
      closeRef.current?.focus();
    }
  }, [open, effectiveMobileStyle]);

  useEffect(() => {
    const isPlayerRoute = pathname.startsWith("/player") || pathname.startsWith("/embed");
    const sync = () => setPlayerChromeHidden(isPlayerRoute || document.body.classList.contains("grubx-player-open") || document.documentElement.classList.contains("grubx-player-open"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [pathname]);

  if (playerChromeHidden) return null;
  return (
    <header className="site-navbar fixed inset-x-0 top-0 z-50">
      <div className="liquid-glass border-b border-white/10">
        <div className="page-shell flex h-[var(--nav-height)] items-center gap-3">
          <Link href="/" className="flex items-center gap-2 rounded-full px-2 py-1.5">
            <Image src="/64x64.png" alt="GrubX logo" width={32} height={32} className="rounded-full" />
            <span className="font-semibold">{settings.websiteName}</span>
          </Link>
          <nav className={cn("hidden flex-1 gap-1 overflow-x-auto lg:flex", effectiveNavStyle === "sidebar" && "lg:hidden")} aria-label={t("nav.label")}>
            {nav.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(pathname, item.href);
              return (
                <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("min-h-11 rounded-full px-3 inline-flex items-center gap-2 text-sm", active ? "bg-[var(--accent)] text-black" : "hover:bg-white/10")}>
                  {settings.showNavIcons && <Icon className="size-4" aria-hidden="true" />}
                  {settings.showNavLabels ? t(item.key) : <span className="sr-only">{t(item.key)}</span>}
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            aria-label={t("nav.openMenu")}
            aria-expanded={effectiveMobileStyle === "drawer" ? open : undefined}
            aria-controls="grubx-mobile-drawer"
            onClick={() => setOpen(true)}
            className="min-h-11 min-w-11 rounded-xl border border-white/10 lg:hidden"
          >
            <Menu className="mx-auto size-5" aria-hidden="true" />
          </button>
        </div>
      </div>
      {effectiveMobileStyle === "drawer" && (
        <>
          <div aria-hidden="true" onClick={() => setOpen(false)} className={cn("fixed inset-0 bg-black/60 backdrop-blur-sm transition", open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")} />
          <aside
            id="grubx-mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.drawerLabel")}
            aria-hidden={!open}
            inert={!open}
            className={cn("fixed left-0 top-0 h-full w-[84vw] max-w-sm bg-[#090909] p-4 pt-[calc(env(safe-area-inset-top)+1rem)] transition-transform", open ? "translate-x-0" : "-translate-x-full")}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="font-semibold" id="grubx-drawer-title" tabIndex={-1}>{t("nav.drawerLabel")}</p>
              <button
                type="button"
                ref={closeRef}
                aria-label={t("nav.closeMenu")}
                onClick={() => setOpen(false)}
                className="min-h-11 min-w-11 rounded-xl border border-white/10"
              >
                <X className="mx-auto size-5" aria-hidden="true" />
              </button>
            </div>
            <nav className="space-y-2" aria-label={t("nav.drawerLabel")}>
              {nav.map((item) => {
                const Icon = item.icon;
                const active = isActivePath(pathname, item.href);
                return (
                  <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("min-h-11 rounded-xl px-3 inline-flex w-full items-center gap-3", active ? "bg-white text-black" : "bg-white/5 hover:bg-white/10")}>
                    <Icon className="size-4" aria-hidden="true" />
                    {t(item.key)}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </>
      )}
    </header>
  );
}
