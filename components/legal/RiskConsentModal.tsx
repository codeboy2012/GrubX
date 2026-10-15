"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

const consentItems = [
  "I understand third-party providers may show unsafe or NSFW ads.",
  "I understand GrubX does not control third-party provider ads.",
  "I understand I should use a trusted ad blocker.",
  "I am 13 or older.",
];

export function RiskConsentModal({
  onAccept,
  onCancel,
}: {
  onAccept: () => void;
  onCancel: () => void;
}) {
  const [checked, setChecked] = useState<boolean[]>(() => consentItems.map(() => false));
  const allChecked = useMemo(() => checked.every(Boolean), [checked]);

  return (
    <div className="fixed inset-0 z-[1200] grid place-items-center overflow-y-auto bg-black/82 px-4 py-[calc(1rem+env(safe-area-inset-top))] text-white backdrop-blur-xl">
      <section className="liquid-glass my-auto w-full max-w-2xl rounded-[1.25rem] p-5 shadow-2xl md:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full border border-red-300/30 bg-red-500/10 text-red-100">
            <AlertTriangle className="size-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">Third-party playback</p>
            <h2 className="mt-3 text-3xl font-bold">Third-party playback warning</h2>
          </div>
        </div>
        <p className="mt-5 text-sm leading-7 text-[var(--muted)]">
          GrubX may load video from third-party providers. These providers may show popups, adult ads,
          weed/drug-related ads, dating ads, redirects, or unsafe pages. GrubX does not control those ads. We
          recommend using a trusted ad blocker before continuing.
        </p>
        <div className="mt-5 grid gap-3">
          {consentItems.map((item, index) => (
            <label key={item} className="flex min-h-11 items-start gap-3 rounded-[0.9rem] border border-white/10 bg-black/24 px-4 py-3 text-sm text-white">
              <input
                type="checkbox"
                checked={checked[index]}
                onChange={(event) =>
                  setChecked((current) => current.map((value, currentIndex) => (currentIndex === index ? event.target.checked : value)))
                }
                className="mt-1 size-4 accent-[var(--accent)]"
              />
              <span>{item}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
          <Link href="/safety" className="underline decoration-white/30 underline-offset-4 hover:text-white">
            Safety info
          </Link>
          <Link href="/terms" className="underline decoration-white/30 underline-offset-4 hover:text-white">
            Terms
          </Link>
          <Link href="/privacy" className="underline decoration-white/30 underline-offset-4 hover:text-white">
            Privacy
          </Link>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 rounded-full border border-white/12 bg-white/8 px-5 text-sm font-semibold text-white transition active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!allChecked}
            onClick={onAccept}
            className="min-h-12 rounded-full bg-white px-5 text-sm font-bold text-black transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            I understand, continue
          </button>
        </div>
      </section>
    </div>
  );
}
