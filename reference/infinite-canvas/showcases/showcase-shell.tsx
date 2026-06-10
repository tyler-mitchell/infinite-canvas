"use client";

import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AppShellLayout } from "#/components/app-shell-layout";

type InfiniteCanvasShowcaseRoute = Readonly<{
  id: string;
  label: string;
  to:
    | "/experiments/infinite-canvas"
    | "/experiments/infinite-canvas/custom-frames"
    | "/experiments/infinite-canvas/drop-tray"
    | "/experiments/infinite-canvas/frustum-devtools"
    | "/experiments/infinite-canvas/original-proof"
    | "/experiments/infinite-canvas/raster-devtools"
    | "/experiments/infinite-canvas/scene-chrome"
    | "/experiments/infinite-canvas/scene-layers"
    | "/experiments/infinite-canvas/spatial-targets"
    | "/experiments/infinite-canvas/workflow-board"
    | "/experiments/infinite-canvas/stress-live"
    | "/experiments/infinite-canvas/stress-raster";
}>;

const infiniteCanvasShowcaseRoutes = [
  {
    id: "normal",
    label: "Normal",
    to: "/experiments/infinite-canvas",
  },
  {
    id: "custom-frames",
    label: "Custom Frames",
    to: "/experiments/infinite-canvas/custom-frames",
  },
  {
    id: "scene-chrome",
    label: "Scene Chrome",
    to: "/experiments/infinite-canvas/scene-chrome",
  },
  {
    id: "scene-layers",
    label: "Scene Layers",
    to: "/experiments/infinite-canvas/scene-layers",
  },
  {
    id: "workflow-board",
    label: "Workflow Board",
    to: "/experiments/infinite-canvas/workflow-board",
  },
  {
    id: "drop-tray",
    label: "Drop Tray",
    to: "/experiments/infinite-canvas/drop-tray",
  },
  {
    id: "original-proof",
    label: "Original Proof",
    to: "/experiments/infinite-canvas/original-proof",
  },
  {
    id: "stress-live",
    label: "Stress Live",
    to: "/experiments/infinite-canvas/stress-live",
  },
  {
    id: "stress-raster",
    label: "Stress Raster",
    to: "/experiments/infinite-canvas/stress-raster",
  },
  {
    id: "frustum-devtools",
    label: "Frustum Devtools",
    to: "/experiments/infinite-canvas/frustum-devtools",
  },
  {
    id: "raster-devtools",
    label: "Raster Devtools",
    to: "/experiments/infinite-canvas/raster-devtools",
  },
] satisfies readonly InfiniteCanvasShowcaseRoute[];

function InfiniteCanvasShowcaseShell({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <AppShellLayout contentClassName="overflow-hidden">
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
        <div className="-mx-1 mb-3 flex shrink-0 items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {infiniteCanvasShowcaseRoutes.map((route) => (
            <Link
              activeOptions={{ exact: true }}
              className="shrink-0 border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-medium uppercase text-white/54 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white [&.active]:border-cyan-100/50 [&.active]:bg-cyan-100/[0.08] [&.active]:text-cyan-100/84"
              key={route.id}
              to={route.to}
            >
              {route.label}
            </Link>
          ))}
        </div>
        {children}
      </div>
    </AppShellLayout>
  );
}

export { InfiniteCanvasShowcaseShell, infiniteCanvasShowcaseRoutes };
