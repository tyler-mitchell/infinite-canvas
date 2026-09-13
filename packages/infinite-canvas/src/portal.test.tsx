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
        canvasInstanceId="test-canvas"
        chrome={DEFAULT_INFINITE_CANVAS_CHROME}
        isActive={false}
        isGrouped={false}
        isSelected={false}
        stackBands={DEFAULT_INFINITE_CANVAS_STACK_BANDS}
        theme={DEFAULT_INFINITE_CANVAS_THEME}
        window={noteWindow}
        windowDefinitions={defineInfiniteCanvasWindowRegistry<Kind>({
          note: { kind: "note", portalRoot, renderBody: () => <p>body</p> },
        })}
        zoom={state.camera.zoom}
      />
    </InfiniteCanvasProvider>,
  );

const PORTAL_SLOT = `data-slot="${INFINITE_CANVAS_SLOTS.windowPortalRoot}"`;

test("the window portal root is opt-in per window kind", () => {
  expect(renderFrame(false)).not.toContain(PORTAL_SLOT);
  expect(renderFrame(true)).toContain(PORTAL_SLOT);
});

test("the portal root renders after the frame, not before it", () => {
  const markup = renderFrame(true);
  const frameIndex = markup.indexOf("<article");
  const portalIndex = markup.indexOf(PORTAL_SLOT);

  expect(frameIndex).toBeGreaterThanOrEqual(0);
  expect(portalIndex).toBeGreaterThan(frameIndex);
});

test("the portal root is a sibling of the frame, never inside it", () => {
  const markup = renderFrame(true);
  const articleEnd = markup.indexOf("</article>");

  expect(articleEnd).toBeGreaterThan(0);
  expect(markup.indexOf(PORTAL_SLOT)).toBeGreaterThan(articleEnd);
});

test("the portal root carries the frame's own stack value", () => {
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
  const markup = renderFrame(true);
  const rootTag = markup.slice(markup.indexOf(PORTAL_SLOT));

  expect(rootTag.slice(0, rootTag.indexOf(">"))).toContain("pointer-events:none");
});
