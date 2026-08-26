/**
 * Semantic LOD, at the wiring rather than the policy (RENDER-001's far-card half).
 *
 * `detail-level.test.ts` covers the policy: given a rect, a zoom, and a previous level, which
 * level applies. That is necessary and not sufficient, and today proved it — the policy was
 * correct while the *defaults* stranded every stock window as a summary card at 100% zoom, a bug
 * found by driving the product rather than by any of the eleven green assertions around it.
 *
 * What was still untested afterwards is the other half: that the level the policy returns is the
 * one the body actually renders. A `renderSummary` that never ran, or ran always, would satisfy
 * every policy test in the suite.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import {
  DEFAULT_INFINITE_CANVAS_CHROME,
  DEFAULT_INFINITE_CANVAS_STACK_BANDS,
  DEFAULT_INFINITE_CANVAS_THEME,
} from "./constants";
import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
} from "./factory";
import { InfiniteCanvasProvider } from "./store";
import { InfiniteCanvasWindowFrame } from "./window-frame";

type Kind = "note";

/** 300x210, the size `/stress` uses — the one the shipped defaults got wrong. */
const noteWindow = createInfiniteCanvasWindow<Kind>({
  id: "note-1",
  kind: "note",
  rect: { height: 210, width: 300, x: 0, y: 0 },
  title: "Note",
});

const BODY_MARKER = "FULL-BODY";
const SUMMARY_MARKER = "SUMMARY-CARD";

const registry = (withSummary: boolean) =>
  defineInfiniteCanvasWindowRegistry<Kind>({
    note: {
      kind: "note",
      renderBody: () => <p>{BODY_MARKER}</p>,
      ...(withSummary && { renderSummary: () => <p>{SUMMARY_MARKER}</p> }),
    },
  });

const renderAtZoom = (zoom: number, withSummary = true) => {
  const state = createInfiniteCanvasState<Kind>({
    camera: { center: { x: 150, y: 105 }, zoom },
    viewport: { height: 800, width: 1200 },
    windows: [noteWindow],
  });

  return renderToStaticMarkup(
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
        windowDefinitions={registry(withSummary)}
      />
    </InfiniteCanvasProvider>,
  );
};

test("a window renders its full body at 100% zoom", () => {
  // The regression that shipped: 300x210 takes its smaller axis, 210, which sat under the old
  // 240px restore threshold and stranded every stock window as a card at the default zoom.
  const markup = renderAtZoom(1);

  expect(markup).toContain(BODY_MARKER);
  expect(markup).not.toContain(SUMMARY_MARKER);
});

test("a window renders its summary once it is too small to read", () => {
  // extent = min(300, 210) * 0.4 = 84, below the 120px demote threshold.
  const markup = renderAtZoom(0.4);

  expect(markup).toContain(SUMMARY_MARKER);
  expect(markup).not.toContain(BODY_MARKER);
});

test("a kind that declares no summary stays full detail at any zoom", () => {
  // The lane must cost nothing for windows that opted out — not a re-render, not a threshold
  // comparison that could ever flip.
  const markup = renderAtZoom(0.1, false);

  expect(markup).toContain(BODY_MARKER);
});

/**
 * A body taller than its window has to be reachable.
 *
 * This shipped broken and no test noticed, because every test here asks *what* renders and none
 * asked whether you could get to it. `overflowY` is a documented property of a window definition
 * and the body slot honours it, so the scroll container was always there — but the wrapper this
 * module puts inside it carried `height: "100%"`, which locks it to the container's exact height.
 * A container whose only child can never exceed it has nothing to scroll, so the overflow was
 * unreachable by wheel, scrollbar, or keyboard, for every consumer of the framework.
 *
 * Asserted on the emitted style rather than on layout because this package's test environment has
 * no DOM: `scrollHeight` is not available, and the invariant is anyway about what this module
 * declares, not about what a browser then does with it. The pairing is the whole point — the
 * container without a growable child is exactly the shape of the bug.
 */
const getStyles = (markup: string) => [...markup.matchAll(/style="([^"]*)"/g)].map(([, s]) => s);

test("the window body is a scroll container", () => {
  expect(getStyles(renderAtZoom(1)).some((style) => style.includes("overflow-y:auto"))).toBe(true);
});

test("the body's content wrapper may grow past the scroll container, not be locked to it", () => {
  // The frame carries `contain-intrinsic-size` too, so that alone finds the wrong element. The
  // wrapper is the one sized in percentages; the frame is sized in pixels.
  const wrapper = getStyles(renderAtZoom(1)).find(
    (style) => style.includes("contain-intrinsic-size") && style.includes("width:100%"),
  );

  expect(wrapper).toBeDefined();
  expect(wrapper).toContain("min-height:100%");
  // `min-height:100%` contains `height:100%` as a substring, so the negative has to anchor on the
  // property boundary or it can never fail.
  expect(/(?:^|;)height:100%/.test(wrapper ?? "")).toBe(false);
});
