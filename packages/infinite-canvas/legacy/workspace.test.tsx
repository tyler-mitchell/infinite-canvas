import { getSelectedWindowIds } from "./selection";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
} from "./factory";
import { isInfiniteCanvasCommandEnabled } from "./operations";
import { InfiniteCanvasViewport } from "./infinite-canvas";
import { createInfiniteCanvasStore } from "./store";
import { reduceInfiniteCanvasState } from "./operations";
import { InfiniteCanvasProvider } from "./react/store";
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
    activate: false,
    title: "Research",
    type: "workspace.create",
    windowIds: ["a", "b"],
    workspaceId: "research",
  });

  return reduceInfiniteCanvasState(created, {
    activate: false,
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
    <InfiniteCanvasProvider initialState={state} windowDefinitions={registry}>
      <InfiniteCanvasViewport<Kind> />
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
    <InfiniteCanvasProvider initialState={activated} windowDefinitions={registry}>
      <InfiniteCanvasViewport<Kind> />
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
    { type: "selection.replace", targets: [{ type: "window" as const, id: "b" }] },
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
  expect(getSelectedWindowIds(returned.selection)).toEqual(["b"]);
});

test("a switch is one undo entry, and undo puts the canvas back on the workspace it left", () => {
  const store = createInfiniteCanvasStore({ initialState: withTwoWorkspaces() });
  store.dispatch({
    type: "workspace.activate",
    workspaceId: "research",
  });

  expect(store.history.undos$.peek()).toBe(1);

  store.dispatch({
    type: "workspace.activate",
    workspaceId: "writing",
  });

  expect(store.history.undos$.peek()).toBe(2);
});

test("workspaces round-trip and default only within the current document version", () => {
  const active = reduceInfiniteCanvasState(withTwoWorkspaces(), {
    type: "workspace.activate",
    workspaceId: "writing",
  });
  const restored = createInfiniteCanvasStore<Kind>({
    document: createInfiniteCanvasStore({ initialState: active }).snapshot(),
  }).getState();

  expect(restored?.workspaces.map((workspace) => workspace.id)).toEqual(["research", "writing"]);
  expect(restored?.activeWorkspaceId).toBe("writing");

  const { activeWorkspaceId, workspaces, ...withoutWorkspaces } = createInfiniteCanvasStore({
    initialState: active,
  }).snapshot();

  expect(workspaces).toHaveLength(2);
  expect(activeWorkspaceId).toBe("writing");
  expect(
    createInfiniteCanvasStore<Kind>({ document: withoutWorkspaces }).getState().workspaces,
  ).toEqual([]);
  expect(() =>
    createInfiniteCanvasStore<Kind>({ document: { ...withoutWorkspaces, version: 2 } }),
  ).toThrow(/version/);
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

  const first = reduceInfiniteCanvasState(state, { direction: "next", type: "workspace.cycle" });

  expect(first.activeWorkspaceId).toBe("research");

  const second = reduceInfiniteCanvasState(first, {
    direction: "next",
    type: "workspace.cycle",
  });

  expect(second.activeWorkspaceId).toBe("writing");
  expect(
    reduceInfiniteCanvasState(second, { direction: "next", type: "workspace.cycle" })
      .activeWorkspaceId,
  ).toBe("research");
  expect(
    reduceInfiniteCanvasState(state, { direction: "previous", type: "workspace.cycle" })
      .activeWorkspaceId,
  ).toBe("writing");
});

test("cycling carries each workspace's camera with it", () => {
  const research = reduceInfiniteCanvasState(withTwoWorkspaces(), {
    direction: "next",
    type: "workspace.cycle",
  });
  const moved = { ...research, camera: { center: { x: 900, y: 40 }, zoom: 3 } };
  const away = reduceInfiniteCanvasState(moved, { direction: "next", type: "workspace.cycle" });
  const back = reduceInfiniteCanvasState(away, {
    direction: "previous",
    type: "workspace.cycle",
  });

  expect(back.camera).toEqual({ center: { x: 900, y: 40 }, zoom: 3 });
});

test("showing all leaves the workspace without closing it", () => {
  const active = reduceInfiniteCanvasState(withTwoWorkspaces(), {
    direction: "next",
    type: "workspace.cycle",
  });

  expect(isInfiniteCanvasCommandEnabled(active, { type: "workspace.showAll" })).toBe(true);

  const all = reduceInfiniteCanvasState(active, { type: "workspace.showAll" });

  expect(all.activeWorkspaceId).toBeNull();
  expect(all.workspaces).toHaveLength(2);
  expect(isInfiniteCanvasCommandEnabled(all, { type: "workspace.showAll" })).toBe(false);
});

