import { describe, it, expect } from "vitest";
import {
  sortByStart,
  rankTeams,
  selectTop8,
  buildBracket,
  buildMonitorQueue,
  dailyBest,
  gesamtwertung,
} from "./tournament";
import type { Team, KoState } from "../types";

const team = (
  id: string,
  start: number,
  dg1: [number | null, number | null],
  dg2: [number | null, number | null],
  extra: Partial<Team> = {},
): Team => ({
  id,
  start,
  name: `FF ${id}`,
  dg1: { zeit: dg1[0], strafe: dg1[1] },
  dg2: { zeit: dg2[0], strafe: dg2[1] },
  ...extra,
});

const seeds = Array.from({ length: 8 }, (_, i) => team(`s${i}`, i + 1, [null, null], [null, null]));

describe("sortByStart", () => {
  it("orders by starting number without mutating the input", () => {
    const input = [team("b", 3, [null, null], [null, null]), team("a", 1, [null, null], [null, null])];
    expect(sortByStart(input).map((t) => t.start)).toEqual([1, 3]);
    expect(input[0].id).toBe("b");
  });
});

describe("rankTeams", () => {
  it("computes totals and ranks ascending with no-result teams last", () => {
    const ranked = rankTeams([
      team("a", 1, [30, 0], [30, 0]), // 30
      team("b", 2, [20, 0], [25, 0]), // 20
      team("c", 3, [null, null], [null, null]), // no result
    ]);
    expect(ranked.map((t) => t.id)).toEqual(["b", "a", "c"]);
    expect(ranked[0]).toMatchObject({ id: "b", g1: 20, g2: 25, punkte: 20 });
  });

  it("assigns a stable order to a tie within places 1-7 (doesn't affect qualification)", () => {
    const input = [
      team("a", 1, [20, 0], [20, 0]), // tied for 1st/2nd
      team("b", 2, [20, 0], [20, 0]),
      team("c", 3, [25, 0], [25, 0]), // clear 3rd
    ];
    const ranked = rankTeams(input);
    expect(ranked.map((t) => t.id).slice(0, 2).sort()).toEqual(["a", "b"]);
    expect(ranked[0].tiedRank).toBe(true);
    expect(ranked[1].tiedRank).toBe(true);
    expect(ranked[0].cutoffContested).toBeUndefined();
    expect(ranked[2].tiedRank).toBeUndefined(); // clear 3rd, not tied with anyone

    // Same tie, fed in the opposite input order: the tie-break must depend
    // on the teams, not on their position in the input array (that's just
    // JS's stable sort re-surfacing, not an actual resolution).
    const reordered = rankTeams([input[1], input[0], input[2]]);
    expect(reordered.map((t) => t.id).slice(0, 2)).toEqual(ranked.map((t) => t.id).slice(0, 2));
  });

  it("flags — but doesn't randomize — a tie straddling the top-8 cutoff", () => {
    const clear = Array.from({ length: 7 }, (_, i) => team(`t${i}`, i + 1, [10 + i, 0], [10 + i, 0]));
    const eighth = team("place8", 8, [30, 0], [30, 0]);
    const ninth = team("place9", 9, [30, 0], [30, 0]); // ties with place8
    const ranked = rankTeams([...clear, eighth, ninth]);
    const [p8, p9] = [ranked[7], ranked[8]];
    expect(new Set([p8.id, p9.id])).toEqual(new Set(["place8", "place9"]));
    expect(p8.cutoffContested).toBe(true);
    expect(p9.cutoffContested).toBe(true);
    expect(p8.tiedRank).toBeUndefined();
    // Places 1-7 are all clear (no ties) and must stay untouched.
    expect(ranked.slice(0, 7).map((t) => t.id)).toEqual(["t0", "t1", "t2", "t3", "t4", "t5", "t6"]);
  });

  it("flags a tie entirely below the cutoff for display, without contesting qualification", () => {
    const clear = Array.from({ length: 9 }, (_, i) => team(`t${i}`, i + 1, [10 + i, 0], [10 + i, 0]));
    const a = team("a", 10, [50, 0], [50, 0]);
    const b = team("b", 11, [50, 0], [50, 0]); // tied for last, well below 8th/9th
    const ranked = rankTeams([...clear, a, b]);
    const tail = ranked.slice(9);
    expect(tail.map((t) => t.id).sort()).toEqual(["a", "b"]);
    expect(tail.every((t) => t.tiedRank)).toBe(true);
    expect(tail.every((t) => !t.cutoffContested)).toBe(true);
  });
});

