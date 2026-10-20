# Wall Runner Spec

As of 2026-10-20. Source of truth for decisions; the shared doc version is kept in sync by hand.

## Goal

Build the seed of a real product: a free, ad-supported browser game for public players, measured by a live global leaderboard.

- **Core fantasy:** a fictional electric hypercar that can make short thruster hops and drive up walls and across ceilings. Speed is flavour; these two moves are the hook.
- **Inspiration, not licence:** the moves echo the thrusters Tesla showed for its second-generation Roadster. The car, name and look are original, with no Tesla trademarks or likeness.
- **Working title:** Wall Runner is a placeholder until the car and game are named.

## Locked decisions

All 21 decisions below were confirmed on 2026-10-20. Changing one means reopening its row, not editing it quietly. S2 and B3 were reopened and changed on 2026-10-20 (2.5D switch, chosen by the owner after the first M1 playtest).

| ID | Area | Decision |
| --- | --- | --- |
| G1 | Goal | Seed of a real product; choices must survive publishing and monetization |
| G2 | Goal | Audience is public strangers: onboarding, polish, fair skill curve |
| G3 | Goal | Core fantasy is short flights plus wall and ceiling driving |
| G4 | Goal | Old top-down prototype is a throwaway; only lessons carry over |
| S1 | Shape | Original fictional car; no Tesla name, logo or likeness |
| S2 | Shape | 2.5D side-scroller: 3D world and camera, play on one side-on plane |
| S3 | Shape | Ships first in the web browser |
| L1 | Loop | Endless runner on a procedurally generated course |
| L2 | Loop | Flight = thrust hops from a limited, refilling fuel tank |
| L3 | Loop | Sticking works only on marked surfaces; generator is its own spec |
| R1 | Rules | A run ends on a pit, a hazard, an upside-down crash, or empty charge |
| R2 | Rules | Score = distance + style (wall runs, airtime, near-misses) |
| R3 | Rules | v1 inputs: keyboard and mobile touch |
| P1 | Product | Stick requires holding a button |
| P2 | Product | Revenue later from ads via web game portals |
| P3 | Product | v1 success = a live global leaderboard people compete on |
| B1 | Build | Auto-throttle; player controls Hop, Stick (hold), Brake |
| B2 | Build | Anti-cheat = basic server sanity checks; physics need not be deterministic |
| B3 | Build | Three.js + TypeScript, Rapier physics (motion locked to the play plane) |
| B4 | Build | Managed backend with built-in auth (Supabase-type) |
| B5 | Build | Identity staged: nickname (v1), portal identity, then optional account |

## Component specs

Eight specs, each owning one concern behind a narrow interface, so any one can be rebuilt without touching the rest.

| Spec | Owns | Depends on | Done when | Code |
| --- | --- | --- | --- | --- |
| C1 Car physics | Auto-throttle, brake, gravity, rotation, flip detection (B1, R1) | none | Car runs a flat and sloped strip and reports "upside-down landing" reliably | `src/car/Car.ts` |
| C2 Hop | Thrust impulse, fuel tank, refill rate (L2) | C1 | Hop height and fuel cost are tunable constants; empty tank blocks hops | `src/car/Hop.ts` |
| C3 Stick | Hold-to-stick on marked surfaces, release, fall-off (L3, P1) | C1 | Car drives a full floor-wall-ceiling loop while held; drops on release | `src/car/Stick.ts` |
| C4 Course generator | Chunks, pits, hazards, marked surfaces, pickups (L1) | C1–C3 constants | Every chunk passes a reachability check using real hop and stick limits | `src/generator/` |
| C5 Rules and score | Fail states, charge drain, distance, style bonuses (R1, R2) | C1–C4 events | A run emits one result: distance, score, cause of death, duration | `src/rules/Rules.ts` |
| C6 Input | Keyboard map and 3-button touch layout (R3, B1) | none | Same three actions on both; touch tested on a real phone | `src/input/Input.ts` |
| C7 Leaderboard | Submit, sanity check, top-N, nickname filter (P3, B2, B4, B5) | C5 result | Impossible scores rejected; board loads in game and on its own page | `src/leaderboard/`, `supabase/leaderboard.sql` |
| C8 Ads | Portal SDK slot for interstitials and rewarded ads (P2) | C5 | Stubbed in v1: one interface, no live ads | `src/ads/` |

**Interfaces to keep narrow:** C1–C3 expose tuning constants (`src/config/tuning.ts`) that C4 reads; C5 consumes events only; C7 sees only C5's run result.

## Milestone 1: feel prototype

Prove that hopping and wall-driving are fun on one handmade test course before building the generator, leaderboard or ads.

**In scope:** C1, C2, C3, C6, plus a bare distance counter. Placeholder shapes for art.
**Out of scope:** C4, C5 style scoring and charge, C7, C8, sound, menus.

