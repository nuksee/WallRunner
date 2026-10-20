/**
 * C7 backend (B4). The anon key is public by design: the database only lets
 * it call the leaderboard functions. Leave both empty to use the on-device
 * board. VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY override them at build time.
 */
export const BACKEND = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
};
