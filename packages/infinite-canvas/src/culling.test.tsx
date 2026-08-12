import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
} from "./factory";
import { InfiniteCanvasViewport } from "./infinite-canvas";
import { InfiniteCanvasProvider } from "./store";

/**
 * Culling skips rendering; it must never unmount.
 *
 * The distinction is the whole design. Dropping an offscreen window from the rendered set
 * tears down its subtree: DOM focus falls to `<body>` and silently kills every hotkey bound
 * to a control inside it, portal roots detach, and body scroll position, video playback, and
 * uncontrolled input state are destroyed by panning away and back. `content-visibility: auto`
 * skips the subtree's rendering work while leaving all of that intact — and the browser
 * un-skips it when it takes focus, which is why it is `auto` rather than `hidden`.
 *
 * These assert the property through rendered markup rather than through the predicate, so a
 * future change that culls by filtering the window list fails here even if the predicate it
 * consults is still correct.
 */

type Kind = "note";

const registry = defineInfiniteCanvasWindowRegistry<Kind>({
  note: { kind: "note", renderBody: ({ window }) => <p>{window.title}</p> },
});

/** One window under the camera, one far outside it, on a measured viewport. */
const canvas = () => ({
  ...createInfiniteCanvasState<Kind>({
    windows: [
      createInfiniteCanvasWindow<Kind>({
        id: "near",
        kind: "note",
        rect: { height: 200, width: 300, x: 0, y: 0 },
        title: "near",
      }),
      createInfiniteCanvasWindow<Kind>({
        id: "far",
        kind: "note",
        // Far enough past the 480px cull margin that no rounding puts it back in view.
        rect: { height: 200, width: 300, x: 40_000, y: 40_000 },
        title: "far",
      }),
    ],
  }),
  viewport: { height: 800, width: 1200 },
});

const markup = () =>
  renderToStaticMarkup(
    <InfiniteCanvasProvider initialState={canvas()}>
      <InfiniteCanvasViewport<Kind> windowDefinitions={registry} />
    </InfiniteCanvasProvider>,
  );

test("an offscreen window is still in the document", () => {
  const rendered = markup();

  // Its body, not merely its frame: unmounting the subtree is the failure this guards, and a
  // frame rendered with its contents dropped would pass a check for the id alone.
  expect(rendered).toContain('data-infinite-canvas-window-id="far"');
  expect(rendered).toContain("far</p>");
});

/**
 * The frame element's own `style`, and nothing nested inside it.
 *
 * A window body carries its own `content-visibility` from the rasterization policy, which is a
 * different mechanism with a different trigger. Matching anywhere in the frame's subtree reads
 * that one and reports success no matter what the frame does — which is exactly what the first
 * draft of these tests did.
 */
const frameStyle = (rendered: string, id: string): string => {
  const article = rendered.split("<article").find((chunk) => chunk.includes(`-window-${id}"`));

  return article?.slice(0, article.indexOf(">")) ?? "";
};

test("an offscreen window is skipped and an onscreen one is not", () => {
  const rendered = markup();

  // `auto`, never `hidden`: `hidden` would keep the element mounted but make its contents
  // unfocusable and unreachable by find-in-page, which reintroduces the bug by another route.
  expect(frameStyle(rendered, "far")).toContain("content-visibility:auto");
  expect(frameStyle(rendered, "near")).toContain("content-visibility:visible");
});

test("nothing is culled before the viewport has been measured", () => {
  // A `0 x 0` viewport overlaps no window at all, so a predicate that trusted it would skip
  // every window on the canvas and paint an empty page on the first frame.
  const rendered = renderToStaticMarkup(
    <InfiniteCanvasProvider initialState={{ ...canvas(), viewport: { height: 0, width: 0 } }}>
      <InfiniteCanvasViewport<Kind> windowDefinitions={registry} />
    </InfiniteCanvasProvider>,
  );

  expect(frameStyle(rendered, "far")).toContain("content-visibility:visible");
});
