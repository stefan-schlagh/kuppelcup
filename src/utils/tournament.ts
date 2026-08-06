import type { Team, RunData, Match, BracketData, KoState, MonitorRunner } from "../types";
import { gesamt, punkte, byPunkte, SEED_ORDER } from "./helpers";

// A team enriched with its computed run totals and points, as shown in the
// Bestenliste and used for seeding.
export interface RankedTeam extends Team {
  g1: number | null;
  g2: number | null;
  punkte: number;
  // Tied with at least one neighbour on punkte; the tie-break below picked
  // an order for them (places 1-7 only affect K.O. seeding, not who
  // qualifies, so this is a stable coin flip rather than a real conflict).
  tiedRank?: boolean;
  // Tied exactly across the top-8 cutoff (whoever is 8th vs. 9th) — that
  // decides who actually qualifies, so it's left unresolved and flagged
  // instead of guessed at; needs a real decider run.
  cutoffContested?: boolean;
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

// A short, stable hash so a tie-break "coin flip" gives the same answer on
// every render (same teams -> same order) without persisting a decision
// anywhere — genuine Math.random() here would reshuffle the tournament tree
// on every recompute.
function stableHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

// Resolve ties (equal punkte, excluding no-result teams) in an already
// punkte-sorted list. Places 1-7 only decide K.O. seed order, not who
// qualifies, so a tie there is given a stable pseudo-random order. A tie
// straddling the top-8 cutoff (place 8 vs. place 9) decides who actually
// qualifies — that can't be guessed at, so it's left in place and flagged
// (`cutoffContested`) for a real decider run instead. Ties entirely below
// the cutoff don't affect anything, so they're just flagged for display.
export function applyTieBreaks(ranked: RankedTeam[]): RankedTeam[] {
  const result = [...ranked];
  let i = 0;
  while (i < result.length) {
    const p = result[i].punkte;
    if (p === 0) { i++; continue; } // no-result teams aren't a real tie
    let j = i;
    while (j + 1 < result.length && result[j + 1].punkte === p) j++;
    if (j > i) {
      const place1 = i + 1; // 1-indexed place of the first team in the tie
      const place2 = j + 1;
      if (place1 <= 8 && place2 >= 9) {
        for (let k = i; k <= j; k++) result[k] = { ...result[k], cutoffContested: true };
      } else if (place2 <= 8) {
        const shuffled = result.slice(i, j + 1).sort((a, b) => stableHash(a.id) - stableHash(b.id));
        for (let k = 0; k < shuffled.length; k++) result[i + k] = { ...shuffled[k], tiedRank: true };
      } else {
        for (let k = i; k <= j; k++) result[k] = { ...result[k], tiedRank: true };
      }
    }
    i = j + 1;
  }
  return result;
}

// Rank teams by points (lower is better; no-result teams last), with ties
// resolved per applyTieBreaks.
export function rankTeams(teams: Team[]): RankedTeam[] {
  const sorted = teams
    .map((t) => ({ ...t, g1: gesamt(t.dg1), g2: gesamt(t.dg2), punkte: punkte(t) }))
    .sort(byPunkte);
  return applyTieBreaks(sorted);
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
// Winners propagate QF -> SF -> Final; an exact tie is left unresolved and
// flagged (`tied`) rather than guessed at — it needs a real decider run. A
// team whose opponent slot is a dead branch (no seed, and nothing upstream
// can ever fill it) advances automatically — a bye cascades forward until it
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
    if (scoreA < Infinity && scoreA === scoreB) {
      // Both ran, exact tie — not decided by seeding, needs a decider run.
      return { match: { id: matchId, teamA, teamB, runA, runB, winnerId: null, tied: true }, slot: { team: null, dead: false } };
    }
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

// Overall final standings: places 1-8 come from how far each team got in
// the K.O. bracket (champion, runner-up, semi-final losers, quarter-final
// losers) — decided matches only, so this firms up as K.O. results come in.
// Teams eliminated in the same round never played each other, so there's no
// rule to rank them by; they're ordered by base-round punkte as a display
// tie-break. Everyone else (no K.O. slot, or a match still undecided) keeps
// their base-round rank.
export function gesamtwertung(ranked: RankedTeam[], bracket: BracketData): RankedTeam[] {
  const byId = new Map(ranked.map((t) => [t.id, t]));
  const placed = new Set<string>();
  const rows: RankedTeam[] = [];

  const loserOf = (m: Match): string | null =>
    m.winnerId ? (m.winnerId === m.teamA?.id ? (m.teamB?.id ?? null) : (m.teamA?.id ?? null)) : null;

  const place = (id: string | null | undefined) => {
    if (!id || placed.has(id) || !byId.has(id)) return;
    placed.add(id);
    rows.push(byId.get(id)!);
  };

  const placeGroup = (ids: (string | null)[]) => {
    ids
      .filter((id): id is string => !!id && !placed.has(id) && byId.has(id))
      .map((id) => byId.get(id)!)
      .sort(byPunkte)
      .forEach((t) => place(t.id));
  };

  place(bracket.final.winnerId);
  place(loserOf(bracket.final));
  placeGroup(bracket.sf.map(loserOf));
  placeGroup(bracket.qf.map(loserOf));
  ranked.forEach((t) => place(t.id));

  return rows;
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
