import type { RunResult } from '../rules/Rules';

/**
 * C7 Leaderboard: submit, sanity check, top-N, nickname filter (P3, B2, B4,
 * B5). Sees only C5's run result. Two backends share this interface: the
 * live Supabase board, and an on-device board used when none is configured.
 */

export interface BoardEntry {
  rank: number;
  /** This browser's own row. */
  me: boolean;
  nickname: string;
  score: number;
  distance: number;
}

export type SubmitOutcome =
  | { accepted: true; rank: number | null; best: number }
  | { accepted: false; reason: string };

export interface Leaderboard {
  /** True for the shared global board, false for the on-device fallback. */
  readonly live: boolean;
  submit(playerId: string, nickname: string, result: RunResult): Promise<SubmitOutcome>;
  /** Each player's best score, highest first. */
  top(limit: number, playerId: string): Promise<BoardEntry[]>;
}
