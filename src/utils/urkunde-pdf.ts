import { jsPDF } from "jspdf";

export interface UrkundeEntry {
  name: string;
  wertung: string;
  detail?: string;
  extra?: string;
}

interface UrkundeMeta {
  competitionName: string;
  year: number | string;
}

type RGB = [number, number, number];
const RED: RGB = [200, 16, 46];
const DARK: RGB = [30, 32, 38];
const MUTED: RGB = [110, 110, 116];

if (typeof Image === "undefined") {
  global.Image = class {
    onload: () => void = () => {};
    onerror: (err?: any) => void = () => {};
    private _src: string = "";

    set src(value: string) {
      this._src = value;
      setTimeout(() => this.onload(), 10);
    }
    get src() {
      return this._src;
    }
  } as any;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      resolve(image);
    };

    image.onerror = () => {
      reject(
        new Error(
          `Failed to load image from ${src}. Make sure the file exists and is accessible.`
        )
      );
    };

    image.src = src;
  });
}

function processBackgroundImage(image: HTMLImageElement, borderRadius: number ): string {
  const canvas = document.createElement("canvas");

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error(
      "Failed to get 2D context from canvas. Your browser may not support the Canvas API."
    );
  }

  const w = canvas.width;
  const h = canvas.height;

  context.beginPath();
  if (typeof context.roundRect === "function") {
    context.roundRect(0, 0, w, h, borderRadius);
  } else {
    // Fallback for browsers that do not support roundRect
    const r = borderRadius;
    context.moveTo(r, 0);
    context.arcTo(w, 0, w, h, r);
    context.arcTo(w, h, 0, h, r);
    context.arcTo(0, h, 0, 0, r);
    context.arcTo(0, 0, w, 0, r);
    context.closePath();
  }
  context.clip();

  context.drawImage(image, 0, 0, w, h);

  return canvas.toDataURL("image/png");
}

// Konvertiert das SVG-Logo via Canvas in eine PNG-Data-URL (für jsPDF Kompatibilität)
function getHoseLogoPngDataUrl(): Promise<string> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40">
    <!-- Linkes Element (D): Öffnung nach links, Rundung nach rechts -->
    <path fill="#C8102E" d="M 10,8 H 36 C 42.5,8 47.5,13 47.5,20 C 47.5,27 42.5,32 36,32 H 10 V 25 H 36 C 38.8,25 41,22.8 41,20 C 41,17.2 38.8,15 36,15 H 10 Z"/>
    
    <!-- Rechtes Element (C): Öffnung nach rechts, Rundung nach links -->
    <path fill="#C8102E" d="M 90,8 H 64 C 57.5,8 52.5,13 52.5,20 C 52.5,27 57.5,32 64,32 H 90 V 25 H 64 C 61.2,25 59,22.8 59,20 C 59,17.2 61.2,15 64,15 H 90 Z"/>
  </svg>`;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 160;
      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      } else {
        reject(new Error("Canvas context missing"));
      }
    };
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

// Builds a jsPDF document with one A4 certificate per entry.
export async function buildUrkundenDoc(entries: UrkundeEntry[], meta: UrkundeMeta): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const cx = W / 2;

  const backgroundImage = await loadImage("/CertificateBackground.png");

  const margin = 6;

  const borderRadiusMm = 5;
  const innerWidthMm = W - 2 * margin;
  const scale = backgroundImage.naturalWidth / innerWidthMm;
  const borderRadiusPx = borderRadiusMm * scale;

  const backgroundDataUrl = processBackgroundImage(backgroundImage, borderRadiusPx);

  // Hose-Logo als PNG Data-URL generieren
  const hoseLogoDataUrl = await getHoseLogoPngDataUrl();

  const color = (rgb: RGB): void => {
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  };

  entries.forEach((e, i) => {
    if (i > 0) doc.addPage();

    // 1. Hintergrundfläche
    doc.setFillColor(248, 248, 247);
    doc.rect(0, 0, W, H, "F");

    // 2. Hintergrundbild bündig zum Außenrahmen rendern
    const innerWidth = W - 2 * margin;
    const innerHeight = H - 2 * margin;

    doc.addImage(backgroundDataUrl, "PNG", margin, margin, innerWidth, innerHeight);

    // 3. Äußerer abgerundeter Rahmen
    doc.setDrawColor(255, 110, 115);
    doc.setLineWidth(0.8);
    doc.roundedRect(margin, margin, innerWidth, innerHeight, borderRadiusMm, borderRadiusMm, "S");

    // 4. Rotes DC-Logo als PNG gerendert
    const logoWidth = 18;
    const logoHeight = 7.2;
    doc.addImage(hoseLogoDataUrl, "PNG", cx - logoWidth / 2, 87, logoWidth, logoHeight);

    // 5. Title ("URKUNDE")
    color(DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(36);
    doc.text("URKUNDE", cx, 114, { align: "center" });

    // 6. Event ("1. GEISSBERGKUPPELCUP 2026")
    color(MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const eventNameFormatted = `${meta.competitionName} ${meta.year}`.replace(/ß/g, "SS").toUpperCase();
    doc.text(eventNameFormatted, cx, 125, { align: "center" });

    // 7. Trennlinie
    color(RED);
    doc.setLineWidth(0.5);
    doc.line(cx - 20, 134, cx + 20, 134);

    // 8. Wertung ("TEILNEHMERURKUNDE")
    color(RED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(e.wertung.toUpperCase(), cx, 146, { align: "center" });

    // 9. Detail-Text ("Grunddurchgang: Rang 1...")
    color(MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    if (e.detail) doc.text(e.detail, cx, 132, { align: "center" });
    if (e.extra) doc.text(e.extra, cx, e.detail ? 140 : 132, { align: "center" })

    // 10. Team Name ("FF Greifenstein")
    color(DARK);
    doc.setFont("helvetica", "bold");
    let teamFontSize = 30;
    doc.setFontSize(teamFontSize);
    const maxTeamWidth = W - 50;
    while (doc.getTextWidth(e.name) > maxTeamWidth && teamFontSize > 14) {
      teamFontSize--;
      doc.setFontSize(teamFontSize);
    }
    doc.text(e.name, cx, 178, { align: "center" });

    // 11. Unterschriftenzeilen
    const sy = 212;
    const lineLength = 55;
    const spacingFromCenter = 10;

    color(MUTED);
    doc.setLineWidth(0.3);

    // Linke Linie & Beschriftung
    const leftLineStart = cx - spacingFromCenter - lineLength;
    const leftLineEnd = cx - spacingFromCenter;
    doc.line(leftLineStart, sy, leftLineEnd, sy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Datum", (leftLineStart + leftLineEnd) / 2, sy + 6, { align: "center" });

    // Rechte Linie & Beschriftung
    const rightLineStart = cx + spacingFromCenter;
    const rightLineEnd = cx + spacingFromCenter + lineLength;
    doc.line(rightLineStart, sy, rightLineEnd, sy);
    doc.text("Turnierleitung", (rightLineStart + rightLineEnd) / 2, sy + 6, { align: "center" });
  });

  return doc;
}

export async function generateUrkundenPdf(entries: UrkundeEntry[], meta: UrkundeMeta): Promise<void> {
  const stamp = new Date().toISOString().slice(0, 10);
  const document = await buildUrkundenDoc(entries, meta);
  document.save(`urkunden-${stamp}.pdf`);
}