import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import { executeInfiniteCanvasCommand, isInfiniteCanvasCommandEnabled } from "./commands";
import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
} from "./factory";
import { InfiniteCanvasViewport } from "./infinite-canvas";
import { parseInfiniteCanvasState, serializeInfiniteCanvasState } from "./persistence";
import { reduceInfiniteCanvasState } from "./reducer";
import { InfiniteCanvasProvider } from "./store";
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
  expect(executeInfiniteCanvasCommand(state, { type: "activeWindow.close" }).windows).toHaveLength(
    1,
  );
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

test("an unspecified capability permits, so existing windows are unaffected", () => {
  const ordinary = stateWith({});

  expect(
    reduceInfiniteCanvasState(ordinary, { type: "window.close", windowId: "console" }).windows,
  ).toHaveLength(0);
  expect(isInfiniteCanvasCommandEnabled(ordinary, { type: "activeWindow.close" })).toBe(true);
});

test("withheld controls render disabled and marked, rather than vanishing", () => {
  const markup = renderToStaticMarkup(
    <InfiniteCanvasProvider initialState={stateWith({ closable: false })}>
      <InfiniteCanvasViewport<Kind> windowDefinitions={registry} />
    </InfiniteCanvasProvider>,
  );

  expect(markup).toContain('data-action="close"');
  expect(markup).toContain("data-disabled");
  expect(markup).toContain("disabled");
});

test("a fixed-size window renders no resize handles at all", () => {
  const fixed = renderToStaticMarkup(
    <InfiniteCanvasProvider initialState={stateWith({ resizable: false })}>
      <InfiniteCanvasViewport<Kind> windowDefinitions={registry} />
    </InfiniteCanvasProvider>,
  );
  const ordinary = renderToStaticMarkup(
    <InfiniteCanvasProvider initialState={stateWith({})}>
      <InfiniteCanvasViewport<Kind> windowDefinitions={registry} />
    </InfiniteCanvasProvider>,
  );

  expect(fixed).not.toContain('data-slot="resize-handle"');
  expect(ordinary).toContain('data-slot="resize-handle"');
});

test("capabilities survive a persistence round-trip", () => {
  const restored = parseInfiniteCanvasState<Kind>(
    serializeInfiniteCanvasState(stateWith({ closable: false, resizable: false })),
    stateWith({}),
  );

  expect(restored?.windows[0]?.capabilities).toEqual({ closable: false, resizable: false });
});

test("a granted capability is not written out, so equivalent documents serialize alike", () => {
  const restored = parseInfiniteCanvasState<Kind>(
    serializeInfiniteCanvasState(stateWith({ closable: true })),
    stateWith({}),
  );

  expect(restored?.windows[0]?.capabilities).toBeUndefined();
});

test("a malformed capability set rejects the window rather than silently unlocking it", () => {
  const corrupt = {
    ...serializeInfiniteCanvasState(stateWith({ closable: false })),
  };

  corrupt.windows = [{ ...corrupt.windows[0], capabilities: { closable: "no" } }] as never;

  expect(parseInfiniteCanvasState<Kind>(corrupt, stateWith({}))?.windows ?? []).toHaveLength(0);
});
