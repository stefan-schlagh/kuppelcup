import type { ReactNode } from "react";

export interface SplitViewOption {
  key: string;
  label: string;
  render: () => ReactNode;
}

export type SplitLayout = "row" | "column";

interface SplitViewProps {
  options: SplitViewOption[];
  left: string;
  right: string;
  onLeftChange: (key: string) => void;
  onRightChange: (key: string) => void;
  layout: SplitLayout;
  onLayoutChange: (layout: SplitLayout) => void;
}

// Shows two of the presentation views side by side, or stacked, (Bestenliste,
// Live-Monitor, Turnierbaum) -- for a single big screen that has to stand in
// for two, e.g. a beamer showing standings and the live monitor at once.
// Stacked is the better fit for wide content like Turnierbaum's bracket,
// which can be too cramped squeezed into half the screen's width.
export default function SplitView({
  options, left, right, onLeftChange, onRightChange, layout, onLayoutChange,
}: SplitViewProps) {
  const find = (key: string) => options.find((o) => o.key === key) ?? options[0];
  const sideLabel = (side: "first" | "second") => {
    if (layout === "column") return side === "first" ? "Obere Ansicht" : "Untere Ansicht";
    return side === "first" ? "Linke Ansicht" : "Rechte Ansicht";
  };

  const pane = (side: "first" | "second", value: string, onChange: (key: string) => void) => (
    <div className="split-pane">
      <select
        className="split-pane-select"
        aria-label={sideLabel(side)}
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
    <div>
      <div className="split-toolbar">
        <span className="split-toolbar-label">Anordnung:</span>
        <button
          type="button"
          className={`split-layout-btn ${layout === "row" ? "active" : ""}`}
          onClick={() => onLayoutChange("row")}
        >
          Nebeneinander
        </button>
        <button
          type="button"
          className={`split-layout-btn ${layout === "column" ? "active" : ""}`}
          onClick={() => onLayoutChange("column")}
        >
          Untereinander
        </button>
      </div>
      <div className={`split-view ${layout === "row" ? "split-row" : ""}`}>
        {pane("first", left, onLeftChange)}
        {pane("second", right, onRightChange)}
      </div>
    </div>
  );
}
