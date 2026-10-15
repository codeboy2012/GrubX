"use client";

import { useMemo } from "react";

import { useSettingsContext } from "@/context/SettingsContext";
import {
  createTranslator,
  isRtlLocale,
  resolveLocale,
  type LocaleCode,
  type Translate,
} from "@/lib/i18n";

export type I18n = {
  locale: LocaleCode;
  dir: "ltr" | "rtl";
  t: Translate;
};

/**
 * Locale hook for client components. Resolves the stored preference ("system"
 * follows the browser languages), falls back to English, and exposes the
 * direction so RTL languages render correctly wherever they apply.
 */
export const useI18n = (): I18n => {
  const { settings } = useSettingsContext();

  return useMemo(() => {
    const candidates =
      typeof navigator !== "undefined" ? (navigator.languages ?? [navigator.language]) : [];
    const locale = resolveLocale(settings.locale, candidates);
    return {
      locale,
      dir: isRtlLocale(locale) ? "rtl" : "ltr",
      t: createTranslator(locale),
    };
  }, [settings.locale]);
};
