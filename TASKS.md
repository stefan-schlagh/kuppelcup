# Tasks — TODO.md work

Working branch: `todo-items`. One commit per task.

## Done
- [x] Add Vitest + tests for helper functions (fixed `punkte()` missing return)
- [x] Light mode (persisted theme toggle)
- [x] CSV export/import backup (Admin → Backup)
- [x] Urkunden — certificates for **all participants**, exported as **PDF** (jsPDF)
- [x] Event management + teams (Admin → Event & Teams: phase lifecycle, add/remove, seed, lock when abgeschlossen)
- [x] Backend connection layer → **Firestore** target, **local placeholder** auth
  - [x] 6a: Multi-event support (Backend repository interface + LocalBackend; events owned by an admin account; create/switch/delete; legacy migration)
  - [x] 6b: Firebase adapter stub (prepared Firestore/Auth endpoints behind `BACKEND` switch in config.ts)
- [x] Urkunden: restrict to admin only (hide the tab from public view)
- [x] non-admins should not see the current lifecycle state
- [x] events can be renamed after creating them
- [x] Turnierbaum: use both sides in the UI (final in the middle)
- [x] Event access by URL only (`?event=<id>`); header switcher removed; admin QR code per event

## Backend-readiness hardening (local now, matters once Firebase is wired)
- [x] Guard against duplicate default-event creation (init runs once; no StrictMode/async race)
- [x] Debounce per-event writes (no full-document write per keystroke; flush on switch/unmount)
- [x] Surface save failures in the UI (dismissible banner) instead of swallowing them
- [x] Real-time updates: `Backend.subscribeEvent(id, cb)`; useEvents subscribes to the
      current event so changes propagate live. LocalBackend uses cross-tab storage
      events; FirebaseBackend maps to `onSnapshot` (stub → drop-in once wired). Own
      writes / in-progress edits are guarded so snapshots don't stomp local entry.
- [x] Multiple admin accounts (backend stubs): Admin tab has a username+password login
      (no account list shown), a passwordless **email login** (Firebase email-link;
      local dev signs in / auto-creates by email), plus "create new admin account"
      (starts empty). Default seeded admin credentials for local/dev: **admin / admin**
      (owns the starter event). Events stay owned per admin. Replaces the old admin PIN.

## Code-quality fixes
- [x] Extract tournament logic to `utils/tournament.ts` and unit-test it
      (rankTeams, selectTop8, buildBracket incl. seeding/ties/propagation,
      buildMonitorQueue incl. K.O. phase, dailyBest)
- [x] Fix ranking comparator (tested `byPunkte` helper; no-result teams last)
- [x] Fix Tagesbestzeit: no state mutation in render, correct team B, fold K.O. runs; drop console.logs
- [x] Remove unused Vite-template files (`App.css`, template assets)
- [x] Fix Bestenliste tooltips passing `RunData` to `fmtTime` (→ `NaN:NaN`)

## In progress
_(none)_

## Open
_(none)_

## Ties — current behaviour & risks
How equal scores are resolved today (there is **no explicit tie-break rule** anywhere):

- **Base-round ranking** (`tournament.ts` → `rankTeams` → `byPunkte`): `punkte` is the
  lower of the two run totals. Equal `punkte` returns `0` from `byPunkte`, so the
  order falls back to JS's **stable sort** = the `teams` array order (insertion /
  seed order). Tied teams therefore get an arbitrary but stable rank.
- **Top-8 cutoff** (`tournament.ts` → `selectTop8`, `.slice(0, 8)`): the 8th/9th
  boundary is decided by that same arbitrary order, so a tie on the qualification line
  silently favours whoever happens to sit earlier in the array. This is the
  highest-impact case.
- **K.O. matches** (`tournament.ts` → `buildBracket` → `assembleMatch`):
  `winnerId = scoreA <= scoreB ? teamA : teamB`, i.e. an exact tie advances **team A**
  (the higher-seeded / left side). Deterministic, but only by seeding — no
  re-run/shootout.
- **Gemeindewertung / Tagesbestzeit**: same `byPunkte` fallback as the base round.

Potential issues to flag:
- No sport-defined tie-break (e.g. faster single run, fewer penalties, count-back,
  head-to-head, re-run). Ranks/qualification can hinge on array order, which also
  **shifts if teams are re-ordered** (CSV import, add/remove).
