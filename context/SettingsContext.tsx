"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { dataLayer } from "@/lib/dataLayer";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import type { Settings } from "@/types/settings";

type SettingsContextValue = {
  ready: boolean;
  settings: Settings;
  updateSettings(next: Partial<Settings>): Promise<void>;
  saveSettings(next: Partial<Settings>): Promise<void>;
  resetSettings(): Promise<void>;
  clearAllData(): Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const loadedSettings = await dataLayer.loadSettings();
        if (!cancelled) {
          setSettings(loadedSettings);
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }

    const root = document.documentElement;
    root.dataset.theme = settings.uiTheme === "light" ? "light" : settings.amoledMode ? "amoled" : "cinematic-dark";
    root.dataset.grubxTheme = settings.uiTheme;
    root.dataset.cardDensity = settings.compactMode ? "compact" : settings.cardDensity;
    root.dataset.blur = settings.blurStrength;
    root.dataset.largeText = settings.largeText ? "true" : "false";
    root.dataset.audioProfile = settings.audioProfile;
    root.dataset.backgroundStyle = settings.backgroundStyle;
    root.dataset.posterShape = settings.posterShape;
    root.dataset.cardSize = settings.cardSize;
    root.dataset.highContrast = settings.highContrastMode ? "true" : "false";

    root.style.setProperty(
      "--app-blur",
      settings.blurStrength === "soft" ? "10px" : settings.blurStrength === "intense" ? "24px" : "16px",
    );
    const compactSpacing = settings.compactMode || settings.customCardDensity === "compact" || settings.cardDensity === "compact";
    const spaciousSpacing = settings.customCardDensity === "spacious" || settings.rowSpacing === "spacious";
    root.style.setProperty("--card-gap", compactSpacing ? "1rem" : spaciousSpacing ? "2rem" : "1.5rem");
    root.style.setProperty("--content-gap", compactSpacing ? "1.5rem" : spaciousSpacing ? "2.75rem" : "2.1rem");
    root.style.setProperty("--text-scale", settings.textSize === "small" ? "0.95" : settings.textSize === "large" || settings.largeText ? "1.08" : "1");
    root.style.setProperty("--panel-opacity", String(settings.panelOpacity));
    root.style.setProperty("--border-strength", String(settings.borderStrength));
    root.style.setProperty("--shadow-strength", String(settings.shadowStrength));
    root.style.setProperty("--poster-radius", settings.posterShape === "sharp" ? "0.25rem" : settings.posterShape === "extra-rounded" ? "1.3rem" : "0.82rem");
    root.style.setProperty("--card-radius", settings.posterShape === "sharp" ? "0.55rem" : settings.posterShape === "extra-rounded" ? "1.6rem" : "1.05rem");
    root.style.setProperty("--row-card-width", settings.cardSize === "small" ? "166px" : settings.cardSize === "large" ? "226px" : "204px");

    const customAccent = /^#[0-9a-f]{6}$/i.test(settings.accentColor) ? settings.accentColor : "";
    if (customAccent) {
      root.style.setProperty("--accent", customAccent);
      root.style.setProperty("--accent-soft", `${customAccent}2b`);
    } else if (settings.accentTone === "electric") {
      root.style.setProperty("--accent", "#d8e4ff");
      root.style.setProperty("--accent-soft", "rgba(216, 228, 255, 0.16)");
    } else if (settings.accentTone === "aurora") {
      root.style.setProperty("--accent", "#9ee8d2");
      root.style.setProperty("--accent-soft", "rgba(158, 232, 210, 0.16)");
    } else {
      root.style.setProperty("--accent", "#f2b35a");
      root.style.setProperty("--accent-soft", "rgba(242, 179, 90, 0.17)");
    }
  }, [ready, settings]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      ready,
      settings,
      async updateSettings(next) {
        const persisted = await dataLayer.saveSettings({
          ...settings,
          ...next,
        });
        setSettings(persisted);
      },
      async saveSettings(next) {
        // Partial update: only the given keys move, other prefs stay put.
        const persisted = await dataLayer.saveSettings({
          ...settings,
          ...next,
        });
        setSettings(persisted);
      },
      async resetSettings() {
        const persisted = await dataLayer.saveSettings(DEFAULT_SETTINGS);
        setSettings(persisted);
      },
      async clearAllData() {
        const persisted = await dataLayer.clearAllLocalData();
        setSettings(persisted);
      },
    }),
    [ready, settings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettingsContext = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettingsContext must be used inside SettingsProvider.");
  }
  return context;
};
