"use client";

import type { CSSProperties } from "react";

import { DEFAULT_INFINITE_CANVAS_STACK_BANDS } from "./constants";
import { useInfiniteCanvasRasterPolicy, useInfiniteCanvasRasterSummary } from "./rasterization";

/**
 * Developer surface: must render correctly without theme.css, so all styling
 * is inline. Color values reproduce the previous Tailwind utilities verbatim;
 * rgba(206, 250, 254, …) is Tailwind cyan-100 (#cefafe).
 */
const DEVTOOLS_FONT_FAMILY =
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";

const DEVTOOLS_HAIRLINE = "1px solid rgba(255, 255, 255, 0.08)";

const RASTER_DEVTOOLS_PANEL_STYLE = {
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
  width: "280px",
  zIndex: DEFAULT_INFINITE_CANVAS_STACK_BANDS.overlay,
} satisfies CSSProperties;

const DEVTOOLS_HEADER_ROW_STYLE = {
  alignItems: "center",
  borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
  display: "flex",
  justifyContent: "space-between",
  marginBottom: "8px",
  paddingBottom: "8px",
} satisfies CSSProperties;

const DEVTOOLS_TITLE_STYLE = {
  color: "rgba(206, 250, 254, 0.78)",
} satisfies CSSProperties;

const DEVTOOLS_LABEL_STYLE = {
  color: "rgba(255, 255, 255, 0.34)",
} satisfies CSSProperties;

const DEVTOOLS_VALUE_STYLE = {
  color: "rgba(255, 255, 255, 0.72)",
} satisfies CSSProperties;

const DEVTOOLS_METRIC_ROW_STYLE = {
  alignItems: "center",
  display: "flex",
  gap: "12px",
  justifyContent: "space-between",
} satisfies CSSProperties;

const RASTER_METRIC_GRID_STYLE = {
  columnGap: "12px",
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  marginBottom: "12px",
  rowGap: "4px",
} satisfies CSSProperties;

const RASTER_RUNTIME_GRID_STYLE = {
  ...RASTER_METRIC_GRID_STYLE,
  borderTop: DEVTOOLS_HAIRLINE,
  paddingTop: "8px",
} satisfies CSSProperties;

const RASTER_POLICY_GRID_STYLE = {
  borderTop: DEVTOOLS_HAIRLINE,
  color: "rgba(255, 255, 255, 0.42)",
  display: "grid",
  gap: "4px",
  paddingTop: "8px",
} satisfies CSSProperties;

const RASTER_POLICY_ROW_STYLE = {
  display: "flex",
  gap: "12px",
  justifyContent: "space-between",
} satisfies CSSProperties;

const RASTER_POLICY_VALUE_STYLE = {
  color: "rgba(255, 255, 255, 0.62)",
} satisfies CSSProperties;

const RASTER_LATEST_EVENT_STYLE = {
  borderTop: DEVTOOLS_HAIRLINE,
  color: "rgba(206, 250, 254, 0.6)",
  marginTop: "4px",
  overflow: "hidden",
  paddingTop: "8px",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} satisfies CSSProperties;

const RASTER_LATEST_ERROR_STYLE = {
  color: "#ffb4a8",
  display: "-webkit-box",
  marginTop: "4px",
  overflow: "hidden",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
} satisfies CSSProperties;

const RASTER_FOOTNOTE_STYLE = {
  borderTop: DEVTOOLS_HAIRLINE,
  color: "rgba(255, 255, 255, 0.34)",
  marginTop: "4px",
  paddingTop: "8px",
} satisfies CSSProperties;

const RASTER_HUD_STYLE = {
  backdropFilter: "blur(8px)",
  backgroundColor: "rgba(0, 0, 0, 0.55)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  color: "rgba(255, 255, 255, 0.48)",
  fontFamily: DEVTOOLS_FONT_FAMILY,
  fontSize: "10px",
  lineHeight: 1.625,
  padding: "8px 12px",
  pointerEvents: "none",
  position: "absolute",
  right: "16px",
  textTransform: "uppercase",
  top: "16px",
  zIndex: DEFAULT_INFINITE_CANVAS_STACK_BANDS.overlay,
} satisfies CSSProperties;

const RASTER_HUD_TITLE_STYLE = {
  color: "rgba(206, 250, 254, 0.7)",
} satisfies CSSProperties;

const RASTER_HUD_NOTE_STYLE = {
  color: "rgba(255, 255, 255, 0.36)",
} satisfies CSSProperties;

const RASTER_HUD_PAUSED_STYLE = {
  color: "rgba(206, 250, 254, 0.6)",
} satisfies CSSProperties;

const RASTER_HUD_FAILED_STYLE = {
  color: "#ffb4a8",
} satisfies CSSProperties;

