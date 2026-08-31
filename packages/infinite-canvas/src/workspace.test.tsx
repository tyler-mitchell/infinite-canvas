import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
} from "./factory";
import { executeInfiniteCanvasCommand, isInfiniteCanvasCommandEnabled } from "./commands";
import { InfiniteCanvasViewport } from "./infinite-canvas";
import { parseInfiniteCanvasState, serializeInfiniteCanvasState } from "./persistence";
import { reduceInfiniteCanvasState } from "./reducer";
import { InfiniteCanvasProvider } from "./store";
import type { InfiniteCanvasState } from "./types";

type Kind = "note";

const registry = defineInfiniteCanvasWindowRegistry<Kind>({
  note: { kind: "note", renderBody: ({ window }) => <p>{window.title}</p> },
});

const paneAt = (id: string, x: number) =>
  createInfiniteCanvasWindow<Kind>({
    id,
    kind: "note",
    rect: { height: 200, width: 300, x, y: 0 },
    title: id,
  });

const threeWindows = (): InfiniteCanvasState<Kind> => ({
  ...createInfiniteCanvasState<Kind>({
    windows: [paneAt("a", 0), paneAt("b", 400), paneAt("c", 800)],
  }),
  viewport: { height: 800, width: 1200 },
});

const withTwoWorkspaces = () => {
  const created = reduceInfiniteCanvasState(threeWindows(), {
    title: "Research",
    type: "workspace.create",
    windowIds: ["a", "b"],
    workspaceId: "research",
  });

  return reduceInfiniteCanvasState(created, {
    title: "Writing",
    type: "workspace.create",
    windowIds: ["c"],
    workspaceId: "writing",
  });
};

test("a canvas with no workspace filters nothing, exactly as before they existed", () => {
  const state = threeWindows();

  expect(state.workspaces).toEqual([]);
  expect(state.activeWorkspaceId).toBeNull();

  const markup = renderToStaticMarkup(
    <InfiniteCanvasProvider initialState={state}>
      <InfiniteCanvasViewport<Kind> windowDefinitions={registry} />
    </InfiniteCanvasProvider>,
  );

  for (const title of ["a", "b", "c"]) {
    expect(markup).toContain(`<p>${title}</p>`);
  }
});

test("activating a workspace filters the canvas to its members", () => {
  const activated = reduceInfiniteCanvasState(withTwoWorkspaces(), {
    type: "workspace.activate",
    workspaceId: "research",
  });
  const markup = renderToStaticMarkup(
    <InfiniteCanvasProvider initialState={activated}>
      <InfiniteCanvasViewport<Kind> windowDefinitions={registry} />
    </InfiniteCanvasProvider>,
  );

  expect(markup).toContain("<p>a</p>");
  expect(markup).toContain("<p>b</p>");
  expect(markup).not.toContain("<p>c</p>");
  expect(activated.windows).toHaveLength(3);
});

test("switching preserves each workspace's camera and selection", () => {
  const research = reduceInfiniteCanvasState(withTwoWorkspaces(), {
    type: "workspace.activate",
    workspaceId: "research",
  });
  const worked = reduceInfiniteCanvasState(
    { ...research, camera: { center: { x: 500, y: 250 }, zoom: 2 } },
    { type: "selection.replace", windowIds: ["b"] },
  );

  const writing = reduceInfiniteCanvasState(worked, {
    type: "workspace.activate",
    workspaceId: "writing",
  });

  expect(writing.camera.zoom).toBe(1);

  const returned = reduceInfiniteCanvasState(writing, {
    type: "workspace.activate",
    workspaceId: "research",
  });

  expect(returned.camera).toEqual({ center: { x: 500, y: 250 }, zoom: 2 });
  expect(returned.selection.windowIds).toEqual(["b"]);
});

test("a switch is one undo entry, and undo puts the canvas back on the workspace it left", () => {
  const state = withTwoWorkspaces();
  const before = state.history.past.length;
  const switched = reduceInfiniteCanvasState(state, {
    type: "workspace.activate",
    workspaceId: "research",
  });

  expect(switched.history.past.length - before).toBe(1);

  const switchedAgain = reduceInfiniteCanvasState(switched, {
    type: "workspace.activate",
    workspaceId: "writing",
  });

  expect(switchedAgain.history.past.length - switched.history.past.length).toBe(1);
});

