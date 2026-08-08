import { lazy, Suspense } from "react";
import type { BracketData, Match, Team } from "../types";
import type { UrkundeEntry } from "../pdf/urkundenPdf";

const UrkundenPreview = lazy(() => import("../pdf/UrkundenPreview"));

function winnerTeam(m: Match): Team | null {
  if (!m.winnerId) return null;
  return m.winnerId === m.teamA?.id ? m.teamA : m.teamB;
}

function loserTeam(m: Match): Team | null {
  if (!m.winnerId) return null;
  return m.winnerId === m.teamA?.id ? m.teamB : m.teamA;
}

interface RankedTeam extends Team {
  punkte?: number;
}

interface UrkundenProps {
  ranked: RankedTeam[];
  bracket: BracketData;
  competitionName: string;
  year: number | string;
}

export default function Urkunden({ ranked, bracket, competitionName, year }: UrkundenProps) {
  const champion = winnerTeam(bracket.final);
  const finalist = loserTeam(bracket.final);
  const semiIds = new Set(
    bracket.sf.map(loserTeam).filter((t): t is Team => !!t).map((t) => t.id),
  );

  const wertungFor = (t: RankedTeam): string => {
    if (champion && t.id === champion.id) return "Turniersieger";
    if (finalist && t.id === finalist.id) return "Finalist";
    if (semiIds.has(t.id)) return "Halbfinalist";
    if (t.gastgeber) return "Teilnehmer (außer Konkurrenz)";
    return "Teilnehmerurkunde";
  };

  const entries: UrkundeEntry[] = ranked.map((t, i) => {
    const p = t.punkte ?? 0;
    const detail = p > 0 ? `Grunddurchgang: Rang ${i + 1} · ${p} Punkte` : "Teilnahme am Grunddurchgang";
    return { name: t.name, wertung: wertungFor(t), detail };
  });
  const meta = { competitionName, year };

  // Dynamically imported: @react-pdf/renderer is large and only ever
  // needed here, behind an admin-only click.
  const handleExport = async () => {
    const [{ downloadPdf }, { UrkundenPdf }] = await Promise.all([
      import("../pdf/download"),
      import("../pdf/urkundenPdf"),
    ]);
    const stamp = new Date().toISOString().slice(0, 10);
    await downloadPdf(UrkundenPdf({ entries, meta }), `urkunden-${stamp}.pdf`);
  };

  return (
    <div className="urkunden">
      <div className="urkunden-toolbar">
        <h2 className="panel-title">Urkunden — alle Teilnehmer</h2>
        <button
          className="pin-btn backup-btn"
          onClick={() => void handleExport()}
          disabled={entries.length === 0}
        >
          Als PDF exportieren ⬇
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="hint-text">Noch keine Teams vorhanden.</p>
      ) : (
        <>
          <p className="hint-text">
            {entries.length} Urkunde{entries.length === 1 ? "" : "n"} — eine Seite pro Teilnehmer im PDF.
          </p>
          <Suspense fallback={<p className="hint-text">Vorschau wird geladen …</p>}>
            <UrkundenPreview entries={entries} meta={meta} />
          </Suspense>
        </>
      )}
    </div>
  );
}
