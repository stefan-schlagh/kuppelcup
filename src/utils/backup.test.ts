import { describe, it, expect } from "vitest";
import { teamsToCsv, csvToTeams } from "./backup";
import type { Team } from "../types";

const teams: Team[] = [
  {
    id: "t1",
    start: 1,
    name: "FF Buchberg",
    gastgeber: true,
    gemeinde: false,
    dg1: { zeit: 22.5, strafe: 5 },
    dg2: { zeit: null, strafe: null },
  },
  {
    id: "t2",
    start: 2,
    name: 'FF "Ober, Unten"',
    gemeinde: true,
    dg1: { zeit: 19, strafe: 0 },
    dg2: { zeit: 20.1, strafe: 10 },
  },
];

describe("backup CSV", () => {
  it("round-trips teams through CSV, preserving values and quoting", () => {
    const restored = csvToTeams(teamsToCsv(teams));
    expect(restored).toHaveLength(2);
    expect(restored[0]).toEqual({
      id: "t1",
      start: 1,
      name: "FF Buchberg",
      gastgeber: true,
      gemeinde: false,
      dg1: { zeit: 22.5, strafe: 5 },
      dg2: { zeit: null, strafe: null },
    });
    // Name with quotes and comma survives the round-trip.
    expect(restored[1].name).toBe('FF "Ober, Unten"');
    expect(restored[1].gemeinde).toBe(true);
    expect(restored[1].dg2).toEqual({ zeit: 20.1, strafe: 10 });
  });

  it("returns an empty array for header-only or blank input", () => {
    expect(csvToTeams("")).toEqual([]);
    expect(csvToTeams("id,start,name")).toEqual([]);
  });
});
