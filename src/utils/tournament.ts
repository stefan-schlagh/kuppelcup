import type { Team, RunData, Match, BracketData, KoState, MonitorRunner } from "../types";
import { gesamt, punkte, byPunkte, SEED_ORDER } from "./helpers";

// A team enriched with its computed run totals and points, as shown in the
// Bestenliste and used for seeding.
export interface RankedTeam extends Team {
  g1: number | null;
  g2: number | null;
  punkte: number;
}

// The Live-Monitor view: which runs just finished, are up, and are next.
export interface MonitorView {
  status: "empty" | "running" | "finished";
  former: MonitorRunner[];
  current: MonitorRunner[];
  next: MonitorRunner[];
}

// Start order for the base rounds (strictly by starting number).
export function sortByStart(teams: Team[]): Team[] {
  return [...teams].sort((a, b) => a.start - b.start);
}

// Rank teams by points (lower is better; no-result teams last).
export function rankTeams(teams: Team[]): RankedTeam[] {
  return teams
    .map((t) => ({ ...t, g1: gesamt(t.dg1), g2: gesamt(t.dg2), punkte: punkte(t) }))
    .sort(byPunkte);
}

// The eight teams that qualify for the K.O. phase: best-ranked teams that
// aren't hosts (außer Konkurrenz) and have at least one result.
export function selectTop8(ranked: RankedTeam[]): RankedTeam[] {
  return ranked.filter((t) => !t.gastgeber && t.punkte !== 0).slice(0, 8);
}

// Assemble the K.O. bracket from the top-8 seeds and the recorded match runs.
// Winners propagate QF -> SF -> Final; an exact tie advances team A.
export function buildBracket(top8: Team[], ko: KoState): BracketData {
  const defaultRun = (): RunData => ({ zeit: null, strafe: 0 });

  const assembleMatch = (matchId: string, teamA: Team | null, teamB: Team | null): Match => {
    const saved = ko[matchId] || {};
    const runA = { ...defaultRun(), ...saved.runA };
    const runB = { ...defaultRun(), ...saved.runB };
    const scoreA = runA.zeit !== null ? runA.zeit + (runA.strafe ?? 0) : Infinity;
    const scoreB = runB.zeit !== null ? runB.zeit + (runB.strafe ?? 0) : Infinity;
    let winnerId: string | null = null;
    if (scoreA < Infinity || scoreB < Infinity) {
      winnerId = scoreA <= scoreB ? teamA?.id ?? null : teamB?.id ?? null;
    }
    return { id: matchId, teamA, teamB, runA, runB, winnerId };
  };

  const qf = SEED_ORDER.map(([a, b], i) => assembleMatch(`qf${i + 1}`, top8[a] || null, top8[b] || null));
  const winnerOf = (mid: string): Team | null => {
    const m = qf.find((x) => x.id === mid);
    return m?.winnerId ? (m.winnerId === m.teamA?.id ? m.teamA : m.teamB) : null;
  };
  const sf = [
    assembleMatch("sf1", winnerOf("qf1"), winnerOf("qf2")),
    assembleMatch("sf2", winnerOf("qf3"), winnerOf("qf4")),
  ];
  const finalist = (m: Match): Team | null =>
    m.winnerId ? (m.winnerId === m.teamA?.id ? m.teamA : m.teamB) : null;
  const final = assembleMatch("final", finalist(sf[0]), finalist(sf[1]));

  return { qf, sf, final };
}

const koLabel = (id: string): string =>
  id.startsWith("qf") ? "Viertelfinale" : id.startsWith("sf") ? "Halbfinale" : "Finale";

// Build the Live-Monitor queue: every team's DG1, then DG2, then the K.O.
// matches (each match with both teams becomes a heat of two). The "current"
// heat is the one containing the first run still missing a time.
export function buildMonitorQueue(scheduledTeams: Team[], bracket: BracketData, parallel: number): MonitorView {
  const runner = (t: Team, label: string, r: RunData): MonitorRunner => ({
    name: t.name, start: t.start, label, zeit: r.zeit, strafe: r.strafe,
  });

  const queue: MonitorRunner[] = [];
  scheduledTeams.forEach((t) => queue.push(runner(t, "DG1", t.dg1)));
  scheduledTeams.forEach((t) => queue.push(runner(t, "DG2", t.dg2)));
  [...bracket.qf, ...bracket.sf, bracket.final].forEach((m) => {
    if (m.teamA && m.teamB) {
      queue.push(runner(m.teamA, koLabel(m.id), m.runA));
      queue.push(runner(m.teamB, koLabel(m.id), m.runB));
    }
  });

  if (queue.length === 0) {
    return { status: "empty", former: [], current: [], next: [] };
  }

  const currentIndex = queue.findIndex((q) => q.zeit === null);
  if (currentIndex === -1) {
    const lastChunkStart = Math.max(0, queue.length - parallel);
    return { status: "finished", former: queue.slice(lastChunkStart), current: [], next: [] };
  }

  const chunkIndex = Math.floor(currentIndex / parallel);
  const currentStart = chunkIndex * parallel;
  const currentEnd = currentStart + parallel;
  const formerStart = currentStart - parallel;
  const nextStart = currentEnd;
  const nextEnd = nextStart + parallel;

  return {
    status: "running",
    former: formerStart >= 0 ? queue.slice(formerStart, currentStart) : [],
    current: queue.slice(currentStart, currentEnd),
    next: nextStart < queue.length ? queue.slice(nextStart, nextEnd) : [],
  };
}

// Tagesbestzeit: each team's lowest total across the base rounds and every
// K.O. run it took part in, ranked ascending (no-result teams last).
export function dailyBest(ranked: RankedTeam[], bracket: BracketData): RankedTeam[] {
  const koTotals = new Map<string, number[]>();
  const addRun = (teamId: string, total: number | null) => {
    if (total == null || total <= 0) return;
    const arr = koTotals.get(teamId) ?? [];
    arr.push(total);
    koTotals.set(teamId, arr);
  };
  [...bracket.qf, ...bracket.sf, bracket.final].forEach((m) => {
    if (m.teamA) addRun(m.teamA.id, gesamt(m.runA));
    if (m.teamB) addRun(m.teamB.id, gesamt(m.runB));
  });

  return ranked
    .map((t) => {
      const candidates = [t.punkte, ...(koTotals.get(t.id) ?? [])].filter(
        (v): v is number => v != null && v > 0,
      );
      return { ...t, punkte: candidates.length ? Math.min(...candidates) : 0 };
    })
    .sort(byPunkte);
}
