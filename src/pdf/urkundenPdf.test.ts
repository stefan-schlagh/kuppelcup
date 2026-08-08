import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { UrkundenPdf, type UrkundeEntry } from "./urkundenPdf";

const meta = { competitionName: "Test Cup", year: 2026 };

const entries: UrkundeEntry[] = [
  { name: "FF Buchberg", wertung: "Turniersieger", detail: "Grunddurchgang: Rang 1 · 41.5 Punkte" },
  { name: "FF Lindau", wertung: "Finalist", detail: "Grunddurchgang: Rang 2 · 42 Punkte" },
  { name: "FF Stainach", wertung: "Teilnehmerurkunde", detail: "Teilnahme am Grunddurchgang" },
];

function pageCount(buf: Buffer): number {
  const match = buf.toString("latin1").match(/\/Count\s+(\d+)/);
  return match ? Number(match[1]) : -1;
}

function mediaBox(buf: Buffer): string {
  const match = buf.toString("latin1").match(/\/MediaBox\s*\[[^\]]*\]/);
  return match ? match[0] : "";
}

describe("UrkundenPdf", () => {
  it("renders one A4 portrait page per participant", async () => {
    const buf = await renderToBuffer(UrkundenPdf({ entries, meta }));
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pageCount(buf)).toBe(3);
    expect(mediaBox(buf)).toBe("/MediaBox [0 0 595.280029 841.890015]");
  });

  it("renders a single page for a single entry", async () => {
    const buf = await renderToBuffer(UrkundenPdf({ entries: entries.slice(0, 1), meta }));
    expect(pageCount(buf)).toBe(1);
  });
});
