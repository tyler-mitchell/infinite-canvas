/**
 * End-to-end proof that a slot honours `render`.
 *
 * `slot.test.ts` covers the merge function in isolation, which is necessary and not sufficient:
 * it says nothing about whether a slot actually *calls* `render`, passes it the merged props, or
 * keeps its framework attributes when the consumer supplies a different element. Shipping the
 * capability on the strength of a unit-tested helper would be exactly the green checkmark over
 * unverified work this project forbids.
 *
 * `renderToStaticMarkup` needs no DOM, matching `data-attributes.test.tsx`.
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

const renderFrameWith = (
  renderFrame: Parameters<
    typeof defineInfiniteCanvasWindowRegistry<Kind>
  >[0]["note"]["renderFrame"],
) =>
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
          note: { kind: "note", renderFrame },
        })}
      />
    </InfiniteCanvasProvider>,
  );

test("a slot renders its default element when `render` is omitted", () => {
  const markup = renderFrameWith(({ frame: { Header, Surface } }) => (
    <Surface>
      <Header />
    </Surface>
  ));

  expect(markup).toContain("<header");
  expect(markup).toContain('data-slot="window-header"');
});

test("`render` replaces the element the framework would have chosen", () => {
  // The defining headless capability: the consumer owns the tag.
  const markup = renderFrameWith(({ frame: { Header, Surface } }) => (
    <Surface>
      <Header render={(props, { children }) => <nav {...props}>{children}</nav>} />
    </Surface>
  ));

  expect(markup).toContain("<nav");
  expect(markup).not.toContain("<header");
});

test("`render` still receives the framework's own props", () => {
  // An escape hatch that dropped `data-slot` would detach the stylesheet from the element while
  // appearing to work — so the merged props reaching `render` must still carry it.
  const markup = renderFrameWith(({ frame: { Header, Surface } }) => (
    <Surface>
      <Header render={(props, { children }) => <nav {...props}>{children}</nav>} />
    </Surface>
  ));

  expect(markup).toContain('data-slot="window-header"');
  expect(markup).toContain('data-infinite-canvas-control="true"');
});

test("arbitrary DOM props reach the element, with or without `render`", () => {
  // The other half of the gap: before this, a slot took `children`, `className`, and `style` and
  // nothing else, so none of these could be expressed at all.
  const plain = renderFrameWith(({ frame: { Header, Surface } }) => (
    <Surface>
      <Header aria-describedby="hint" id="my-header" tabIndex={0} />
    </Surface>
  ));

  expect(plain).toContain('id="my-header"');
  expect(plain).toContain('aria-describedby="hint"');
  expect(plain).toContain('tabindex="0"');

  const replaced = renderFrameWith(({ frame: { Header, Surface } }) => (
    <Surface>
      <Header id="my-header" render={(props, { children }) => <nav {...props}>{children}</nav>} />
    </Surface>
  ));

  expect(replaced).toContain('id="my-header"');
});

test("a consumer className joins the framework's rather than replacing it", () => {
  const markup = renderFrameWith(({ frame: { Body, Surface } }) => (
    <Surface className="consumer-surface">
      <Body />
    </Surface>
  ));

  expect(markup).toContain("consumer-surface");
  expect(markup).toContain('data-slot="window-surface"');
});
