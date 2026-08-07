import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { RankedTeam } from "../utils/tournament";
import type { BracketData, Match, Team } from "../types";
import { fmtTime, gesamt } from "../utils/helpers";
import { PDF_COLORS } from "./theme";

export interface PdfMeta {
  competitionName: string;
  year: number | string;
}

// One combined A4 page: Turnierbaum at the top, then Grunddurchgang
// (widest, most detail) alongside three compact Rang/Team/Punkte lists
// (Gemeindewertung, Tagesbestzeit, Gesamtwertung) — small text throughout
// by design, to fit an arbitrary team count on a single physical page.
const s = StyleSheet.create({
  page: { padding: 20, fontFamily: "Helvetica", color: PDF_COLORS.text, backgroundColor: PDF_COLORS.white },
  title: { fontSize: 15, fontWeight: "bold" },
  subtitle: { fontSize: 9, color: PDF_COLORS.muted, marginBottom: 8 },
  sectionLabel: { fontSize: 7, fontWeight: "bold", color: PDF_COLORS.muted, textTransform: "uppercase", marginBottom: 2 },

  bracketRow: { flexDirection: "row", gap: 6, marginBottom: 10 },
  bracketCol: { flex: 1, gap: 4 },
  matchBox: { borderWidth: 0.5, borderColor: PDF_COLORS.border, borderRadius: 2 },
  matchRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2, paddingHorizontal: 3 },
  matchDivider: { borderTopWidth: 0.5, borderTopColor: PDF_COLORS.border },
  matchName: { fontSize: 6 },
  matchWinner: { color: PDF_COLORS.accent, fontWeight: "bold" },
  matchTime: { fontSize: 6, color: PDF_COLORS.muted },
  tiedNote: { fontSize: 5, textAlign: "center", color: PDF_COLORS.primary, fontWeight: "bold", paddingVertical: 1 },

  tablesRow: { flexDirection: "row", gap: 6 },
  table: { borderTopWidth: 0.5, borderTopColor: PDF_COLORS.border },
  headerRow: { flexDirection: "row", backgroundColor: PDF_COLORS.headerBg, borderBottomWidth: 0.5, borderBottomColor: PDF_COLORS.border, paddingVertical: 2, paddingHorizontal: 2 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: PDF_COLORS.border, paddingVertical: 1.5, paddingHorizontal: 2 },
  rowQualified: { backgroundColor: PDF_COLORS.rowAlt },
  th: { fontSize: 6, fontWeight: "bold", textTransform: "uppercase", color: PDF_COLORS.muted },
  td: { fontSize: 6 },
  emptyText: { fontSize: 6, color: PDF_COLORS.muted, padding: 4 },
});

interface Column {
  key: string;
  header: string;
  width: number; // percent of the table's own (already flex-sized) width
  align?: "left" | "right" | "center";
  render: (team: RankedTeam, index: number) => string;
}