describe("selectTop8", () => {
  it("excludes hosts and no-result teams and caps at eight", () => {
    const many = Array.from({ length: 10 }, (_, i) => team(`t${i}`, i + 1, [20 + i, 0], [20 + i, 0]));
    many[0].gastgeber = true; // best time but außer Konkurrenz
    const noResult = team("z", 99, [null, null], [null, null]);
    const top8 = selectTop8(rankTeams([...many, noResult]));
    expect(top8).toHaveLength(8);
    expect(top8.some((t) => t.gastgeber)).toBe(false);
    expect(top8.some((t) => t.id === "z")).toBe(false);
  });
});

describe("buildBracket", () => {
  const ko: KoState = {
    qf1: { runA: { zeit: 20, strafe: 0 }, runB: { zeit: 25, strafe: 0 } }, // s0 beats s7
    qf2: { runA: { zeit: 22, strafe: 0 }, runB: { zeit: 23, strafe: 0 } }, // s3 beats s4
    qf3: { runA: { zeit: 30, strafe: 0 }, runB: { zeit: 21, strafe: 0 } }, // s6 beats s1
    qf4: { runA: { zeit: 19, strafe: 0 }, runB: { zeit: 40, strafe: 0 } }, // s2 beats s5
  };

  it("seeds the quarter-finals via SEED_ORDER", () => {
    const b = buildBracket(seeds, {});
    expect([b.qf[0].teamA?.id, b.qf[0].teamB?.id]).toEqual(["s0", "s7"]);
    expect([b.qf[1].teamA?.id, b.qf[1].teamB?.id]).toEqual(["s3", "s4"]);
    expect([b.qf[2].teamA?.id, b.qf[2].teamB?.id]).toEqual(["s1", "s6"]);
    expect([b.qf[3].teamA?.id, b.qf[3].teamB?.id]).toEqual(["s2", "s5"]);
  });

  it("picks winners by lower total", () => {
    const b = buildBracket(seeds, ko);
    expect(b.qf.map((m) => m.winnerId)).toEqual(["s0", "s3", "s6", "s2"]);
  });

  it("leaves an exact K.O. tie unresolved and flags it instead of picking team A", () => {
    const tied: KoState = {
      qf1: { runA: { zeit: 20, strafe: 0 }, runB: { zeit: 25, strafe: 0 } }, // s0 beats s7, decided
      qf2: { runA: { zeit: 22, strafe: 0 }, runB: { zeit: 22, strafe: 0 } }, // tie
    };
    const b = buildBracket(seeds, tied);
    expect(b.qf[1].winnerId).toBeNull();
    expect(b.qf[1].tied).toBe(true);
    // s0 (decided) is waiting in the semi-final, but s3 shouldn't advance
    // off an unresolved tie to join them.
    expect(b.sf[0].teamA?.id).toBe("s0");
    expect(b.sf[0].teamB).toBeNull();
    expect(b.sf[0].winnerId).toBeNull();
  });

  it("propagates winners into the semi-finals and final", () => {
    const b = buildBracket(seeds, {
      ...ko,
      sf1: { runA: { zeit: 20, strafe: 0 }, runB: { zeit: 25, strafe: 0 } }, // s0
      sf2: { runA: { zeit: 30, strafe: 0 }, runB: { zeit: 20, strafe: 0 } }, // s2
    });
    expect([b.sf[0].teamA?.id, b.sf[0].teamB?.id]).toEqual(["s0", "s3"]);
    expect([b.sf[1].teamA?.id, b.sf[1].teamB?.id]).toEqual(["s6", "s2"]);
    expect([b.final.teamA?.id, b.final.teamB?.id]).toEqual(["s0", "s2"]);
  });

  it("leaves real matches without runs undecided", () => {
    const b = buildBracket(seeds.slice(0, 6), {}); // only 6 teams: seeds 6+7 missing
    expect(b.qf[0].teamB).toBeNull(); // seed index 7 missing -> bye, not a real match
    expect(b.qf[1].winnerId).toBeNull(); // s3 vs s4, both present, no run yet
    expect(b.qf[3].winnerId).toBeNull(); // s2 vs s5, both present, no run yet
    // s0's and s1's byes shouldn't leapfrog the still-unplayed qf2/qf4 —
    // their semi-finals must wait for a real opponent, not auto-advance.
    expect(b.sf[0].winnerId).toBeNull();
    expect(b.sf[1].winnerId).toBeNull();
    expect(b.final.teamA).toBeNull();
    expect(b.final.teamB).toBeNull();
  });

  it("gives a walkover to a seed with no competitor (bye)", () => {
    const b = buildBracket(seeds.slice(0, 6), {}); // seeds 6+7 missing
    expect(b.qf[0].winnerId).toBe("s0"); // no seed at index 7 -> automatic bye
    expect(b.qf[2].winnerId).toBe("s1"); // no seed at index 6 -> automatic bye
  });

  it("cascades a bye forward until the team reaches a real opponent", () => {
    // Only 2 teams total: both seeds get byes all the way to the final,
    // where they finally have to play each other for real.
    const b = buildBracket(seeds.slice(0, 2), {}); // s0, s1
    expect(b.qf[0].winnerId).toBe("s0");
    expect(b.qf[2].winnerId).toBe("s1");
    expect(b.sf[0].winnerId).toBe("s0"); // qf2 was empty (no seeds 3/4) -> bye
    expect(b.sf[1].winnerId).toBe("s1"); // qf4 was empty (no seeds 2/5) -> bye
    expect([b.final.teamA?.id, b.final.teamB?.id]).toEqual(["s0", "s1"]);
    expect(b.final.winnerId).toBeNull(); // a real match now, needs a run
  });

  it("crowns a walkover champion when there is only one qualifying team", () => {
    const b = buildBracket(seeds.slice(0, 1), {}); // s0 only
    expect(b.qf[0].winnerId).toBe("s0");
    expect(b.sf[0].winnerId).toBe("s0");
    expect(b.final.winnerId).toBe("s0");
    expect(b.final.teamB).toBeNull();
  });

  it("reports no bracket at all when nobody qualified", () => {
    const b = buildBracket([], {});
    expect(b.qf.every((m) => m.teamA === null && m.teamB === null && m.winnerId === null)).toBe(true);
    expect(b.final.teamA).toBeNull();
    expect(b.final.teamB).toBeNull();
    expect(b.final.winnerId).toBeNull();
  });
});

