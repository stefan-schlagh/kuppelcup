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
                  <td className="td-rank" data-cell="platzierung">{i + 1}</td>
                  <td className="td-name" data-cell="team">
                    {t.name}
                    {t.gastgeber && <span className="host-tag">Gastgeber</span>}
                  </td>
                  <td className="td-mono" title={`Punkte dieses Laufs: ${fmtTime(gesamt(t.dg1))}`} data-cell="wertung (durchgang 1)">
                    {fmtTime(t.dg1.zeit)} {t.dg1.strafe ? <span className="fehler-tag">+{t.dg1.strafe}s</span> : null}
                  </td>
                  <td className="td-mono" title={`Punkte dieses Laufs: ${fmtTime(gesamt(t.dg2))}`} data-cell="wertung (durchgang 2)">
                    {fmtTime(t.dg2.zeit)} {t.dg2.strafe ? <span className="fehler-tag">+{t.dg2.strafe}s</span> : null}
                  </td>
                  <td className="td-best" title="Niedrigerer Wert aus (Zeit + Strafe) von DG1 und DG2" data-cell="punkte">{t.punkte}</td>
                  <td>
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

// TODO add all runs
export function Gemeindewertung({ ranked }: { ranked: RankedTeam[] }) {
  return (
    <div>
      <h2 className="panel-title">Bestenliste — Gemeindewertung</h2>
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
            {ranked.map((t, i) => {
              return (
                <tr key={t.id}>
                  <td className="td-rank" data-cell="platzierung">{i + 1}</td>
                  <td className="td-name" data-cell="team">
                    {t.name}
                  </td>
                  <td className="td-best" title="Niedrigerer Wert aus (Zeit + Strafe) von DG1 und DG2" data-cell="punkte">{t.punkte}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Tagesbestzeit({ ranked }: { ranked: RankedTeam[] }) {
  return (
    <div>
      <h2 className="panel-title">Bestenliste — Tagesbestzeit</h2>
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
            {ranked.map((t, i) => {
              return (
                <tr key={t.id}>
                  <td className="td-rank" data-cell="platzierung">{i + 1}</td>
                  <td className="td-name" data-cell="team">
                    {t.name}
                  </td>
                  <td className="td-best" title="Niedrigerer Wert aus (Zeit + Strafe) von DG1 und DG2" data-cell="punkte">{t.punkte}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SummaryBestenliste({ ranked }: { ranked: RankedTeam[] }) {
  return(
    <div>
    <h2 className="panel-title">Bestenliste — Leaderboard</h2>
    <div className="summary-bestenliste">
    {ranked.map((t, i) => {
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
      );})}
    </div>
    </div>
  )
}

export function DisplayTagesbestzeit({ ranked }: { ranked: RankedTeam[] }) {
  return(
    <div>
      <h2 className="panel-title">Tagesbestzeit</h2>
      {ranked.map((t) => {
        return (
          <div key={t.id} className="display-tagesbestzeit">
            <h2 className="display-title">
              Bestzeit
            </h2>
            <h1 className="team-name">
              {t.name}
            </h1>
            <div className="points-wrapper">
              <span className="point-subtitle">
                Punkte:
              </span>
              <span className="points" title="Niedrigerer Wert aus (Zeit + Strafe) von DG1 und DG2">
                {t.punkte}
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
      })}
    </div>
  );
}