import { pdf, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";

// Renders a react-pdf <Document> element to a blob and triggers a browser
// download — the same component tree a <PDFViewer> preview would use, per
// react-pdf's whole point: one definition, multiple outputs.
export async function downloadPdf(doc: ReactElement<DocumentProps>, filename: string): Promise<void> {
  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
