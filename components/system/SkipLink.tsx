"use client";

import { useI18n } from "@/hooks/useI18n";

/** Keyboard users' first tab stop: jumps the focus into the page content. */
export function SkipLink() {
  const { t } = useI18n();
  return (
    <a href="#main" className="skip-link">
      {t("a11y.skipToContent")}
    </a>
  );
}
