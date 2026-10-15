"use client";

import { useState } from "react";
import { LogIn, LogOut, RefreshCw, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { useAccount } from "@/context/AccountContext";

/**
 * Account section in Settings: sign-in / registration / logout, family
 * profiles, and sync status. Loading, error, and empty states are explicit
 * rather than silent.
 */
export function AccountPanel() {
  const { ready, user, profiles, activeProfileId, setActiveProfile, signIn, register, signOut } = useAccount();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");

  if (!ready) {
    return (
      <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] px-5 py-4">
        <p className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <RefreshCw className="size-4 animate-spin" /> Checking your session…
        </p>
      </div>
    );
  }

  if (!user) {
    const submit = async (event: React.FormEvent) => {
      event.preventDefault();
      setBusy(true);
      const result = mode === "signin" ? await signIn(email, password) : await register(email, password);
      setBusy(false);
      if (result.ok) {
        toast.success(mode === "signin" ? "Signed in." : "Account created. Sync is now active.");
        setPassword("");
      } else {
        toast.error(result.error ?? "Something went wrong.");
      }
    };

    return (
      <form onSubmit={submit} className="space-y-3 rounded-[1.2rem] border border-white/10 bg-white/[0.03] px-5 py-4">
        <p className="text-sm font-semibold text-white">Sign in to sync across devices</p>
        <p className="text-xs text-[var(--muted)]">
          Watchlists, playback positions, and preferences follow your account between the website and the apps.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`rounded-full px-4 py-2 text-xs font-semibold ${mode === "signin" ? "bg-white text-black" : "border border-white/10 text-[var(--muted)]"}`}
          >
            <LogIn className="mr-1 inline size-3" /> Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`rounded-full px-4 py-2 text-xs font-semibold ${mode === "register" ? "bg-white text-black" : "border border-white/10 text-[var(--muted)]"}`}
          >
            <UserPlus className="mr-1 inline size-3" /> Create account
          </button>
        </div>
        <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            className="mt-1.5 min-h-11 w-full rounded-xl border border-white/10 bg-black/45 px-3 text-sm normal-case tracking-normal text-white"
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          Password {mode === "register" ? "(10+ characters)" : ""}
          <input
            type="password"
            required
            minLength={mode === "register" ? 10 : 1}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            className="mt-1.5 min-h-11 w-full rounded-xl border border-white/10 bg-black/45 px-3 text-sm normal-case tracking-normal text-white"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 w-full rounded-full bg-white px-5 text-sm font-bold text-black disabled:opacity-50"
        >
          {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>
    );
  }

  const createProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await fetch("/api/sync/profiles", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newProfileName }),
    });
    if (response.ok) {
      setNewProfileName("");
      toast.success("Profile created.");
      window.location.reload();
    } else {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(body?.error ?? "Unable to create the profile.");
    }
  };

  const deleteProfile = async (profileId: string) => {
    const response = await fetch("/api/sync/profiles", {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId }),
    });
    if (response.ok) {
      toast.success("Profile removed.");
      window.location.reload();
    } else {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(body?.error ?? "Unable to remove the profile.");
    }
  };

  return (
    <div className="space-y-4 rounded-[1.2rem] border border-white/10 bg-white/[0.03] px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{user.email}</p>
          <p className="text-xs text-[var(--muted)]">Sync is on — this device follows your account.</p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 text-xs font-semibold text-white"
        >
          <LogOut className="size-3.5" /> Sign out
        </button>
      </div>

      <div className="space-y-2">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          <Users className="size-3.5" /> Profiles
        </p>
        {profiles.map((profile) => (
          <button
            key={profile.id}
            type="button"
            onClick={() => setActiveProfile(profile.id)}
            className={`flex min-h-11 w-full items-center justify-between rounded-xl border px-4 text-left text-sm ${
              profile.id === activeProfileId
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-white"
                : "border-white/10 bg-white/[0.04] text-[var(--muted)]"
            }`}
          >
            <span>{profile.name}</span>
            {profile.isDefault ? (
              <span className="text-xs">Main</span>
            ) : (
              <span
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  void deleteProfile(profile.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.stopPropagation();
                    void deleteProfile(profile.id);
                  }
                }}
                className="text-xs underline underline-offset-2 hover:text-white"
              >
                Remove
              </span>
            )}
          </button>
        ))}
      </div>

      {profiles.length < 5 ? (
        <form onSubmit={createProfile} className="flex gap-2">
          <input
            value={newProfileName}
            onChange={(event) => setNewProfileName(event.target.value)}
            maxLength={40}
            required
            placeholder="New profile name"
            className="min-h-11 flex-1 rounded-xl border border-white/10 bg-black/45 px-3 text-sm text-white"
          />
          <button type="submit" className="min-h-11 rounded-full bg-white px-4 text-xs font-bold text-black">
            Add profile
          </button>
        </form>
      ) : null}
    </div>
  );
}
