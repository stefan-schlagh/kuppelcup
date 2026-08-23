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
const ORANGE: RGB = [255, 117, 31];

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

function toAbsoluteUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  // Falls im Browser geladen
  if (typeof window !== "undefined" && window.location?.origin) {
    return new URL(url, window.location.origin).href;
  }
  // Fallback für Node/Vitest-Testumgebung
  return `http://localhost${url.startsWith("/") ? "" : "/"}${url}`;
}

async function loadFontAsBase64(url: string): Promise<string> {
  const response = await fetch(toAbsoluteUrl(url));
  if (!response.ok) {
    throw new Error(`Failed to fetch font: ${response.statusText}`);
  }
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      resolve(base64data.split(",")[1]);  
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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


function loadSvgAsPng(src: string, width: number = 300, height: number = 300): Promise<string> {
  return new Promise((resolve, reject) => {
    fetch(toAbsoluteUrl(src))
      .then((res) => res.text())
      .then((svgText) => {
        // Fallback für Testumgebungen ohne vollständige DOM-Canvas-Unterstützung
        if (typeof document === "undefined" || !document.createElement) {
          return resolve("");
        }

        const img = new Image();
        const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
        const url = (typeof URL !== "undefined" && URL.createObjectURL) 
          ? URL.createObjectURL(svgBlob) 
          : `data:image/svg+xml;utf8,${encodeURI(svgText)}`;

        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d");
          if (context) {
            context.drawImage(img, 0, 0, width, height);
            if (typeof URL !== "undefined" && URL.revokeObjectURL && url.startsWith("blob:")) {
              URL.revokeObjectURL(url);
            }
            resolve(canvas.toDataURL("image/png"));
          } else {
            reject(new Error("Canvas context failed"));
          }
        };
        img.onerror = (err) => reject(err);
        img.src = url;
      })
      .catch(reject);
  });
}

function drawTextWithLetterSpacing(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  spacingMm: number,
  options: { align?: "left" | "center" | "right" } = {}
) {
  const characters = text.split("");
  
  // Gesamtbreite berechnen
  let totalWidth = 0;
  characters.forEach((char) => {
    totalWidth += doc.getTextWidth(char) + spacingMm;
  });
  totalWidth -= spacingMm; // Letzten Abstand abziehen

  // Startposition anhand der Ausrichtung ermitteln
  let currentX = x;
  if (options.align === "center") {
    currentX = x - totalWidth / 2;
  } else if (options.align === "right") {
    currentX = x - totalWidth;
  }

  // Buchstaben einzeln zeichnen
  characters.forEach((char) => {
    doc.text(char, currentX, y);
    currentX += doc.getTextWidth(char) + spacingMm;
  });
}

