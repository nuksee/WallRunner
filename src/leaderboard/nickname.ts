/**
 * Nickname filter (B5 stage one, open question "Nickname abuse"). The server
 * repeats it with its own word list; this copy gives instant feedback.
 */

const BLOCKED = [
  'fuck', 'shit', 'cunt', 'bitch', 'nigg', 'fag', 'rape', 'nazi', 'hitler', 'whore', 'slut', 'dick',
  'cock', 'pussy', 'penis', 'vagina', 'porn', 'retard', 'kike', 'spic', 'chink', 'tranny', 'admin',
  'moderator', 'tesla',
];

const SWAPS: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' };

/** Why a nickname is refused, or null if it is fine. */
export function nicknameProblem(raw: string): string | null {
  const name = raw.trim();
  if (name.length < 3 || name.length > 16) return 'Nickname must be 3 to 16 characters';
  if (!/^[A-Za-z0-9_. -]+$/.test(name)) return 'Use letters, numbers, spaces, dots, dashes or underscores';
  const folded = name
    .toLowerCase()
    .replace(/[013457@$]/g, (c) => SWAPS[c])
    .replace(/[^a-z]/g, '');
  if (BLOCKED.some((w) => folded.includes(w))) return 'Please pick a different nickname';
  return null;
}
