import { describe, it, expect } from "vitest";
import {
  sortByStart,
  rankTeams,
  selectTop8,
  buildBracket,
  buildMonitorQueue,
  dailyBest,
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
    qf2: { runA: { zeit: 22, strafe: 0 }, runB: { zeit: 22, strafe: 0 } }, // tie -> team A (s3)
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

  it("picks winners by lower total and gives ties to team A", () => {
    const b = buildBracket(seeds, ko);
    expect(b.qf.map((m) => m.winnerId)).toEqual(["s0", "s3", "s6", "s2"]);
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

  it("leaves matches without runs undecided and tolerates missing seeds", () => {
    const b = buildBracket(seeds.slice(0, 6), {}); // only 6 teams
    expect(b.qf[0].teamB).toBeNull(); // seed index 7 missing
    expect(b.qf.every((m) => m.winnerId === null)).toBe(true);
    expect(b.final.teamA).toBeNull();
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
