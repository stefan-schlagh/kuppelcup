import type { ReactNode } from "react";

export interface SplitViewOption {
  key: string;
  label: string;
  render: () => ReactNode;
}

interface SplitViewProps {
  options: SplitViewOption[];
  left: string;
  right: string;
  onLeftChange: (key: string) => void;
  onRightChange: (key: string) => void;
}

// Shows two of the presentation views side by side (Bestenliste, Live-Monitor,
// Turnierbaum) -- for a single big screen that has to stand in for two, e.g.
// a beamer showing standings and the live monitor at once.
export default function SplitView({ options, left, right, onLeftChange, onRightChange }: SplitViewProps) {
  const find = (key: string) => options.find((o) => o.key === key) ?? options[0];

  const pane = (side: "left" | "right", value: string, onChange: (key: string) => void) => (
    <div className="split-pane">
      <select
        className="split-pane-select"
        aria-label={side === "left" ? "Linke Ansicht" : "Rechte Ansicht"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>
      <div className="split-pane-content">{find(value).render()}</div>
    </div>
  );

  return (
    <div className="split-view">
      {pane("left", left, onLeftChange)}
      {pane("right", right, onRightChange)}
    </div>
  );
}
