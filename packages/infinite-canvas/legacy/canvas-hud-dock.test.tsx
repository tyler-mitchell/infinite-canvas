import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import { InfiniteCanvasHud } from "./infinite-canvas";
import { resolveInfiniteCanvasZoomPolicy } from "./constants";
import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { InfiniteCanvasProvider } from "./react/store";
import type { InfiniteCanvasState } from "./types";

type Kind = "note";

const minimized = (id: string, title: string) => ({
  ...createInfiniteCanvasWindow<Kind>({
    id,
    kind: "note",
    rect: { height: 200, width: 300, x: 0, y: 0 },
    title,
  }),
  mode: "minimized" as const,
});

const base = (): InfiniteCanvasState<Kind> => ({
  ...createInfiniteCanvasState<Kind>({
    windows: [minimized("here", "Here"), minimized("elsewhere", "Elsewhere")],
  }),
  viewport: { height: 800, width: 1200 },
});

const renderHud = (state: InfiniteCanvasState<Kind>) =>
  renderToStaticMarkup(
    <InfiniteCanvasProvider initialState={state}>
      <InfiniteCanvasHud
        subtitle=""
        title="Canvas"
        zoomPolicy={resolveInfiniteCanvasZoomPolicy()}
      />
    </InfiniteCanvasProvider>,
  );

test("the dock lists every minimized window when no desktop is active", () => {
  const markup = renderHud(base());

  expect(markup).toContain("Here");
  expect(markup).toContain("Elsewhere");
});

test("a desktop filters the dock: it does not offer to restore a window it hides", () => {
  const state = base();
  const markup = renderHud({
    ...state,
    activeWorkspaceId: "desk",
    workspaces: [
      {
        camera: state.camera,
        id: "desk",
        selection: { anchorTarget: null, targets: [] },
        title: "Desk",
        windowIds: ["here"],
      },
    ],
  });

  expect(markup).toContain("Here");
  expect(markup).not.toContain("Elsewhere");
});
