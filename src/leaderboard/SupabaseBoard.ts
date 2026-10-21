import type { RunResult } from '../rules/Rules';
import type { BoardEntry, Leaderboard, SubmitOutcome } from './Leaderboard';

const TIMEOUT_MS = 8000;

/**
 * The live global board (B4). Calls the two Postgres functions in
 * supabase/leaderboard.sql through Supabase's REST endpoint with the public
 * anon key; tables are closed to the browser by row level security.
 */
export class SupabaseBoard implements Leaderboard {
  readonly live = true;

  constructor(
    private readonly url: string,
    private readonly anonKey: string,
  ) {}

  async submit(playerId: string, nickname: string, r: RunResult): Promise<SubmitOutcome> {
    const out = await this.rpc<{ accepted: boolean; reason?: string; rank?: number | null; best?: number }>('submit_score', {
      p_player: playerId,
      p_nickname: nickname,
      p_score: r.score,
      p_distance: r.distance,
      p_duration: Math.round(r.duration * 100) / 100,
      p_cause: r.cause,
      p_seed: r.seed,
      p_wall: r.style.wall,
      p_air: r.style.air,
      p_near_miss: r.style.nearMiss,
    });
    return out.accepted
      ? { accepted: true, rank: out.rank ?? null, best: out.best ?? r.score }
      : { accepted: false, reason: out.reason ?? 'Score was not accepted' };
  }

  async top(limit: number, playerId: string): Promise<BoardEntry[]> {
    const rows = await this.rpc<Array<{ rank: number; me: boolean; nickname: string; score: number; distance: number }>>(
      'top_scores',
      { p_limit: limit, p_player: playerId },
    );
    return rows.map((row) => ({
      rank: Number(row.rank),
      me: row.me,
      nickname: row.nickname,
      score: row.score,
      distance: row.distance,
    }));
  }

  private async rpc<T>(fn: string, body: object): Promise<T> {
    const res = await fetch(`${this.url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: this.anonKey, Authorization: `Bearer ${this.anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Leaderboard ${fn} failed (${res.status})`);
    return (await res.json()) as T;
  }
}
