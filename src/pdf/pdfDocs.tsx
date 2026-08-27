import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { RankedTeam } from "../utils/tournament";
import type { BracketData, Match, Team, RunData } from "../types";
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
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 8 },
  subtitle: { fontSize: 12, color: PDF_COLORS.muted, marginBottom: 16 },
  sectionLabel: { fontSize: 9, fontWeight: "bold", color: PDF_COLORS.muted, textTransform: "uppercase", marginBottom: 7 },

  bracketRow: { flexDirection: "row", gap: 6, marginBottom: 20 },
  bracketCol: { flex: 1, gap: 4, justifyContent: "center" },
  matchBox: { borderWidth: 0.5, borderColor: PDF_COLORS.border, borderRadius: 5 },
  matchBoxFinal: { borderColor: PDF_COLORS.accent },
  matchRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, paddingHorizontal: 8 },
  matchWinnerRow: { backgroundColor: "#ede8d9" },
  matchDivider: { borderTopWidth: 0.5, borderTopColor: PDF_COLORS.border },
  matchName: { fontSize: 8 },
  matchWinner: { color: PDF_COLORS.accent, fontWeight: "bold" },
  matchTime: { fontSize: 8, color: PDF_COLORS.muted },
  tiedNote: { fontSize: 5, textAlign: "center", color: PDF_COLORS.primary, fontWeight: "bold", paddingVertical: 1 },

  tablesRow: { flexDirection: "row", gap: 6 },
  table: { borderWidth: 0.5, borderColor: PDF_COLORS.accent, borderRadius: 5 },
  headerRow: { flexDirection: "row", backgroundColor: PDF_COLORS.headerBg, borderBottomWidth: 0.5, borderBottomColor: PDF_COLORS.border, borderTopLeftRadius: 4.5, borderTopRightRadius: 4.5, paddingVertical: 2, paddingHorizontal: 2 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: PDF_COLORS.border, paddingVertical: 1.5, paddingHorizontal: 2 },
  rowEven: { backgroundColor: PDF_COLORS.rowAlt },
  lastRow: { borderBottomWidth: 0, borderBottomColor: "#FFFFFF00", borderBottomLeftRadius: 4.5, borderBottomRightRadius: 4.5 },
  rowQualified: { backgroundColor: "#ede8d950" },
  th: { fontSize: 8, fontWeight: "bold", textTransform: "uppercase", color: PDF_COLORS.accent },
  td: { fontSize: 7 },
  strafe: {fontSize: 6, fontWeight: "600" , color: PDF_COLORS.primary},
  emptyText: { fontSize: 6, color: PDF_COLORS.muted, padding: 4 },
});

interface Column {
  key: string;
  header: string;
  width: number; // percent of the table's own (already flex-sized) width
  align?: "left" | "right" | "center";
  render: (team: RankedTeam, index: number) => React.ReactNode;
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
          rows.map((team, i) => {
            const isLastRow = i === rows.length - 1;
            return(
              <View key={team.id} style={[
                s.row,
                i % 2 === 0 ? s.rowEven : {},
                highlight?.(team) ? s.rowQualified : {},
                isLastRow ? s.lastRow : {},
                ]}>
                {columns.map((c) => (
                  <Text key={c.key} style={[s.td, { width: `${c.width}%`, textAlign: c.align ?? "left" }]}>
                    {c.render(team, i)}
                  </Text>
                ))}
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

const rangCol: Column = { key: "rang", header: "#", width: 15, render: (_t, i) => String(i + 1) };
const teamCol: Column = { key: "team", header: "Team", width: 55, render: (t) => t.name };
const punkteCol: Column = { key: "punkte", header: "Pkt.", width: 30, align: "right", render: (t) => String(t.punkte) };
const simpleColumns: Column[] = [rangCol, teamCol, punkteCol];

function fmtRun(run?: RunData | null) {
  if (!run || run.zeit === null) return "-";

  const zeitStr = fmtTime(run.zeit);
  if (!run.strafe) return zeitStr;

  return (
    <Text>
      {zeitStr}{" "}
      <Text style={[s.strafe, {fontSize: 7}]}>(+{run.strafe}s)</Text>
    </Text>
  );
}

function fmtMistakes(run?: RunData | null) {
  if (!run || run.strafe === null || run.strafe === 0) return "-";

  return(
    <Text style={s.strafe}>(+{run.strafe}s)</Text>
  )
}

function score(run: Match["runA"]) {
  const total = gesamt(run);
  return total != null ? fmtRun(run) : "—";
}

function MatchBox({ match, final }: { match: Match, final?: boolean }) {
  const row = (team: Team | null, run: Match["runA"], index: number) => {
    const isFirstChild = index === 0;
    const isSecondChild = index === 1;
    const isWinner = !!match.winnerId && match.winnerId === team?.id;
    return (
      <View style={[
        s.matchRow,
        isWinner && s.matchWinnerRow,
        isFirstChild && {borderTopLeftRadius: 4.5, borderTopRightRadius: 4.5, borderBottomRightRadius: 0, borderBottomLeftRadius: 0},
        isSecondChild && {borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomRightRadius: 4.5, borderBottomLeftRadius: 4.5}
        ].filter(Boolean) as any}>
        <Text style={isWinner ? [s.matchName, s.matchWinner] : s.matchName}>{team?.name ?? "—"}</Text>
        <Text style={s.matchTime}>{score(run)}</Text>
      </View>
    );
  };
  return (
    <View style={[s.matchBox, final ? s.matchBoxFinal : {} ]}>
      {row(match.teamA, match.runA, 0)}
      <View style={s.matchDivider} />
      {row(match.teamB, match.runB, 1)}
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
        <View style={s.bracketCol}><MatchBox match={bracket.final} final={true} /></View>
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
    { key: "dg1", header: "DG1", width: 14, align: "center", render: (t) => fmtTime(t.dg1.zeit) },
    { key: "dg1-fehler", header: "Fehler", width: 12, align: "center", render: (t) => fmtMistakes(t.dg1)},
    { key: "dg2", header: "DG2", width: 14, align: "center", render: (t) => fmtTime(t.dg2.zeit) },
    { key: "dg2-fehler", header: "Fehler", width: 12, align: "center", render: (t) => fmtMistakes(t.dg2)},
    { key: "punkte", header: "Pkt.", width: 18, align: "right", render: (t) => String(t.punkte) },
  ];

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
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
