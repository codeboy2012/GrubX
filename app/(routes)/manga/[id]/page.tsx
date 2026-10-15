import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Layers3, Tag } from "lucide-react";

import { FeatureGate } from "@/components/feedback/FeatureGate";
import { MangaTitleActions } from "@/components/manga/MangaTitleActions";
import { getServerMangaChapters, getServerMangaDetails } from "@/lib/manga/server";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  ongoing: "Ongoing",
  completed: "Completed",
  hiatus: "On hiatus",
  cancelled: "Cancelled",
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const details = await getServerMangaDetails(id);
    if (!details) {
      return { title: "Manga | GrubX" };
    }
    return { title: `${details.title} | GrubX`, description: details.description };
  } catch {
    return { title: "Manga | GrubX" };
  }
}

export default async function MangaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const details = await getServerMangaDetails(id).catch(() => null);
  if (!details) {
    notFound();
  }

  const chapters = await getServerMangaChapters(id, "en").catch(() => []);
  const firstChapter = chapters[0] ? { id: chapters[0].id, chapter: chapters[0].chapter } : null;

  return (
    <FeatureGate feature="manga">
      <div className="pb-14">
        <section className="page-shell grid gap-6 py-8 md:grid-cols-[240px,minmax(0,1fr)] md:gap-8 md:py-12 xl:py-14">
          <div className="mx-auto w-full max-w-[260px] shrink-0 overflow-hidden rounded-[1.15rem] border border-white/10 bg-black/35 p-2.5 md:mx-0">
            <div className="relative aspect-[2/3] overflow-hidden rounded-[0.82rem]">
              <Image
                src={details.coverUrl ?? "/512x512.png"}
                alt={details.title}
                fill
                priority
                sizes="248px"
                className="object-cover"
              />
            </div>
          </div>

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[var(--accent)]">Manga</p>
            <h1 className="mt-4 text-4xl font-bold leading-none text-white sm:text-5xl md:text-6xl">{details.title}</h1>

            <div className="mt-5 flex flex-wrap items-center gap-2 text-sm font-semibold text-white/82">
              {details.status ? (
                <span className="rounded-full border border-white/10 bg-black/42 px-3 py-1.5 backdrop-blur-md">
                  {STATUS_LABELS[details.status] ?? details.status}
                </span>
              ) : null}
              {details.year ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/42 px-3 py-1.5 backdrop-blur-md">
                  <CalendarDays className="size-4" />
                  {details.year}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/42 px-3 py-1.5 backdrop-blur-md">
                <Layers3 className="size-4" />
                {chapters.length} chapter{chapters.length === 1 ? "" : "s"}
              </span>
            </div>

            {details.description ? (
              <p className="mt-6 max-w-3xl text-base font-medium leading-8 text-white/74">{details.description}</p>
            ) : (
              <p className="mt-6 max-w-3xl text-base font-medium leading-8 text-white/60">
                No synopsis is available for this title.
              </p>
            )}

            {details.tags.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {details.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[var(--muted)]"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            ) : null}

            {details.authors.length > 0 || details.artists.length > 0 ? (
              <p className="mt-5 flex items-center gap-2 text-sm text-[var(--muted)]">
                <Tag className="size-4" />
                {[details.authors[0] ? `Story: ${details.authors[0]}` : null, details.artists[0] ? `Art: ${details.artists[0]}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}

            <div className="mt-7">
              <MangaTitleActions manga={details} firstChapter={firstChapter} />
            </div>
          </div>
        </section>

        <section className="page-shell">
          <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.035] px-5 py-5 md:px-6 md:py-6">
            <h2 className="text-2xl font-bold">Chapters</h2>
            {chapters.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--muted)]">
                No English chapters are available for this title right now.
              </p>
            ) : (
              <div className="mt-5 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                {chapters.map((chapter) => (
                  <Link
                    key={chapter.id}
                    href={`/manga/${details.id}/${chapter.id}`}
                    className="flex items-center justify-between gap-3 rounded-[0.9rem] border border-white/8 bg-black/24 px-4 py-3 transition hover:border-white/20"
                  >
                    <span className="min-w-0 truncate text-sm font-semibold text-white">
                      {chapter.chapter ? `Chapter ${chapter.chapter}` : "Oneshot"}
                      {chapter.title ? ` · ${chapter.title}` : ""}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--muted)]">
                      {chapter.pages} pages
                      {chapter.publishAt ? ` · ${new Date(chapter.publishAt).toLocaleDateString()}` : ""}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </FeatureGate>
  );
}
