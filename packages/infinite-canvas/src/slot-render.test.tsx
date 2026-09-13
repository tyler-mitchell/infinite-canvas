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
        canvasInstanceId="test-canvas"
        chrome={DEFAULT_INFINITE_CANVAS_CHROME}
        isActive={false}
        isGrouped={false}
        isSelected={false}
        stackBands={DEFAULT_INFINITE_CANVAS_STACK_BANDS}
        theme={DEFAULT_INFINITE_CANVAS_THEME}
        window={noteWindow}
        windowDefinitions={defineInfiniteCanvasWindowRegistry<Kind>({
          note: { kind: "note", renderFrame },
        })}
        zoom={state.camera.zoom}
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
  const markup = renderFrameWith(({ frame: { Header, Surface } }) => (
    <Surface>
      <Header render={(props, { children }) => <nav {...props}>{children}</nav>} />
    </Surface>
  ));

  expect(markup).toContain("<nav");
  expect(markup).not.toContain("<header");
});

test("`render` still receives the framework's own props", () => {
  const markup = renderFrameWith(({ frame: { Header, Surface } }) => (
    <Surface>
      <Header render={(props, { children }) => <nav {...props}>{children}</nav>} />
    </Surface>
  ));

  expect(markup).toContain('data-slot="window-header"');
  expect(markup).toContain('data-infinite-canvas-control="true"');
});

test("arbitrary DOM props reach the element, with or without `render`", () => {
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

test("a header title centres with grid columns, no absolute positioning", () => {
  const markup = renderFrameWith(({ frame: { Controls, Header, Surface, Title } }) => (
    <Surface>
      <Header style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr" }}>
        <span data-testid="leading" />
        <Title style={{ textAlign: "center" }} />
        <Controls style={{ justifySelf: "end" }} />
      </Header>
    </Surface>
  ));

  expect(markup).toContain("display:grid");
  expect(markup).toContain("grid-template-columns:1fr auto 1fr");
  expect(markup).toContain("position:absolute");
  expect(markup).toContain('data-slot="window-header"');
  expect(markup).toContain('data-slot="window-title"');
  expect(markup).toContain('data-slot="window-controls"');
});

test("the header's framework behaviour survives a consumer relayout", () => {
  const markup = renderFrameWith(({ frame: { Controls, Header, Surface, Title } }) => (
    <Surface>
      <Header style={{ display: "grid" }}>
        <Title />
        <Controls />
      </Header>
    </Surface>
  ));

  expect(markup).toContain('data-infinite-canvas-control="true"');
});
