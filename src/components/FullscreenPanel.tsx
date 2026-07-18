import { useRef, useState, useEffect } from "react";
import type { ReactNode } from "react";

// Wraps a view with a "Vollbild" toggle that fullscreens just this panel
// (handy on a beamer / display). Styling for the fullscreen state is driven
// by the .is-fullscreen class so it works regardless of :fullscreen support.
export default function FullscreenPanel({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isFull, setIsFull] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFull(document.fullscreenElement === ref.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      ref.current?.requestFullscreen().catch(() => {});
    }
  };

  return (
    <div ref={ref} className={`fs-panel ${isFull ? "is-fullscreen" : ""}`}>
      <div className="fs-bar">
        <button className="fs-toggle" onClick={toggle} title={isFull ? "Vollbild verlassen" : "Vollbild"}>
          {isFull ? "✕ Vollbild verlassen" : "⛶ Vollbild"}
        </button>
      </div>
      {children}
    </div>
  );
}
