import { useState } from "react";
import Turnierbaum from "./Turnierbaum";
import { PENALTY_OPTIONS, PHASES, PHASE_LABELS } from "../utils/helpers";
import { teamsToCsv, csvToTeams, downloadCsv } from "../utils/backup";
import { eventUrl } from "../utils/eventUrl";
import { ENABLE_TEST_DATA } from "../config";
import { toDataURL } from "qrcode";
import type { Team, EventPhase, BracketData, Account, EventMeta, EventDoc } from '../types'

type RunField = "zeit" | "strafe";

interface AdminPanelProps {
  teams: Team[];
  updateRun: (teamId: string, dg: "dg1" | "dg2", field: RunField, value: number | null) => void;
  toggleGastgeber: (id: string) => void;
  toggleGemeinde: (id: string) => void;
  bracket: BracketData;
  updateKoRun: (matchId: string, side: "runA" | "runB", field: RunField, value: number | null) => void;
  onImportTeams: (teams: Team[]) => void;
  phase: EventPhase;
  setPhase: (phase: EventPhase) => void;
  locked: boolean;
  addTeam: (name: string) => void;
  removeTeam: (id: string) => void;
  loadSampleTeams: () => void;
  fillRandomResults: () => void;
  account: Account | null;
  events: EventMeta[];
  current: EventDoc | null;
  createEvent: (name: string) => void;
  renameEvent: (id: string, name: string) => void;
  deleteEvent: (id: string) => void;
  selectEvent: (id: string) => void;
  logout: () => void;
}

