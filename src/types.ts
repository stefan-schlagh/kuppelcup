export interface RunData {
  zeit: number | null;
  strafe: number | null;
}

export interface Team {
  id: string;
  start: number;
  name: string;
  gastgeber?: boolean;
  dg1: RunData;
  dg2: RunData;
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