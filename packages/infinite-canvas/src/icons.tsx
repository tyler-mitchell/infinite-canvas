"use client";

/**
 * Built-in icon slots for the framework chrome (window controls + HUD).
 *
 * Each icon is a minimal inline SVG glyph: 24x24 viewBox, stroked with
 * `currentColor` so theme.css (or consumer CSS) owns the color, and tagged
 * `data-slot="icon"`. Consumers can replace any subset of glyphs through
 * the `icons` prop on the Desktop/Viewport; the resolved map is
 * distributed via context so frame slots and HUD buttons pick up
 * overrides anywhere inside the viewport.
 */
import { createContext, useContext, type ComponentType, type ReactNode } from "react";

type InfiniteCanvasIconProps = Readonly<{
  size?: number;
}>;

type InfiniteCanvasIconName =
  | "center-active"
  | "close"
  | "fit-all"
  | "fit-selection"
  | "maximize"
  | "minimize"
  | "pin"
  | "pointer-marquee"
  | "pointer-pan"
  | "reset"
  | "zoom-in"
  | "zoom-out";

type InfiniteCanvasIcons = Readonly<
  Partial<Record<InfiniteCanvasIconName, ComponentType<InfiniteCanvasIconProps>>>
>;

function InfiniteCanvasIconSvg({
  children,
  size,
}: Readonly<{
  children: ReactNode;
  size: number;
}>) {
  return (
    <svg
      aria-hidden="true"
      data-slot="icon"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}

function InfiniteCanvasPinIcon({ size = 12 }: InfiniteCanvasIconProps) {
  return (
    <InfiniteCanvasIconSvg size={size}>
      <path d="M9 3.5h6" />
      <path d="M10 3.5v5.2L7 12h10l-3-3.3V3.5" />
      <path d="M12 12v8.5" />
    </InfiniteCanvasIconSvg>
  );
}

function InfiniteCanvasMinimizeIcon({ size = 12 }: InfiniteCanvasIconProps) {
  return (
    <InfiniteCanvasIconSvg size={size}>
      <path d="M20 4l-6 6" />
      <path d="M14 5v5h5" />
      <path d="M4 20l6-6" />
      <path d="M10 19v-5H5" />
    </InfiniteCanvasIconSvg>
  );
}

function InfiniteCanvasMaximizeIcon({ size = 12 }: InfiniteCanvasIconProps) {
  return (
    <InfiniteCanvasIconSvg size={size}>
      <path d="M14 10l6-6" />
      <path d="M15 4h5v5" />
      <path d="M10 14l-6 6" />
      <path d="M9 20H4v-5" />
    </InfiniteCanvasIconSvg>
  );
}

function InfiniteCanvasCloseIcon({ size = 12 }: InfiniteCanvasIconProps) {
  return (
    <InfiniteCanvasIconSvg size={size}>
      <path d="M5.5 5.5l13 13" />
      <path d="M18.5 5.5l-13 13" />
    </InfiniteCanvasIconSvg>
  );
}

function InfiniteCanvasPointerMarqueeIcon({ size = 14 }: InfiniteCanvasIconProps) {
  return (
    <InfiniteCanvasIconSvg size={size}>
      <path d="M5 4l14 7-6 2-2 6z" />
    </InfiniteCanvasIconSvg>
  );
}

function InfiniteCanvasPointerPanIcon({ size = 14 }: InfiniteCanvasIconProps) {
  return (
    <InfiniteCanvasIconSvg size={size}>
      <path d="M12 3v18" />
      <path d="M3 12h18" />
      <path d="M9 6l3-3 3 3" />
      <path d="M9 18l3 3 3-3" />
      <path d="M6 9l-3 3 3 3" />
      <path d="M18 9l3 3-3 3" />
    </InfiniteCanvasIconSvg>
  );
}

function InfiniteCanvasCenterActiveIcon({ size = 14 }: InfiniteCanvasIconProps) {
  return (
    <InfiniteCanvasIconSvg size={size}>
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="1" />
      <path d="M12 2v3" />
      <path d="M12 19v3" />
      <path d="M2 12h3" />
      <path d="M19 12h3" />
    </InfiniteCanvasIconSvg>
  );
}

function InfiniteCanvasFitSelectionIcon({ size = 14 }: InfiniteCanvasIconProps) {
  return (
    <InfiniteCanvasIconSvg size={size}>
      <path d="M3 8.5h18" />
      <path d="M3 15.5h18" />
      <path d="M8.5 3v18" />
      <path d="M15.5 3v18" />
    </InfiniteCanvasIconSvg>
  );
}

function InfiniteCanvasFitAllIcon({ size = 14 }: InfiniteCanvasIconProps) {
  return (
    <InfiniteCanvasIconSvg size={size}>
      <path d="M4 9V6.5A2.5 2.5 0 0 1 6.5 4H9" />
      <path d="M15 4h2.5A2.5 2.5 0 0 1 20 6.5V9" />
      <path d="M20 15v2.5a2.5 2.5 0 0 1-2.5 2.5H15" />
      <path d="M9 20H6.5A2.5 2.5 0 0 1 4 17.5V15" />
      <circle cx="11.5" cy="11.5" r="3" />
      <path d="M16.2 16.2l-2.6-2.6" />
    </InfiniteCanvasIconSvg>
  );
}

function InfiniteCanvasZoomInIcon({ size = 14 }: InfiniteCanvasIconProps) {
  return (
    <InfiniteCanvasIconSvg size={size}>
      <path d="M12 5.5v13" />
      <path d="M5.5 12h13" />
    </InfiniteCanvasIconSvg>
  );
}

function InfiniteCanvasZoomOutIcon({ size = 14 }: InfiniteCanvasIconProps) {
  return (
    <InfiniteCanvasIconSvg size={size}>
      <path d="M5.5 12h13" />
    </InfiniteCanvasIconSvg>
  );
}

function InfiniteCanvasResetIcon({ size = 14 }: InfiniteCanvasIconProps) {
  return (
    <InfiniteCanvasIconSvg size={size}>
      <path d="M5.2 8.8A7.5 7.5 0 1 0 7.7 5.9" />
      <path d="M7.7 1.8v4.1H3.6" />
    </InfiniteCanvasIconSvg>
  );
}

const DEFAULT_INFINITE_CANVAS_ICONS = {
  "center-active": InfiniteCanvasCenterActiveIcon,
  close: InfiniteCanvasCloseIcon,
  "fit-all": InfiniteCanvasFitAllIcon,
  "fit-selection": InfiniteCanvasFitSelectionIcon,
  maximize: InfiniteCanvasMaximizeIcon,
  minimize: InfiniteCanvasMinimizeIcon,
  pin: InfiniteCanvasPinIcon,
  "pointer-marquee": InfiniteCanvasPointerMarqueeIcon,
  "pointer-pan": InfiniteCanvasPointerPanIcon,
  reset: InfiniteCanvasResetIcon,
  "zoom-in": InfiniteCanvasZoomInIcon,
  "zoom-out": InfiniteCanvasZoomOutIcon,
} satisfies Readonly<Record<InfiniteCanvasIconName, ComponentType<InfiniteCanvasIconProps>>>;

const InfiniteCanvasIconsContext = createContext<
  Readonly<Record<InfiniteCanvasIconName, ComponentType<InfiniteCanvasIconProps>>>
>(DEFAULT_INFINITE_CANVAS_ICONS);

function useInfiniteCanvasIcons() {
  return useContext(InfiniteCanvasIconsContext);
}

export { DEFAULT_INFINITE_CANVAS_ICONS, InfiniteCanvasIconsContext, useInfiniteCanvasIcons };
export type { InfiniteCanvasIconName, InfiniteCanvasIconProps, InfiniteCanvasIcons };
