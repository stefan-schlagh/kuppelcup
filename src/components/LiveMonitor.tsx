import React from "react";
import type { Team } from "../types";
import { fmtTime } from "../utils/helpers";

interface MonitorState {
  team: Team;
  round: "dg1" | "dg2";
}

type MonitorEntry = MonitorState | MonitorState[] | null;

interface LiveMonitorProps {
  data: {
    former: MonitorEntry;
    current: MonitorEntry;
    next: MonitorEntry;
  };
}

function toArray(entry: MonitorEntry): MonitorState[] {
  if (!entry) return [];
  return Array.isArray(entry) ? entry : [entry];
}

export default function LiveMonitor({ data }: LiveMonitorProps) {
  const formerList = toArray(data.former);
  const currentList = toArray(data.current);
  const nextList = toArray(data.next);

  return (
    <div className="monitor-container">
      {/* 1. FORMER RUNNER(S) */}
      <div className="monitor-card card-dim">
        <span className="monitor-badge badge-past">Letzter Durchgang</span>
        {formerList.length > 0 ? (
          <div className="monitor-parallel-group">
            {formerList.map((entry, i) => (
              <div key={i} className="monitor-entry">
                <h3 className="monitor-team-name">{entry.team.name}</h3>
                <p className="monitor-meta">
                  Start-Nr: {entry.team.start} | {entry.round.toUpperCase()}
                </p>
                <div className="monitor-time-box text-muted-color">
                  {fmtTime(entry.team[entry.round].zeit)}
                  {entry.team[entry.round].strafe > 0 && (
                    <span className="monitor-error-text"> (+{entry.team[entry.round].strafe}s)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-msg">Kein vorheriger Lauf</p>
        )}
      </div>

      {/* 2. CURRENT RUNNER(S) */}
      <div className="monitor-card card-active">
        <span className="monitor-badge badge-live">Am Start ⚡</span>
        {currentList.length > 0 ? (
          <div
            className={`monitor-parallel-group${
              currentList.length > 1 ? " monitor-parallel-current" : ""
            }`}
          >
            {currentList.map((entry, i) => (
              <div key={i} className="monitor-entry">
                <h2 className="monitor-team-name giant-text">{entry.team.name}</h2>
                <p className="monitor-meta giant-meta">
                  Startnummer: {entry.team.start} | Durchgang: {entry.round.toUpperCase()}
                </p>
                <div className="monitor-live-pulse-box">Bereit auf der Bahn...</div>
              </div>
            ))}
          </div>
        ) : (
          <h2 className="empty-msg giant-text">Grunddurchgang beendet! 🎉</h2>
        )}
      </div>

      {/* 3. NEXT RUNNER(S) */}
      <div className="monitor-card card-dim">
        <span className="monitor-badge badge-future">Nächster Aufruf</span>
        {nextList.length > 0 ? (
          <div className="monitor-parallel-group">
            {nextList.map((entry, i) => (
              <div key={i} className="monitor-entry">
                <h3 className="monitor-team-name">{entry.team.name}</h3>
                <p className="monitor-meta">
                  Start-Nr: {entry.team.start} | {entry.round.toUpperCase()}
                </p>
                <div className="monitor-next-box">In Vorbereitung...</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-msg">Letztes Team läuft bereits</p>
        )}
      </div>
    </div>
  );
}