import { createFileRoute } from "@tanstack/react-router";
import {
  InfiniteCanvasDesktop,
  unionRects,
  useInfiniteCanvasActions,
  useInfiniteCanvasState,
} from "@hyphened/infinite-canvas";
import { useMemo, useState } from "react";
import { Button } from "ui";
import { CommandPalette } from "../showcases/command-palette.tsx";
import { CanvasMinimap } from "../showcases/minimap.tsx";
import {
  createStressInfiniteCanvasState,
  sampleInfiniteCanvasWindowRegistry,
} from "../showcases/sample-layout.tsx";

/** Enough windows that the rows are obvious and the occupancy number means something. */
const PACKING_WINDOW_COUNT = 24;

/**
 * The stress generator makes windows of one height, which hides the half of the algorithm worth
 * seeing. Mixed heights are what force it to sort and to open a new row when one fills.
 */
const PACKING_HEIGHTS = [180, 240, 300, 360] as const;

export const Route = createFileRoute("/packing")({
  component: PackingShowcase,
  staticData: {
    showcase: {
      description: "Strip packing: rows of windows, tallest first, nothing overlapping.",
      order: 4,
      title: "Packing",
    },
  },
});

function PackingShowcase() {
  const initialState = useMemo(() => {
    const generated = createStressInfiniteCanvasState(PACKING_WINDOW_COUNT);

    return {
      ...generated,
      windows: generated.windows.map((window, index) => ({
        ...window,
        rect: {
          ...window.rect,
          height: PACKING_HEIGHTS[index % PACKING_HEIGHTS.length] ?? window.rect.height,
        },
      })),
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <InfiniteCanvasDesktop
        documentKey="packing"
        initialState={initialState}
        renderOverlay={() => (
          <>
            <CommandPalette />
            <CanvasMinimap />
            <PackingPanel />
          </>
        )}
        subtitle="First-Fit Decreasing Height over the region the windows already span."
        title="Packing"
        windowDefinitions={sampleInfiniteCanvasWindowRegistry}
      />
    </div>
  );
}

/** Gaps offered, so the effect of the one parameter is visible. */
const GAP_CHOICES = [0, 16, 40] as const;

function PackingPanel() {
  const state = useInfiniteCanvasState();
  const actions = useInfiniteCanvasActions();
  const [gapPx, setGapPx] = useState<number>(16);

  const rects = state.windows
    .filter((window) => window.mode !== "minimized")
    .map((window) => window.rect);
  const bounds = unionRects(rects);
  /*
   * Occupancy is what a packer is judged on: the share of the bounding block the windows actually
   * cover. Packing raises it, and that number moving is the visible proof it did something.
   */
  const covered = rects.reduce((total, rect) => total + rect.width * rect.height, 0);
  const occupancy = bounds === null ? 0 : covered / (bounds.width * bounds.height);

  return (
    <div className="pointer-events-none absolute bottom-16 left-4 z-[70]">
      <div className="pointer-events-auto w-60 rounded-lg border border-border bg-popover/90 p-3 backdrop-blur">
        <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
          Strip packing
        </div>

        <dl className="mb-3 grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <dt>windows</dt>
          <dd className="text-right text-foreground">{rects.length}</dd>
          <dt>block</dt>
          <dd className="text-right text-foreground">
            {bounds === null ? "—" : `${Math.round(bounds.width)} × ${Math.round(bounds.height)}`}
          </dd>
          <dt>occupancy</dt>
          <dd className="text-right text-foreground">{`${Math.round(occupancy * 100)}%`}</dd>
        </dl>

        <div className="mb-1.5 flex items-center gap-1.5">
          {GAP_CHOICES.map((choice) => (
            <Button
              key={choice}
              onClick={() => {
                setGapPx(choice);
              }}
              size="xs"
              variant={choice === gapPx ? "secondary" : "ghost"}
            >
              {`gap ${choice}`}
            </Button>
          ))}
        </div>

        <div className="grid gap-1.5">
          <Button
            data-testid="pack-windows"
            onClick={() => {
              // Packing arranges the selection, so select everything first.
              actions.executeCommand({ type: "selection.selectAllVisible" });
              actions.executeCommand({ gapPx, type: "window.pack" });
            }}
            size="xs"
            variant="secondary"
          >
            Pack windows
          </Button>
          <Button
            onClick={() => {
              actions.executeCommand({ type: "history.undo" });
            }}
            size="xs"
            variant="ghost"
          >
            Undo
          </Button>
        </div>

        <p className="mt-2.5 font-mono text-[9.5px] leading-relaxed text-muted-foreground">
          Tallest first into the first row with room, so rows never interleave and no two windows
          overlap. Sizes are kept.
        </p>
      </div>
    </div>
  );
}
