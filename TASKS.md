# Tasks — TODO.md work

Working branch: `todo-items`. One commit per task.

## Done
- [x] Add Vitest + tests for helper functions (fixed `punkte()` missing return)
- [x] Light mode (persisted theme toggle)
- [x] CSV export/import backup (Admin → Backup)
- [x] Urkunden — certificates for **all participants**, exported as **PDF** (jsPDF)
- [x] Event management + teams (Admin → Event & Teams: phase lifecycle, add/remove, seed, lock when abgeschlossen)

## In progress
- [ ] Backend connection layer → **Firestore** target, **local placeholder** auth
  - [x] 6a: Multi-event support (Backend repository interface + LocalBackend; events owned by an admin account; create/switch/delete; legacy migration)
  - [ ] 6b: Firebase adapter stub (prepared Firestore/Auth endpoints behind a config switch)

## Open
_(none)_

## Backlog (not scheduled yet)
- [ ] Turnierbaum: use both sides in the UI (final in the middle)
- [ ] Urkunden: restrict to admin only (hide the tab from public view)
- [ ] non-admins should not see the current lifecycle state
- [ ] the event switcher should be removed. Instead users can access the events by URL only. admin should be able to generate a QR code for each event 

## Notes
- Keep things simple.
- Backend task: only prepare the connections to the endpoints, don't build a full backend.
- Test-data buttons (sample teams / random results incl. K.O.) are gated behind
  `ENABLE_TEST_DATA` in `src/config.ts` — temporary, for test/showcase only.