- **Inconsistent rounding:** displayed points use rounded `gesamt` (hundredths), but
  K.O. `scoreA/scoreB` add `zeit + strafe` raw. So a K.O. "tie" is compared on
  unrounded values — a winner can be picked on sub-millisecond float noise rather
  than a real difference.
- Ties are **invisible in the UI** — nothing marks two teams as equal or flags a
  contested cutoff, so an arbitrary resolution looks authoritative.

## Backlog (not scheduled yet)
- [x] Tighten component prop types (typed AdminPanel/Bestenliste props; typed fmtTime; no `any` left in src)
- [x] Full-screen / presentation mode for Bestenliste and Turnierbaum (FullscreenPanel, scaled-up for beamer)
- [ ] Replace the stubbed local admin login (no password) with real auth (Firebase Auth
      — passwords / provider sign-in) once the backend is wired. Multi-admin support with
      per-admin events is already in place (LocalBackend); Firebase methods are stubbed.
- [ ] Define an explicit tie-break rule for base-round ranking + top-8 cutoff (see "Ties" above)
- [ ] Make K.O. winner comparison use rounded totals (`gesamt`) for consistency; decide how exact ties resolve (re-run vs. seed)
- [ ] Surface ties in the UI (mark equal ranks / flag a contested qualification line)
- [ ] Visually distinguish K.O. heats in the Live-Monitor (phase badge or "vs." styling for the two opponents), rather than only the text label
- [x] fix UI for small screens, especially on the top (header brand row wraps, nav tabs scroll, tighter padding; Turnierbaum stacks — see earlier)

## Manual setup (you)
- [x] Firebase is wired (`BACKEND = "firebase"`, `FIREBASE_WIRED = true` in `src/config.ts`).
  Local dev needs project credentials in `.env.local` (gitignored, not the same file as
  `.env.example`) — copy `.env.example` to `.env.local` and fill in the `VITE_FIREBASE_*`
  values from the Firebase console (Project settings → your Web App). `src/firebaseConfig.ts`
  reads these via `import.meta.env`, so it's tracked and `npm run build`/`npm test` work
  even with no `.env.local` present (e.g. on CI, which doesn't need a real project).
- [ ] Deploy `firestore.rules` when they change: `firebase deploy --only firestore:rules`
  (requires `firebase login` once). Run `npm run test:rules` first — it exercises the rules
  against the Firestore emulator (needs Java; the emulator jar downloads once via `firebase
  emulators:start` on first use).

## Notes
- Keep things simple.
- Backend task: only prepare the connections to the endpoints, don't build a full backend.
- Test-data buttons (sample teams / random results incl. K.O.) are gated behind
  `ENABLE_TEST_DATA` in `src/config.ts` — temporary, for test/showcase only.
- Backend selection lives in `src/config.ts`: `BACKEND` ("local" | "firebase")
  and `FIREBASE_WIRED`. While `FIREBASE_WIRED` is false the app stays on
  LocalBackend (localStorage) even if BACKEND is "firebase" — frontend-only dev
  never hits the unwired Firebase stub.

TODO 20260804

- [x] use database rules that make sense and are secure, write tests for them
  (`firestore.rules`: split public `get`-by-id from owner-only `list`/write +
  schema validation; emulator-backed tests in `tests/rules/`, run via
  `npm run test:rules`)
- [x] adapt FirebaseBackend tests (mock the Firebase SDK so they're fast,
  offline unit tests of the adapter logic; also dropped dead stub code left
  over from wiring)
- in parallel heats: only do teams that are in the same DG
  - write tests for that
- some interactivity that shows an action has been registered
- does firebase allow user + pw login
- complete email only login
- firebase: do i have to switch on account merging (if e.g. same email used with different login methods)
- do tests what happens in tournament tree if there are < 8 participants (for 3 only 2 were added to the tree)
  - then: the teams getting no competitor in their heat should automatically advance
- all times (+ gemeindewertung + best times) and turnament tree should be printable as a pdf, gesamtwertung as well
- use a libary like react-pdf so that (potential) previews and the pdf itself can be the same code
  - pdfs shall only be in "light mode"
- conflict resolution for tie breaks:
  - in turnament mode: another run
  - for base heats: if at 1-7 assign place (relevant on where to start in turnament tree) randomly
  - if 8 and 9 are tied: another run
- Gemeindewertung shall be in the same order as gesamtwertung (place 1-8 from tournament tree, rest from base heats)

if there is something not clear: ask
when you add new logic, add test cases for it
