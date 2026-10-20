# Wall Runner

A 2.5D endless-runner prototype for the browser. You drive an original electric hypercar that can fire short thruster hops and drive up walls and across ceilings.

**▶ Play it:** https://nuksee.github.io/WallRunner/

This is Milestone 3: an endless, procedurally generated course with fail states, a draining battery, a style score, and a global leaderboard. Ads are a stub for now. The working title is a placeholder.

**🏆 Leaderboard:** https://nuksee.github.io/WallRunner/leaderboard.html

## Controls

The car accelerates by itself. You control three actions:

| Action | Keyboard | Touch |
| --- | --- | --- |
| Hop (thruster jump, uses fuel) | Space / W / ↑ | HOP (right thumb) |
| Stick (hold to drive on glowing surfaces) | Shift / D / → | STICK (left thumb) |
| Brake | S / ↓ | BRAKE |
| Restart run | R | HOP after a run ends |
| Tuning panel | T | ⚙ button |

The fuel bar refills while your wheels are on a surface. The charge bar drains all the time, faster the further you go; green cells top it up.

A run ends if you fall into a pit, touch a red fence, land upside down, or run out of charge. Your score is distance plus style points for wall and ceiling runs, airtime and near misses over fences.

## Leaderboard

After each run your score is posted under a nickname you pick once (change it from the results screen). Runs played with changed tuning values are not posted.

The board lives in a free [Supabase](https://supabase.com) project. To set one up, run [`supabase/leaderboard.sql`](supabase/leaderboard.sql) in its SQL editor, then put the project URL and anon key in [`src/config/backend.ts`](src/config/backend.ts). Without them the game keeps an on-device board instead. To remove an abusive name or a fake score, set `banned` on the player or `hidden` on the score in the Supabase table editor.

## Ads

There are no live ads. [`src/ads/`](src/ads/) holds the interface a game portal's ad SDK will plug into, with a slot between runs. Add `?ads=debug` to the URL to see placeholder cards where ads would show.

## Run it locally

You need Node.js 20 or newer.

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # type-check and production build to dist/
```

`npm run dev` also prints a Network URL. You can open it on a phone on the same Wi‑Fi to try the touch controls.

## Tech

- Three.js and TypeScript for rendering and code
- Rapier for physics, locked to a side-on play plane
- Vite for bundling
- Every push to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`

## Project docs

- [`docs/SPEC.md`](docs/SPEC.md) is the source of truth: the locked decisions, the component specs (C1–C8) and the milestones.
- [`CLAUDE.md`](CLAUDE.md) holds working notes and conventions for contributors.
