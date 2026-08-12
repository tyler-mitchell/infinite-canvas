import { normalizeSelection } from "./selection";
import type { InfiniteCanvasState, InfiniteCanvasWorkspace } from "./types";

/**
 * Workspaces — virtual desktops for an infinite canvas.
 *
 * **Deliberately not nested canvases.** A canvas inside a canvas means a second camera and a
 * second input plane, which is a different program. A workspace is *one* canvas plus a
 * membership filter: a named set of windows, with the camera and selection you left it at.
 *
 * They are opt-in the way groups are. `workspaces: []` with `activeWorkspaceId: null` means
 * no filtering at all, so a canvas that never creates one behaves exactly as it did before
 * they existed and no persisted document needs rewriting.
 *
 * The camera and selection stored on a workspace are a *snapshot taken on the way out*.
 * While a workspace is active, `state.camera` is the live one and the stored copy is stale by
 * design — writing through on every pan would make each frame a workspace mutation, and
 * workspace mutations are undo checkpoints.
 */

/** The windows the active workspace admits, or every window when none is active. */
function getInfiniteCanvasWorkspaceWindowIds<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): ReadonlySet<string> | null {
  const active = state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId);

  return active === undefined ? null : new Set(active.windowIds);
}

/**
 * `null` means "admits everything", which is why this is a predicate rather than a filter over
 * `getInfiniteCanvasWorkspaceWindowIds`: the no-workspace case must not pay for a set.
 */
function isInfiniteCanvasWindowInActiveWorkspace<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
): boolean {
  const admitted = getInfiniteCanvasWorkspaceWindowIds(state);

  return admitted === null || admitted.has(windowId);
}

function findInfiniteCanvasWorkspace<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  workspaceId: string,
): InfiniteCanvasWorkspace | null {
  return state.workspaces.find((workspace) => workspace.id === workspaceId) ?? null;
}

function createInfiniteCanvasWorkspace<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{ title?: string; windowIds?: readonly string[]; workspaceId: string }>,
): InfiniteCanvasState<Kind> {
  const { title, windowIds = [], workspaceId } = input;

  if (findInfiniteCanvasWorkspace(state, workspaceId) !== null) {
    return state;
  }

  return {
    ...state,
    workspaces: [
      ...state.workspaces,
      {
        camera: state.camera,
        id: workspaceId,
        selection: { anchorWindowId: null, windowIds: [] },
        title: title ?? workspaceId,
        windowIds: normalizeInfiniteCanvasWorkspaceWindowIds(state, windowIds),
      },
    ],
  };
}

/**
 * Closing a workspace never closes its windows. A membership filter that deleted what it
 * filtered would make "which set is this in" a destructive question, and a window in no
 * workspace is simply one every workspace-less view shows.
 */
function closeInfiniteCanvasWorkspace<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  workspaceId: string,
): InfiniteCanvasState<Kind> {
  if (findInfiniteCanvasWorkspace(state, workspaceId) === null) {
    return state;
  }

  return {
    ...state,
    activeWorkspaceId: state.activeWorkspaceId === workspaceId ? null : state.activeWorkspaceId,
    workspaces: state.workspaces.filter((workspace) => workspace.id !== workspaceId),
  };
}

/**
 * Switch, saving on the way out and restoring on the way in.
 *
 * The save is what makes the exit criterion hold — "switching preserves each workspace's
 * camera and selection". Without it the outgoing workspace would keep whatever camera it had
 * when it was *created*, and returning to it would throw away everything the user did there.
 */
function activateInfiniteCanvasWorkspace<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  workspaceId: string | null,
): InfiniteCanvasState<Kind> {
  if (workspaceId === state.activeWorkspaceId) {
    return state;
  }

  const target = workspaceId === null ? null : findInfiniteCanvasWorkspace(state, workspaceId);

  if (workspaceId !== null && target === null) {
    return state;
  }

  // Identical array when there is nothing to save, because `isSameInfiniteCanvasDocument`
  // compares by reference: a `.map()` that changed nothing would still read as an edit.
  const saved =
    state.activeWorkspaceId === null
      ? state.workspaces
      : state.workspaces.map((workspace) =>
          workspace.id === state.activeWorkspaceId
            ? { ...workspace, camera: state.camera, selection: state.selection }
            : workspace,
        );

  return {
    ...state,
    activeWorkspaceId: workspaceId,
    // A window admitted by the outgoing workspace and not the incoming one must not stay
    // selected or active: it is not on screen, and every verb keyed to the active window
    // would act on something the user cannot see.
    ...(target === null
      ? {}
      : { camera: target.camera, selection: normalizeSelection(state, target.selection) }),
    workspaces: saved,
  };
}

function setInfiniteCanvasWorkspaceWindows<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{ windowIds: readonly string[]; workspaceId: string }>,
): InfiniteCanvasState<Kind> {
  if (findInfiniteCanvasWorkspace(state, input.workspaceId) === null) {
    return state;
  }

  return {
    ...state,
    workspaces: state.workspaces.map((workspace) =>
      workspace.id === input.workspaceId
        ? {
            ...workspace,
            windowIds: normalizeInfiniteCanvasWorkspaceWindowIds(state, input.windowIds),
          }
        : workspace,
    ),
  };
}

/** Membership is a set of ids that exist: deduplicated, and never naming a closed window. */
function normalizeInfiniteCanvasWorkspaceWindowIds<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowIds: readonly string[],
): readonly string[] {
  const live = new Set(state.windows.map((window) => window.id));

  return [...new Set(windowIds)].filter((windowId) => live.has(windowId));
}

/**
 * Drop a window from every workspace. Called where `detachInfiniteCanvasWindowFromGroups` is:
 * a closed window cannot keep a membership, and a later workspace naming it would resurrect a
 * dead id into the filter.
 */
function detachInfiniteCanvasWindowFromWorkspaces<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
): InfiniteCanvasState<Kind> {
  if (!state.workspaces.some((workspace) => workspace.windowIds.includes(windowId))) {
    return state;
  }

  return {
    ...state,
    workspaces: state.workspaces.map((workspace) =>
      workspace.windowIds.includes(windowId)
        ? {
            ...workspace,
            windowIds: workspace.windowIds.filter((candidate) => candidate !== windowId),
          }
        : workspace,
    ),
  };
}

export {
  activateInfiniteCanvasWorkspace,
  closeInfiniteCanvasWorkspace,
  createInfiniteCanvasWorkspace,
  detachInfiniteCanvasWindowFromWorkspaces,
  findInfiniteCanvasWorkspace,
  getInfiniteCanvasWorkspaceWindowIds,
  isInfiniteCanvasWindowInActiveWorkspace,
  setInfiniteCanvasWorkspaceWindows,
};
