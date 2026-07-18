import type { Team } from "../types";

// Flat CSV backup of the base-round data (the hand-entered Grunddurchgang).
// One row per team; round-trippable via teamsToCsv / csvToTeams.

const COLUMNS = [
  "id",
  "start",
  "name",
  "gastgeber",
  "gemeinde",
  "dg1_zeit",
  "dg1_strafe",
  "dg2_zeit",
  "dg2_strafe",
] as const;

const escapeCell = (value: string): string => {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
};

const numCell = (n: number | null): string => (n == null ? "" : String(n));

export function teamsToCsv(teams: Team[]): string {
  const rows = teams.map((t) =>
    [
      t.id,
      String(t.start),
      escapeCell(t.name),
      t.gastgeber ? "1" : "0",
      t.gemeinde ? "1" : "0",
      numCell(t.dg1.zeit),
      numCell(t.dg1.strafe),
      numCell(t.dg2.zeit),
      numCell(t.dg2.strafe),
    ].join(","),
  );
  return [COLUMNS.join(","), ...rows].join("\n");
}

// Minimal CSV line splitter that understands quoted cells with escaped quotes.
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

const parseNum = (cell: string): number | null => {
  const trimmed = cell.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isNaN(n) ? null : n;
};

export function csvToTeams(csv: string): Team[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);

  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const at = (name: string) => cells[idx(name)] ?? "";
    return {
      id: at("id").trim(),
      start: parseNum(at("start")) ?? 0,
      name: at("name").trim(),
      gastgeber: at("gastgeber").trim() === "1",
      gemeinde: at("gemeinde").trim() === "1",
      dg1: { zeit: parseNum(at("dg1_zeit")), strafe: parseNum(at("dg1_strafe")) },
      dg2: { zeit: parseNum(at("dg2_zeit")), strafe: parseNum(at("dg2_strafe")) },
    };
  });
}

// Trigger a browser download of the given text content.
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
