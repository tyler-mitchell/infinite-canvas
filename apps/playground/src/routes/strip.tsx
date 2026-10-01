import { createFileRoute } from "@tanstack/react-router";
import { type } from "arktype";
import { useState } from "react";
import { Button } from "ui";
import { createCanvasState, type Layout } from "@hyphened/infinite-canvas/next";
import {
  CanvasScroll,
  CanvasTools,
  CanvasViewport,
  WindowNavigation,
} from "@hyphened/infinite-canvas/next/react";
import "@hyphened/infinite-canvas/next/theme.css";
import { SampleWindow } from "../showcases/sample-canvas";

export const Route = createFileRoute("/strip")({
  component: StripShowcase,
  staticData: {
    showcase: {
      description:
        "Scrollable tiling: columns of proportional width, no wrapping, the camera follows the scroll sideways.",
      order: 3,
      title: "Strip",
    },
  },
});

const stripOptions = type({ type: "'strip'", gap: "number >= 0 = 16", view: "number > 0" });
const stripItem = type({ proportion: "0 < number <= 1 = 0.5" });

const strip: Layout<typeof stripOptions, typeof stripItem> = {
  options: stripOptions,
  item: stripItem,
  accepts: [],
  size: ({ options, items, proposal }) => ({
    height: proposal.height ?? 0,
    width: items.reduce(
      (total, { item }) => total + item.proportion * options.view + options.gap,
      -options.gap,
    ),
  }),
  arrange: ({ options, items, rect }) => {
    const widths = items.map(({ item }) => item.proportion * options.view);
    return {
      controls: [],
      children: items.map(({ id }, index) => ({
        id,
        visible: true,
        rect: {
          ...rect,
          width: widths[index]!,
          x:
            rect.x +
            widths.slice(0, index).reduce((total, width) => total + width + options.gap, 0),
        },
      })),
      size: {
        height: rect.height,
        width: widths.reduce((total, width) => total + width + options.gap, -options.gap),
      },
    };
  },
};

const columns = [
  { id: "archive-window", kind: "archive", title: "archive.index", proportion: 1 / 3 },
  { id: "log-window", kind: "log", title: "ops.event-stream", proportion: 2 / 3 },
  { id: "control-window", kind: "control", title: "runtime.controls", proportion: 1 / 2 },
  { id: "archive-two", kind: "archive", title: "archive.mirror", proportion: 1 / 3 },
  { id: "log-two", kind: "log", title: "ops.audit", proportion: 2 / 3 },
] as const;

function createStripCanvas() {
  return createCanvasState({
    layouts: { strip },
    windowDefinitions: {
      archive: { minSize: { width: 240, height: 240 } },
      log: { minSize: { width: 240, height: 260 } },
      control: { minSize: { width: 240, height: 280 } },
    },
    document: {
      content: {
        presentation: { axis: "horizontal", maxZoom: 1 },
        windows: {
          columns: {
            title: "strip",
            rect: { x: 0, y: 0, width: 900, height: 620 },
            layout: { type: "strip", view: 900, gap: 16 },
            children: columns.map(({ id }) => id),
          },
          ...Object.fromEntries(
            columns.map(({ id, kind, title, proportion }) => [
              id,
              { kind, title, item: { proportion }, rect: { x: 0, y: 0, width: 300, height: 620 } },
            ]),
          ),
        },
      },
    },
  });
}

function Rail() {
  return (
    <WindowNavigation.Root
      aria-label="Columns"
      className="absolute bottom-4 left-1/2 z-70 flex -translate-x-1/2 gap-1 border border-white/10 bg-black/90 p-1"
    >
      {(entry) => (
        <WindowNavigation.Item
          key={entry.id}
          window={entry}
          className="rounded px-2 py-1 font-mono text-[11px] text-white/50 aria-[current=true]:text-white"
        />
      )}
    </WindowNavigation.Root>
  );
}

function StripShowcase() {
  const [canvas] = useState(createStripCanvas);
  const [exploring, setExploring] = useState(false);
  return (
    <div className="absolute inset-0">
      <CanvasScroll canvas={canvas} attached={!exploring}>
        <CanvasViewport
          canvas={canvas}
          renderWindow={(window) => <SampleWindow canvas={canvas} window={window} />}
        >
          <CanvasTools canvas={canvas} />
          <div
            data-canvas-control
            className="absolute top-4 left-4 z-70 flex gap-2 border border-white/10 bg-black/90 p-2 text-xs"
          >
            <Button size="xs" variant="ghost" onClick={() => setExploring((value) => !value)}>
              {exploring ? "Back to reading" : "Explore"}
            </Button>
          </div>
        </CanvasViewport>
        <Rail />
      </CanvasScroll>
    </div>
  );
}
