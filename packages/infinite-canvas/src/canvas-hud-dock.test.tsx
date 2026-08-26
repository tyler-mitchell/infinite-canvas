/**
 * The dock, against a desktop.
 *
 * `canvas-hud.test.ts` covers policy resolution and nothing that renders, so the dock's own rule —
 * which windows it lists — had no test at all. That rule is the kind worth one: minimizing and
 * workspace membership are orthogonal, so a window minimized on one desktop stays a member of it,
 * and a dock reading `mode` alone offers to restore windows the canvas will not draw. The failure
 * is silent and reads as a broken control: the row disappears and nothing appears.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import { InfiniteCanvasHud } from "./infinite-canvas";
import { resolveInfiniteCanvasZoomPolicy } from "./constants";
import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { InfiniteCanvasProvider } from "./store";
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
  // No workspace admits everything, so a canvas that never creates one is unaffected by the rule.
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
        selection: { anchorWindowId: null, windowIds: [] },
        title: "Desk",
        windowIds: ["here"],
      },
    ],
  });

  expect(markup).toContain("Here");
  expect(markup).not.toContain("Elsewhere");
});
