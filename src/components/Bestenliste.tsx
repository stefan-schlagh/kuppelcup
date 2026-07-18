import { fmtTime, gesamt } from "../utils/helpers";
import type { Team } from "../types";

export default function Bestenliste({ ranked, top8Ids }: any) {
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
            {ranked.map((t: Team, i: number) => {
              const qualified = top8Ids.has(t.id);
              return (
                <tr key={t.id} className={qualified ? "row-qualified" : ""}>
                  <td className="td-rank">{i + 1}</td>
                  <td className="td-name">
                    {t.name}
                    {t.gastgeber && <span className="host-tag">Gastgeber</span>}
                  </td>
                  <td className="td-mono" title={`Punkte dieses Laufs: ${fmtTime(gesamt(t.dg1))}`}>
                    {fmtTime(t.dg1.zeit)} {t.dg1.strafe ? <span className="fehler-tag">+{t.dg1.strafe}s</span> : null}
                  </td>
                  <td className="td-mono" title={`Punkte dieses Laufs: ${fmtTime(gesamt(t.dg2))}`}>
                    {fmtTime(t.dg2.zeit)} {t.dg2.strafe ? <span className="fehler-tag">+{t.dg2.strafe}s</span> : null}
                  </td>
                  <td className="td-best" title="Niedrigerer Wert aus (Zeit + Strafe) von DG1 und DG2">{(t as any).punkte}</td>
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
export function Gemeindewertung({ ranked }: any) {
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
            {ranked.map((t: Team, i: number) => {
              return (
                <tr key={t.id}>
                  <td className="td-rank">{i + 1}</td>
                  <td className="td-name">
                    {t.name}
                  </td>
                  <td className="td-best" title="Niedrigerer Wert aus (Zeit + Strafe) von DG1 und DG2">{(t as any).punkte}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Tagesbestzeit({ ranked }: any) {
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
            {ranked.map((t: Team, i: number) => {
              return (
                <tr key={t.id}>
                  <td className="td-rank">{i + 1}</td>
                  <td className="td-name">
                    {t.name}
                  </td>
                  <td className="td-best" title="Niedrigerer Wert aus (Zeit + Strafe) von DG1 und DG2">{(t as any).punkte}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}