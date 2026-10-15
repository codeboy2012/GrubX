import { notFound } from "next/navigation";

import { FeatureGate } from "@/components/feedback/FeatureGate";
import { MangaReader } from "@/components/manga/MangaReader";
import { getServerMangaChapters, getServerMangaDetails } from "@/lib/manga/server";

export const dynamic = "force-dynamic";

export default async function MangaChapterPage({
  params,
}: {
  params: Promise<{ id: string; chapter: string }>;
}) {
  const { id, chapter } = await params;

  const details = await getServerMangaDetails(id).catch(() => null);
  if (!details) {
    notFound();
  }

  const chapters = await getServerMangaChapters(id, "en").catch(() => []);
  const current = chapters.find((entry) => entry.id === chapter);
  if (!current) {
    notFound();
  }

  return (
    <FeatureGate feature="manga">
      <MangaReader
        mangaId={details.id}
        mangaTitle={details.title}
        coverUrl={details.coverUrl}
        chapterId={current.id}
        chapterNumber={current.chapter}
      />
    </FeatureGate>
  );
}
