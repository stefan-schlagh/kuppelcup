import { describe, it, expect } from "vitest";
import { buildUrkundenDoc, type UrkundeEntry } from "./urkunde-pdf";

const entries: UrkundeEntry[] = [
  { name: "FF Buchberg", wertung: "Turniersieger", detail: "Grunddurchgang: Rang 1 · 41.5 Punkte" },
  { name: "FF Lindau", wertung: "Finalist", detail: "Grunddurchgang: Rang 2 · 42 Punkte" },
  { name: "FF Stainach", wertung: "Teilnehmerurkunde", detail: "Teilnahme am Grunddurchgang" },
];

describe("buildUrkundenDoc", () => {
  it("renders one page per participant", () => {
    const doc = buildUrkundenDoc(entries, { competitionName: "Test Cup", year: 2026 });
    expect(doc.getNumberOfPages()).toBe(3);
  });

  it("uses A4 portrait (Hochformat) pages", () => {
    const doc = buildUrkundenDoc(entries, { competitionName: "Test Cup", year: 2026 });
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    expect(Math.round(w)).toBe(210);
    expect(Math.round(h)).toBe(297);
    expect(w).toBeLessThan(h);
  });

  it("produces a non-empty PDF blob", () => {
    const doc = buildUrkundenDoc(entries, { competitionName: "Test Cup", year: 2026 });
    const bytes = doc.output("arraybuffer");
    expect(bytes.byteLength).toBeGreaterThan(0);
  });
});
