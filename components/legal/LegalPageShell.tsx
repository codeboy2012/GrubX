import type { ReactNode } from "react";

export function LegalPageShell({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="page-shell py-8 md:py-12">
      <section className="rounded-[1.25rem] border border-white/10 bg-white/[0.035] px-5 py-8 md:px-8 md:py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[var(--accent)]">{eyebrow}</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-none text-white md:text-6xl">{title}</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-[var(--muted)]">{intro}</p>
      </section>
      <div className="mt-8 grid gap-5">{children}</div>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] px-5 py-5 md:px-6 md:py-6">
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-[var(--muted)]">{children}</div>
    </section>
  );
}
