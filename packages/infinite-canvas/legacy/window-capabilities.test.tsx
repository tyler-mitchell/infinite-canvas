import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import { isInfiniteCanvasCommandEnabled } from "./operations";
import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
} from "./factory";
import { InfiniteCanvasViewport } from "./infinite-canvas";
import { createInfiniteCanvasStore } from "./store";
import { reduceInfiniteCanvasState } from "./operations";
import { InfiniteCanvasProvider } from "./react/store";
import type { InfiniteCanvasState, InfiniteCanvasWindowCapabilities } from "./types";

type Kind = "note";

const registry = defineInfiniteCanvasWindowRegistry<Kind>({
  note: { kind: "note", renderBody: ({ window }) => <p>{window.title}</p> },
});

const stateWith = (capabilities: InfiniteCanvasWindowCapabilities): InfiniteCanvasState<Kind> => ({
  ...createInfiniteCanvasState<Kind>({
    viewport: { height: 600, width: 900 },
    windows: [
      createInfiniteCanvasWindow<Kind>({
        capabilities,
        id: "console",
        kind: "note",
        rect: { height: 200, width: 320, x: 0, y: 0 },
        title: "Console",
      }),
    ],
  }),
  activeWindowId: "console",
});

test("a window that declines closing is not closed by the action either", () => {
  const state = stateWith({ closable: false });

  expect(
    reduceInfiniteCanvasState(state, { type: "window.close", windowId: "console" }).windows,
  ).toHaveLength(1);
  expect(isInfiniteCanvasCommandEnabled(state, { type: "activeWindow.close" })).toBe(false);
  expect(reduceInfiniteCanvasState(state, { type: "activeWindow.close" }).windows).toHaveLength(1);
});

test("minimize and maximize are refused the same way, and pinning is not a capability", () => {
  const locked = stateWith({ maximizable: false, minimizable: false });

  expect(
    reduceInfiniteCanvasState(locked, { type: "window.minimize", windowId: "console" }).windows[0]
      ?.mode,
  ).toBe("normal");
  expect(
    reduceInfiniteCanvasState(locked, { type: "window.maximize", windowId: "console" }).windows[0]
      ?.mode,
  ).toBe("normal");

  expect(isInfiniteCanvasCommandEnabled(locked, { type: "activeWindow.togglePinned" })).toBe(true);
});

test("a fixed-size window refuses to begin a resize", () => {
  const fixed = stateWith({ resizable: false });
  const attempted = reduceInfiniteCanvasState(fixed, {
    handle: "south-east",
    pointerId: 1,
    point: { x: 320, y: 200 },
    type: "interaction.startResize",
    windowId: "console",
  });

  expect(attempted.interaction).toBeNull();
});

test("a locked window refuses pointer moves, nudges, placement, and arrangement", () => {
  const locked = stateWith({ movable: false });
  const selected = {
    ...locked,
    selection: {
      anchorTarget: { type: "window" as const, id: "console" },
      targets: [{ type: "window" as const, id: "console" }],
    },
  };
  const attempted = reduceInfiniteCanvasState(locked, {
    pointerId: 1,
    point: { x: 10, y: 10 },
    type: "interaction.startMove",
    target: { type: "window", id: "console" },
  });

  expect(attempted.interaction).toBeNull();
  expect(
    isInfiniteCanvasCommandEnabled(selected, {
      amountPx: 1,
      direction: "right",
      type: "window.nudge",
    }),
  ).toBe(false);
  expect(
    reduceInfiniteCanvasState(selected, {
      amountPx: 1,
      direction: "right",
      type: "window.nudge",
    }).windows[0]?.rect.x,
  ).toBe(0);
  expect(isInfiniteCanvasCommandEnabled(locked, { region: "left", type: "window.place" })).toBe(
    false,
  );
  expect(
    isInfiniteCanvasCommandEnabled(locked, {
      amountPx: 8,
      direction: "right",
      type: "window.resize",
    }),
  ).toBe(true);
});

test("an unspecified capability permits, so existing windows are unaffected", () => {
  const ordinary = stateWith({});

  expect(
    reduceInfiniteCanvasState(ordinary, { type: "window.close", windowId: "console" }).windows,
  ).toHaveLength(0);
  expect(isInfiniteCanvasCommandEnabled(ordinary, { type: "activeWindow.close" })).toBe(true);
});

test("withheld controls render disabled and marked, rather than vanishing", () => {
  const markup = renderToStaticMarkup(
    <InfiniteCanvasProvider
      initialState={stateWith({ closable: false })}
      windowDefinitions={registry}
    >
      <InfiniteCanvasViewport<Kind> />
    </InfiniteCanvasProvider>,
  );

  expect(markup).toContain('data-action="close"');
  expect(markup).toContain("data-disabled");
  expect(markup).toContain("disabled");
});

test("a fixed-size window renders no resize handles at all", () => {
  const fixed = renderToStaticMarkup(
    <InfiniteCanvasProvider
      initialState={stateWith({ resizable: false })}
      windowDefinitions={registry}
    >
      <InfiniteCanvasViewport<Kind> />
    </InfiniteCanvasProvider>,
  );
  const ordinary = renderToStaticMarkup(
    <InfiniteCanvasProvider initialState={stateWith({})} windowDefinitions={registry}>
      <InfiniteCanvasViewport<Kind> />
    </InfiniteCanvasProvider>,
  );

  expect(fixed).not.toContain('data-slot="resize-handle"');
  expect(ordinary).toContain('data-slot="resize-handle"');
});

test("capabilities survive a persistence round-trip", () => {
  const restored = createInfiniteCanvasStore<Kind>({
    document: createInfiniteCanvasStore({
      initialState: stateWith({ closable: false, resizable: false }),
    }).snapshot(),
  }).getState();

  expect(restored?.windows[0]?.capabilities).toEqual({ closable: false, resizable: false });
});

test("explicit capability settings survive a document round trip", () => {
  const restored = createInfiniteCanvasStore<Kind>({
    document: createInfiniteCanvasStore({ initialState: stateWith({ closable: true }) }).snapshot(),
  }).getState();

  expect(restored?.windows[0]?.capabilities).toEqual({ closable: true });
});

test("a malformed capability set rejects the window rather than silently unlocking it", () => {
  const document = createInfiniteCanvasStore({
    initialState: stateWith({ closable: false }),
  }).snapshot();
  const corrupt = {
    ...document,
    windows: document.windows.map((window) => ({ ...window, capabilities: { closable: "no" } })),
  };
  expect(() => createInfiniteCanvasStore<Kind>({ document: corrupt })).toThrow(
    /capabilities\.closable/,
  );
});
