import { jsPDF } from "jspdf";

export interface UrkundeEntry {
  name: string;
  wertung: string;
  detail: string;
}

interface UrkundeMeta {
  competitionName: string;
  year: number | string;
}

type RGB = [number, number, number];
const GOLD: RGB = [154, 114, 32];
const RED: RGB = [200, 16, 46];
const DARK: RGB = [30, 32, 38];
const MUTED: RGB = [110, 110, 116];

// Builds a jsPDF document with one A4 certificate per entry.
export function buildUrkundenDoc(entries: UrkundeEntry[], meta: UrkundeMeta): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const cx = W / 2;

  const color = (rgb: RGB) => {
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  };

  entries.forEach((e, i) => {
    if (i > 0) doc.addPage();

    // Double border
    color(GOLD);
    doc.setLineWidth(0.8);
    doc.rect(12, 12, W - 24, H - 24);
    doc.setLineWidth(0.3);
    doc.rect(15, 15, W - 30, H - 30);

    // Top accent rule (in lieu of the on-screen ⊃⊂ mark, which the
    // standard PDF fonts can't render)
    color(RED);
    doc.setLineWidth(1.4);
    doc.line(cx - 18, 42, cx + 18, 42);

    // Title
    color(DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(46);
    doc.text("URKUNDE", cx, 72, { align: "center" });

    // Event
    color(MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.text(`${meta.competitionName} ${meta.year}`, cx, 86, { align: "center" });

    // Divider
    color(GOLD);
    doc.setLineWidth(0.6);
    doc.line(cx - 25, 98, cx + 25, 98);

    // Wertung
    color(GOLD);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(e.wertung.toUpperCase(), cx, 120, { align: "center" });

    // Detail
    color(MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(13);
    doc.text(e.detail, cx, 132, { align: "center" });

    // Team name
    color(DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(34);
    doc.text(e.name, cx, 168, { align: "center", maxWidth: W - 50 });

    // Signature lines
    const sy = 250;
    color(MUTED);
    doc.setLineWidth(0.3);
    doc.line(35, sy, 90, sy);
    doc.line(W - 90, sy, W - 35, sy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("Datum", 62.5, sy + 6, { align: "center" });
    doc.text("Turnierleitung", W - 62.5, sy + 6, { align: "center" });
  });

  return doc;
}

// Renders the certificates and triggers a PDF download in the browser.
export function generateUrkundenPdf(entries: UrkundeEntry[], meta: UrkundeMeta): void {
  const stamp = new Date().toISOString().slice(0, 10);
  buildUrkundenDoc(entries, meta).save(`urkunden-${stamp}.pdf`);
}
