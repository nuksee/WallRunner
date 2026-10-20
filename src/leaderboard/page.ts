import { createLeaderboard, player } from '.';

/** The leaderboard on its own page (C7 "board loads in game and on its own page"). */

const LIMIT = 100;
const board = createLeaderboard();
const note = document.querySelector('.note')!;
const body = document.querySelector('tbody')!;

note.textContent = board.live ? 'Each player’s best run.' : 'No global board configured: showing scores from this device only.';

try {
  const rows = await board.top(LIMIT, player.id);
  for (const row of rows) {
    const tr = body.insertRow();
    tr.classList.toggle('me', row.me);
    for (const text of [`${row.rank}`, row.nickname, `${row.score}`, `${row.distance} m`]) tr.insertCell().textContent = text;
  }
  if (rows.length === 0) body.insertRow().insertCell().textContent = 'No scores yet.';
} catch {
  note.textContent = 'Couldn’t reach the leaderboard. Try again in a moment.';
  note.classList.add('warn');
}
