// PDFs are always light-mode, regardless of the app's current theme —
// react-pdf has its own rendering pipeline (not the DOM/CSS the app's
// dark/light toggle applies to), so this is just a fixed light palette,
// matching the app's light-theme accent colors for brand consistency.
export const PDF_COLORS = {
  primary: "#C8102E",
  accent: "#9A7220",
  text: "#1E2026",
  muted: "#6E6E74",
  border: "#D9D9DD",
  headerBg: "#F4F1E8",
  rowAlt: "#FAFAF9",
  white: "#FFFFFF",
};
