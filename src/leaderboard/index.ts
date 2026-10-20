import { BACKEND } from '../config/backend';
import type { Leaderboard } from './Leaderboard';
import { LocalBoard } from './LocalBoard';
import { SupabaseBoard } from './SupabaseBoard';

export type { BoardEntry, Leaderboard, SubmitOutcome } from './Leaderboard';
export { nicknameProblem } from './nickname';
export { sanityProblem } from './sanity';

/** The live board when a Supabase project is configured, otherwise the on-device one. */
export function createLeaderboard(): Leaderboard {
  const { supabaseUrl, supabaseAnonKey } = BACKEND;
  return supabaseUrl && supabaseAnonKey ? new SupabaseBoard(supabaseUrl.replace(/\/$/, ''), supabaseAnonKey) : new LocalBoard();
}

const PLAYER_KEY = 'wallrunner.player';
const NICK_KEY = 'wallrunner.nickname';

/** Who this browser is (B5 stage one): a random id plus a chosen nickname. */
export const player = {
  get id(): string {
    let id = read(PLAYER_KEY);
    if (!id) {
      id = uuid();
      write(PLAYER_KEY, id);
    }
    return id;
  },
  get nickname(): string {
    return read(NICK_KEY) ?? '';
  },
  set nickname(name: string) {
    write(NICK_KEY, name.trim());
  },
};

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked: identity lasts for this visit only.
  }
}

/** crypto.randomUUID needs a secure context; a phone on the dev server's LAN address is not one. */
function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
