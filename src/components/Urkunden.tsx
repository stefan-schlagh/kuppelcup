import type { BracketData, Match, Team } from "../types";
import { generateUrkundenPdf, type UrkundeEntry } from "../utils/urkunde-pdf";
import { urkundePlacements, type RankedTeam } from "../utils/tournament";

function winnerTeam(m: Match): Team | null {
  if (!m.winnerId) return null;
  return m.winnerId === m.teamA?.id ? m.teamA : m.teamB;
}

function loserTeam(m: Match): Team | null {
  if (!m.winnerId) return null;
  return m.winnerId === m.teamA?.id ? m.teamB : m.teamA;
}

interface UrkundenProps {
  gesamt: RankedTeam[];
  bracket: BracketData;
  dailyBestTimes: RankedTeam[];
  competitionName: string;
  year: number | string;
}

// One certificate per participant. Each team's Wertung reflects its best
// achievement (K.O. placement), otherwise a plain Teilnehmerurkunde. The
// numeric rank shown is the overall standing (Gesamtwertung), not the
// base-round rank alone.
export default function Urkunden({ gesamt, bracket, dailyBestTimes, competitionName, year }: UrkundenProps) {
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

  // The Tagesbestzeit board (fastest total across base round + K.O. runs)
  // is already ranked ascending -- its first entry, if any team has a
  // result at all, is the category winner. Its punkte field holds that
  // total (zeit + strafe, in seconds).
  const fastestTeam = dailyBestTimes[0]?.punkte && dailyBestTimes[0].punkte > 0 ? dailyBestTimes[0] : undefined;

  const placements = urkundePlacements(gesamt);
  const entries: UrkundeEntry[] = gesamt.map((t) => {
    const { platz, gemeindePlatz } = placements.get(t.id) ?? {};
    const detail = platz ? `${platz}. Platz` : undefined;
    const extra = gemeindePlatz ? `Gemeindewertung: ${gemeindePlatz}. Platz` : undefined;
    const comment = t.kommentar?.trim() || undefined;
    const fastest = t.id === fastestTeam?.id ? `Schnellste Zeit: ${fastestTeam.punkte!.toFixed(2)}s` : undefined;
    return { name: t.name, wertung: wertungFor(t), detail, extra, comment, fastest };
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
              {e.detail && <p className="urkunde-platz">{e.detail}</p>}
              {e.comment && <p className="urkunde-platz">{e.comment}</p>}
              {e.extra && <p className="urkunde-platz">{e.extra}</p>}
              {e.fastest && <p className="urkunde-platz">{e.fastest}</p>}
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