test("a window can be taken off the workspace it is on, and stays open", () => {
  const active = reduceInfiniteCanvasState(withTwoWorkspaces(), {
    direction: "next",
    type: "workspace.cycle",
  });

  const focused = active.activeWindowId;

  expect(focused).not.toBeNull();
  expect(active.workspaces[0]?.windowIds).toContain(focused);
  expect(isInfiniteCanvasCommandEnabled(active, { type: "workspace.removeActiveWindow" })).toBe(
    true,
  );

  const removed = reduceInfiniteCanvasState(active, { type: "workspace.removeActiveWindow" });

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
  const research = reduceInfiniteCanvasState(withTwoWorkspaces(), {
    direction: "next",
    type: "workspace.cycle",
  });
  const selected = reduceInfiniteCanvasState(research, { type: "selection.selectAllVisible" });

  expect([...getSelectedWindowIds(selected.selection)].toSorted()).toEqual(["a", "b"]);

  const fittedToWorkspace = reduceInfiniteCanvasState(research, { type: "view.fitAll" });
  const fittedToEverything = reduceInfiniteCanvasState(
    reduceInfiniteCanvasState(research, { type: "workspace.showAll" }),
    { type: "view.fitAll" },
  );

  expect(fittedToWorkspace.camera.center.x).toBeLessThan(fittedToEverything.camera.center.x);
});

const dockedThenFiltered = () => {
  const docked = reduceInfiniteCanvasState(
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
      activate: false,
      type: "workspace.create",
      windowIds: ["c"],
      workspaceId: "writing",
    }),
    { type: "workspace.activate", workspaceId: "writing" },
  );
  const markup = renderToStaticMarkup(
    <InfiniteCanvasProvider initialState={elsewhere} windowDefinitions={registry}>
      <InfiniteCanvasViewport<Kind> />
    </InfiniteCanvasProvider>,
  );

  expect(markup).toContain("<p>c</p>");
  expect(markup).not.toContain('data-slot="group-gutter"');

  const here = reduceInfiniteCanvasState(elsewhere, {
    type: "workspace.activate",
    workspaceId: "research",
  });
  const onIts = renderToStaticMarkup(
    <InfiniteCanvasProvider initialState={here} windowDefinitions={registry}>
      <InfiniteCanvasViewport<Kind> />
    </InfiniteCanvasProvider>,
  );

  expect(onIts).toContain('data-slot="group-gutter"');
});

test("docking into a group on a workspace brings the docked window onto it", () => {
  const docked = reduceInfiniteCanvasState(
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
    { direction: "left", type: "window.dockDirection" },
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
  const docked = reduceInfiniteCanvasState(
    { ...threeWindows(), activeWindowId: "a" },
    { direction: "right", type: "window.dockDirection" },
  );
  const filtered = reduceInfiniteCanvasState(docked, {
    type: "workspace.create",
    windowIds: ["a", "b"],
    workspaceId: "research",
  });
  const serialized = createInfiniteCanvasStore({ initialState: filtered }).snapshot();

  const tampered = {
    ...serialized,
    workspaces: serialized.workspaces?.map((workspace) => ({ ...workspace, windowIds: ["a"] })),
  } as never;
  const restored = createInfiniteCanvasStore<Kind>({ document: tampered }).getState();

  expect([...(restored?.workspaces[0]?.windowIds ?? [])].toSorted()).toEqual(["a", "b"]);
});

test("hydration drops a membership naming a window that did not survive", () => {
  const state = reduceInfiniteCanvasState(threeWindows(), {
    type: "workspace.create",
    windowIds: ["a", "b"],
    workspaceId: "research",
  });
  const serialized = createInfiniteCanvasStore({ initialState: state }).snapshot();
  const withoutB = {
    ...serialized,
    windows: serialized.windows.filter((window) => window.id !== "b"),
  } as never;

  expect(
    createInfiniteCanvasStore<Kind>({ document: withoutB }).getState()?.workspaces[0]?.windowIds,
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
    targets: [{ type: "window" as const, id: "b" }],
  });
  const left = reduceInfiniteCanvasState(selected, {
    type: "workspace.activate",
    workspaceId: null,
  });

  expect(getSelectedWindowIds(left.workspaces[0]?.selection)).toEqual(["b"]);

  const closed = reduceInfiniteCanvasState(left, { type: "window.close", windowId: "b" });

  expect(closed.workspaces[0]?.windowIds).toEqual(["a"]);
  expect(getSelectedWindowIds(closed.workspaces[0]?.selection)).toEqual([]);
  expect(
    closed.workspaces[0]?.selection.anchorTarget?.type === "window"
      ? closed.workspaces[0]?.selection.anchorTarget.id
      : null,
  ).toBeNull();
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
      selection: {
        anchorTarget: { type: "window" as const, id: "ghost" },
        targets: [{ type: "window" as const, id: "ghost" }],
      },
    })),
  };
  const entered = reduceInfiniteCanvasState(tampered, {
    type: "workspace.activate",
    workspaceId: "research",
  });

  expect(getSelectedWindowIds(entered.selection)).toEqual([]);
  expect(entered.activeWindowId).toBe("a");
});
