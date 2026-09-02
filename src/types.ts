export type EventPhase = "anmeldung" | "durchfuehrung" | "abgeschlossen";

export interface RunData {
  zeit: number | null;
  strafe: number | null;
}

export interface Team {
  id: string;
  start: number;
  name: string;
  gastgeber?: boolean;
  gemeinde?: boolean;
  // Free-text note, printed below the placement on the team's certificate.
  kommentar?: string;
  dg1: RunData;
  dg2: RunData;
  punkte?: number;
}

export interface Match {
  id: string;
  teamA: Team | null;
  teamB: Team | null;
  // Specific run metrics for this round
  runA: RunData;
  runB: RunData;
  winnerId: string | null;
  // Both teams ran and scored exactly equal — a K.O. tie needs another run
  // (a decider), it isn't resolved automatically.
  tied?: boolean;
}

export interface BracketData {
  qf: Match[];
  sf: Match[];
  final: Match;
  // Lauf um Platz 3: the two semi-final losers play each other to decide
  // 3rd vs. 4th place, instead of leaving them tied on K.O. round alone.
  small: Match;
}

// Per-match K.O. run times, keyed by match id (qf1..final).
export type KoState = Record<string, { runA?: RunData; runB?: RunData }>;

// One entry in the Live-Monitor queue — a team's single run in a given
// phase (base round or a K.O. match), decoupled from where the time lives.
export interface MonitorRunner {
  name: string;
  start: number;
  label: string;
  zeit: number | null;
  strafe: number | null;
  // Set on both runners of a K.O. heat that ended in an exact tie (see
  // Match.tied) — never set for base-round (DG1/DG2) entries, which don't
  // have an opponent in the same heat to tie against.
  tied?: boolean;
  // Which physical lane this runner is on, for Live-Monitor display only.
  lane?: "A" | "B";
}

// An admin account that owns events. For now this is a local placeholder;
// it maps onto a Firebase Auth user later.
export interface Account {
  id: string;
  name: string;
}

// Lightweight event descriptor for lists / switching.
export interface EventMeta {
  id: string;
  name: string;
  ownerId: string;
  phase: EventPhase;
  createdAt: number;
}

// A full event document: metadata plus its competition data.
export interface EventDoc extends EventMeta {
  teams: Team[];
  ko: KoState;
}