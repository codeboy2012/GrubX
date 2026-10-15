"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { markAge13Plus } from "@/lib/grubx/consent";

export function SafeExitPage() {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const contactTeam = () => {
    startTransition(async () => {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          category: "report",
          area: "safety",
          priority: "medium",
          title: "Under-13 safe page contact",
          message: "A user reached the under-13 safety page and clicked contact.",
          pageUrl: "/under-13",
        }),
      });

      if (!response.ok) {
        toast.error("Could not send the message right now. Please try again later.");
        return;
      }

      toast.success("Message sent to the GrubX team.");
    });
  };

  const confirm13Plus = () => {
    markAge13Plus();
    toast.success("Age gate updated.");
    router.push("/");
  };

  return (
    <div className="page-shell py-8 md:py-12">
      <section className="rounded-[1.25rem] border border-white/10 bg-white/[0.035] px-5 py-8 md:px-8 md:py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[var(--accent)]">Safe exit</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-none text-white md:text-6xl">
          You were taken to a safer page
        </h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-[var(--muted)]">
          GrubX third-party playback is not available for users under 13 because some providers may show unsafe ads,
          popups, or adult content. This is not a punishment. It is meant to keep you away from content that may not be
          safe for your age.
        </p>
      </section>

      <section className="mt-8 rounded-[1.1rem] border border-white/10 bg-white/[0.03] px-5 py-5 md:px-6 md:py-6">
        <h2 className="text-2xl font-bold text-white">Why this happened</h2>
        <ul className="mt-4 grid gap-3 text-sm leading-7 text-[var(--muted)]">
          <li>Some websites show ads GrubX cannot control.</li>
          <li>Some ads may be adult, drug-related, dating-related, or unsafe.</li>
          <li>You should ask a parent or guardian before using streaming websites.</li>
          <li>You can still leave the site safely.</li>
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/" className="inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-bold text-black">
            Go to Home
          </Link>
          <button
            type="button"
            disabled={isPending}
            onClick={contactTeam}
            className="min-h-11 rounded-full border border-white/10 bg-white/8 px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            Contact GrubX Team
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="min-h-11 rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-5 text-sm font-semibold text-[var(--accent)]"
          >
            I chose the wrong option
          </button>
        </div>
      </section>

      {confirmOpen ? (
        <div className="fixed inset-0 z-[1200] grid place-items-center bg-black/82 px-4 backdrop-blur-xl">
          <section className="liquid-glass w-full max-w-lg rounded-[1.25rem] p-5 shadow-2xl">
            <h2 className="text-2xl font-bold text-white">Only continue if you are actually 13 or older.</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              If you are under 13, please leave this page and ask a parent or guardian.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={confirm13Plus}
                className="min-h-12 rounded-full bg-white px-5 text-sm font-bold text-black"
              >
                I am 13 or older
              </button>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="min-h-12 rounded-full border border-white/12 bg-white/8 px-5 text-sm font-semibold text-white"
              >
                Stay on safe page
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
