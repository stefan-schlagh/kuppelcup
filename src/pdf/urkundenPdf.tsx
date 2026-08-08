import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { PDF_COLORS } from "./theme";
import type { PdfMeta } from "./pdfDocs";

export interface UrkundeEntry {
  name: string;
  wertung: string;
  detail: string;
}

const s = StyleSheet.create({
  page: { padding: 32, backgroundColor: PDF_COLORS.white, fontFamily: "Helvetica" },
  outerBorder: { flex: 1, borderWidth: 2, borderColor: PDF_COLORS.accent, padding: 6 },
  innerBorder: {
    flex: 1,
    borderWidth: 0.75,
    borderColor: PDF_COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 48,
  },
  // Stands in for the on-screen "⊃⊂" mark, which Helvetica (the PDF's
  // built-in font) can't render — same workaround the old jsPDF version used.
  accentRule: { width: 90, height: 3, backgroundColor: PDF_COLORS.primary, marginBottom: 28 },
  title: { fontSize: 40, fontWeight: "bold", color: PDF_COLORS.text, letterSpacing: 3, marginBottom: 10 },
  event: { fontSize: 13, color: PDF_COLORS.muted, marginBottom: 20 },
  divider: { width: 130, height: 1.5, backgroundColor: PDF_COLORS.accent, marginBottom: 20 },
  wertung: {
    fontSize: 16,
    fontWeight: "bold",
    color: PDF_COLORS.accent,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  detail: { fontSize: 12, color: PDF_COLORS.muted, marginBottom: 26, textAlign: "center" },
  teamName: { fontSize: 28, fontWeight: "bold", color: PDF_COLORS.text, textAlign: "center", marginBottom: 56 },
  signRow: { flexDirection: "row", justifyContent: "space-around", width: "100%" },
  signBlock: { alignItems: "center", width: 150 },
  signLine: { width: "100%", borderTopWidth: 1, borderTopColor: PDF_COLORS.muted, marginBottom: 6 },
  signLabel: { fontSize: 10, color: PDF_COLORS.muted },
});

function CertificatePage({ entry, meta }: { entry: UrkundeEntry; meta: PdfMeta }) {
  return (
    <Page size="A4" style={s.page}>
      <View style={s.outerBorder}>
        <View style={s.innerBorder}>
          <View style={s.accentRule} />
          <Text style={s.title}>URKUNDE</Text>
          <Text style={s.event}>{meta.competitionName} {meta.year}</Text>
          <View style={s.divider} />
          <Text style={s.wertung}>{entry.wertung}</Text>
          <Text style={s.detail}>{entry.detail}</Text>
          <Text style={s.teamName}>{entry.name}</Text>
          <View style={s.signRow}>
            <View style={s.signBlock}>
              <View style={s.signLine} />
              <Text style={s.signLabel}>Datum</Text>
            </View>
            <View style={s.signBlock}>
              <View style={s.signLine} />
              <Text style={s.signLabel}>Turnierleitung</Text>
            </View>
          </View>
        </View>
      </View>
    </Page>
  );
}

// One certificate per entry, one page each — the same document renders the
// download (via download.ts's downloadPdf) and the in-app preview (via
// UrkundenPreview.tsx's <PDFViewer>), so there's only one place the layout
// is defined.
export function UrkundenPdf({ entries, meta }: { entries: UrkundeEntry[]; meta: PdfMeta }) {
  return (
    <Document>
      {entries.map((entry, i) => <CertificatePage key={i} entry={entry} meta={meta} />)}
    </Document>
  );
}
