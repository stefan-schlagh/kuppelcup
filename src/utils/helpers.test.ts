import { describe, it, expect } from "vitest";
import { fmtTime, gesamt, punkte, seedTeams, SEED_ORDER, makeTeam, withRandomResults, randomKoResults, KO_MATCH_IDS } from "./helpers";
import type { Team } from "../types";

const teamWithRuns = (dg1: Team["dg1"], dg2: Team["dg2"]): Team => ({
  id: "t1",
  start: 1,
  name: "FF Test",
  dg1,
  dg2,
});

describe("fmtTime", () => {
  it("renders a dash for null / NaN", () => {
    expect(fmtTime(null)).toBe("–");
    expect(fmtTime(undefined)).toBe("–");
    expect(fmtTime(NaN)).toBe("–");
  });

  it("formats sub-minute times with zero-padded seconds", () => {
    expect(fmtTime(25.5)).toBe("0:25.50");
    expect(fmtTime(9.1)).toBe("0:09.10");
  });

  it("formats times spanning minutes", () => {
    expect(fmtTime(90)).toBe("1:30.00");
    expect(fmtTime(125.25)).toBe("2:05.25");
  });
});

describe("gesamt", () => {
  it("returns null when there is no run or no time", () => {
    expect(gesamt(null as any)).toBeNull();
    expect(gesamt({ zeit: null, strafe: 5 })).toBeNull();
  });

  it("adds penalty seconds to the time", () => {
    expect(gesamt({ zeit: 20, strafe: 5 })).toBe(25);
  });

  it("treats a null penalty as zero", () => {
    expect(gesamt({ zeit: 20, strafe: null })).toBe(20);
  });
});

describe("punkte", () => {
  it("is 0 when a team has no runs", () => {
    expect(punkte(teamWithRuns({ zeit: null, strafe: null }, { zeit: null, strafe: null }))).toBe(0);
  });

  it("uses the only completed run", () => {
    expect(punkte(teamWithRuns({ zeit: 22, strafe: 5 }, { zeit: null, strafe: null }))).toBe(27);
    expect(punkte(teamWithRuns({ zeit: null, strafe: null }, { zeit: 19, strafe: 0 }))).toBe(19);
  });

  it("takes the lower total of both runs", () => {
    expect(punkte(teamWithRuns({ zeit: 22, strafe: 0 }, { zeit: 20, strafe: 5 }))).toBe(22);
    expect(punkte(teamWithRuns({ zeit: 30, strafe: 0 }, { zeit: 21, strafe: 0 }))).toBe(21);
  });
});

describe("seedTeams", () => {
  const teams = seedTeams();

  it("creates 20 teams with sequential start numbers and unique ids", () => {
    expect(teams).toHaveLength(20);
    teams.forEach((t, i) => {
      expect(t.start).toBe(i + 1);
      expect(t.id).toBe(`t${i + 1}`);
    });
    expect(new Set(teams.map((t) => t.id)).size).toBe(20);
  });

  it("marks only the first team as Gastgeber and starts with empty runs", () => {
    expect(teams[0].gastgeber).toBe(true);
    expect(teams.slice(1).some((t) => t.gastgeber)).toBe(false);
    expect(teams[0].dg1).toEqual({ zeit: null, strafe: null });
  });
});

describe("makeTeam", () => {
  it("creates an empty team with the given name and start and a unique id", () => {
    const a = makeTeam("FF Neu", 5);
    const b = makeTeam("FF Neu", 5);
    expect(a.name).toBe("FF Neu");
    expect(a.start).toBe(5);
    expect(a.dg1).toEqual({ zeit: null, strafe: null });
    expect(a.dg2).toEqual({ zeit: null, strafe: null });
    expect(a.id).not.toBe(b.id);
  });
});

describe("withRandomResults", () => {
  it("fills every team's runs with numeric times and valid penalties", () => {
    const filled = withRandomResults(seedTeams());
    expect(filled).toHaveLength(20);
    filled.forEach((t) => {
      expect(typeof t.dg1.zeit).toBe("number");
      expect(typeof t.dg2.zeit).toBe("number");
      expect(t.dg1.strafe).toBeGreaterThanOrEqual(0);
      expect(t.dg2.strafe).toBeGreaterThanOrEqual(0);
    });
  });

  it("does not mutate the input teams", () => {
    const teams = seedTeams();
    withRandomResults(teams);
    expect(teams[0].dg1.zeit).toBeNull();
  });
});

describe("randomKoResults", () => {
  it("produces runs for every bracket match when enough teams qualify", () => {
    const ko = randomKoResults(withRandomResults(seedTeams()));
    expect(Object.keys(ko).sort()).toEqual([...KO_MATCH_IDS].sort());
    KO_MATCH_IDS.forEach((id) => {
      expect(typeof ko[id].runA.zeit).toBe("number");
      expect(typeof ko[id].runB.zeit).toBe("number");
    });
  });

  it("returns an empty bracket when fewer than 8 teams have results", () => {
    const few = withRandomResults(seedTeams().slice(0, 5));
    expect(randomKoResults(few)).toEqual({});
  });
});

describe("SEED_ORDER", () => {
  it("pairs all eight quarter-final slots exactly once", () => {
    expect(SEED_ORDER).toHaveLength(4);
    const slots = SEED_ORDER.flat().sort((a, b) => a - b);
    expect(slots).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});
