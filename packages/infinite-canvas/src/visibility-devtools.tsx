"use client";

import type { CSSProperties } from "react";

import { DEFAULT_INFINITE_CANVAS_STACK_BANDS } from "./constants";
import { useInfiniteCanvasVisibilitySummary } from "./visibility";

/**
 * Developer surface: must render correctly without theme.css, so all styling
 * is inline. Color values reproduce the previous Tailwind utilities verbatim;
 * rgba(206, 250, 254, …) is Tailwind cyan-100 (#cefafe).
 */
const DEVTOOLS_FONT_FAMILY =
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";

const VISIBILITY_HUD_STYLE = {
  backdropFilter: "blur(12px)",
  backgroundColor: "rgba(5, 8, 11, 0.88)",
  border: "1px solid rgba(206, 250, 254, 0.2)",
  boxShadow: "0 18px 50px rgba(0, 0, 0, 0.38)",
  color: "rgba(255, 255, 255, 0.56)",
  fontFamily: DEVTOOLS_FONT_FAMILY,
  fontSize: "10px",
  lineHeight: 1.625,
  padding: "12px",
  pointerEvents: "none",
  position: "absolute",
  right: "16px",
  textTransform: "uppercase",
  top: "16px",
  width: "220px",
  zIndex: DEFAULT_INFINITE_CANVAS_STACK_BANDS.overlay,
} satisfies CSSProperties;

const VISIBILITY_HEADER_ROW_STYLE = {
  alignItems: "center",
  borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
  display: "flex",
  justifyContent: "space-between",
  marginBottom: "8px",
  paddingBottom: "8px",
} satisfies CSSProperties;

const VISIBILITY_TITLE_STYLE = {
  color: "rgba(206, 250, 254, 0.78)",
} satisfies CSSProperties;

const VISIBILITY_LABEL_STYLE = {
  color: "rgba(255, 255, 255, 0.34)",
} satisfies CSSProperties;

const VISIBILITY_VALUE_STYLE = {
  color: "rgba(255, 255, 255, 0.72)",
} satisfies CSSProperties;

const VISIBILITY_METRIC_GRID_STYLE = {
  display: "grid",
  gap: "4px",
} satisfies CSSProperties;

const VISIBILITY_METRIC_ROW_STYLE = {
  alignItems: "center",
  display: "flex",
  gap: "12px",
  justifyContent: "space-between",
} satisfies CSSProperties;

const VISIBILITY_FOOTNOTE_STYLE = {
  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
  color: "rgba(255, 255, 255, 0.34)",
  marginTop: "8px",
  paddingTop: "8px",
} satisfies CSSProperties;

function InfiniteCanvasVisibilityHud() {
  const summary = useInfiniteCanvasVisibilitySummary();

  return (
    <div data-infinite-canvas-visibility-hud="true" style={VISIBILITY_HUD_STYLE}>
      <div style={VISIBILITY_HEADER_ROW_STYLE}>
        <div style={VISIBILITY_TITLE_STYLE}>Frustum</div>
        <div style={VISIBILITY_LABEL_STYLE}>R3F</div>
      </div>
      <div style={VISIBILITY_METRIC_GRID_STYLE}>
        {[
          ["tracked", summary.tracked],
          ["visible", summary.visible],
          ["hidden", summary.hidden],
        ].map(([label, value]) => (
          <div key={label} style={VISIBILITY_METRIC_ROW_STYLE}>
            <span style={VISIBILITY_LABEL_STYLE}>{label}</span>
            <span style={VISIBILITY_VALUE_STYLE}>{value}</span>
          </div>
        ))}
      </div>
      <div style={VISIBILITY_FOOTNOTE_STYLE}>
        Counts should change as windows enter and leave the viewport.
      </div>
    </div>
  );
}

export { InfiniteCanvasVisibilityHud };