test("workspaces survive a reload, and older payloads migrate to none", () => {
  const active = reduceInfiniteCanvasState(withTwoWorkspaces(), {
    type: "workspace.activate",
    workspaceId: "writing",
  });
  const restored = parseInfiniteCanvasState<Kind>(
    serializeInfiniteCanvasState(active),
    threeWindows(),
  );

  expect(restored?.workspaces.map((workspace) => workspace.id)).toEqual(["research", "writing"]);
  expect(restored?.activeWorkspaceId).toBe("writing");

  const { activeWorkspaceId, workspaces, ...legacy } = serializeInfiniteCanvasState(active);

  expect(workspaces).toHaveLength(2);
  expect(activeWorkspaceId).toBe("writing");
  expect(
    parseInfiniteCanvasState<Kind>({ ...legacy, version: 2 }, threeWindows())?.workspaces,
  ).toEqual([]);
});

test("closing a window drops it from every workspace, and closing a workspace keeps its windows", () => {
  const closedWindow = reduceInfiniteCanvasState(withTwoWorkspaces(), {
    type: "window.close",
    windowId: "a",
  });

  expect(closedWindow.workspaces[0]?.windowIds).toEqual(["b"]);

  const closedWorkspace = reduceInfiniteCanvasState(withTwoWorkspaces(), {
    type: "workspace.close",
    workspaceId: "research",
  });

  expect(closedWorkspace.workspaces.map((workspace) => workspace.id)).toEqual(["writing"]);
  expect(closedWorkspace.windows).toHaveLength(3);
});

test("membership never names a window that does not exist", () => {
  const state = reduceInfiniteCanvasState(threeWindows(), {
    type: "workspace.create",
    windowIds: ["a", "a", "ghost"],
    workspaceId: "research",
  });

  expect(state.workspaces[0]?.windowIds).toEqual(["a"]);
});

test("activating a workspace that does not exist changes nothing", () => {
  const state = withTwoWorkspaces();

  expect(
    reduceInfiniteCanvasState(state, { type: "workspace.activate", workspaceId: "absent" }),
  ).toBe(state);
});

test("cycling walks the workspaces and wraps", () => {
  const state = withTwoWorkspaces();

  expect(
    isInfiniteCanvasCommandEnabled(state, { direction: "next", type: "workspace.cycle" }),
  ).toBe(true);

  const first = executeInfiniteCanvasCommand(state, { direction: "next", type: "workspace.cycle" });

  expect(first.activeWorkspaceId).toBe("research");

  const second = executeInfiniteCanvasCommand(first, {
    direction: "next",
    type: "workspace.cycle",
  });

  expect(second.activeWorkspaceId).toBe("writing");
  expect(
    executeInfiniteCanvasCommand(second, { direction: "next", type: "workspace.cycle" })
      .activeWorkspaceId,
  ).toBe("research");
  expect(
    executeInfiniteCanvasCommand(state, { direction: "previous", type: "workspace.cycle" })
      .activeWorkspaceId,
  ).toBe("writing");
});

test("cycling carries each workspace's camera with it", () => {
  const research = executeInfiniteCanvasCommand(withTwoWorkspaces(), {
    direction: "next",
    type: "workspace.cycle",
  });
  const moved = { ...research, camera: { center: { x: 900, y: 40 }, zoom: 3 } };
  const away = executeInfiniteCanvasCommand(moved, { direction: "next", type: "workspace.cycle" });
  const back = executeInfiniteCanvasCommand(away, {
    direction: "previous",
    type: "workspace.cycle",
  });

  expect(back.camera).toEqual({ center: { x: 900, y: 40 }, zoom: 3 });
});

test("showing all leaves the workspace without closing it", () => {
  const active = executeInfiniteCanvasCommand(withTwoWorkspaces(), {
    direction: "next",
    type: "workspace.cycle",
  });

  expect(isInfiniteCanvasCommandEnabled(active, { type: "workspace.showAll" })).toBe(true);

  const all = executeInfiniteCanvasCommand(active, { type: "workspace.showAll" });

  expect(all.activeWorkspaceId).toBeNull();
  expect(all.workspaces).toHaveLength(2);
  expect(isInfiniteCanvasCommandEnabled(all, { type: "workspace.showAll" })).toBe(false);
});

test("a window can be taken off the workspace it is on, and stays open", () => {
  const active = executeInfiniteCanvasCommand(withTwoWorkspaces(), {
    direction: "next",
    type: "workspace.cycle",
  });

  const focused = active.activeWindowId;

  expect(focused).not.toBeNull();
  expect(active.workspaces[0]?.windowIds).toContain(focused);
  expect(isInfiniteCanvasCommandEnabled(active, { type: "workspace.removeActiveWindow" })).toBe(
    true,
  );

  const removed = executeInfiniteCanvasCommand(active, { type: "workspace.removeActiveWindow" });

  expect(removed.workspaces[0]?.windowIds).not.toContain(focused);
  expect(removed.windows.map((window) => window.id)).toContain(focused);
});

