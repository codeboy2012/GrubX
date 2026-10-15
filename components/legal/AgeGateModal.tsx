"use client";

import { ShieldAlert } from "lucide-react";

export function AgeGateModal({
  onConfirm13Plus,
  onUnder13,
}: {
  onConfirm13Plus: () => void;
  onUnder13: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[1200] grid place-items-center bg-black/82 px-4 py-[calc(1rem+env(safe-area-inset-top))] text-white backdrop-blur-xl">
      <section className="liquid-glass w-full max-w-xl rounded-[1.25rem] p-5 shadow-2xl md:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent)]">
            <ShieldAlert className="size-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">Before you continue</p>
            <h2 className="mt-3 text-3xl font-bold">Before you continue</h2>
          </div>
        </div>
        <p className="mt-5 text-sm leading-7 text-[var(--muted)]">
          GrubX uses third-party providers for playback. These providers may show popups, adult ads, dating ads,
          drug-related ads, redirects, or other unsafe content that GrubX does not control.
        </p>
        <p className="mt-5 text-base font-semibold text-white">Are you 13 or older?</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onConfirm13Plus}
            className="min-h-12 rounded-full bg-white px-5 text-sm font-bold text-black transition active:scale-[0.98]"
          >
            Yes, I am 13 or older
          </button>
          <button
            type="button"
            onClick={onUnder13}
            className="min-h-12 rounded-full border border-white/12 bg-white/8 px-5 text-sm font-semibold text-white transition active:scale-[0.98]"
          >
            No, I am under 13
          </button>
        </div>
      </section>
    </div>
  );
}
