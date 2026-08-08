import { PDFViewer } from "@react-pdf/renderer";
import { UrkundenPdf, type UrkundeEntry } from "./urkundenPdf";
import type { PdfMeta } from "./pdfDocs";

// A separate file (not just a function in Urkunden.tsx) so React.lazy() can
// code-split it — @react-pdf/renderer is large and PDFViewer in particular
// pulls in its own PDF-rendering worker, which only admins with the
// Urkunden tab open ever need.
export default function UrkundenPreview({ entries, meta }: { entries: UrkundeEntry[]; meta: PdfMeta }) {
  return (
    <PDFViewer width="100%" height={720} showToolbar className="urkunden-pdf-viewer">
      <UrkundenPdf entries={entries} meta={meta} />
    </PDFViewer>
  );
}
