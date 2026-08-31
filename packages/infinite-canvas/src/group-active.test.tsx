import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { InfiniteCanvasGroupLayer } from "./group-layer";
import { InfiniteCanvasProvider } from "./store";
import type { InfiniteCanvasGroup } from "./types";

type Kind = "note";

const windows = ["inside-1", "inside-2", "outside"].map((id, index) =>
  createInfiniteCanvasWindow<Kind>({
    id,
    kind: "note",
    rect: { height: 200, width: 320, x: index * 400, y: 0 },
    title: id,
  }),
);

const group: InfiniteCanvasGroup = {
  id: "group-1",
  rect: { height: 400, width: 600, x: 0, y: 0 },
  title: "Reading list",
  tree: {
    activeChildId: null,
    axis: "horizontal",
    children: [
      { id: "inside-1", kind: "window", weight: 1 },
      { id: "inside-2", kind: "window", weight: 1 },
    ],
    id: "container-1",
    kind: "container",
    layout: "split",
    weight: 1,
  },
  zIndex: 0,
};

const renderWithActive = (activeWindowId: string) =>
  renderToStaticMarkup(
    <InfiniteCanvasProvider
      initialState={createInfiniteCanvasState<Kind>({
        activeWindowId,
        groups: [group],
        viewport: { height: 800, width: 1200 },
        windows,
      })}
    >
      <InfiniteCanvasGroupLayer
        canvasInstanceId="test-canvas"
        devicePixelRatio={1}
        labelSize={20}
        resizeHandleSize={8}
        zIndex={0}
      />
    </InfiniteCanvasProvider>,
  );

test("the shell holding the active window marks itself", () => {
  const markup = renderWithActive("inside-1");

  expect(markup).toContain("data-active");
  expect(markup).toContain('aria-current="true"');
});

test("any member counts, not only the first", () => {
  expect(renderWithActive("inside-2")).toContain('aria-current="true"');
});

test("a shell holding no active window says nothing rather than saying false", () => {
  const markup = renderWithActive("outside");

  expect(markup).not.toContain("data-active");
  expect(markup).not.toContain("aria-current");
});
