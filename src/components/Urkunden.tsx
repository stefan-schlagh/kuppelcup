import type { BracketData, Match, Team } from "../types";
import { generateUrkundenPdf, type UrkundeEntry } from "../utils/urkunde-pdf";

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

// One certificate per participant. Each team's Wertung reflects its best
// achievement (K.O. placement), otherwise a plain Teilnehmerurkunde.
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

  return (
    <div className="urkunden">
      <div className="urkunden-toolbar">
        <h2 className="panel-title">Urkunden — alle Teilnehmer</h2>
        <button
          className="pin-btn backup-btn"
          onClick={() => generateUrkundenPdf(entries, { competitionName, year })}
          disabled={entries.length === 0}
        >
          Als PDF exportieren ⬇
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="hint-text">Noch keine Teams vorhanden.</p>
      ) : (
        <p className="hint-text">
          {entries.length} Urkunde{entries.length === 1 ? "" : "n"} — eine Seite pro Teilnehmer im PDF.
        </p>
      )}

      <div className="urkunden-sheets">
        {entries.map((e, i) => (
          <div className="urkunde" key={i}>
            <div className="urkunde-inner">
              <div className="urkunde-hose">⊃⊂</div>
              <h1 className="urkunde-title">Urkunde</h1>
              <p className="urkunde-event">{competitionName} {year}</p>
              <div className="urkunde-rule" />
              <p className="urkunde-wertung">{e.wertung}</p>
              <p className="urkunde-platz">{e.detail}</p>
              <p className="urkunde-team">{e.name}</p>
              <div className="urkunde-signatures">
                <span className="urkunde-sig">Datum</span>
                <span className="urkunde-sig">Turnierleitung</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