// Builds a jsPDF document with one A4 certificate per entry.
export async function buildUrkundenDoc(entries: UrkundeEntry[], meta: UrkundeMeta): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const cx = W / 2;

  const margin = 6;
  const borderRadiusMm = 5;

  let hasCustomFont = false;
  try {
    const fontBase64 = await loadFontAsBase64("/Oswald-Bold.ttf");
    doc.addFileToVFS("Oswald-Bold.ttf", fontBase64);
    doc.addFont("Oswald-Bold.ttf", "Oswald", "bold");
    hasCustomFont = true;
  } catch (e) {
    console.warn("Custom Font Oswald-Bold.ttf konnte nicht geladen werden, verwende Fallback Helvetica.");
  }

  const [backgroundImage, hoseLogoDataUrl, geissPngDataUrl, ffLogoPngDataUrl] = await Promise.all([
    loadImage("/CertificateBackground.png"),
    loadSvgAsPng("/Hose.svg", 400, 150),
    loadSvgAsPng("/GeissColored.svg", 200, 414),
    loadSvgAsPng("/ff.svg", 100, 100),
  ]);

  const innerWidthMm = W - 2 * margin;
  const scale = backgroundImage.naturalWidth / innerWidthMm;
  const borderRadiusPx = borderRadiusMm * scale;
  const backgroundDataUrl = processBackgroundImage(backgroundImage, borderRadiusPx);

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
    color(RED);
    doc.setLineWidth(0.8);
    doc.roundedRect(margin, margin, innerWidth, innerHeight, borderRadiusMm, borderRadiusMm, "S");

    // 4. Rotes DC-Logo als PNG gerendert
    const logoWidth = 16;
    const logoHeight = 6.4;
    doc.addImage(hoseLogoDataUrl, "PNG", cx - logoWidth / 2, 72, logoWidth, logoHeight);

    // 5. Title ("URKUNDE")
    color(DARK);
    doc.setFont(hasCustomFont ? "Oswald" : "helvetica", "bold");
    doc.setFontSize(60);
    drawTextWithLetterSpacing(doc, "URKUNDE", cx, 112, 1.5875, { align: "center" });

    // 6. Event ("1. GEISSBERGKUPPELCUP 2026")
    color(MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(16);
    const eventNameFormatted = `${meta.competitionName} ${meta.year}`.replace(/ß/g, "SS").toUpperCase();
    doc.text(eventNameFormatted, cx, 123, { align: "center" });

    // 7. Trennlinie
    color(RED);
    doc.setLineWidth(0.5);
    doc.line(cx - 24, 132, cx + 24, 132);

    // 8. Wertung ("TEILNEHMERURKUNDE")
    color(RED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    drawTextWithLetterSpacing(doc, e.wertung.toUpperCase(), cx, 144, 0.8, { align: "center" });

    // 9. Detail-Text ("Grunddurchgang: Rang 1...")
    color(MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(16);
    let nextY = 152;
    if (e.detail) {
      doc.text(e.detail, cx, nextY, { align: "center" });
      nextY += 8;
    }
    if (e.extra) {
      doc.text(e.extra, cx, nextY, { align: "center" });
    }
    // 10. Team Name ("FF Greifenstein")
    color(DARK);
    doc.setFont(hasCustomFont ? "Oswald" : "helvetica", "bold");
    let teamFontSize = 45;
    doc.setFontSize(teamFontSize);
    const maxTeamWidth = W - 50;
    while (doc.getTextWidth(e.name) > maxTeamWidth && teamFontSize > 16) {
      teamFontSize--;
      doc.setFontSize(teamFontSize);
    }
    doc.text(e.name, cx, 186, { align: "center" });

    // 11. Unterschriftenzeilen
    const sy = 224;
    const lineLength = 52;
    const spacingFromCenter = 18;

    color(MUTED);
    doc.setLineWidth(0.3);

    // Linke Linie & Beschriftung
    const leftLineStart = cx - spacingFromCenter - lineLength;
    const leftLineEnd = cx - spacingFromCenter;
    doc.line(leftLineStart, sy, leftLineEnd, sy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text("Datum", (leftLineStart + leftLineEnd) / 2, sy + 6, { align: "center" });

    // Rechte Linie & Beschriftung
    const rightLineStart = cx + spacingFromCenter;
    const rightLineEnd = cx + spacingFromCenter + lineLength;
    doc.line(rightLineStart, sy, rightLineEnd, sy);
    doc.text("Turnierleitung", (rightLineStart + rightLineEnd) / 2, sy + 6, { align: "center" });

    // 12. Geiß-Logo
    const geissW = 20;
    const geissH = 41.4194915254236;
    doc.addImage(geissPngDataUrl, "PNG", cx - geissW / 2, 198.580508474576 , geissW, geissH);

    //13. Feuerwehr Ringendorf Badge
    const badgeW = 42;
    const badgeH = 17;
    const badgeX = cx - badgeW / 2;
    const badgeY = 239.5;

    doc.setFillColor(255, 255, 255);
    color(ORANGE);
    doc.setLineWidth(0.35);
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 5, 5, "FD");

    const ffLogoW = 6.6;
    const ffLogoH = 8.5;
    const ffLogoX = badgeX + 4.3;
    const ffLogoY = badgeY + (badgeH - ffLogoH) / 2;

    doc.addImage(ffLogoPngDataUrl, "PNG", ffLogoX, ffLogoY , ffLogoW, ffLogoH);

    const textX = ffLogoX + ffLogoW + 2;
    
    color(MUTED);
    doc.setFontSize(7);
    doc.setFont(hasCustomFont ? "Oswald" : "helvetica" , "bold");
    doc.text("FREIWILLIGE FEUERWEHR", textX, badgeY + 6.5);

    color(MUTED);
    doc.setFontSize(13.5);
    doc.setFont(hasCustomFont ? "Oswald" : "helvetica" , "bold");
    doc.text("RINGENDORF", textX, badgeY + 12.2);
  });

  return doc;
}

export async function generateUrkundenPdf(entries: UrkundeEntry[], meta: UrkundeMeta): Promise<void> {
  const stamp = new Date().toISOString().slice(0, 10);
  const document = await buildUrkundenDoc(entries, meta);
  document.save(`urkunden-${stamp}.pdf`);
}