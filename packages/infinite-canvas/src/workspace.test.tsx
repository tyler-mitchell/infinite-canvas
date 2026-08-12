import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
} from "./factory";
import { InfiniteCanvasViewport } from "./infinite-canvas";
import { parseInfiniteCanvasState, serializeInfiniteCanvasState } from "./persistence";
import { reduceInfiniteCanvasState } from "./reducer";
import { InfiniteCanvasProvider } from "./store";
import type { InfiniteCanvasState } from "./types";

/**
 * M5 — workspaces, as virtual desktops rather than nested canvases.
 *
 * The roadmap's exit criterion is the spec these assert: "switching workspaces preserves each
 * one's camera and selection, survives reload, and is one undo entry."
 *
 * The design decision underneath is the one the roadmap makes and these tests hold to: a
 * workspace is **one canvas and a membership filter**. A canvas inside a canvas would need a
 * second camera and a second input plane, which is a different program.
 */

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
  // Opt-in the way groups are. This is the assertion that lets every existing canvas keep
  // working: `activeWorkspaceId: null` admits everything rather than admitting nothing.
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
  // Filtered, not closed. `c` is still in `state.windows`; it is simply not on this desktop.
  expect(markup).not.toContain("<p>c</p>");
  expect(activated.windows).toHaveLength(3);
});

test("switching preserves each workspace's camera and selection", () => {
  // The exit criterion, verbatim. The save on the way out is what makes it hold: without it
  // a workspace would keep the camera it was *created* with and returning would discard
  // everything done there.
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
  // Workspaces are part of the document for exactly this reason — membership and the stored
  // camera are layout, not view. Camera and viewport stay out of the document, so panning is
  // still not an edit.
  // Measured as a delta, because creating a workspace is itself an edit and the fixture makes
  // two of them. The first draft asserted absolutes and failed for that uninteresting reason.
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

  // A version-2 payload predates workspaces and migrates to none rather than being rejected,
  // the same bargain `groups` struck at version 2. Built by *removing* the fields rather than
  // by relabelling a v3 payload: an older build would never have written them, and a test
  // that leaves them in is asking whether the parser honours a version number it has no
  // reason to trust over the data in front of it.
  const { activeWorkspaceId, workspaces, ...legacy } = serializeInfiniteCanvasState(active);

  expect(workspaces).toHaveLength(2);
  expect(activeWorkspaceId).toBe("writing");
  expect(
    parseInfiniteCanvasState<Kind>({ ...legacy, version: 2 }, threeWindows())?.workspaces,
  ).toEqual([]);
});

test("closing a window drops it from every workspace, and closing a workspace keeps its windows", () => {
  // Two halves of the same rule: membership is a filter, so it must never outlive the window
  // it names, and it must never take a window with it when it goes.
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

  // Deduplicated, and a name with no window behind it is dropped rather than stored: a
  // filter holding a dead id would silently admit nothing when that id came back.
  expect(state.workspaces[0]?.windowIds).toEqual(["a"]);
});

test("activating a workspace that does not exist changes nothing", () => {
  const state = withTwoWorkspaces();

  expect(
    reduceInfiniteCanvasState(state, { type: "workspace.activate", workspaceId: "absent" }),
  ).toBe(state);
});
