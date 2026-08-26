import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./reducer";
import type { InfiniteCanvasState } from "./types";
import {
  moveInfiniteCanvasWindowsToWorkspace,
  reconcileInfiniteCanvasWorkspaces,
} from "./workspace";

/**
 * The active window has to be one this desktop admits — including when it stops being one.
 *
 * `activateInfiniteCanvasWorkspace` states the rule in its own comment and holds it on entry: "a
 * window admitted by the outgoing workspace and not the incoming one must not stay selected or
 * active either: it is not on screen, and every verb keyed to the active window would act on
 * something the user cannot see."
 *
 * That is the camera moving between desktops. The same rule has to hold when membership changes
 * under a stationary camera, and it did not: `moveInfiniteCanvasWindowsToWorkspace` and
 * `removeInfiniteCanvasWindowFromWorkspace` edit `workspaces[].windowIds` and nothing else, and
 * `reconcileInfiniteCanvasWorkspaces` cleans each workspace's *stored* selection while leaving the
 * live `state.selection` and `state.activeWindowId` alone.
 *
 * So filing the active window onto another desktop left it active here. Every `activeWindow.*`
 * verb — close, minimize, maximize, pin — then acted on a window this canvas does not draw, and
 * `window.place` moved it inside a viewport it is not in. Silent, and destructive in the sense
 * that matters: it rearranges a desktop the user is not looking at.
 */

type Kind = "note";

const pane = (id: string) =>
  createInfiniteCanvasWindow<Kind>({
    id,
    kind: "note",
    rect: { height: 200, width: 300, x: 0, y: 0 },
    title: id,
  });

/** Two desktops, both windows on Here, standing on Here with `a` active. */
const standingOnHere = (): InfiniteCanvasState<Kind> => {
  const base = {
    ...createInfiniteCanvasState<Kind>({ windows: [pane("a"), pane("b")] }),
    viewport: { height: 800, width: 1200 },
  };
  const withDesktops = reduceInfiniteCanvasState(
    reduceInfiniteCanvasState(base, {
      title: "Here",
      type: "workspace.create",
      windowIds: ["a", "b"],
      workspaceId: "here",
    }),
    { title: "There", type: "workspace.create", windowIds: [], workspaceId: "there" },
  );
  const onHere = reduceInfiniteCanvasState(withDesktops, {
    type: "workspace.activate",
    workspaceId: "here",
  });

  return reduceInfiniteCanvasState(onHere, { type: "window.focus", windowId: "a" });
};

test("filing the active window onto another desktop stops it being active here", () => {
  const before = standingOnHere();

  expect(before.activeWindowId).toBe("a");

  const after = reduceInfiniteCanvasState(before, {
    type: "workspace.moveWindows",
    windowIds: ["a"],
    workspaceId: "there",
  });

  // `a` now belongs to There, and this canvas is standing on Here.
  expect(after.workspaces.find((workspace) => workspace.id === "there")?.windowIds).toContain("a");
  expect(after.activeWindowId).not.toBe("a");
  expect(after.selection.windowIds).not.toContain("a");
});

test("removing the active window from this desktop stops it being active", () => {
  const before = standingOnHere();
  const after = reduceInfiniteCanvasState(before, {
    type: "workspace.removeWindow",
    windowId: "a",
    workspaceId: "here",
  });

  expect(after.activeWindowId).not.toBe("a");
  expect(after.selection.windowIds).not.toContain("a");
});

/**
 * Where the guarantee lives, asserted rather than assumed.
 *
 * The membership writer does not hold this rule and is not supposed to: it edits `windowIds` and
 * nothing else, and `reconcileInfiniteCanvasWorkspaces` — which the reducer runs once after every
 * action — is what re-derives the live selection and active window from it. Pinning both halves is
 * what stops the guarantee from being quietly moved into the writer, where the next writer would
 * not have it, or dropped from reconcile on the grounds that "the writer handles it".
 *
 * It is also the demonstration the tests above cannot make on their own. They were written from
 * the defect and pass against the fix, but the fix landed from another session while they were
 * being written, so they were never seen failing. This asserts the unreconciled state directly:
 * the writer alone leaves `a` active, which is exactly the defect.
 */
test("the membership writer leaves the active window stale; reconciliation is what clears it", () => {
  const before = standingOnHere();
  const written = moveInfiniteCanvasWindowsToWorkspace(before, {
    windowIds: ["a"],
    workspaceId: "there",
  });

  expect(written.workspaces.find((workspace) => workspace.id === "here")?.windowIds).not.toContain(
    "a",
  );
  expect(written.activeWindowId).toBe("a");
  expect(reconcileInfiniteCanvasWorkspaces(written).activeWindowId).not.toBe("a");
});

test("a window this desktop still admits stays active", () => {
  // The other half of the rule, and the one that keeps this from being a clear-everything hammer:
  // moving *another* window away must not disturb the active one.
  const before = standingOnHere();
  const after = reduceInfiniteCanvasState(before, {
    type: "workspace.moveWindows",
    windowIds: ["b"],
    workspaceId: "there",
  });

  expect(after.activeWindowId).toBe("a");
});