function InfiniteCanvasRasterHud() {
  const rasterizationPolicy = useInfiniteCanvasRasterPolicy();
  const summary = useInfiniteCanvasRasterSummary();

  if (!rasterizationPolicy.enabled) {
    return null;
  }

  if (rasterizationPolicy.debug) {
    const displayMetrics = [
      ["displayed", summary.displayed],
      ["live", summary.live],
      ["snapshot", summary.snapshot],
      ["ready", summary.ready],
      ["queued", summary.queued],
      ["capturing", summary.capturing],
      ["failed", summary.failed],
      ["paused", summary.paused ? "yes" : "no"],
    ] as const;
    const runtimeMetrics = [
      ["active", summary.activeCaptures],
      ["queue", summary.queuedCaptures],
      ["started", summary.totalStarted],
      ["finished", summary.totalReady],
      ["errored", summary.totalFailed],
      ["avg ms", formatRasterMetric(summary.averageCaptureMs)],
      ["last ms", formatRasterMetric(summary.latestCaptureMs)],
    ] as const;

    return (
      <div data-infinite-canvas-raster-devtools="true" style={RASTER_DEVTOOLS_PANEL_STYLE}>
        <div style={DEVTOOLS_HEADER_ROW_STYLE}>
          <div style={DEVTOOLS_TITLE_STYLE}>Raster Devtools</div>
          <div style={DEVTOOLS_LABEL_STYLE}>{rasterizationPolicy.adapter}</div>
        </div>
        <div style={RASTER_METRIC_GRID_STYLE}>
          {displayMetrics.map(([label, value]) => (
            <div key={label} style={DEVTOOLS_METRIC_ROW_STYLE}>
              <span style={DEVTOOLS_LABEL_STYLE}>{label}</span>
              <span style={DEVTOOLS_VALUE_STYLE}>{value}</span>
            </div>
          ))}
        </div>
        <div style={RASTER_RUNTIME_GRID_STYLE}>
          {runtimeMetrics.map(([label, value]) => (
            <div key={label} style={DEVTOOLS_METRIC_ROW_STYLE}>
              <span style={DEVTOOLS_LABEL_STYLE}>{label}</span>
              <span style={DEVTOOLS_VALUE_STYLE}>{value}</span>
            </div>
          ))}
        </div>
        <div style={RASTER_POLICY_GRID_STYLE}>
          <div style={RASTER_POLICY_ROW_STYLE}>
            <span>schedule</span>
            <span style={RASTER_POLICY_VALUE_STYLE}>{rasterizationPolicy.captureScheduling}</span>
          </div>
          <div style={RASTER_POLICY_ROW_STYLE}>
            <span>format</span>
            <span style={RASTER_POLICY_VALUE_STYLE}>{rasterizationPolicy.format}</span>
          </div>
          <div style={RASTER_POLICY_ROW_STYLE}>
            <span>cache</span>
            <span style={RASTER_POLICY_VALUE_STYLE}>{rasterizationPolicy.cache}</span>
          </div>
          <div style={RASTER_POLICY_ROW_STYLE}>
            <span>concurrency</span>
            <span style={RASTER_POLICY_VALUE_STYLE}>
              {rasterizationPolicy.maxConcurrentCaptures}
            </span>
          </div>
          <div style={RASTER_POLICY_ROW_STYLE}>
            <span>pending cap</span>
            <span style={RASTER_POLICY_VALUE_STYLE}>
              {formatRasterLimit(rasterizationPolicy.maxPendingCaptures)}
            </span>
          </div>
          <div style={RASTER_POLICY_ROW_STYLE}>
            <span>delay</span>
            <span style={RASTER_POLICY_VALUE_STYLE}>{rasterizationPolicy.captureDelayMs}ms</span>
          </div>
          <div style={RASTER_POLICY_ROW_STYLE}>
            <span>stagger</span>
            <span style={RASTER_POLICY_VALUE_STYLE}>{rasterizationPolicy.captureStaggerMs}ms</span>
          </div>
          {summary.latestEvent === null ? null : (
            <div style={RASTER_LATEST_EVENT_STYLE}>{summary.latestEvent}</div>
          )}
          {summary.latestError === null ? null : (
            <div style={RASTER_LATEST_ERROR_STYLE}>{summary.latestError}</div>
          )}
          <div style={RASTER_FOOTNOTE_STYLE}>
            Active, selected, and native-scroll windows intentionally stay live.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-infinite-canvas-raster-hud="true" style={RASTER_HUD_STYLE}>
      <div style={RASTER_HUD_TITLE_STYLE}>Raster</div>
      <div>displayed {summary.displayed}</div>
      <div>live DOM {summary.live}</div>
      <div>snapshot {summary.snapshot}</div>
      <div>queued {summary.queued}</div>
      <div>capturing {summary.capturing}</div>
      <div>ready {summary.ready}</div>
      {summary.live > 0 ? (
        <div style={RASTER_HUD_NOTE_STYLE}>interactive windows stay live</div>
      ) : null}
      {summary.paused ? <div style={RASTER_HUD_PAUSED_STYLE}>paused</div> : null}
      {summary.failed > 0 ? (
        <div style={RASTER_HUD_FAILED_STYLE}>failed {summary.failed}</div>
      ) : null}
    </div>
  );
}

const formatRasterMetric = (value: number | null): string => (value === null ? "-" : `${value}`);
const formatRasterLimit = (value: number): string =>
  Number.isFinite(value) ? `${value}` : "unbounded";

export { InfiniteCanvasRasterHud };
