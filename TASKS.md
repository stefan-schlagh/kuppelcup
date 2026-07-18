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

## Code-quality fixes
- [x] Fix ranking comparator (tested `byPunkte` helper; no-result teams last)
- [x] Fix Tagesbestzeit: no state mutation in render, correct team B, fold K.O. runs; drop console.logs
- [x] Remove unused Vite-template files (`App.css`, template assets)
- [x] Fix Bestenliste tooltips passing `RunData` to `fmtTime` (→ `NaN:NaN`)

## In progress
_(none)_

## Open
_(none)_

## Backlog (not scheduled yet)
- [ ] Tighten component prop types (replace `any` in AdminPanel, Bestenliste, Turnierbaum, …)
- [ ] Replace the hardcoded client-side admin PIN with real auth (Firebase Auth) once the backend is wired, introduce support for multiple admins with their own events as well.

## Manual setup (you — before wiring the backend)
- [ ] **Set up Firebase** (prerequisite for activating FirebaseBackend):
  - Create a Firebase project in the console
  - Add a Web App and copy its config → paste into `firebaseConfig` in `src/config.ts`
  - Enable **Firestore** (create the database)
  - Enable **Authentication** (the sign-in provider you want, e.g. Google)
  - Add Firestore security rules scoping events by owner
    (`allow read/write if request.auth.uid == resource.data.ownerId`)
  - Then hand back to wiring: `npm install firebase`, uncomment the SDK calls in
    `src/backend/FirebaseBackend.ts`, set `BACKEND = "firebase"` and
    `FIREBASE_WIRED = true` in `src/config.ts`

## Notes
- Keep things simple.
- Backend task: only prepare the connections to the endpoints, don't build a full backend.
- Test-data buttons (sample teams / random results incl. K.O.) are gated behind
  `ENABLE_TEST_DATA` in `src/config.ts` — temporary, for test/showcase only.
- Backend selection lives in `src/config.ts`: `BACKEND` ("local" | "firebase")
  and `FIREBASE_WIRED`. While `FIREBASE_WIRED` is false the app stays on
  LocalBackend (localStorage) even if BACKEND is "firebase" — frontend-only dev
  never hits the unwired Firebase stub.
