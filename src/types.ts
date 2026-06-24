export interface RunData {
  zeit: number | null;
  strafe: number;
}

export interface Team {
  id: string;
  name: string;
  gastgeber?: boolean;
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