"use client";

import { useEffect, useEffectEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { flushSyncOutbox, outboxSize } from "@/lib/account/outbox";
import { registerGrubXEventBridge } from "@/lib/grubx/events";
import { isRtlLocale, resolveLocale } from "@/lib/i18n";
import { useSafeBrowsing } from "@/lib/safeBrowsing";
import { useSettingsContext } from "@/context/SettingsContext";
import { useRouteValidation } from "@/hooks/useRouteValidation";

export function AppBootstrap() {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, settings } = useSettingsContext();

  const notifySafeBrowsingBlock = useEffectEvent((message: string) => {
    toast.warning("Safe browsing blocked a risky action", {
      description: message,
      duration: 3200,
    });
  });

  const notifyRouteIssue = useEffectEvent((issue: { message: string; detail?: string }) => {
    toast.error("Route issue detected", {
      description: issue.detail ? `${issue.message} ${issue.detail}` : issue.message,
      duration: 4200,
    });
  });

  useSafeBrowsing({
    enabled: ready,
    safeMode: settings.safeMode,
    strictness: settings.popupBlockerStrictness,
    onBlock: notifySafeBrowsingBlock,
  });

  useRouteValidation((issue) => {
    if (ready) {
      notifyRouteIssue(issue);
    }
  });

  const registerServiceWorker = useEffectEvent(async () => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (!settings.offlineCaching) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
      return;
    }

    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  });

  // Flush any offline-queued sync writes on boot and whenever the tab becomes
  // visible (cheap retry loop without a background timer).
  useEffect(() => {
    if (!ready) {
      return;
    }

    const tryFlush = () => {
      if (navigator.onLine && outboxSize() > 0) {
        void flushSyncOutbox().catch(() => undefined);
      }
    };

    tryFlush();
    window.addEventListener("online", tryFlush);
    document.addEventListener("visibilitychange", tryFlush);
    return () => {
      window.removeEventListener("online", tryFlush);
      document.removeEventListener("visibilitychange", tryFlush);
    };
  }, [ready]);

  // Localize <html lang/dir> so screen readers and browser features agree
  // with the user's stored locale (or follow the browser under "system").
  useEffect(() => {
    if (!ready) {
      return;
    }
    const root = document.documentElement;
    const candidates = navigator.languages ?? ([navigator.language].filter(Boolean) as string[]);
    const locale = resolveLocale(settings.locale, candidates);
    const nextLang = locale === "system" ? candidates[0] ?? root.lang : locale;
    root.lang = nextLang || "en";
    root.dir = isRtlLocale(root.lang) ? "rtl" : "ltr";
  }, [ready, settings.locale]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    return registerGrubXEventBridge((payload) => {
      if (payload.data.event === "popupToggle") {
        toast.message("Player popup state changed", {
          description: `${payload.provider} reported a popup state update.`,
          duration: 2400,
        });
      }
    });
  }, [ready]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    void registerServiceWorker();
  }, [ready, registerServiceWorker, settings.offlineCaching]);

  useEffect(() => {
    if (!ready || !settings.prefetchRoutes) {
      return;
    }

    ["/", "/movies", "/tv", "/anime", "/manga", "/live", "/search", "/settings"].forEach((href) => router.prefetch(href));
  }, [ready, router, settings.prefetchRoutes]);

  useEffect(() => {
    if (!ready || !settings.autoFocusSearch) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        if (pathname !== "/search") {
          router.push("/search?focus=1");
          return;
        }

        window.dispatchEvent(new Event("grubx:focus-search"));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pathname, ready, router, settings.autoFocusSearch]);

  return null;
}
