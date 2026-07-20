import type { MonitorRunner } from "../types";
import { fmtTime } from "../utils/helpers";

interface LiveMonitorProps {
  data: {
    status?: "empty" | "running" | "finished";
    former: MonitorRunner[];
    current: MonitorRunner[];
    next: MonitorRunner[];
  };
}

export default function LiveMonitor({ data }: LiveMonitorProps) {
  const { former, current, next, status } = data;

  return (
    <div className="monitor-container">
      {/* 1. FORMER RUNNER(S) */}
      <div className="monitor-card card-dim">
        <span className="monitor-badge badge-past">Letzter Durchgang</span>
        {former.length > 0 ? (
          <div className="monitor-parallel-group">
            {former.map((entry, i) => (
              <div key={i} className="monitor-entry">
                <h3 className="monitor-team-name">{entry.name}</h3>
                <p className="monitor-meta">
                  Start-Nr: {entry.start} | {entry.label}
                </p>
                <div className="monitor-time-box text-muted-color">
                  {fmtTime(entry.zeit)}
                  {(entry.strafe ?? 0) > 0 && (
                    <span className="monitor-error-text"> (+{entry.strafe}s)</span>
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
        {current.length > 0 ? (
          <div
            className={`monitor-parallel-group${
              current.length > 1 ? " monitor-parallel-current" : ""
            }`}
          >
            {current.map((entry, i) => (
              <div key={i} className="monitor-entry">
                <h2 className="monitor-team-name giant-text">{entry.name}</h2>
                <p className="monitor-meta giant-meta">
                  Startnummer: {entry.start} | {entry.label}
                </p>
                <div className="monitor-live-pulse-box">Bereit auf der Bahn...</div>
              </div>
            ))}
          </div>
        ) : status === "empty" ? (
          <h2 className="empty-msg giant-text">Noch keine Teams angemeldet</h2>
        ) : (
          <h2 className="empty-msg giant-text">Wettkampf beendet! 🎉</h2>
        )}
      </div>

      {/* 3. NEXT RUNNER(S) */}
      <div className="monitor-card card-dim">
        <span className="monitor-badge badge-future">Nächster Aufruf</span>
        {next.length > 0 ? (
          <div className="monitor-parallel-group">
            {next.map((entry, i) => (
              <div key={i} className="monitor-entry">
                <h3 className="monitor-team-name">{entry.name}</h3>
                <p className="monitor-meta">
                  Start-Nr: {entry.start} | {entry.label}
                </p>
                <div className="monitor-next-box">In Vorbereitung...</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-msg">
            {status === "running" ? "Letztes Team läuft bereits" : "Keine weiteren Läufe"}
          </p>
        )}
      </div>
    </div>
  );
}