- [x] Three.js + TypeScript project with Rapier, deployed to a test URL (GitHub Pages)
- [x] C1: auto-throttle car with brake and upside-down detection
- [x] C2: hop with fuel tank and on-screen meter
- [x] C3: hold-to-stick on marked surfaces, including one floor-wall-ceiling loop
- [x] C6: keyboard and 3-button touch layout
- [x] Handmade test course: one pit, one wall run, one ceiling section, one hop-only gap
- [x] Tuning panel for hop force, fuel cost, refill rate and stick speed (gear button or T)

**Exit test:** five people who haven't seen it play on a phone without instructions. Pass if at least three clear the ceiling section and start another run unprompted.

## Milestone 2: endless run

Turn the feel prototype into the real loop: an endless generated course with all four fail states and a score worth beating. Defined on 2026-10-20 from the C4 and C5 rows above.

**In scope:** C4, C5, a results screen, local best score. The M1 handmade course is retired; its lessons become the first-run intro chunks.
**Out of scope:** C7 leaderboard, C8 ads, sound, menus, naming and art direction.

- [x] C4: seeded endless course streamed in chunks (runway, bumps, pit, double-hop gap, fences, wall run, loop, jump-and-grab wall)
- [x] C4: every chunk passes a reachability check against live hop, fuel and stick limits before it is built; failures re-roll easier
- [x] C4: difficulty ramps with distance; charge cells placed on the main route from a charge budget so the battery is always survivable
- [x] C4: first-run intro teaches one move or fail state per stretch (open question "Four fail states for strangers")
- [x] C5: four fail states (pit, fence, upside-down landing, empty charge); charge drains faster with distance
- [x] C5: score = distance + style (wall and ceiling runs, airtime, near misses), one run result per run (distance, score, cause, duration, seed)
- [x] Results screen with breakdown and local best; tuning panel gains Course and Rules folders

**Exit test:** five people who haven't seen it play on a phone. Pass if most beat their first score within three runs and nobody hits a jump they call impossible.

## Milestone 3: leaderboard and ads stub

Make the score public (P3) and leave a clean slot for ads (P2). Defined on 2026-10-20 from the C7 and C8 rows above. The game is still static on GitHub Pages; the only backend is a Supabase project the owner creates (B4).

**In scope:** C7, C8 stub, a standalone leaderboard page.
**Out of scope:** live ads and portal SDKs, accounts or portal identity (B5 stages two and three), sound, menus, naming and art direction.

- [x] C7: nickname (3–16 characters, word filter) and a random player id per browser (B5 stage one)
- [x] C7: Supabase board behind one `Leaderboard` interface; the browser calls two Postgres functions with the anon key and cannot touch the tables (row level security)
- [x] C7: server sanity checks (B2): score adds up, average speed, style points per second, near misses per metre, and no run longer than the time since that player's last submission. The client runs the same checks first
- [x] C7: runs played with tuned values are not posted
- [x] C7: results screen posts the run and shows rank and top five; `leaderboard.html` shows the top 100
- [x] C7: manual removal path: ban a player or hide a score in the Supabase table editor
- [x] C7: falls back to an on-device board when no backend is configured
- [x] C8: `Ads` interface with interstitial and rewarded calls; stub does nothing, `?ads=debug` shows placeholder cards
- [x] C8: interstitial slot between runs, every 3rd run and at most every 90 s (tunable)
- [ ] Owner creates the Supabase project and runs `supabase/leaderboard.sql`; URL and anon key go in `src/config/backend.ts`

**Decisions made in M3** (small, reversible): one row per player on the board (their best run); the rewarded call exists but has no placement, because a reward that changes a run (a revive, extra charge) needs its own leaderboard rule first.

**Exit test:** five people play on their own phones. Pass if every score they post shows up on the board, a deliberately faked score is rejected, and nobody calls the between-run slot intrusive.

## Open questions and risks

| Item | Why it matters | Mitigation or owner |
| --- | --- | --- |
| Hold-to-stick plus Hop on touch | Holding one thumb while tapping another may feel cramped | M1 exit test decides; fallback is auto-stick (reopens P1) |
| Four fail states for strangers | Can feel unfair in the first minute | Introduce one per early stretch of the course in C4 |
| Generator reachability | An impossible gap kills trust in an endless runner | C4 validates each chunk against C1–C3 constants (done in M2; the check is a model, so the M2 playtest should report any jump that felt impossible) |
| Portal rules vs own backend | Portals may limit outside services or provide their own leaderboards | C7 sits behind one interface, so a portal's own board can replace Supabase; check the chosen portal's terms before listing |
| Nickname abuse | Public board shows player-typed names | Word filter and character limits in C7 (client and server); ban or hide in the Supabase table editor |
| Sanity checks are basic | B2 accepts that a determined cheater can post a plausible fake score | Store the seed with every score so a suspect run can be replayed later; tighten limits if the board gets gamed |
| Car and game name | Needed before any public link | Open: pick after M1 |
| Art direction | Shapes the portal listing | Open: decide after M1 |