describe("buildMonitorQueue", () => {
  const emptyBracket = buildBracket([], {});

  it("reports empty when there are no teams", () => {
    expect(buildMonitorQueue([], emptyBracket, 2).status).toBe("empty");
  });

  it("marks the first incomplete heat as current", () => {
    const t1 = team("a", 1, [null, null], [null, null]);
    const t2 = team("b", 2, [null, null], [null, null]);
    const view = buildMonitorQueue([t1, t2], emptyBracket, 2);
    expect(view.status).toBe("running");
    expect(view.current.map((r) => [r.name, r.label])).toEqual([["FF a", "DG1"], ["FF b", "DG1"]]);
    expect(view.former).toEqual([]);
    expect(view.next.map((r) => r.label)).toEqual(["DG2", "DG2"]);
  });

  it("advances to the next heat once a heat has times", () => {
    const t1 = team("a", 1, [20, 0], [null, null]);
    const t2 = team("b", 2, [21, 0], [null, null]);
    const view = buildMonitorQueue([t1, t2], emptyBracket, 2);
    expect(view.current.map((r) => r.label)).toEqual(["DG2", "DG2"]);
    expect(view.former.map((r) => r.label)).toEqual(["DG1", "DG1"]);
    expect(view.next).toEqual([]);
  });

  it("reports finished when every run has a time", () => {
    const t1 = team("a", 1, [20, 0], [22, 0]);
    const t2 = team("b", 2, [21, 0], [23, 0]);
    const view = buildMonitorQueue([t1, t2], emptyBracket, 2);
    expect(view.status).toBe("finished");
    expect(view.current).toEqual([]);
    expect(view.former.map((r) => r.label)).toEqual(["DG2", "DG2"]);
  });

  it("continues into the K.O. phase after the base rounds", () => {
    const teams8 = Array.from({ length: 8 }, (_, i) => team(`s${i}`, i + 1, [20 + i, 0], [20 + i, 0]));
    const bracket = buildBracket(selectTop8(rankTeams(teams8)), {});
    const view = buildMonitorQueue(sortByStart(teams8), bracket, 2);
    expect(view.status).toBe("running");
    expect(view.current.map((r) => r.label)).toEqual(["Viertelfinale", "Viertelfinale"]);
  });

  it("with an odd team count, a heat never mixes DG1 and DG2 runners", () => {
    // 3 teams, parallel=2: DG1 heats are [a,b] then [c] alone. Naively
    // flattening DG1+DG2 into one array and chunking by index would have
    // paired c's DG1 run with a's DG2 run in the same "parallel" heat.
    const a = team("a", 1, [20, 0], [null, null]);
    const b = team("b", 2, [21, 0], [null, null]);
    const c = team("c", 3, [22, 0], [null, null]); // DG1 done for all three, DG2 untouched
    const view = buildMonitorQueue([a, b, c], emptyBracket, 2);
    expect(view.status).toBe("running");
    // c ran DG1 solo (odd one out) — that heat is fully done, so the queue
    // has already moved on to DG2's first heat (a, b), not a DG1/DG2 mix.
    expect(view.former.map((r) => [r.name, r.label])).toEqual([["FF c", "DG1"]]);
    expect(view.current.map((r) => [r.name, r.label])).toEqual([["FF a", "DG2"], ["FF b", "DG2"]]);
    expect(view.next.map((r) => [r.name, r.label])).toEqual([["FF c", "DG2"]]);
  });

  it("with an odd team count, the last team in a phase runs alone rather than joining the next phase", () => {
    const a = team("a", 1, [20, 0], [null, null]);
    const b = team("b", 2, [21, 0], [null, null]);
    const c = team("c", 3, [null, null], [null, null]); // c hasn't run DG1 yet
    const view = buildMonitorQueue([a, b, c], emptyBracket, 2);
    expect(view.status).toBe("running");
    expect(view.current.map((r) => [r.name, r.label])).toEqual([["FF c", "DG1"]]);
    expect(view.next.map((r) => [r.name, r.label])).toEqual([["FF a", "DG2"], ["FF b", "DG2"]]);
  });
});

