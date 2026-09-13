import type { CSSProperties } from "react";
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

const noteWindow = createInfiniteCanvasWindow<Kind>({
  id: "note-1",
  kind: "note",
  rect: { height: 210, width: 300, x: 0, y: 0 },
  title: "Note",
});

const BODY_MARKER = "FULL-BODY";
const SUMMARY_MARKER = "SUMMARY-CARD";

type RenderOptions = Readonly<{
  overflowY?: CSSProperties["overflowY"];
  withSummary?: boolean;
  zoom: number;
}>;

const registry = (options: RenderOptions) =>
  defineInfiniteCanvasWindowRegistry<Kind>({
    note: {
      kind: "note",
      overflowY: options.overflowY,
      renderBody: () => <p>{BODY_MARKER}</p>,
      ...((options.withSummary ?? true) && { renderSummary: () => <p>{SUMMARY_MARKER}</p> }),
    },
  });

const render = (options: RenderOptions) => {
  const state = createInfiniteCanvasState<Kind>({
    camera: { center: { x: 150, y: 105 }, zoom: options.zoom },
    viewport: { height: 800, width: 1200 },
    windows: [noteWindow],
  });

  return renderToStaticMarkup(
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
        windowDefinitions={registry(options)}
        zoom={state.camera.zoom}
      />
    </InfiniteCanvasProvider>,
  );
};

test("a window renders its full body at 100% zoom", () => {
  const markup = render({ zoom: 1 });

  expect(markup).toContain(BODY_MARKER);
  expect(markup).not.toContain(SUMMARY_MARKER);
});

test("a window renders its summary once it is too small to read", () => {
  const markup = render({ zoom: 0.4 });

  expect(markup).toContain(SUMMARY_MARKER);
  expect(markup).not.toContain(BODY_MARKER);
});

test("a kind that declares no summary stays full detail at any zoom", () => {
  const markup = render({ withSummary: false, zoom: 0.1 });

  expect(markup).toContain(BODY_MARKER);
});

const getStyles = (markup: string) => [...markup.matchAll(/style="([^"]*)"/g)].map(([, s]) => s);

const getWrapperStyle = (options: RenderOptions) =>
  getStyles(render(options)).find(
    (style) => style.includes("contain:layout paint style") && style.includes("width:100%"),
  ) ?? "";

const hasHeight = (style: string) => /(?:^|;)height:100%/.test(style);

test("the window body is a scroll container", () => {
  expect(getStyles(render({ zoom: 1 })).some((style) => style.includes("overflow-y:auto"))).toBe(
    true,
  );
});

test("the body's content wrapper may grow past the scroll container, not be locked to it", () => {
  const wrapper = getWrapperStyle({ zoom: 1 });

  expect(wrapper).toContain("min-height:100%");
  expect(hasHeight(wrapper)).toBe(false);
});

test("a body that declares it will not scroll is pinned to its container instead", () => {
  const wrapper = getWrapperStyle({ overflowY: "hidden", zoom: 1 });

  expect(hasHeight(wrapper)).toBe(true);
  expect(wrapper).not.toContain("min-height:100%");
});

test("only overflow values that actually scroll get a growable wrapper", () => {
  expect(hasHeight(getWrapperStyle({ overflowY: "scroll", zoom: 1 }))).toBe(false);
  expect(hasHeight(getWrapperStyle({ overflowY: "clip", zoom: 1 }))).toBe(true);
  expect(hasHeight(getWrapperStyle({ overflowY: "visible", zoom: 1 }))).toBe(true);
});
