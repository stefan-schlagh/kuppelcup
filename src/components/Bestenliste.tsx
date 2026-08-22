import { fmtTime, gesamt } from "../utils/helpers";
import type { RankedTeam } from "../utils/tournament";
import { Award, Trophy, Timer, Flame } from 'lucide-react';

interface BestenlisteProps {
  ranked: RankedTeam[];
  top8Ids: Set<string>;
}

export default function Bestenliste({ ranked, top8Ids }: BestenlisteProps) {
  return (
    <div>
      <h2 className="panel-title">Bestenliste — Grunddurchgang</h2>
      <p className="hint-text">Gastgeber-Teams werden gewertet, belegen aber keinen K.O.-Startplatz.</p>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Rang</th>
              <th>Team</th>
              <th>DG1</th>
              <th>DG2</th>
              <th>Punkte</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((t, i) => {
              const qualified = top8Ids.has(t.id);
              return (
                <tr key={t.id} className={qualified ? "row-qualified" : ""}>
                  <td className="td-rank" data-cell="platzierung">
                    {i + 1}
                    {t.cutoffContested && (
                      <span
                        className="tie-badge tie-badge-contested"
                        title="Gleichstand auf Platz 8/9 — Qualifikation offen, Stechlauf nötig"
                      >
                        Stechlauf
                      </span>
                    )}
                    {t.tiedRank && !t.cutoffContested && (
                      <span className="tie-badge" title="Gleichstand — Platz zufällig zugewiesen">
                        Gleichstand
                      </span>
                    )}
                  </td>
                  <td className="td-name" data-cell="team">
                    {t.name}
                    {t.gastgeber && <span className="host-tag">Gastgeber</span>}
                  </td>
                  <td className="td-mono" title={`Punkte dieses Laufs: ${fmtTime(gesamt(t.dg1))}`} data-cell="wertung (DG-1)">
                    {fmtTime(t.dg1.zeit)} {t.dg1.strafe ? <span className="fehler-tag">+{t.dg1.strafe}s</span> : null}
                  </td>
                  <td className="td-mono" title={`Punkte dieses Laufs: ${fmtTime(gesamt(t.dg2))}`} data-cell="wertung (DG-2)">
                    {fmtTime(t.dg2.zeit)} {t.dg2.strafe ? <span className="fehler-tag">+{t.dg2.strafe}s</span> : null}
                  </td>
                  <td className="td-best" title="Niedrigerer Wert aus (Zeit + Strafe) von DG1 und DG2" data-cell="punkte">{t.punkte}</td>
                  <td data-cell="status">
                    {t.gastgeber ? (
                      <span className="badge-host">Außer Konkurrenz</span>
                    ) : qualified ? (
                      <span className="badge-gold">Qualifiziert</span>
                    ) : (
                      <span className="badge-muted">Ausgeschieden</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SimpleStandingsTable({ ranked }: { ranked: RankedTeam[] }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Rang</th>
            <th>Team</th>
            <th>Punkte</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((t, i) => (
            <tr key={t.id}>
              <td className="td-rank" data-cell="platzierung">{i + 1}</td>
              <td className="td-name" data-cell="team">{t.name}</td>
              <td className="td-best" data-cell="punkte" title="Niedrigerer Wert aus (Zeit + Strafe) von DG1 und DG2">{t.punkte}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Gemeindewertung({ ranked }: { ranked: RankedTeam[] }) {
  return (
    <div>
      <h2 className="panel-title">Bestenliste — Gemeindewertung</h2>
      <SimpleStandingsTable ranked={ranked} />
    </div>
  );
}

export function Tagesbestzeit({ ranked }: { ranked: RankedTeam[] }) {
  return (
    <div>
      <h2 className="panel-title">Bestenliste — Tagesbestzeit</h2>
      <SimpleStandingsTable ranked={ranked} />
    </div>
  );
}


export function SummaryBestenliste({ ranked }: { ranked: RankedTeam[] }) {
  if (!ranked || ranked.length === 0) {
    return;
  } else {
    return(
      <div>
        <h2 className="panel-title">Bestenliste — Leaderboard</h2>
        <div className="summary-bestenliste">
        {ranked.map((t, i) => {
          if (t.punkte ===  0) {
            return;
          } else {
            return(
              <div key={t.id} className="place">
                <div className="award-container">{i < 1 ? <Trophy /> : <Award />}</div>
                <div className="bar">
                  <span>{i+1}</span>
                  <div className="points" title="Niedrigerer Wert aus (Zeit + Strafe) von DG1 und DG2">
                    <span>{t.punkte}</span>
                  </div>
                </div>
                <span className="team-name">
                  {t.name}
                </span>
              </div> 
            );
          }
        })}
        </div>
      </div>
    )
  }
}

export function DisplayTagesbestzeit({ ranked }: { ranked: RankedTeam[] }) {
  if (!ranked || ranked.length === 0) {
    return;
  } else {
    return(
      <div>
        <h2 className="panel-title">Tagesbestzeit</h2>
        {ranked.map((t) => {
          if (t.punkte === 0) {
            return;
          } else {
            return (
              <div key={t.id} className="display-tagesbestzeit">
                <h2 className="display-title">
                  Bestzeit
                </h2>
                <h1 className="team-name">
                  {t.name}
                </h1>
                <div className="points-wrapper">
                  <span className="points" title="Niedrigerer Wert aus (Zeit + Strafe) von DG1 und DG2">
                    {t.punkte}s
                  </span>
                </div>
                <div className="bg-timer">
                  <Timer />
                </div>
                <div className="bg-flame">
                  <Flame />
                </div>
              </div>
            );
          }
        })}
      </div>
    );
  }
}

export function Gesamtwertung({ ranked }: { ranked: RankedTeam[] }) {
  return (
    <div>
      <h2 className="panel-title">Gesamtwertung</h2>
      <SimpleStandingsTable ranked={ranked} />
    </div>
  );
}
