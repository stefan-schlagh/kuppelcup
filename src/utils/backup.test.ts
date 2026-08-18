import { describe, it, expect } from "vitest";
import { teamsToCsv, csvToTeams, backupToCsv, csvToBackup, slugifyFilename } from "./backup";
import type { KoState, Team } from "../types";

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

describe("backup + restore (teams and K.O. heats together)", () => {
  const ko: KoState = {
    qf1: { runA: { zeit: 20.5, strafe: 0 }, runB: { zeit: 22.1, strafe: 5 } },
    qf2: { runA: { zeit: 19.8, strafe: 0 } }, // no runB recorded yet
    final: { runA: { zeit: 18, strafe: 0 }, runB: { zeit: 18, strafe: 0 } }, // a tie
  };

  it("round-trips teams and K.O. results together", () => {
    const csv = backupToCsv(teams, ko);
    const restored = csvToBackup(csv);
    expect(restored.teams).toHaveLength(2);
    expect(restored.teams[0]).toEqual(teams[0]);
    expect(restored.ko).toEqual(ko);
  });

  it("the K.O. section is a separate CSV block, not mixed into the team rows", () => {
    const csv = backupToCsv(teams, ko);
    const [teamBlock, koBlock] = csv.split(/\r?\n\s*\r?\n/);
    expect(teamBlock.split("\n")).toHaveLength(1 + teams.length); // header + rows
    expect(koBlock).toContain("match,side,zeit,strafe");
    // csvToTeams on just the team block still works standalone (no K.O.
    // rows leaking in and corrupting the count).
    expect(csvToTeams(teamBlock)).toHaveLength(2);
  });

  it("omits the K.O. block entirely when there are no recorded runs", () => {
    const csv = backupToCsv(teams, {});
    expect(csv).toBe(teamsToCsv(teams)); // identical to the old team-only format
    expect(csvToBackup(csv).ko).toEqual({});
  });

  it("reads an old team-only export (no K.O. block) as teams + empty ko", () => {
    const oldStyleCsv = teamsToCsv(teams);
    const restored = csvToBackup(oldStyleCsv);
    expect(restored.teams).toHaveLength(2);
    expect(restored.ko).toEqual({});
  });

  it("ignores a K.O. row with an unknown side or missing match id", () => {
    const csv = `${teamsToCsv(teams)}\n\nmatch,side,zeit,strafe\nqf1,A,20,0\nqf1,C,99,0\n,B,50,0`;
    const restored = csvToBackup(csv);
    expect(restored.ko).toEqual({ qf1: { runA: { zeit: 20, strafe: 0 } } });
  });
});

describe("slugifyFilename", () => {
  it("lowercases and hyphenates spaces and punctuation", () => {
    expect(slugifyFilename("1. Geissberg KUPPELCUP")).toBe("1-geissberg-kuppelcup");
  });

  it("transliterates German umlauts and eszett instead of dropping them", () => {
    expect(slugifyFilename("Grüß Gott Übung")).toBe("gruess-gott-uebung");
  });

  it("trims leading/trailing hyphens produced by leading/trailing punctuation", () => {
    expect(slugifyFilename("  #KuppelCup 2026!  ")).toBe("kuppelcup-2026");
  });
});
