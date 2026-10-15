/** Mirrors `formatLiveStart` from the web app's `lib/live/client.ts`. */
export const formatMatchTime = (timestamp: number) => {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return "";
  }
};
