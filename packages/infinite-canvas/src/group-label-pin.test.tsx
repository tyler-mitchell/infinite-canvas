import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { InfiniteCanvasGroupLayer } from "./group-layer";
import { InfiniteCanvasProvider } from "./store";
import type { InfiniteCanvasGroup, InfiniteCanvasRect } from "./types";

type Kind = "note";

const windows = ["note-1", "note-2"].map((id) =>
  createInfiniteCanvasWindow<Kind>({
    id,
    kind: "note",
    rect: { height: 200, width: 320, x: 0, y: 0 },
    title: id,
  }),
);

const tree: InfiniteCanvasGroup["tree"] = {
  activeChildId: null,
  axis: "horizontal",
  children: [
    { id: "note-1", kind: "window", weight: 1 },
    { id: "note-2", kind: "window", weight: 1 },
  ],
  id: "container-1",
  kind: "container",
  layout: "split",
  weight: 1,
};

const LABEL_SIZE = 20;
const HANDLE_SIZE = 8;

const render = (
  rect: InfiniteCanvasRect,
  insets: Readonly<{ bottom: number; left: number; right: number; top: number }> = {
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  },
) =>
  renderToStaticMarkup(
    <InfiniteCanvasProvider
      initialState={createInfiniteCanvasState<Kind>({
        groups: [{ id: "group-1", rect, title: "Reading list", tree, zIndex: 0 }],
        viewport: { height: 800, width: 1200 },
        viewportInsets: insets,
        windows,
      })}
    >
      <InfiniteCanvasGroupLayer
        canvasInstanceId="test-canvas"
        labelSize={LABEL_SIZE}
        resizeHandleSize={HANDLE_SIZE}
        zIndex={0}
      />
    </InfiniteCanvasProvider>,
  );

const getPinOffset = (markup: string): number =>
  Number(
    /calc\(100% \+ var\(--icx-resize-handle-size\) - ([\d.]+)px\)/.exec(markup)?.[1] ?? Number.NaN,
  );

test("a group with room above it does not pin at all", () => {
  expect(getPinOffset(render({ height: 300, width: 600, x: 0, y: 0 }))).toBe(0);
});

test("a group whose top has scrolled off holds its name at the viewport edge", () => {
  expect(getPinOffset(render({ height: 300, width: 600, x: 0, y: -400 }))).toBe(28);
});

test("the pin stops at the consumer's chrome, not the raw viewport edge", () => {
  const offset = getPinOffset(
    render({ height: 300, width: 600, x: 0, y: -400 }, { bottom: 0, left: 0, right: 0, top: 56 }),
  );

  expect(offset).toBe(84);
});

test("a shell scrolled fully off the top takes its label with it", () => {
  const offset = getPinOffset(render({ height: 300, width: 600, x: 0, y: -1200 }));

  expect(offset).toBe(308);
});

test("the pin is a world length, so it holds the same screen position at any zoom", () => {
  const markup = renderToStaticMarkup(
    <InfiniteCanvasProvider
      initialState={createInfiniteCanvasState<Kind>({
        camera: { center: { x: 0, y: 0 }, zoom: 2 },
        groups: [
          {
            id: "group-1",
            rect: { height: 300, width: 600, x: 0, y: -400 },
            title: "R",
            tree,
            zIndex: 0,
          },
        ],
        viewport: { height: 800, width: 1200 },
        windows,
      })}
    >
      <InfiniteCanvasGroupLayer
        canvasInstanceId="test-canvas"
        labelSize={LABEL_SIZE}
        resizeHandleSize={HANDLE_SIZE}
        zIndex={0}
      />
    </InfiniteCanvasProvider>,
  );
  expect(getPinOffset(markup)).toBe(214);
});