export default function AdminPanel({
  teams,
  updateRun,
  toggleGastgeber,
  toggleGemeinde,
  bracket,
  updateKoRun,
  onImportTeams,
  phase,
  setPhase,
  locked,
  addTeam,
  removeTeam,
  loadSampleTeams,
  fillRandomResults,
  account,
  events,
  current,
  createEvent,
  renameEvent,
  deleteEvent,
  selectEvent,
  logout,
}: AdminPanelProps) {
  const [sub, setSub] = useState("event");
  const [newName, setNewName] = useState("");
  const [newEventName, setNewEventName] = useState("");
  const [qr, setQr] = useState<{ name: string; url: string; dataUrl: string } | null>(null);

  const isAnmeldung = phase === "anmeldung";

  const handleExport = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`kuppelcup-backup-${stamp}.csv`, teamsToCsv(teams));
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = csvToTeams(String(reader.result ?? ""));
      if (parsed.length === 0) {
        alert("Keine Teams in der Datei gefunden.");
      } else if (confirm(`${parsed.length} Teams importieren? Aktuelle Daten werden ersetzt.`)) {
        onImportTeams?.(parsed);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleAddTeam = () => {
    if (!newName.trim()) return;
    addTeam(newName);
    setNewName("");
  };

  const handlePhase = (p: EventPhase) => {
    if (p === "abgeschlossen" && !confirm("Event abschließen? Danach sind keine Änderungen mehr möglich.")) return;
    setPhase(p);
  };

  const handleCreateEvent = () => {
    const name = newEventName.trim() || "Neues Event";
    createEvent(name);
    setNewEventName("");
  };

  const handleDeleteEvent = (id: string, name: string) => {
    if (confirm(`Event „${name}" löschen? Alle Teams und Ergebnisse gehen verloren.`)) deleteEvent(id);
  };

  const handleRenameEvent = (id: string, name: string) => {
    const next = prompt("Neuer Event-Name:", name);
    if (next && next.trim() && next.trim() !== name) renameEvent(id, next);
  };

  const handleShowQr = async (id: string, name: string) => {
    const url = eventUrl(id);
    const dataUrl = await toDataURL(url, { width: 220, margin: 1 });
    setQr({ name, url, dataUrl });
  };

  const handleLogout = () => {
    if (confirm("Als Admin abmelden?")) logout();
  };

  return (
    <div>
      <div className="admin-tabs">
        <button onClick={() => setSub("event")} className={`sub-tab ${sub === "event" ? "active" : ""}`}>Event &amp; Teams</button>
        <button onClick={() => setSub("ergebnisse")} className={`sub-tab ${sub === "ergebnisse" ? "active" : ""}`}>Grunddurchgang erfassen</button>
        <button onClick={() => setSub("ko")} className={`sub-tab ${sub === "ko" ? "active" : ""}`}>K.O.-Ergebnisse</button>
        <button onClick={() => setSub("backup")} className={`sub-tab ${sub === "backup" ? "active" : ""}`}>Backup</button>
        <button className="sub-tab logout-btn" onClick={handleLogout} title="Admin abmelden">Abmelden ({account?.name ?? "—"})</button>
      </div>

      {sub === "event" && (
        <div>
          <h3 className="panel-title">Meine Events</h3>
          <p className="hint-text">Events können angelegt, gewechselt und gelöscht werden.</p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Phase</th>
                  <th style={{ textAlign: "center" }}>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id} className={current?.id === ev.id ? "row-qualified" : ""}>
                    <td className="td-name">{ev.name}</td>
                    <td>{PHASE_LABELS[ev.phase as EventPhase]}</td>
                    <td style={{ textAlign: "center" }}>
                      {current?.id !== ev.id && (
                        <button className="remove-btn switch-btn" onClick={() => selectEvent(ev.id)} title="Zu diesem Event wechseln">Öffnen</button>
                      )}
                      <button className="remove-btn switch-btn" onClick={() => handleRenameEvent(ev.id, ev.name)} title="Event umbenennen">Umbenennen</button>
                      <button className="remove-btn switch-btn" onClick={() => handleShowQr(ev.id, ev.name)} title="QR-Code / Link">QR</button>
                      <button className="remove-btn" onClick={() => handleDeleteEvent(ev.id, ev.name)} title="Event löschen">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {qr && (
            <div className="qr-panel">
              <div className="qr-panel-head">
                <span>QR-Code — <strong>{qr.name}</strong></span>
                <button className="remove-btn" onClick={() => setQr(null)} title="Schließen">✕</button>
              </div>
              <img className="qr-img" src={qr.dataUrl} alt={`QR-Code für ${qr.name}`} width={220} height={220} />
              <div className="qr-url">
                <code>{qr.url}</code>
                <button className="sub-tab" onClick={() => navigator.clipboard?.writeText(qr.url)}>Link kopieren</button>
              </div>
              <p className="hint-text">Teilnehmer öffnen das Event über diesen Link bzw. QR-Code.</p>
            </div>
          )}

          <div className="add-team-row" style={{ marginTop: 12 }}>
            <input
              type="text"
              value={newEventName}
              placeholder="Neuer Event-Name, z.B. 2. Geissberg KUPPELCUP"
              onChange={(e) => setNewEventName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateEvent()}
              className="pin-input add-team-input"
            />
            <button className="pin-btn add-team-btn" onClick={handleCreateEvent}>Event anlegen +</button>
          </div>

          <h3 className="panel-title" style={{ marginTop: 24 }}>Event-Phase</h3>
          <p className="hint-text">Anmeldung → Durchführung → Abgeschlossen. In der Anmeldung werden Teams verwaltet; nach dem Abschluss sind keine Änderungen mehr möglich.</p>
          <div className="phase-stepper">
            {PHASES.map((p: EventPhase) => (
              <button
                key={p}
                onClick={() => handlePhase(p)}
                className={`phase-step ${phase === p ? "active" : ""}`}
              >
                {PHASE_LABELS[p]}
              </button>
            ))}
          </div>

          {ENABLE_TEST_DATA && (
            <div className="dev-tools">
              <span className="dev-tools-label">⚠ Testdaten — nur für Test / Vorführung</span>
              <div className="event-actions">
                {isAnmeldung && (
                  <button className="sub-tab" onClick={loadSampleTeams}>Beispiel-Teams laden</button>
                )}
                {!locked && (
                  <button className="sub-tab" onClick={fillRandomResults}>Zufallsergebnisse erzeugen (inkl. K.O.)</button>
                )}
              </div>
            </div>
          )}

          <h3 className="panel-title" style={{ marginTop: 24 }}>Teams ({teams.length})</h3>
          {isAnmeldung ? (
            <div className="add-team-row">
              <input
                type="text"
                value={newName}
                placeholder="Teamname, z.B. FF Buchberg"
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTeam()}
                className="pin-input add-team-input"
              />
              <button className="pin-btn add-team-btn" onClick={handleAddTeam}>Hinzufügen +</button>
            </div>
          ) : (
            <p className="hint-text">Teams können nur in der Anmeldungs-Phase hinzugefügt oder entfernt werden.</p>
          )}

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Start-Nr</th>
                  <th>Team</th>
                  <th style={{ textAlign: "center" }}>Gastgeber<br />(außer Konkurrenz)</th>
                  <th style={{ textAlign: "center" }}>Gemeindewertung</th>
                  {isAnmeldung && <th style={{ textAlign: "center" }}>Aktion</th>}
                </tr>
              </thead>
              <tbody>
                {teams.length === 0 && (
                  <tr><td colSpan={isAnmeldung ? 5 : 4} className="hint-text">Noch keine Teams angemeldet.</td></tr>
                )}
                {teams.map((t: Team) => (
                  <tr key={t.id}>
                    <td className="td-rank">{t.start}</td>
                    <td className="td-name">{t.name}</td>
                    <td style={{ textAlign: "center" }}>
                      <input type="checkbox" disabled={locked} checked={!!t.gastgeber} onChange={() => toggleGastgeber(t.id)} />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <input type="checkbox" disabled={locked} checked={!!t.gemeinde} onChange={() => toggleGemeinde(t.id)} />
                    </td>
                    {isAnmeldung && (
                      <td style={{ textAlign: "center" }}>
                        <button className="remove-btn" onClick={() => removeTeam(t.id)} title="Team entfernen">✕</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sub === "ergebnisse" && (
        <div>
          {locked && <p className="hint-text">Event abgeschlossen — Eingaben gesperrt.</p>}
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
                </tr>
              </thead>
              <tbody>
                {teams.map((t: Team) => (
                  <tr key={t.id}>
                    <td className="td-name">{t.name}</td>
                    <td><input type="number" step="0.01" disabled={locked} value={t.dg1.zeit ?? ""} onChange={(e) => updateRun(t.id, "dg1", "zeit", parseFloat(e.target.value))} className="input-field" /></td>
                    <td><input type="number" min="0" step="5" disabled={locked} value={t.dg1.strafe ?? 0} onChange={(e) => updateRun(t.id, "dg1", "strafe", parseInt(e.target.value || '0'))} className="input-field-small" /></td>
                    <td><input type="number" step="0.01" disabled={locked} value={t.dg2.zeit ?? ""} onChange={(e) => updateRun(t.id, "dg2", "zeit", parseFloat(e.target.value))} className="input-field" /></td>
                    <td><input type="number" min="0" step="5" disabled={locked} value={t.dg2.strafe ?? 0} onChange={(e) => updateRun(t.id, "dg2", "strafe", parseInt(e.target.value || '0'))} className="input-field-small" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sub === "ko" && (
        <>
          {locked && <p className="hint-text">Event abgeschlossen — Eingaben gesperrt.</p>}
          <Turnierbaum bracket={bracket} editable={!locked} onUpdateRun={updateKoRun} /*{(matchId, teamId) => setWinner(matchId, teamId)}*/ />
        </>
      )}

      {sub === "backup" && (
        <div className="backup-panel">
          <p className="hint-text">Teams und Grunddurchgang-Ergebnisse als CSV sichern oder wiederherstellen.</p>
          <div className="backup-actions">
            <button className="pin-btn backup-btn" onClick={handleExport}>Export als CSV ⬇</button>
            <label className="pin-btn backup-btn backup-import">
              Import aus CSV ⬆
              <input type="file" accept=".csv,text/csv" onChange={handleImport} hidden />
            </label>
          </div>
          <p className="hint-text">Beim Import werden die vorhandenen Teams ersetzt (K.O.-Ergebnisse bleiben unberührt).</p>
        </div>
      )}
    </div>
  );
}
