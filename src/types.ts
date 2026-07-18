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
}

export interface BracketData {
  qf: Match[];
  sf: Match[];
  final: Match;
}

// Per-match K.O. run times, keyed by match id (qf1..final).
export type KoState = Record<string, { runA?: RunData; runB?: RunData }>;

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