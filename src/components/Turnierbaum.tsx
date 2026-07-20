import type { BracketData, Match, Team, RunData } from "../types";
import { fmtTime } from "../utils/helpers";

interface MatchBoxProps {
  match: Match;
  editable: boolean;
  onUpdateRun?: (matchId: string, side: "runA" | "runB", field: "zeit" | "strafe", value: number | null) => void;
}

function MatchBox({ match, editable, onUpdateRun }: MatchBoxProps) {
  const renderRow = (team: Team | null, side: "runA" | "runB") => {
    const name = team?.name ?? "—";
    const run: RunData = match[side];
    const isWinner = match.winnerId && match.winnerId === team?.id;
    
    // Calculate display summary value
    const totalScore = run.zeit !== null ? run.zeit + (run.strafe ?? 0) : null;

    return (
      <div className={`match-team-row ${isWinner ? "match-winner" : ""}`}>
        <span className="team-name-span">{name}</span>
        
        {team && editable && onUpdateRun ? (
          <div className="bracket-inputs-group">
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={run.zeit ?? ""}
              onChange={(e) => {
                const val = e.target.value ? parseFloat(e.target.value) : null;
                onUpdateRun(match.id, side, "zeit", val);
              }}
              className="bracket-input-time"
            />
            <input
              type="number"
              min="0"
              step="5"
              placeholder="+0s"
              value={run.strafe || ""}
              onChange={(e) => {
                const val = e.target.value ? parseInt(e.target.value, 10) : 0;
                onUpdateRun(match.id, side, "strafe", val);
              }}
              className="bracket-input-penalty"
            />
          </div>
        ) : (
          <span className="bracket-time-display">
            {run.zeit !== null ? `${fmtTime(run.zeit)}` : "—"}
            {(run.strafe ?? 0) > 0 && <span className="bracket-penalty-badge"> +{run.strafe}s</span>}
            {totalScore !== null && <strong className="bracket-total-score"> ({fmtTime(totalScore)})</strong>}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="match-box flex-column">
      {renderRow(match.teamA, "runA")}
      <div className="match-divider-line" />
      {renderRow(match.teamB, "runB")}
    </div>
  );
}

interface TurnierbaumProps {
  bracket: BracketData;
  editable?: boolean;
  onUpdateRun?: (matchId: string, side: "runA" | "runB", field: "zeit" | "strafe", value: number | null) => void;
}

export default function Turnierbaum({ bracket, editable = false, onUpdateRun }: TurnierbaumProps) {
  const box = (m: Match) => <MatchBox key={m.id} match={m} editable={editable} onUpdateRun={onUpdateRun} />;

  // Symmetric bracket: left half feeds in from the left, right half from the
  // right, with the final in the middle.
  const [qfL1, qfL2, qfR1, qfR2] = bracket.qf;
  const [sfL, sfR] = bracket.sf;

  return (
    <div>
      <h2 className="panel-title">Turnierbaum — Top 8</h2>
      <div className="bracket-row bracket-symmetric">
        <div className="bracket-col">
          <div className="bracket-col-label">Viertelfinale</div>
          {qfL1 && box(qfL1)}
          {qfL2 && box(qfL2)}
        </div>
        <div className="bracket-col">
          <div className="bracket-col-label">Halbfinale</div>
          {sfL && box(sfL)}
        </div>
        <div className="bracket-col bracket-col-final">
          <div className="bracket-col-label">Finale</div>
          {box(bracket.final)}
        </div>
        <div className="bracket-col">
          <div className="bracket-col-label">Halbfinale</div>
          {sfR && box(sfR)}
        </div>
        <div className="bracket-col">
          <div className="bracket-col-label">Viertelfinale</div>
          {qfR1 && box(qfR1)}
          {qfR2 && box(qfR2)}
        </div>
      </div>
    </div>
  );
}