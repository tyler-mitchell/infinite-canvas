/**
 * Window portal roots — the last module from the README-claims audit, and the one with the worst
 * history: `scope="window"` shipped in `0.1.0` painting *underneath* the very window it belonged
 * to, and stayed that way until someone looked at the showcase built to demonstrate it. The
 * showcase was demonstrating the bug.
 *
 * The cause was pure document order. Both the frame and the portal root are positioned, so paint
 * order resolves by `z-index` first and document order second; the root was rendered *before* the
 * frame with no `z-index`, so an opaque window body covered it. Present in the DOM, invisible on
 * screen — which is why a test that only asserted the root existed would have passed throughout.
 *
 * So these assert the two properties that actually decide visibility: the root comes after the
 * frame, and it carries the frame's own stack value.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import {
  DEFAULT_INFINITE_CANVAS_CHROME,
  DEFAULT_INFINITE_CANVAS_STACK_BANDS,
  DEFAULT_INFINITE_CANVAS_THEME,
} from "./constants";
import { INFINITE_CANVAS_SLOTS } from "./data-attributes";
import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
} from "./factory";
import { InfiniteCanvasProvider } from "./store";
import { InfiniteCanvasWindowFrame } from "./window-frame";

type Kind = "note";

const noteWindow = createInfiniteCanvasWindow<Kind>({
  id: "note-1",
  kind: "note",
  rect: { height: 200, width: 320, x: 0, y: 0 },
  title: "Note",
});

const state = createInfiniteCanvasState<Kind>({
  viewport: { height: 800, width: 1200 },
  windows: [noteWindow],
});

const renderFrame = (portalRoot: boolean) =>
  renderToStaticMarkup(
    <InfiniteCanvasProvider initialState={state}>
      <InfiniteCanvasWindowFrame
        camera={state.camera}
        canvasInstanceId="test-canvas"
        chrome={DEFAULT_INFINITE_CANVAS_CHROME}
        devicePixelRatio={1}
        isActive={false}
        isGrouped={false}
        isSelected={false}
        stackBands={DEFAULT_INFINITE_CANVAS_STACK_BANDS}
        theme={DEFAULT_INFINITE_CANVAS_THEME}
        viewport={state.viewport}
        window={noteWindow}
        windowDefinitions={defineInfiniteCanvasWindowRegistry<Kind>({
          note: { kind: "note", portalRoot, renderBody: () => <p>body</p> },
        })}
      />
    </InfiniteCanvasProvider>,
  );

const PORTAL_SLOT = `data-slot="${INFINITE_CANVAS_SLOTS.windowPortalRoot}"`;

test("the window portal root is opt-in per window kind", () => {
  // Mounting one for every window would cost a style write per window per camera tick, which is
  // exactly what the frame's memoization exists to avoid.
  expect(renderFrame(false)).not.toContain(PORTAL_SLOT);
  expect(renderFrame(true)).toContain(PORTAL_SLOT);
});

test("the portal root renders after the frame, not before it", () => {
  // The `0.1.0` bug, stated as the property that was violated. Both elements are positioned, so
  // with equal stack values document order decides, and being first meant being underneath.
  const markup = renderFrame(true);
  const frameIndex = markup.indexOf("<article");
  const portalIndex = markup.indexOf(PORTAL_SLOT);

  expect(frameIndex).toBeGreaterThanOrEqual(0);
  expect(portalIndex).toBeGreaterThan(frameIndex);
});

test("the portal root is a sibling of the frame, never inside it", () => {
  // Inside the frame it would sit within the zoom transform, be scaled by it, and resolve
  // `position: fixed` against the frame — the entire trap portals exist to escape.
  const markup = renderFrame(true);
  const articleEnd = markup.indexOf("</article>");

  expect(articleEnd).toBeGreaterThan(0);
  expect(markup.indexOf(PORTAL_SLOT)).toBeGreaterThan(articleEnd);
});

test("the portal root carries the frame's own stack value", () => {
  // Sharing rather than adding is what "belongs to this window" has to mean: above its own
  // window, still below any window stacked higher.
  //
  // Read from the two specific elements, not from every `z-index` in the markup. The first draft
  // collected all of them and failed on [0,4,4,4,4,4,4,4,4,0] — the eight 4s are the resize
  // handles stacking *within* the frame, which say nothing about where the portal root sits
  // relative to the window. The frame and the root were both 0 all along. The second draft then
  // read backwards by a fixed offset and landed inside a handle — hence `lastIndexOf("<div")`,
  // which finds the tag that actually opens the portal root.
  const markup = renderFrame(true);
  const zIndexOf = (fromIndex: number) => {
    const tag = markup.slice(fromIndex, markup.indexOf(">", fromIndex));
    const match = /z-index:\s*(-?\d+)/.exec(tag);

    return match === null ? null : Number(match[1]);
  };

  const frameZIndex = zIndexOf(markup.indexOf("<article"));
  const portalZIndex = zIndexOf(markup.lastIndexOf("<div", markup.indexOf(PORTAL_SLOT)));

  expect(frameZIndex).not.toBeNull();
  expect(portalZIndex).toBe(frameZIndex);
});

test("the portal root does not blanket the body it covers", () => {
  // `pointer-events: none` on the root; interactive portalled content opts back in itself, the
  // same contract `renderOverlay` uses.
  const markup = renderFrame(true);
  const rootTag = markup.slice(markup.indexOf(PORTAL_SLOT));

  expect(rootTag.slice(0, rootTag.indexOf(">"))).toContain("pointer-events:none");
});
