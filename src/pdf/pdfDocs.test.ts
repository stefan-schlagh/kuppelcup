import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { GesamtberichtPdf, type GesamtberichtPdfProps } from "./pdfDocs";
import { buildBracket } from "../utils/tournament";
import type { RankedTeam } from "../utils/tournament";

const meta = { competitionName: "Test Cup", year: 2026 };

const team = (id: string, punkte: number): RankedTeam => ({
  id,
  start: 1,
  name: `FF ${id}`,
  dg1: { zeit: punkte, strafe: 0 },
  dg2: { zeit: punkte + 5, strafe: 0 },
  g1: punkte,
  g2: punkte + 5,
  punkte,
});

const teams = Array.from({ length: 20 }, (_, i) => team(`t${i}`, 20 + i));
const bracket = buildBracket(teams.slice(0, 8), {});

function baseProps(overrides: Partial<GesamtberichtPdfProps> = {}): GesamtberichtPdfProps {
  return {
    ranked: teams,
    top8Ids: new Set(teams.slice(0, 8).map((t) => t.id)),
    gemeinde: teams.slice(0, 3),
    dailyBest: teams,
    gesamt: teams,
    bracket,
    meta,
    ...overrides,
  };
}

function mediaBox(buf: Buffer): string {
  const match = buf.toString("latin1").match(/\/MediaBox\s*\[[^\]]*\]/);
  return match ? match[0] : "";
}

function pageCount(buf: Buffer): number {
  const match = buf.toString("latin1").match(/\/Count\s+(\d+)/);
  return match ? Number(match[1]) : -1;
}

describe("GesamtberichtPdf", () => {
  it("renders a single A4 portrait page, even with a full 20-team roster", async () => {
    const buf = await renderToBuffer(GesamtberichtPdf(baseProps()));
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pageCount(buf)).toBe(1);
    expect(mediaBox(buf)).toBe("/MediaBox [0 0 595.280029 841.890015]");
  });

  it("doesn't crash with no teams and an empty bracket", async () => {
    const buf = await renderToBuffer(GesamtberichtPdf(baseProps({
      ranked: [], top8Ids: new Set(), gemeinde: [], dailyBest: [], gesamt: [], bracket: buildBracket([], {}),
    })));
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pageCount(buf)).toBe(1);
  });

  it("still fits one page with only a handful of teams (a sparse, mostly-bye bracket)", async () => {
    const few = teams.slice(0, 3);
    const buf = await renderToBuffer(GesamtberichtPdf(baseProps({
      ranked: few, top8Ids: new Set(few.map((t) => t.id)), gemeinde: few, dailyBest: few, gesamt: few,
      bracket: buildBracket(few, {}),
    })));
    expect(pageCount(buf)).toBe(1);
  });
});
