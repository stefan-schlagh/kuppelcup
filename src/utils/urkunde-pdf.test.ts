import { describe, it, expect } from "vitest";
import { buildUrkundenDoc, type UrkundeEntry } from "./urkunde-pdf";

const entries: UrkundeEntry[] = [
  { name: "FF Buchberg", wertung: "Turniersieger", detail: "1. Platz" },
  { name: "FF Lindau", wertung: "Finalist", detail: "2. Platz", extra: "1. Platz (Gemeindewertung)" },
  { name: "FF Stainach", wertung: "Teilnehmer (außer Konkurrenz)" },
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
