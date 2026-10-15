"use client";

import Image from "next/image";
import Link from "next/link";
import { BookOpen } from "lucide-react";

import { cn } from "@/lib/cn";
import type { MangaSummary } from "@/types/manga";

const STATUS_LABELS: Record<string, string> = {
  ongoing: "Ongoing",
  completed: "Completed",
  hiatus: "Hiatus",
  cancelled: "Cancelled",
};

export function MangaCard({ manga }: { manga: MangaSummary }) {
  return (
    <article className="group relative flex h-full w-full flex-col transition-transform duration-300 hover:-translate-y-1 active:scale-[0.985]">
      <div className="pointer-events-none absolute -inset-1 rounded-[1.35rem] bg-white/8 opacity-0 blur-xl transition duration-300 group-hover:opacity-100" />
      <Link
        href={`/manga/${manga.id}`}
        className="relative flex h-full flex-col overflow-hidden rounded-[var(--card-radius)] border border-white/8 bg-white/[var(--panel-opacity,0.035)] p-3"
      >
        <div className="relative block aspect-[2/3] w-full overflow-hidden rounded-[var(--poster-radius)] border border-white/8 bg-black">
          {manga.coverUrl ? (
            <Image
              src={manga.coverUrl}
              alt={manga.title}
              fill
              sizes="(max-width: 640px) 180px, (max-width: 1024px) 230px, 260px"
              loading="lazy"
              className="object-cover transition duration-500 group-hover:scale-[1.045]"
            />
          ) : (
            <div className="grid h-full w-full place-items-center bg-white/5 text-[var(--muted)]">
              <BookOpen className="size-8" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/12 to-transparent opacity-90" />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3 text-xs text-[var(--muted)]">
            <span className="rounded-full border border-white/10 bg-black/58 px-2.5 py-1 uppercase tracking-[0.16em] text-white/82 backdrop-blur-md">
              manga
            </span>
            {manga.status ? (
              <span className="rounded-full border border-white/10 bg-black/58 px-2.5 py-1 backdrop-blur-md">
                {STATUS_LABELS[manga.status] ?? manga.status}
              </span>
            ) : null}
          </div>
          <div className="absolute inset-x-0 bottom-0 p-3 opacity-0 transition duration-300 group-hover:opacity-100">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-black shadow-[0_12px_30px_rgba(0,0,0,0.32)]">
              <BookOpen className="size-3.5" />
              Read
            </span>
          </div>
        </div>

        <div className={cn("flex flex-1 flex-col gap-3 px-0.5 pb-0.5 pt-3.5")}>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            {manga.year ? (
              <span className="rounded-full border border-white/10 bg-black/28 px-2.5 py-1">{manga.year}</span>
            ) : null}
            {manga.lastChapter ? (
              <span className="rounded-full border border-white/10 bg-black/28 px-2.5 py-1">Ch. {manga.lastChapter}</span>
            ) : null}
          </div>

          <div className="space-y-2">
            <h3 className="line-clamp-2 text-base font-semibold leading-tight text-white">{manga.title}</h3>
            <p className="line-clamp-3 text-sm leading-5 text-[var(--muted)]">
              {manga.authorName ? `${manga.authorName} · ` : ""}
              {manga.tags.slice(0, 3).map((tag) => tag.name).join(", ") || manga.description || "No synopsis available."}
            </p>
          </div>
        </div>
      </Link>
    </article>
  );
}