function CompactTable({ title, flex, columns, rows, highlight }: {
  title: string;
  flex: number;
  columns: Column[];
  rows: RankedTeam[];
  highlight?: (team: RankedTeam) => boolean;
}) {
  return (
    <View style={{ flex }}>
      <Text style={s.sectionLabel}>{title}</Text>
      <View style={s.table}>
        <View style={s.headerRow}>
          {columns.map((c) => (
            <Text key={c.key} style={[s.th, { width: `${c.width}%`, textAlign: c.align ?? "left" }]}>{c.header}</Text>
          ))}
        </View>
        {rows.length === 0 ? (
          <Text style={s.emptyText}>–</Text>
        ) : (
          rows.map((team, i) => (
            <View key={team.id} style={highlight?.(team) ? [s.row, s.rowQualified] : s.row}>
              {columns.map((c) => (
                <Text key={c.key} style={[s.td, { width: `${c.width}%`, textAlign: c.align ?? "left" }]}>
                  {c.render(team, i)}
                </Text>
              ))}
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const rangCol: Column = { key: "rang", header: "#", width: 15, render: (_t, i) => String(i + 1) };
const teamCol: Column = { key: "team", header: "Team", width: 55, render: (t) => t.name };
const punkteCol: Column = { key: "punkte", header: "Pkt.", width: 30, align: "right", render: (t) => String(t.punkte) };
const simpleColumns: Column[] = [rangCol, teamCol, punkteCol];

function score(run: Match["runA"]): string {
  const total = gesamt(run);
  return total != null ? fmtTime(total) : "—";
}

function MatchBox({ match }: { match: Match }) {
  const row = (team: Team | null, run: Match["runA"]) => {
    const isWinner = !!match.winnerId && match.winnerId === team?.id;
    return (
      <View style={s.matchRow}>
        <Text style={isWinner ? [s.matchName, s.matchWinner] : s.matchName}>{team?.name ?? "—"}</Text>
        <Text style={s.matchTime}>{score(run)}</Text>
      </View>
    );
  };
  return (
    <View style={s.matchBox}>
      {row(match.teamA, match.runA)}
      <View style={s.matchDivider} />
      {row(match.teamB, match.runB)}
      {match.tied && <Text style={s.tiedNote}>Unentschieden</Text>}
    </View>
  );
}

function CompactBracket({ bracket }: { bracket: BracketData }) {
  const [qfL1, qfL2, qfR1, qfR2] = bracket.qf;
  const [sfL, sfR] = bracket.sf;
  return (
    <View>
      <Text style={s.sectionLabel}>Turnierbaum — Top 8</Text>
      <View style={s.bracketRow}>
        <View style={s.bracketCol}><MatchBox match={qfL1} /><MatchBox match={qfL2} /></View>
        <View style={s.bracketCol}><MatchBox match={sfL} /></View>
        <View style={s.bracketCol}><MatchBox match={bracket.final} /></View>
        <View style={s.bracketCol}><MatchBox match={sfR} /></View>
        <View style={s.bracketCol}><MatchBox match={qfR1} /><MatchBox match={qfR2} /></View>
      </View>
    </View>
  );
}

export interface GesamtberichtPdfProps {
  ranked: RankedTeam[];
  top8Ids: Set<string>;
  gemeinde: RankedTeam[];
  dailyBest: RankedTeam[];
  gesamt: RankedTeam[];
  bracket: BracketData;
  meta: PdfMeta;
}

export function GesamtberichtPdf({ ranked, top8Ids, gemeinde, dailyBest, gesamt, bracket, meta }: GesamtberichtPdfProps) {
  const grunddurchgangColumns: Column[] = [
    rangCol,
    { key: "team", header: "Team", width: 40, render: (t) => t.name },
    { key: "dg1", header: "DG1", width: 17, align: "right", render: (t) => fmtTime(t.dg1.zeit) },
    { key: "dg2", header: "DG2", width: 17, align: "right", render: (t) => fmtTime(t.dg2.zeit) },
    { key: "punkte", header: "Pkt.", width: 18, align: "right", render: (t) => String(t.punkte) },
  ];

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>Gesamtbericht</Text>
        <Text style={s.subtitle}>{meta.competitionName} {meta.year}</Text>

        <CompactBracket bracket={bracket} />

        <View style={s.tablesRow}>
          <CompactTable
            title="Grunddurchgang"
            flex={2.2}
            columns={grunddurchgangColumns}
            rows={ranked}
            highlight={(t) => top8Ids.has(t.id)}
          />
          <CompactTable title="Gemeindewertung" flex={1} columns={simpleColumns} rows={gemeinde} />
          <CompactTable title="Tagesbestzeit" flex={1} columns={simpleColumns} rows={dailyBest} />
          <CompactTable title="Gesamtwertung" flex={1} columns={simpleColumns} rows={gesamt} />
        </View>
      </Page>
    </Document>
  );
}
