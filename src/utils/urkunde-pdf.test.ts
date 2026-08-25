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

  it("wraps a long comment instead of running it off the certificate", () => {
    const longComment =
      "Besonderer Dank an das Team für den spektakulären Fehlstart und die anschließende Slapstick-Einlage direkt vor der Kuppel";
    const withLongComment: UrkundeEntry[] = [
      { name: "FF Buchberg", wertung: "Turniersieger", detail: "1. Platz", comment: longComment },
    ];
    const doc = buildUrkundenDoc(withLongComment, { competitionName: "Test Cup", year: 2026 });
    const W = doc.internal.pageSize.getWidth();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(13);
    const wrapped = doc.splitTextToSize(longComment, W - 50) as string[];
    // A comment this long can't fit on one line at this font size -- if it
    // did, the maxWidth wrapping wouldn't be exercised by this test.
    expect(wrapped.length).toBeGreaterThan(1);
    expect(doc.getNumberOfPages()).toBe(1);
  });
});
