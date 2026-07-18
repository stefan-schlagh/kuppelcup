import { useState } from "react";
import Turnierbaum from "./Turnierbaum";
import { PENALTY_OPTIONS } from "../utils/helpers";
import type { Team} from '../types'

export default function AdminPanel({ teams, updateRun, toggleGastgeber, toggleGemeinde, bracket, /*setWinner,*/ updateKoRun }: any) {
  const [sub, setSub] = useState("ergebnisse");
  return (
    <div>
      <div className="admin-tabs">
        <button onClick={() => setSub("ergebnisse")} className={`sub-tab ${sub === "ergebnisse" ? "active" : ""}`}>Grunddurchgang erfassen</button>
        <button onClick={() => setSub("ko")} className={`sub-tab ${sub === "ko" ? "active" : ""}`}>K.O.-Ergebnisse</button>
      </div>

      {sub === "ergebnisse" && (
        <div>
          <p className="hint-text">Strafsekunden als Summe eintragen — Standardwerte sind {PENALTY_OPTIONS.filter(Boolean).join("s / ")}s, mehrere Strafen in einem Lauf werden addiert (z.B. 5+10 = 15).</p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>DG1 Zeit (s)</th>
                  <th>DG1 Strafe (s)</th>
                  <th>DG2 Zeit (s)</th>
                  <th>DG2 Strafe (s)</th>
                  <th style={{ textAlign: "center" }}>Gastgeber<br />(außer Konkurrenz)</th>
                  <th style={{ textAlign: "center" }}>Gemeindewertung<br /></th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t: Team) => (
                  <tr key={t.id}>
                    <td className="td-name">{t.name}</td>
                    <td><input type="number" step="0.01" value={t.dg1.zeit ?? ""} onChange={(e) => updateRun(t.id, "dg1", "zeit", parseFloat(e.target.value))} className="input-field" /></td>
                    <td><input type="number" min="0" step="5" value={t.dg1.strafe ?? 0} onChange={(e) => updateRun(t.id, "dg1", "strafe", parseInt(e.target.value || '0'))} className="input-field-small" /></td>
                    <td><input type="number" step="0.01" value={t.dg2.zeit ?? ""} onChange={(e) => updateRun(t.id, "dg2", "zeit", parseFloat(e.target.value))} className="input-field" /></td>
                    <td><input type="number" min="0" step="5" value={t.dg2.strafe ?? 0} onChange={(e) => updateRun(t.id, "dg2", "strafe", parseInt(e.target.value || '0'))} className="input-field-small" /></td>
                    <td style={{ textAlign: "center" }}>
                      <input type="checkbox" checked={!!t.gastgeber} onChange={() => toggleGastgeber(t.id)} />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <input type="checkbox" checked={!!t.gemeinde} onChange={() => toggleGemeinde(t.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sub === "ko" && (
        <Turnierbaum bracket={bracket} editable={true} onUpdateRun={updateKoRun} /*{(matchId, teamId) => setWinner(matchId, teamId)}*/ />
      )}
    </div>
  );
}