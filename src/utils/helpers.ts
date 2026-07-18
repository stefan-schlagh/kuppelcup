import type { Team, RunData, EventPhase } from "../types";

export const fmtTime = (s: any) => {
  if (s == null || Number.isNaN(s)) return "–";
  const m = Math.floor(s / 60);
  const sec = (s - m * 60).toFixed(2).padStart(5, "0");
  return `${m}:${sec}`;
};

export const PENALTY_OPTIONS = [0, 5, 10, 20];

export const seedTeams = () => {
  const names = [
    "FF Buchberg", "FF Lindau", "FF Stainach", "FF Rosenau", "FF Engelsdorf",
    "FF Hofkirchen", "FF Talheim", "FF Sonnberg", "FF Wiesenbach", "FF Mooshof",
    "FF Greifenstein", "FF Eichgraben", "FF Tannwald", "FF Bergheim", "FF Aurach",
    "FF Steinwand", "FF Fellbach", "FF Dornbach", "FF Königsau", "FF Reitdorf",
  ];
  
  /*const randomStrafe = () => {
    const r = Math.random();
    if (r < 0.65) return 0;
    const pool = [5, 10, 20];
    const count = r < 0.9 ? 1 : 2; 
    let sum = 0;
    for (let i = 0; i < count; i++) sum += pool[Math.floor(Math.random() * pool.length)];
    return sum;
  };*/

  return names.map((name, i) => {
    //const base = 18 + Math.random() * 10;
    return {
      id: `t${i + 1}`,
      name,
      start: i + 1,
      gastgeber: i === 0, 
      dg1: { zeit: null, strafe: null },
      dg2: { zeit: null, strafe: null },
      //dg1: { zeit: +(base + Math.random() * 4 - 1).toFixed(2), strafe: randomStrafe() },
      //dg2: { zeit: +(base + Math.random() * 4 - 1).toFixed(2), strafe: randomStrafe() },
    };
  });
};

export function gesamt(run: RunData) {
  if (!run || run.zeit == null) return null;
  return run.zeit + (run.strafe || 0);
}

export function punkte(t: Team): number {
  const g1 = gesamt(t.dg1);
  const g2 = gesamt(t.dg2);
  if (g1 == null && g2 == null) return 0;
  if (g1 == null) return g2!;
  if (g2 == null) return g1;
  return Math.min(g1, g2);
}

export const SEED_ORDER = [
  [0, 7], [3, 4], [1, 6], [2, 5],
];

export const PHASES: EventPhase[] = ["anmeldung", "durchfuehrung", "abgeschlossen"];

export const PHASE_LABELS: Record<EventPhase, string> = {
  anmeldung: "Anmeldung",
  durchfuehrung: "Durchführung",
  abgeschlossen: "Abgeschlossen",
};

// Create a fresh team with empty runs and a unique id.
export function makeTeam(name: string, start: number): Team {
  return {
    id: `t-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    name,
    start,
    dg1: { zeit: null, strafe: null },
    dg2: { zeit: null, strafe: null },
  };
}

const randomStrafe = () => {
  const r = Math.random();
  if (r < 0.65) return 0;
  const pool = [5, 10, 20];
  const count = r < 0.9 ? 1 : 2;
  let sum = 0;
  for (let i = 0; i < count; i++) sum += pool[Math.floor(Math.random() * pool.length)];
  return sum;
};

// Fill every team's runs with plausible random times/penalties (for testing).
export function withRandomResults(teams: Team[]): Team[] {
  return teams.map((t) => {
    const base = 18 + Math.random() * 10;
    const run = () => ({ zeit: +(base + Math.random() * 4 - 1).toFixed(2), strafe: randomStrafe() });
    return { ...t, dg1: run(), dg2: run() };
  });
}

export const KO_MATCH_IDS = ["qf1", "qf2", "qf3", "qf4", "sf1", "sf2", "final"];

// Fill the K.O. bracket with random run times (for testing). Winners are
// derived reactively from these runs, so we only emit run times per match.
// Returns an empty state if there are not enough eligible teams for a bracket.
export function randomKoResults(teams: Team[]): Record<string, { runA: RunData; runB: RunData }> {
  const eligible = teams.filter((t) => !t.gastgeber && punkte(t) > 0);
  if (eligible.length < 8) return {};
  const run = (): RunData => ({ zeit: +(20 + Math.random() * 8).toFixed(2), strafe: randomStrafe() });
  const ko: Record<string, { runA: RunData; runB: RunData }> = {};
  KO_MATCH_IDS.forEach((id) => {
    ko[id] = { runA: run(), runB: run() };
  });
  return ko;
}