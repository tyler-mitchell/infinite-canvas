import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { expect, test } from "vite-plus/test";

import { InfiniteCanvasHud } from "./canvas-hud";
import {
  DEFAULT_INFINITE_CANVAS_CHROME,
  DEFAULT_INFINITE_CANVAS_STACK_BANDS,
  DEFAULT_INFINITE_CANVAS_THEME,
  resolveInfiniteCanvasZoomPolicy,
} from "./constants";
import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
} from "./factory";
import { InfiniteCanvasProvider } from "./store";
import { InfiniteCanvasWindowFrame } from "./window-frame";

type Kind = "note";

const windowRegistry = defineInfiniteCanvasWindowRegistry<Kind>({
  note: {
    kind: "note",
    renderBody: ({ window }) => <p>{window.title}</p>,
  },
});

const noteWindow = createInfiniteCanvasWindow<Kind>({
  id: "note-1",
  kind: "note",
  rect: { height: 240, width: 320, x: 0, y: 0 },
  title: "Field notes",
});

const minimizedWindow = createInfiniteCanvasWindow<Kind>({
  id: "note-2",
  kind: "note",
  mode: "minimized",
  rect: { height: 240, width: 320, x: 400, y: 0 },
  title: "Archived notes",
});

const state = createInfiniteCanvasState<Kind>({
  activeWindowId: "note-1",
  viewport: { height: 800, width: 1200 },
  windows: [noteWindow, minimizedWindow],
});

const idleState = createInfiniteCanvasState<Kind>({
  activeWindowId: null,
  selection: [],
  viewport: { height: 800, width: 1200 },
  windows: [noteWindow],
});

function renderWithStore(children: ReactNode) {
  return renderToStaticMarkup(
    <InfiniteCanvasProvider initialState={state}>{children}</InfiniteCanvasProvider>,
  );
}

function renderFrame(input: Readonly<{ isActive: boolean; isSelected: boolean }>) {
  return renderWithStore(
    <InfiniteCanvasWindowFrame
      canvasInstanceId="test-canvas"
      chrome={DEFAULT_INFINITE_CANVAS_CHROME}
      isActive={input.isActive}
      isGrouped={false}
      isSelected={input.isSelected}
      stackBands={DEFAULT_INFINITE_CANVAS_STACK_BANDS}
      theme={DEFAULT_INFINITE_CANVAS_THEME}
      window={noteWindow}
      windowDefinitions={windowRegistry}
      zoom={state.camera.zoom}
    />,
  );
}

function renderHud(hudState: typeof state) {
  return renderToStaticMarkup(
    <InfiniteCanvasProvider initialState={hudState}>
      <InfiniteCanvasHud
        onPointerModeChange={() => undefined}
        pointerMode="pan"
        subtitle="Subtitle"
        title="Title"
        zoomPolicy={resolveInfiniteCanvasZoomPolicy()}
      />
    </InfiniteCanvasProvider>,
  );
}

const hudMarkup = renderHud(state);
const idleHudMarkup = renderHud(idleState);

function buttonOpenings(markup: string): readonly string[] {
  return [...markup.matchAll(/<button\b[^>]*>/g)].map((match) => match[0]);
}

function unnamedButtons(markup: string): readonly string[] {
  return [...markup.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
    .filter(([, attributes, children]) => {
      const hasLabel = attributes.includes("aria-label=");
      const text = children.replace(/<[^>]*>/g, "").trim();
      return !hasLabel && text.length === 0;
    })
    .map(([element]) => element.slice(0, 120));
}

test("windows expose an accessible name, a role, and a role description", () => {
  const markup = renderFrame({ isActive: true, isSelected: true });

  expect(markup).toContain('role="group"');
  expect(markup).toContain('aria-label="Field notes"');
  expect(markup).toContain('aria-roledescription="window"');
});

test("window frames and the HUD never emit aria-selected: invalid on role=group", () => {
  for (const isSelected of [false, true]) {
    for (const isActive of [false, true]) {
      expect(renderFrame({ isActive, isSelected })).not.toContain("aria-selected");
    }
  }
  expect(hudMarkup).not.toContain("aria-selected");
});

test("aria-current marks the active window and only the active window", () => {
  expect(renderFrame({ isActive: true, isSelected: false })).toContain('aria-current="true"');
  expect(renderFrame({ isActive: false, isSelected: true })).not.toContain("aria-current");
});

test("selection is a styling concern, exposed only as a data attribute", () => {
  const markup = renderFrame({ isActive: false, isSelected: true });

  expect(markup).toContain('data-selected=""');
  expect(markup).not.toContain("aria-selected");
});

test("every framework-rendered button has an accessible name", () => {
  const frameMarkup = renderFrame({ isActive: true, isSelected: true });

  expect(buttonOpenings(frameMarkup).length).toBe(4);
  expect(buttonOpenings(hudMarkup).length).toBeGreaterThan(4);
  expect(unnamedButtons(frameMarkup)).toEqual([]);
  expect(unnamedButtons(hudMarkup)).toEqual([]);
});

test("aria-pressed appears only on the pointer-mode toggle buttons", () => {
  const pressed = [...hudMarkup.matchAll(/aria-pressed="(?:true|false)"/g)];
  expect(pressed.length).toBe(2);

  const pressedButtons = buttonOpenings(hudMarkup).filter((opening) =>
    opening.includes("aria-pressed"),
  );
  expect(pressedButtons.length).toBe(2);
});

test("decorative chrome is hidden from assistive technology", () => {
  const markup = renderFrame({ isActive: true, isSelected: false });

  expect(markup).toContain('aria-hidden="true"');
});

test("unavailable HUD commands are exposed as disabled, not merely dimmed", () => {
  const findAction = (markup: string, action: string) =>
    buttonOpenings(markup).find((opening) => opening.includes(`data-action="${action}"`));

  expect(findAction(idleHudMarkup, "center-active")).toContain("disabled");
  expect(findAction(idleHudMarkup, "fit-selection")).toContain("disabled");

  expect(findAction(hudMarkup, "center-active")).not.toContain("disabled");
  expect(findAction(hudMarkup, "fit-selection")).not.toContain("disabled");
});

test("the invalid state cannot silently return: no aria-selected on frames or HUD", () => {
  const allMarkup = [
    renderFrame({ isActive: true, isSelected: true }),
    renderFrame({ isActive: false, isSelected: false }),
    hudMarkup,
  ].join("\n");

  expect(allMarkup.includes("aria-selected")).toBe(false);
});
