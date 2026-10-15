"use client";

import { useEffect, useState } from "react";

import { useI18n } from "@/hooks/useI18n";
import { flushSyncOutbox } from "@/lib/account/outbox";

/**
 * Visible offline state for the shell.
 *
 * Shows whenever the browser reports no connectivity, offers an explicit
 * retry, and (on reconnection) flushes any queued progress/watchlist writes.
 * Catalogue playback still requires a network — nothing here implies
 * offline streaming, only offline views for cached data.
 */
export function OfflineBanner() {
  const { t } = useI18n();
  const [offline, setOffline] = useState(false);
  const [justRestored, setJustRestored] = useState(false);

  useEffect(() => {
    const goOffline = () => {
      setJustRestored(false);
      setOffline(true);
    };
    const goOnline = () => {
      setOffline(false);
      setJustRestored(true);
      void flushSyncOutbox();
    };

    setOffline(!navigator.onLine);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  useEffect(() => {
    if (!justRestored) {
      return;
    }
    const timer = window.setTimeout(() => setJustRestored(false), 6000);
    return () => window.clearTimeout(timer);
  }, [justRestored]);

  if (!offline && !justRestored) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[1rem] border border-white/10 bg-[#101014] px-4 py-3 text-sm"
    >
      {offline ? (
        <>
          <p className="text-[var(--muted)]" data-testid="offline-banner-message">
            {t("app.offlineBanner")}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 font-semibold transition hover:border-white/30"
          >
            {t("app.offlineRetry")}
          </button>
        </>
      ) : (
        <p className="text-[var(--success, #8ae7bd)]" data-testid="offline-banner-message">
          {t("app.reconnected")}
        </p>
      )}
    </div>
  );
}
