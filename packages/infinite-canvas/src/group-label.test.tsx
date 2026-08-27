/**
 * A group's title has somewhere to be seen.
 *
 * It was modelled, persisted, settable through `setGroupTitle`, and drawn nowhere: the only render
 * sites were the shell's `aria-label` and a *fallback* tab label for a nested split. Measured in a
 * browser on 2026-08-26, a two-member split named "Reading list" rendered that string zero times.
 * Naming a group was write-only, and nothing in a typecheck or a green suite said so.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { InfiniteCanvasGroupLayer } from "./group-layer";
import { InfiniteCanvasProvider } from "./store";
import type { InfiniteCanvasGroup } from "./types";

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

const renderLayerFor = (title: string) => {
  const state = createInfiniteCanvasState<Kind>({
    groups: [group(title)],
    viewport: { height: 800, width: 1200 },
    windows,
  });

  return renderToStaticMarkup(
    <InfiniteCanvasProvider initialState={state}>
      <InfiniteCanvasGroupLayer
        canvasInstanceId="test-canvas"
        devicePixelRatio={1}
        resizeHandleSize={8}
        zIndex={0}
      />
    </InfiniteCanvasProvider>,
  );
};

test("a split group draws its title, where no tab strip exists to carry it", () => {
  const markup = renderLayerFor("Reading list");

  expect(markup).toContain('data-slot="group-label"');
  expect(markup).toContain("Reading list");
});

test("a group with no title draws no label rather than an empty band", () => {
  expect(renderLayerFor("")).not.toContain('data-slot="group-label"');
});
