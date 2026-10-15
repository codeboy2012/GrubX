"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type AccountUser = { userId: string; email: string };
export type AccountProfile = { id: string; name: string; isDefault: boolean };

type AccountState = {
  ready: boolean;
  user: AccountUser | null;
  profiles: AccountProfile[];
  activeProfileId: string | null;
  setActiveProfile: (profileId: string) => void;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AccountContext = createContext<AccountState | null>(null);

const PROFILE_STORAGE_KEY = "grubx_active_profile";

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [profiles, setProfiles] = useState<AccountProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/auth/session", { credentials: "same-origin" });
    const body = (await response.json().catch(() => null)) as
      | { user: AccountUser | null; profiles?: AccountProfile[] }
      | null;

    const nextUser = body?.user ?? null;
    setUser(nextUser);
    setProfiles(body?.profiles ?? []);

    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(PROFILE_STORAGE_KEY);
      const usable = (body?.profiles ?? []).find((profile) => profile.id === stored);
      setActiveProfileId(usable?.id ?? body?.profiles?.find((p) => p.isDefault)?.id ?? null);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, deviceLabel: navigator.userAgent.slice(0, 80) }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        return { ok: false, error: body?.error ?? "Unable to sign in right now." };
      }
      await refresh();
      return { ok: true };
    },
    [refresh],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, deviceLabel: navigator.userAgent.slice(0, 80) }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        return { ok: false, error: body?.error ?? "Unable to create the account right now." };
      }
      await refresh();
      return { ok: true };
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    window.localStorage.removeItem(PROFILE_STORAGE_KEY);
    setActiveProfileId(null);
    await refresh();
  }, [refresh]);

  const setActiveProfile = useCallback((profileId: string) => {
    setActiveProfileId(profileId);
    window.localStorage.setItem(PROFILE_STORAGE_KEY, profileId);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      user,
      profiles,
      activeProfileId,
      setActiveProfile,
      signIn,
      register,
      signOut,
      refresh,
    }),
    [ready, user, profiles, activeProfileId, setActiveProfile, signIn, register, signOut, refresh],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export const useAccount = () => {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error("useAccount must be used inside AccountProvider");
  }
  return context;
};
