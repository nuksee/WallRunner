import type { BoardEntry, Leaderboard } from '../leaderboard';
import { nicknameProblem, player } from '../leaderboard';
import type { RunResult } from '../rules/Rules';

const SHOWN = 5;

/**
 * Leaderboard box on the results screen (C7 in game): asks for a nickname
 * once, submits each run, then shows the player's rank and the top few.
 */
export class BoardPanel {
  private readonly form: HTMLFormElement;
  private readonly input: HTMLInputElement;
  private readonly status: HTMLElement;
  private readonly list: HTMLOListElement;
  private pending: RunResult | null = null;
  /** Bumped per run so a slow reply for an old run is ignored. */
  private run = 0;

  constructor(
    slot: HTMLElement,
    private readonly board: Leaderboard,
  ) {
    slot.innerHTML = `
      <h3>${board.live ? 'Global leaderboard' : 'Leaderboard (this device)'}</h3>
      <form class="board-name hidden">
        <input maxlength="16" placeholder="Your nickname" autocomplete="nickname" enterkeyhint="send" />
        <button type="submit">Submit</button>
      </form>
      <p class="board-status"></p>
      <ol class="board-list"></ol>
      <div class="board-links"><a href="leaderboard.html" target="_blank" rel="noopener">Full board</a><button type="button" class="board-rename">Change name</button></div>`;
    this.form = slot.querySelector('form')!;
    this.input = this.form.querySelector('input')!;
    this.status = slot.querySelector('.board-status')!;
    this.list = slot.querySelector('.board-list')!;

    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const problem = nicknameProblem(this.input.value);
      if (problem) return this.say(problem, true);
      player.nickname = this.input.value;
      this.input.blur();
      this.form.classList.add('hidden');
      if (this.pending) void this.submit(this.pending, this.run);
    });
    slot.querySelector('.board-rename')!.addEventListener('click', () => this.askName(true));
  }

  /** Called with each run's result. `reason` explains why the run won't be submitted, if so. */
  show(result: RunResult, reason: string | null): void {
    const run = ++this.run;
    this.pending = null;
    this.list.innerHTML = '';
    if (reason) {
      this.say(reason);
      void this.refresh(run);
    } else if (!player.nickname) {
      this.pending = result;
      this.askName();
      void this.refresh(run);
    } else {
      void this.submit(result, run);
    }
  }

  /** Focus only on request: a focused field would swallow Space (restart) or pop up a phone keyboard. */
  private askName(focus = false): void {
    this.form.classList.remove('hidden');
    this.input.value = player.nickname;
    this.say(this.pending ? 'Pick a nickname to post your score' : 'Your next run posts with the new name');
    if (focus) this.input.focus();
  }

  private async submit(result: RunResult, run: number): Promise<void> {
    this.pending = null;
    this.say('Posting score…');
    try {
      const out = await this.board.submit(player.id, player.nickname, result);
      if (run !== this.run) return;
      if (out.accepted) {
        this.say(out.rank ? `You're #${out.rank}${out.best > result.score ? ` with your best of ${out.best}` : ''}` : 'Score posted');
      } else {
        this.say(out.reason, true);
        if (/nickname/i.test(out.reason)) {
          this.pending = result;
          this.askName();
          this.say(out.reason, true);
        }
      }
    } catch {
      if (run === this.run) this.say("Couldn't reach the leaderboard", true);
    }
    await this.refresh(run);
  }

  private async refresh(run: number): Promise<void> {
    let rows: BoardEntry[];
    try {
      rows = await this.board.top(SHOWN, player.id);
    } catch {
      return;
    }
    if (run !== this.run) return;
    this.list.innerHTML = '';
    for (const row of rows) {
      const li = document.createElement('li');
      li.classList.toggle('me', row.me);
      li.innerHTML = `<span class="rank"></span><span class="name"></span><b></b>`;
      li.querySelector('.rank')!.textContent = `${row.rank}`;
      li.querySelector('.name')!.textContent = row.nickname;
      li.querySelector('b')!.textContent = `${row.score}`;
      this.list.appendChild(li);
    }
    if (rows.length === 0) this.list.innerHTML = '<li class="empty">No scores yet</li>';
  }

  private say(text: string, warn = false): void {
    this.status.textContent = text;
    this.status.classList.toggle('warn', warn);
  }
}
