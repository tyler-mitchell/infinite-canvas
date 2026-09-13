import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { InfiniteCanvasGroupLayer } from "./group-layer";
import { InfiniteCanvasProvider } from "./store";
import type { InfiniteCanvasGroup, InfiniteCanvasWindow } from "./types";

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

const group = (title: string): InfiniteCanvasGroup => ({
  id: "group-1",
  rect: { height: 400, width: 600, x: 0, y: 0 },
  title,
  tree,
  zIndex: 0,
});

const renderLayerFor = (
  title: string,
  labelSize = 20,
  zoom = 1,
  groupLabel?: (
    context: Readonly<{ group: InfiniteCanvasGroup; windows: readonly InfiniteCanvasWindow[] }>,
  ) => string,
) => {
  const state = createInfiniteCanvasState<Kind>({
    camera: { center: { x: 0, y: 0 }, zoom },
    groups: [group(title)],
    viewport: { height: 800, width: 1200 },
    windows,
  });

  return renderToStaticMarkup(
    <InfiniteCanvasProvider initialState={state}>
      <InfiniteCanvasGroupLayer
        canvasInstanceId="test-canvas"
        groupLabel={groupLabel}
        labelSize={labelSize}
        resizeHandleSize={8}
        zIndex={0}
      />
    </InfiniteCanvasProvider>,
  );
};

const getLabelWorldSize = (markup: string): number =>
  Number(/--icx-group-label-size:\s*([\d.]+)px/.exec(markup)?.[1] ?? Number.NaN);

test("a split group draws its title, where no tab strip exists to carry it", () => {
  const markup = renderLayerFor("Reading list");

  expect(markup).toContain('data-slot="group-label"');
  expect(markup).toContain("Reading list");
});

test("a consumer replaces what the frame label says", () => {
  const markup = renderLayerFor("Reading list", 20, 1, ({ group: labelled }) => `#${labelled.id}`);

  expect(markup).toContain("#group-1");
  expect(markup).not.toContain("Reading list");
});

test("the label is handed the group and the windows, so it can name one after its members", () => {
  const markup = renderLayerFor(
    "Reading list",
    20,
    1,
    ({ windows: members }) => `${String(members.length)} panes`,
  );

  expect(markup).toContain(`${String(windows.length)} panes`);
});

test("an empty string draws no label, which is how one group opts out", () => {
  const markup = renderLayerFor("Reading list", 20, 1, () => "");

  expect(markup).not.toContain('data-slot="group-label"');
});

test("without a policy the default still names the group, so nothing changed for consumers", () => {
  const markup = renderLayerFor("Reading list");

  expect(markup).toContain("Reading list");
});

test("a group with no title draws no label rather than an empty band", () => {
  expect(renderLayerFor("")).not.toContain('data-slot="group-label"');
});

test("the label's world size scales inversely with zoom, so its screen size never changes", () => {
  const screenSizes = [0.25, 0.5, 1, 2, 4].map(
    (zoom) => getLabelWorldSize(renderLayerFor("Reading list", 20, zoom)) * zoom,
  );

  expect(screenSizes).toStrictEqual([20, 20, 20, 20, 20]);
});

test("the world size grows as the camera pulls back — the arithmetic that keeps it readable", () => {
  const far = getLabelWorldSize(renderLayerFor("Reading list", 20, 0.25));
  const near = getLabelWorldSize(renderLayerFor("Reading list", 20, 4));

  expect(far).toBeGreaterThan(near);
  expect(far).toBe(80);
  expect(near).toBe(5);
});

test("the band is configurable, and its size is the one the consumer named", () => {
  expect(getLabelWorldSize(renderLayerFor("Reading list", 44, 1))).toBe(44);
});

test("a zero band draws no label, so a consumer can turn the legend off outright", () => {
  expect(renderLayerFor("Reading list", 0)).not.toContain('data-slot="group-label"');
});

test("the label does not borrow the tab strip's size", () => {
  expect(getLabelWorldSize(renderLayerFor("Reading list", 20, 1))).not.toBe(30);
});
