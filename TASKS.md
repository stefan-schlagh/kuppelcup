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
- [x] e2e smoke tests (Playwright) live in `e2e/`: `npm run test:e2e` (one-time
  `npx playwright install chromium`). The dev server it drives is forced onto
  LocalBackend via `VITE_E2E_LOCAL_BACKEND=true` (set in `playwright.config.ts`,
  read in `src/config.ts`) so it can never touch the real Firebase project.

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
- [x] in parallel heats: only do teams that are in the same DG
  - write tests for that
  (`buildMonitorQueue` flattened DG1+DG2 into one array and chunked it by
  index; with an odd team count that paired the last DG1 runner with the
  first DG2 runner in the same "parallel" heat. Now DG1/DG2/each K.O. match
  are chunked as separate phases so a heat never mixes them)
- [x] some interactivity that shows an action has been registered
  (result entry saves silently and debounced — nothing on screen confirmed
  a write actually went through, only `saveError` existed and only for
  failures. Added a brief "✓ Gespeichert" flash in the header, next to the
  phase badge, that appears once a debounced save completes and fades out
  ~1.6s later; e2e-tested since it's a timing-dependent UI behavior)
- [x] does firebase allow user + pw login — yes, the Email/Password provider is
  already enabled (`firebase.json` → `auth.providers.emailPassword`) and
  `FirebaseBackend.auth.signIn`/`createAccount` already call
  `signInWithEmailAndPassword`/`createUserWithEmailAndPassword`. The catch:
  Firebase's Email/Password provider requires the identifier to actually be
  an **email address** — unlike `LocalBackend`, which accepts any string
  (the local dev seed is literally `admin`/`admin`). The login form's
  "Benutzername" field didn't reflect that; relabeled it to "E-Mail-Adresse"
  (`type="email"`) so real (Firebase) admins sign up with a real email —
  local dev is unaffected since `LocalBackend.signIn` does plain string
  comparison, no format is enforced.
- [x] complete email only login
  (`FirebaseBackend.auth.signInWithEmail` now sends a real Firebase email
  link via `sendSignInLinkToEmail`; since nobody can sign in until the user
  clicks that link, it rejects with a new `AuthNotice` — a non-error the UI
  renders as a blue notice, not a red one — instead of returning an Account.
  `completeEmailLinkSignIn()` (new optional `Backend.auth` method, called
  once on startup in `useEvents`) finishes the sign-in when the user comes
  back via the emailed link, using the email persisted in localStorage
  across that round trip, falling back to a prompt if it's missing.
  **Manual step**: enable "Email link (passwordless sign-in)" under
  Authentication → Sign-in method → Email/Password in the Firebase console
  — it's a separate toggle from plain Email/Password, and unlike that one
  `firebase.json`'s `auth.providers` config can't turn it on for you. Also
  add the production domain under Authentication → Settings → Authorized
  domains once deployed, or the emailed link will be rejected.)
- [x] firebase: do i have to switch on account merging (if e.g. same email
  used with different login methods) — no, not for what's here today.
  Firebase Auth's Email/Password sign-in and Email Link (passwordless)
  sign-in are the **same provider** (`providerId: "password"`); signing in
  with either one for a given email always resolves to the same Firebase
  Auth user, so there's nothing to merge. Account linking only becomes
  relevant if a *different* provider (e.g. Google Sign-In) is added later —
  then enabling "One account per email address" in Firebase console →
  Authentication → Settings avoids duplicate accounts for the same email
  across providers.
- [x] do tests what happens in tournament tree if there are < 8 participants (for 3 only 2 were added to the tree)
  - then: the teams getting no competitor in their heat should automatically advance
  (`buildBracket`: previously a QF/SF/Final slot with no team just sat at
  `winnerId: null` forever, so a bye never advanced. Now a genuinely empty
  bracket branch — a seed position that doesn't exist, not just a still-
  unplayed match — makes the other side win automatically, cascading forward
  until it reaches a real opponent; a still-unplayed real match is left
  correctly undecided rather than treated as a bye)
- [x] all times (+ gemeindewertung + best times) and turnament tree should be printable as a pdf, gesamtwertung as well
- [x] use a libary like react-pdf so that (potential) previews and the pdf itself can be the same code
  - pdfs shall only be in "light mode"
  (`@react-pdf/renderer`; `src/pdf/pdfDocs.tsx` builds one `GesamtberichtPdf`
  — Grunddurchgang + Gemeindewertung + Tagesbestzeit + Gesamtwertung +
  Turnierbaum together on a single physical A4 page (per your call — small
  fixed font, not paginated per section), including the new `Gesamtwertung`
  list added to the Bestenliste tab. One "Gesamtbericht als PDF
  exportieren" button, admin-only (AdminPanel → Backup — the whole panel is
  already gated behind admin auth). react-pdf's styles are a fixed light
  palette independent of the DOM/app theme, so "light mode only" is
  automatic, not something to maintain. The library is dynamically
  `import()`ed from the button handler, not statically — it's ~480kB
  gzipped and was otherwise landing in every visitor's bundle, spectators
  included, for a feature only admins use; confirmed via `npm run build`
  that it now split into its own lazily-loaded chunk. Verified with a
  temporary throwaway script rendering a 20-team roster to a real PDF,
  converted to PNG via `pdftoppm` to eyeball the layout, plus a real e2e
  download test (`page.waitForEvent("download")`) that also confirms the
  button doesn't exist when signed out.)
- [x] conflict resolution for tie breaks:
  - in turnament mode: another run
  - for base heats: if at 1-7 assign place (relevant on where to start in turnament tree) randomly
  - if 8 and 9 are tied: another run
  (K.O.: an exact tie no longer auto-advances team A — `Match.tied` is set,
  nothing propagates to the next round, and Turnierbaum shows "Unentschieden
  — Stechlauf nötig" until the times are overwritten with a real decider
  run. Base heats: a tie fully within places 1-7 gets a stable pseudo-random
  order — a deterministic hash of the team ids, not `Math.random()`, so it
  doesn't reshuffle on every render — flagged `tiedRank` and shown as a
  "Gleichstand" badge in Bestenliste. A tie straddling the 8th/9th place is
  left in place and flagged `cutoffContested` (own badge) instead of being
  guessed at, since that decides who actually qualifies)
- [x] Gemeindewertung shall be in the same order as gesamtwertung (place 1-8 from tournament tree, rest from base heats)
  (new `gesamtwertung()` in `utils/tournament.ts`: champion, runner-up, SF
  losers, QF losers — decided matches only, so it firms up as K.O. results
  come in; teams eliminated in the same round never played each other, so
  there's no rule to rank them by, they're ordered by base-round punkte as
  a display tie-break. Everyone outside the K.O. bracket keeps their
  base-round rank. Gemeindewertung now filters this instead of raw
  `ranked`; e2e-tested since it needed real K.O. + Admin UI interaction)
- [x] add a single test script that tests everything, include this in CI workflow
  (`npm run test:all` = unit tests, then `test:rules` against the Firestore
  emulator, then `test:e2e` against a LocalBackend dev server — wired into
  `.github/workflows/node.js.yml`. Along the way, fixed a real gap: `test:rules`
  called bare `firebase`, which only worked locally by accident because
  firebase-tools happened to be globally installed on this machine — it was
  never a project dependency, so it would have failed in CI. Added
  `firebase-tools` as a devDependency so the local `node_modules/.bin/firebase`
  is what actually runs. CI also needs Java (`actions/setup-java`, for the
  emulator) and `npx playwright install --with-deps chromium`; both the
  emulator jar and the Playwright browser download are cached by
  `package-lock.json` hash so only the first CI run after a dependency bump
  pays for the download.)

if there is something not clear: ask
when you add new logic, add test cases for it

bugs:
- [x] events not shown when after new login (`useEvents.enterAccount` set `account`
  before awaiting `listEvents`/`getEvent`, so a rejected fetch — e.g. Firestore's
  `where(ownerId) + orderBy(createdAt)` needs a composite index, which
  `firestore.indexes.json` didn't define — left the UI authenticated with events/
  current stuck empty instead of surfacing a failed login. Fixed the ordering and
  added the missing index; deploy with `firebase deploy --only firestore:indexes`)
