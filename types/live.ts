export type LiveMatchScope = "live" | "all-today";

export type LiveSport = {
  id: string;
  name: string;
};

export type LiveTeam = {
  name?: string;
  badge?: string | null;
};

export type LiveSource = {
  source: string;
  id: string;
};

export type LiveStream = {
  streamNo: number;
  source: string;
  embedUrl?: string;
  language?: string;
  hd?: boolean;
};

export type LiveScoreInfo = {
  provider: "ESPN";
  homeScore: string | null;
  awayScore: string | null;
  state: "pre" | "in" | "post";
  detail: string | null;
  shortDetail: string | null;
  lastUpdated: string;
};

export type LiveMatch = {
  id: string;
  title: string;
  category: string;
  date: number;
  poster?: string;
  popular?: boolean;
  teams?: {
    home?: LiveTeam;
    away?: LiveTeam;
  };
  sources: LiveSource[];
  score?: LiveScoreInfo | null;
};

export type RankedLiveSelection = {
  bestSource: LiveSource | null;
  metrics: Array<{
    source: string;
    id: string;
    latencyMs: number | null;
    streamCount: number;
    hdCount: number;
  }>;
};

/**
 * One program entry in a channel's timeline. Timestamps are absolute epoch
 * seconds so guides stay correct across time zones; only rendering converts
 * them to local time.
 */
export type EpgProgram = {
  id: string;
  /** Epoch milliseconds for the program start. */
  startAt: number;
  /** Epoch milliseconds for the program end. */
  endAt: number;
  title: string;
  description?: string | null;
  category?: string | null;
};

/**
 * A channel directory entry. GrubX ships one embedded, agreed-upon public
 * sports schedule (the same streamed.pk feed documented provider); user-added
 * playlists exist as user-playlists/settings and are never bundled.
 */
export type EpgChannel = {
  id: string;
  name: string;
  category: string;
  logoUrl: string | null;
  currentIndex: number;
  programs: EpgProgram[];
};
