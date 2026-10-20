# Wall Runner

2D side-scrolling endless runner for the web: an original electric hypercar that hops on thrusters and drives on marked walls and ceilings.

- **Spec:** `docs/SPEC.md` is the source of truth. Decision IDs (G1, L3, B1…) are locked; do not change behaviour that contradicts one without reopening it with the owner.
- **Stack:** Three.js + TypeScript + Rapier (2.5D: 3D render, physics locked to the XY play plane), bundled with Vite.
- **Compartments:** one folder per component spec (C1–C8). Components talk through `src/config/tuning.ts` constants and events, never by reaching into each other's internals.
- **IP:** no Tesla name, logo, or likeness anywhere (S1).

## Commands

- `npm install`
- `npm run dev` — local dev server
- `npm run build` — type-check and production build to `dist/`
- Deploy: every push to `main` builds and publishes to GitHub Pages (`.github/workflows/deploy.yml`) at https://nuksee.github.io/WallRunner/
