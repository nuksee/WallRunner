# Wall Runner

A 2.5D endless-runner prototype for the browser. You drive an original electric hypercar that can fire short thruster hops and drive up walls and across ceilings.

**▶ Play it:** https://nuksee.github.io/WallRunner/

This is the Milestone 1 feel prototype: one handmade test course built to try the moves. The procedural course, scoring and leaderboard come in later milestones. The working title is a placeholder.

## Controls

The car accelerates by itself. You control three actions:

| Action | Keyboard | Touch |
| --- | --- | --- |
| Hop (thruster jump, uses fuel) | Space / W / ↑ | HOP (right thumb) |
| Stick (hold to drive on glowing surfaces) | Shift / D / → | STICK (left thumb) |
| Brake | S / ↓ | BRAKE |
| Restart run | R | HOP after a run ends |
| Tuning panel | T | ⚙ button |

The fuel bar refills while your wheels are on a surface. A run ends if you fall into a pit or land upside down.

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
