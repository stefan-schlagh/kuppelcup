import type { Team, RunData } from "../types";

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