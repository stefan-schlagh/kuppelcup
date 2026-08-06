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

// A bracket slot feeding into a match: either a team (decided), nobody yet
// (`team: null`) while its feeder is still alive and could still produce
// one, or a permanently empty branch (`dead: true`) — fewer than 8
// qualifiers leaves some seed positions with no team, ever.
interface Slot { team: Team | null; dead: boolean }

// Assemble the K.O. bracket from the top-8 seeds and the recorded match runs.
// Winners propagate QF -> SF -> Final; an exact tie advances team A. A team
// whose opponent slot is a dead branch (no seed, and nothing upstream can
// ever fill it) advances automatically — a bye cascades forward until it
// reaches an opponent who actually exists.
export function buildBracket(top8: Team[], ko: KoState): BracketData {
  const defaultRun = (): RunData => ({ zeit: null, strafe: 0 });
  const seedSlot = (t: Team | undefined): Slot => ({ team: t ?? null, dead: t === undefined });

  const assembleMatch = (matchId: string, a: Slot, b: Slot): { match: Match; slot: Slot } => {
    const saved = ko[matchId] || {};
    const runA = { ...defaultRun(), ...saved.runA };
    const runB = { ...defaultRun(), ...saved.runB };
    const teamA = a.team;
    const teamB = b.team;

    if (a.dead && b.dead) {
      return { match: { id: matchId, teamA: null, teamB: null, runA, runB, winnerId: null }, slot: { team: null, dead: true } };
    }
    if (a.dead || b.dead) {
      // The dead side will never have a competitor, so whoever comes out of
      // the live side — once decided — advances through this match untouched.
      const live = a.dead ? teamB : teamA;
      const winnerId = live?.id ?? null;
      return {
        match: { id: matchId, teamA: a.dead ? null : teamA, teamB: b.dead ? null : teamB, runA, runB, winnerId },
        slot: { team: live, dead: false },
      };
    }
    if (!teamA || !teamB) {
      // Both sides are still alive, but at least one hasn't been decided yet
      // (its own feeder match is unplayed) — nothing to compare yet.
      return { match: { id: matchId, teamA, teamB, runA, runB, winnerId: null }, slot: { team: null, dead: false } };
    }

    const scoreA = runA.zeit !== null ? runA.zeit + (runA.strafe ?? 0) : Infinity;
    const scoreB = runB.zeit !== null ? runB.zeit + (runB.strafe ?? 0) : Infinity;
    let winnerId: string | null = null;
    if (scoreA < Infinity || scoreB < Infinity) {
      winnerId = scoreA <= scoreB ? teamA.id : teamB.id;
    }
    const winner = winnerId ? (winnerId === teamA.id ? teamA : teamB) : null;
    return { match: { id: matchId, teamA, teamB, runA, runB, winnerId }, slot: { team: winner, dead: false } };
  };

  const qfResults = SEED_ORDER.map(([a, b], i) => assembleMatch(`qf${i + 1}`, seedSlot(top8[a]), seedSlot(top8[b])));
  const qf = qfResults.map((r) => r.match);

  const sf1 = assembleMatch("sf1", qfResults[0].slot, qfResults[1].slot);
  const sf2 = assembleMatch("sf2", qfResults[2].slot, qfResults[3].slot);
  const sf = [sf1.match, sf2.match];

  const final = assembleMatch("final", sf1.slot, sf2.slot).match;

  return { qf, sf, final };
}

const koLabel = (id: string): string =>
  id.startsWith("qf") ? "Viertelfinale" : id.startsWith("sf") ? "Halbfinale" : "Finale";

// Split one phase's runners into heats of at most `parallel` teams. Kept
// per-phase (not sliced across the whole queue) so an odd team count can't
// pair a team's DG1 run with another team's DG2 run in the same heat — the
// two lanes running "in parallel" must always be the same Durchgang.
function chunkHeats(entries: MonitorRunner[], parallel: number): MonitorRunner[][] {
  const heats: MonitorRunner[][] = [];
  for (let i = 0; i < entries.length; i += parallel) heats.push(entries.slice(i, i + parallel));
  return heats;
}

// Build the Live-Monitor queue: every team's DG1, then DG2, then the K.O.
// matches (each match is its own heat of two). The "current" heat is the
// one containing the first run still missing a time.
export function buildMonitorQueue(scheduledTeams: Team[], bracket: BracketData, parallel: number): MonitorView {
  const runner = (t: Team, label: string, r: RunData): MonitorRunner => ({
    name: t.name, start: t.start, label, zeit: r.zeit, strafe: r.strafe,
  });

  const heats: MonitorRunner[][] = [
    ...chunkHeats(scheduledTeams.map((t) => runner(t, "DG1", t.dg1)), parallel),
    ...chunkHeats(scheduledTeams.map((t) => runner(t, "DG2", t.dg2)), parallel),
  ];
  [...bracket.qf, ...bracket.sf, bracket.final].forEach((m) => {
    if (m.teamA && m.teamB) {
      heats.push([runner(m.teamA, koLabel(m.id), m.runA), runner(m.teamB, koLabel(m.id), m.runB)]);
    }
  });

  if (heats.length === 0) {
    return { status: "empty", former: [], current: [], next: [] };
  }

  const currentHeatIndex = heats.findIndex((h) => h.some((r) => r.zeit === null));
  if (currentHeatIndex === -1) {
    return { status: "finished", former: heats[heats.length - 1], current: [], next: [] };
  }

  return {
    status: "running",
    former: currentHeatIndex > 0 ? heats[currentHeatIndex - 1] : [],
    current: heats[currentHeatIndex],
    next: currentHeatIndex + 1 < heats.length ? heats[currentHeatIndex + 1] : [],
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
