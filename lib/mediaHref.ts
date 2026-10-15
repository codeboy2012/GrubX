import type { MediaType } from "@/types/media";

/**
 * Builds the correct in-app route for content across movies, TV, anime, and
 * manga. The third argument is the "resume point": an episode for TV, an
 * episode for anime, or a chapter id for manga.
 */
export const mediaHref = (mediaType: MediaType | string, id: string, resume?: number | string | null): string => {
  if (mediaType === "manga") {
    return resume ? `/manga/${id}/${resume}` : `/manga/${id}`;
  }

  if (mediaType === "anime") {
    return resume ? `/anime/${id}/watch?episode=${encodeURIComponent(String(resume))}` : `/anime/${id}`;
  }

  return `/title/${mediaType}/${id}`;
};

/**
 * Poster URL resolver. TMDB posters arrive as a path (e.g. "/abc.jpg") while
 * manga covers and Ani.pm covers arrive as absolute URLs already, so both are
 * handled here.
 */
export const mediaImageUrl = (posterPath: string | null | undefined, width: string): string | null => {
  if (!posterPath) {
    return null;
  }
  if (posterPath.startsWith("http://") || posterPath.startsWith("https://")) {
    return posterPath;
  }
  return `https://image.tmdb.org/t/p/${width}${posterPath}`;
};