describe("dailyBest", () => {
  it("folds K.O. run totals into the best time without mutating ranked", () => {
    const ranked = rankTeams([
      team("a", 1, [30, 0], [30, 0]), // base best 30
      team("b", 2, [40, 0], [40, 0]), // base best 40
    ]);
    const bracket = buildBracket(selectTop8(ranked), {
      qf1: { runA: { zeit: 25, strafe: 0 } }, // team a runs a faster 25 in the K.O.
    });
    const result = dailyBest(ranked, bracket);
    expect(result.map((t) => [t.id, t.punkte])).toEqual([["a", 25], ["b", 40]]);
    // ranked must be untouched (guards the earlier state-mutation bug)
    expect(ranked.find((t) => t.id === "a")?.punkte).toBe(30);
  });
});

describe("gesamtwertung", () => {
  // 10 teams: t0..t7 qualify for K.O. (ascending base punkte, t0 fastest),
  // t8/t9 don't. K.O. results consistently favour the lower-numbered team.
  const teams10 = Array.from({ length: 10 }, (_, i) => team(`t${i}`, i + 1, [20 + i, 0], [20 + i, 0]));
  const decisive: KoState = {
    qf1: { runA: { zeit: 20, strafe: 0 }, runB: { zeit: 30, strafe: 0 } }, // t0 beats t7
    qf2: { runA: { zeit: 23, strafe: 0 }, runB: { zeit: 33, strafe: 0 } }, // t3 beats t4
    qf3: { runA: { zeit: 21, strafe: 0 }, runB: { zeit: 31, strafe: 0 } }, // t1 beats t6
    qf4: { runA: { zeit: 22, strafe: 0 }, runB: { zeit: 32, strafe: 0 } }, // t2 beats t5
    sf1: { runA: { zeit: 20, strafe: 0 }, runB: { zeit: 30, strafe: 0 } }, // t0 beats t3
    sf2: { runA: { zeit: 21, strafe: 0 }, runB: { zeit: 31, strafe: 0 } }, // t1 beats t2
    final: { runA: { zeit: 20, strafe: 0 }, runB: { zeit: 30, strafe: 0 } }, // t0 beats t1
  };

  it("orders 1-8 by how far each team got in the bracket, then the rest by base rank", () => {
    const ranked = rankTeams(teams10);
    const bracket = buildBracket(selectTop8(ranked), decisive);
    const result = gesamtwertung(ranked, bracket);
    // 1: champion, 2: runner-up, 3-4: SF losers (t2 < t3 on base punkte),
    // 5-8: QF losers (t4 < t5 < t6 < t7 on base punkte), 9-10: never in K.O.
    expect(result.map((t) => t.id)).toEqual(["t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9"]);
  });

  it("falls back to base-round order for anyone not yet decided in the bracket", () => {
    const ranked = rankTeams(teams10);
    // Only the quarter-finals are in — semis/final are still unplayed.
    const bracket = buildBracket(selectTop8(ranked), {
      qf1: decisive.qf1, qf2: decisive.qf2, qf3: decisive.qf3, qf4: decisive.qf4,
    });
    const result = gesamtwertung(ranked, bracket);
    // The 4 QF losers are decided and placed first...
    expect(result.slice(0, 4).map((t) => t.id)).toEqual(["t4", "t5", "t6", "t7"]);
    // ...everyone else (QF winners still alive in an undecided SF, plus
    // teams that never qualified) falls back to base rank.
    expect(result.slice(4).map((t) => t.id)).toEqual(["t0", "t1", "t2", "t3", "t8", "t9"]);
  });

  it("is a no-op reshuffle when there's no bracket at all", () => {
    const ranked = rankTeams(teams10);
    const result = gesamtwertung(ranked, buildBracket([], {}));
    expect(result.map((t) => t.id)).toEqual(ranked.map((t) => t.id));
  });
});