test("with no workspace active there is nothing to cycle or leave", () => {
  const bare = threeWindows();

  for (const command of [
    { direction: "next", type: "workspace.cycle" },
    { type: "workspace.showAll" },
    { type: "workspace.removeActiveWindow" },
  ] as const) {
    expect(isInfiniteCanvasCommandEnabled(bare, command)).toBe(false);
  }
});

test("adding and removing a window touches only that window's membership", () => {
  const state = withTwoWorkspaces();
  const added = reduceInfiniteCanvasState(state, {
    type: "workspace.addWindow",
    windowId: "c",
    workspaceId: "research",
  });

  expect(added.workspaces[0]?.windowIds).toEqual(["a", "b", "c"]);
  expect(added.workspaces[1]).toBe(state.workspaces[1]);

  const removed = reduceInfiniteCanvasState(added, {
    type: "workspace.removeWindow",
    windowId: "a",
    workspaceId: "research",
  });

  expect(removed.workspaces[0]?.windowIds).toEqual(["b", "c"]);
});

test("a delta does not discard a membership change it did not make", () => {
  const stale = withTwoWorkspaces();
  const meanwhile = reduceInfiniteCanvasState(stale, {
    type: "workspace.addWindow",
    windowId: "c",
    workspaceId: "research",
  });
  const added = reduceInfiniteCanvasState(meanwhile, {
    type: "workspace.addWindow",
    windowId: "a",
    workspaceId: "writing",
  });

  expect(added.workspaces[0]?.windowIds).toEqual(["a", "b", "c"]);
  expect(added.workspaces[1]?.windowIds).toEqual(["c", "a"]);
});

test("adding is idempotent, and neither verb invents a window", () => {
  const state = reduceInfiniteCanvasState(withTwoWorkspaces(), {
    type: "workspace.addWindow",
    windowId: "c",
    workspaceId: "research",
  });

  expect(
    reduceInfiniteCanvasState(state, {
      type: "workspace.addWindow",
      windowId: "c",
      workspaceId: "research",
    }),
  ).toBe(state);
  expect(
    reduceInfiniteCanvasState(state, {
      type: "workspace.addWindow",
      windowId: "ghost",
      workspaceId: "research",
    }),
  ).toBe(state);
  expect(
    reduceInfiniteCanvasState(state, {
      type: "workspace.removeWindow",
      windowId: "ghost",
      workspaceId: "research",
    }),
  ).toBe(state);
});

test("select-all and fit-all see only the desktop you are on", () => {
  const research = executeInfiniteCanvasCommand(withTwoWorkspaces(), {
    direction: "next",
    type: "workspace.cycle",
  });
  const selected = executeInfiniteCanvasCommand(research, { type: "selection.selectAllVisible" });

  expect([...selected.selection.windowIds].toSorted()).toEqual(["a", "b"]);

  const fittedToWorkspace = executeInfiniteCanvasCommand(research, { type: "view.fitAll" });
  const fittedToEverything = executeInfiniteCanvasCommand(
    executeInfiniteCanvasCommand(research, { type: "workspace.showAll" }),
    { type: "view.fitAll" },
  );

  expect(fittedToWorkspace.camera.center.x).toBeLessThan(fittedToEverything.camera.center.x);
});

const dockedThenFiltered = () => {
  const docked = executeInfiniteCanvasCommand(
    { ...threeWindows(), activeWindowId: "a" },
    { direction: "right", type: "window.dockDirection" },
  );

  return reduceInfiniteCanvasState(docked, {
    type: "workspace.create",
    windowIds: ["a"],
    workspaceId: "research",
  });
};

test("naming one window of a group puts the whole group on the workspace", () => {
  const state = dockedThenFiltered();

  expect([...(state.workspaces[0]?.windowIds ?? [])].toSorted()).toEqual(["a", "b"]);
});

test("a group's shell is not rendered on a desktop its windows are not on", () => {
  const state = dockedThenFiltered();
  const elsewhere = reduceInfiniteCanvasState(
    reduceInfiniteCanvasState(state, {
      type: "workspace.create",
      windowIds: ["c"],
      workspaceId: "writing",
    }),
    { type: "workspace.activate", workspaceId: "writing" },
  );
  const markup = renderToStaticMarkup(
    <InfiniteCanvasProvider initialState={elsewhere}>
      <InfiniteCanvasViewport<Kind> windowDefinitions={registry} />
    </InfiniteCanvasProvider>,
  );

  expect(markup).toContain("<p>c</p>");
  expect(markup).not.toContain('data-slot="group-gutter"');

  const here = reduceInfiniteCanvasState(elsewhere, {
    type: "workspace.activate",
    workspaceId: "research",
  });
  const onIts = renderToStaticMarkup(
    <InfiniteCanvasProvider initialState={here}>
      <InfiniteCanvasViewport<Kind> windowDefinitions={registry} />
    </InfiniteCanvasProvider>,
  );

  expect(onIts).toContain('data-slot="group-gutter"');
});

