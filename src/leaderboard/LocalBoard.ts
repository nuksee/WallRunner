import type { RunResult } from '../rules/Rules';
import type { BoardEntry, Leaderboard, SubmitOutcome } from './Leaderboard';
import { nicknameProblem } from './nickname';
import { sanityProblem } from './sanity';

const KEY = 'wallrunner.localBoard';
const KEEP = 50;

interface Row {
  playerId: string;
  nickname: string;
  score: number;
  distance: number;
}

/** On-device stand-in for the global board, used until a backend is configured (and in dev). */
export class LocalBoard implements Leaderboard {
  readonly live = false;

  async submit(playerId: string, nickname: string, r: RunResult): Promise<SubmitOutcome> {
    const problem = nicknameProblem(nickname) ?? sanityProblem(r);
    if (problem) return { accepted: false, reason: problem };
    const rows = load();
    const mine = rows.find((row) => row.playerId === playerId);
    if (mine) {
      mine.nickname = nickname.trim();
      if (r.score > mine.score) Object.assign(mine, { score: r.score, distance: r.distance });
    } else {
      rows.push({ playerId, nickname: nickname.trim(), score: r.score, distance: r.distance });
    }
    rows.sort((a, b) => b.score - a.score);
    save(rows.slice(0, KEEP));
    const me = rows.findIndex((row) => row.playerId === playerId);
    return { accepted: true, rank: me + 1, best: rows[me].score };
  }

  async top(limit: number, playerId: string): Promise<BoardEntry[]> {
    return load()
      .slice(0, limit)
      .map((row, i) => ({ rank: i + 1, me: row.playerId === playerId, nickname: row.nickname, score: row.score, distance: row.distance }));
  }
}

function load(): Row[] {
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function save(rows: Row[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows));
  } catch {
    // Storage blocked: the board lasts for this visit only.
  }
}
