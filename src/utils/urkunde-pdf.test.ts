// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { buildUrkundenDoc, type UrkundeEntry } from "./urkunde-pdf";

Object.defineProperty(global.Image.prototype, "src", {
  set(_src) {
    setTimeout(() => {
      if (this.onload) this.onload();
    }, 0);
  },
});

HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue(
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
);

HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn(() => ({ data: [] })),
  putImageData: vi.fn(),
  createImageData: vi.fn(),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  roundRect: vi.fn(),
  clip: vi.fn(),
}) as any;

const entries: UrkundeEntry[] = [
  { name: "FF Buchberg", wertung: "Turniersieger", detail: "1. Platz" },
  { name: "FF Lindau", wertung: "Finalist", detail: "2. Platz", extra: "1. Platz (Gemeindewertung)" },
  { name: "FF Stainach", wertung: "Teilnehmer (außer Konkurrenz)" },
];

describe("buildUrkundenDoc", () => {
  it("renders one page per participant", async () => {
    const doc = await buildUrkundenDoc(entries, { competitionName: "Test Cup", year: 2026 });
    expect(doc.getNumberOfPages()).toBe(3);
  });

  it("uses A4 portrait (Hochformat) pages", async () => {
    const doc = await buildUrkundenDoc(entries, { competitionName: "Test Cup", year: 2026 });
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    expect(Math.round(w)).toBe(210);
    expect(Math.round(h)).toBe(297);
    expect(w).toBeLessThan(h);
  });

  it("produces a non-empty PDF blob", async () => {
    const doc = await buildUrkundenDoc(entries, { competitionName: "Test Cup", year: 2026 });
    const bytes = doc.output("arraybuffer");
    expect(bytes.byteLength).toBeGreaterThan(0);
  });
});