test("docking into a group on a workspace brings the docked window onto it", () => {
  const docked = executeInfiniteCanvasCommand(
    { ...threeWindows(), activeWindowId: "a" },
    { direction: "right", type: "window.dockDirection" },
  );
  const filtered = reduceInfiniteCanvasState(docked, {
    type: "workspace.create",
    windowIds: ["a"],
    workspaceId: "research",
  });

  expect([...(filtered.workspaces[0]?.windowIds ?? [])].toSorted()).toEqual(["a", "b"]);

  const grown = reduceInfiniteCanvasState(
    { ...filtered, activeWindowId: "c" },
    { command: { direction: "left", type: "window.dockDirection" }, type: "command.execute" },
  );

  expect([...(grown.workspaces[0]?.windowIds ?? [])].toSorted()).toEqual(["a", "b", "c"]);
});

test("reconciliation returns the identical state when nothing moved", () => {
  const state = withTwoWorkspaces();
  const panned = reduceInfiniteCanvasState(state, {
    delta: { x: 10, y: 0 },
    type: "camera.panBy",
  });

  expect(panned.workspaces).toBe(state.workspaces);
});

test("hydration cannot bring in a workspace holding half a group", () => {
  const docked = executeInfiniteCanvasCommand(
    { ...threeWindows(), activeWindowId: "a" },
    { direction: "right", type: "window.dockDirection" },
  );
  const filtered = reduceInfiniteCanvasState(docked, {
    type: "workspace.create",
    windowIds: ["a", "b"],
    workspaceId: "research",
  });
  const serialized = serializeInfiniteCanvasState(filtered);

  const tampered = {
    ...serialized,
    workspaces: serialized.workspaces?.map((workspace) => ({ ...workspace, windowIds: ["a"] })),
  } as never;
  const restored = parseInfiniteCanvasState<Kind>(tampered, threeWindows());

  expect([...(restored?.workspaces[0]?.windowIds ?? [])].toSorted()).toEqual(["a", "b"]);
});

test("hydration drops a membership naming a window that did not survive", () => {
  const state = reduceInfiniteCanvasState(threeWindows(), {
    type: "workspace.create",
    windowIds: ["a", "b"],
    workspaceId: "research",
  });
  const serialized = serializeInfiniteCanvasState(state);
  const withoutB = {
    ...serialized,
    windows: serialized.windows.filter((window) => window.id !== "b"),
  } as never;

  expect(
    parseInfiniteCanvasState<Kind>(withoutB, threeWindows())?.workspaces[0]?.windowIds,
  ).toEqual(["a"]);
});

test("a workspace names no window that does not exist, in its membership or its selection", () => {
  const state = reduceInfiniteCanvasState(
    reduceInfiniteCanvasState(threeWindows(), {
      type: "workspace.create",
      windowIds: ["a", "b"],
      workspaceId: "research",
    }),
    { type: "workspace.activate", workspaceId: "research" },
  );
  const selected = reduceInfiniteCanvasState(state, {
    type: "selection.replace",
    windowIds: ["b"],
  });
  const left = reduceInfiniteCanvasState(selected, {
    type: "workspace.activate",
    workspaceId: null,
  });

  expect(left.workspaces[0]?.selection.windowIds).toEqual(["b"]);

  const closed = reduceInfiniteCanvasState(left, { type: "window.close", windowId: "b" });

  expect(closed.workspaces[0]?.windowIds).toEqual(["a"]);
  expect(closed.workspaces[0]?.selection.windowIds).toEqual([]);
  expect(closed.workspaces[0]?.selection.anchorWindowId).toBeNull();
});

test("entering a workspace was already safe against a stale stored selection", () => {
  const state = reduceInfiniteCanvasState(threeWindows(), {
    type: "workspace.create",
    windowIds: ["a"],
    workspaceId: "research",
  });
  const tampered: InfiniteCanvasState<Kind> = {
    ...state,
    workspaces: state.workspaces.map((workspace) => ({
      ...workspace,
      selection: { anchorWindowId: "ghost", windowIds: ["ghost"] },
    })),
  };
  const entered = reduceInfiniteCanvasState(tampered, {
    type: "workspace.activate",
    workspaceId: "research",
  });

  expect(entered.selection.windowIds).toEqual([]);
  expect(entered.activeWindowId).toBe("a");
});
