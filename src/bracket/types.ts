/* ============================================================================
   Data model (BUILD-BLUEPRINT §5). Keep this module pure types — no logic —
   so the render/layout/model code and the data files can both depend on it
   without a cycle. Swapping the JSON in src/data/ + player/court lookups is
   the ONLY change needed to load real 2026 data (URS-31).
============================================================================ */

/** Court tier drives the legend pill / spotlight capsule tint (URS-18). */
export type Tier = "roofed" | "open";

export interface Court {
  id: string;
  name: string;
  tier: Tier;
  capacity?: number;
}

/** A player entry keyed by a stable id used inside the draw JSON (URS-31). */
export interface Player {
  id: string;
  name: string;
  /** ISO 3166-1 alpha-2, lower-case, as flagcdn expects (URS-20). */
  iso: string;
  /** Short code shown on/adjacent to the token and used in feeder labels (URS-9, URS-21). */
  shortCode: string;
  /** 1..32 where seeded (URS-22). Absent = unseeded. */
  seed?: number;
}

/** One set's game count, with an optional tiebreak point count (URS-24). */
export interface SetGames {
  games: [number, number];
  tb?: [number, number] | number;
}

/** A full match score: ordered list of sets as actually played. */
export type SetScore = SetGames[];

export interface Match {
  /** Node id in the skeleton (matches CHILDREN keys / leaf leaves). */
  num: number;
  /** Player ids for LEAF matches only (outermost rendered round). */
  p1?: string;
  p2?: string;
  /** Present => the match has been played (URS-24). */
  score?: SetScore;
  /** Optional explicit override; normally the winner is derived from score. */
  winner?: string;
  /** -> Court.id (URS-19). */
  courtId?: string;
  /** "2026-07-01" */
  date?: string;
  /** "13:00 UTC+1" (venue-local with explicit offset) or "" for order-of-play only. */
  time?: string;
}

export type DrawId = "gentlemens-singles" | "ladies-singles";

export interface Draw {
  id: DrawId;
  label: string;
  bestOf: 3 | 5;
  /** Final's node id (root of the skeleton). */
  rootNum: number;
  /** Skeleton: match num -> its two child match nums (URS-3). */
  children: Record<number, [number, number]>;
  /** Sparse: every node that needs data lives here (players, score, court, schedule). */
  matches: Match[];
  /** true => 2026 illustrative placeholder data (URS-40, URS-69). */
  placeholder: boolean;
  /** Dataset's own "as of" timestamp, ISO 8601 (URS-30). */
  updatedAt?: string;
}

/** Resolved per-node view used by layout/render (computed by model.ts). */
export interface ResolvedNode {
  num: number;
  /** Player ids of the two slots, null while undecided. */
  participants: [string | null, string | null];
  winner: string | null;
  score?: SetScore;
  courtId?: string;
  date?: string;
  time?: string;
}

export type ResolvedModel = Record<number, ResolvedNode>;

/** "live" | "deck" ("on court next") | "soon" ("today") | "" (BUILD-BLUEPRINT §7, URS-25). */
export type MatchStatus = "live" | "deck" | "soon" | "";
