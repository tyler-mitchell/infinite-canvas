import { getInfiniteCanvasWindowGroup } from "./group-state";
import { getInfiniteCanvasGroupWindowIds } from "./group-tree";
import { getSelectableWindowIds, normalizeSelection } from "./selection";
import {
  getInfiniteCanvasWorkspaceWindowIds,
  isInfiniteCanvasWindowInActiveWorkspace,
} from "./workspace-membership";
import type { InfiniteCanvasState, InfiniteCanvasWorkspace } from "./types";

/**
 * Virtual desktops: one canvas plus a membership filter. A workspace is a named set of windows
 * with the camera and selection it was left at. Not a nested canvas, which would need a second
 * camera and input plane.
 *
 * Opt-in. `workspaces: []` with `activeWorkspaceId: null` applies no filtering, so a canvas that
 * creates none is unaffected and no persisted document needs migrating.
 *
 * The stored camera and selection are a snapshot taken on exit. While a workspace is active,
 * `state.camera` is live and the stored copy is intentionally stale — writing through on every pan
 * would make each frame a workspace mutation, and those are undo checkpoints.
 */

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
 * Closing a workspace does not close its windows. A window in no workspace is one every
 * unfiltered view shows.
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
 * Switches workspace, saving the outgoing camera and selection and restoring the incoming ones.
 * Without the save, a workspace would keep the camera it had when created.
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

  const entered = {
    ...state,
    activeWorkspaceId: workspaceId,
    ...(target === null ? {} : { camera: target.camera }),
    workspaces: saved,
  };

  // Normalized against the workspace being *entered*, not the one being left. `normalizeSelection`
  // reaches `getSelectableWindowIds`, which now asks which desktop a window is on — so
  // normalizing against `state` would filter the incoming selection through the outgoing
  // membership and empty it.
  //
  // A window admitted by the outgoing workspace and not the incoming one must not stay selected
  // or active either: it is not on screen, and every verb keyed to the active window would act
  // on something the user cannot see.
  const selection = normalizeSelection(entered, target?.selection ?? entered.selection);
  // A workspace saved with nothing selected would otherwise be entered with no active window,
  // and every verb keyed to the active one — close, minimize, dock, extend the selection —
  // would be dead until the user clicked. Falling back to a window *on this desktop* is the
  // same courtesy `minimizeWindow` does when it hands focus on.
  const activeWindowId = selection.anchorWindowId ?? getSelectableWindowIds(entered).at(-1) ?? null;

  return { ...entered, activeWindowId, selection };
}

/** Renaming a workspace, under the same rule window and group renames follow. */
function renameInfiniteCanvasWorkspace<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{ title: string; workspaceId: string }>,
): InfiniteCanvasState<Kind> {
  const title = input.title.trim();
  const target = findInfiniteCanvasWorkspace(state, input.workspaceId);

  if (title === "" || target === null || target.title === title) {
    return state;
  }

  return {
    ...state,
    workspaces: state.workspaces.map((workspace) =>
      workspace.id === input.workspaceId ? { ...workspace, title } : workspace,
    ),
  };
}

/**
 * Moves a workspace to another position. `toIndex` matches `group.reorderChild`.
 *
 * The index is clamped rather than rejected, since callers are drag gestures and running past the
 * end means "last". Removing before inserting makes `toIndex` the position in the final list.
 */
function reorderInfiniteCanvasWorkspace<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{ toIndex: number; workspaceId: string }>,
): InfiniteCanvasState<Kind> {
  const fromIndex = state.workspaces.findIndex((workspace) => workspace.id === input.workspaceId);

  if (fromIndex === -1) {
    return state;
  }

  const remaining = state.workspaces.filter((workspace) => workspace.id !== input.workspaceId);
  const toIndex = Math.min(Math.max(Math.trunc(input.toIndex), 0), remaining.length);

  if (toIndex === fromIndex) {
    return state;
  }

  const moved = state.workspaces[fromIndex];

  return moved === undefined
    ? state
    : {
        ...state,
        workspaces: [...remaining.slice(0, toIndex), moved, ...remaining.slice(toIndex)],
      };
}

/**
 * Adds one window as a delta. `setInfiniteCanvasWorkspaceWindows` takes the whole list, so a
 * read-append-write caller discards anything added in between. Both forms stay: the absolute one
 * for recipes and restores, this one for gestures.
 */
function addInfiniteCanvasWindowToWorkspace<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{ windowId: string; workspaceId: string }>,
): InfiniteCanvasState<Kind> {
  const target = findInfiniteCanvasWorkspace(state, input.workspaceId);
  const isLiveWindow = state.windows.some((window) => window.id === input.windowId);

  if (target === null || !isLiveWindow || target.windowIds.includes(input.windowId)) {
    return state;
  }

  return {
    ...state,
    workspaces: state.workspaces.map((workspace) =>
      workspace.id === input.workspaceId
        ? { ...workspace, windowIds: [...workspace.windowIds, input.windowId] }
        : workspace,
    ),
  };
}

/**
 * Removes the whole shell, because reconciliation re-expands membership to whole groups — dropping
 * one docked pane alone would be pulled straight back. `addInfiniteCanvasWindowToWorkspace` needs
 * no such expansion: reconciliation completes an under-filled membership on its own.
 */
function removeInfiniteCanvasWindowFromWorkspace<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{ windowId: string; workspaceId: string }>,
): InfiniteCanvasState<Kind> {
  const target = findInfiniteCanvasWorkspace(state, input.workspaceId);

  if (target === null || !target.windowIds.includes(input.windowId)) {
    return state;
  }

  const leaving = new Set(normalizeInfiniteCanvasWorkspaceWindowIds(state, [input.windowId]));

  return {
    ...state,
    workspaces: state.workspaces.map((workspace) =>
      workspace.id === input.workspaceId
        ? {
            ...workspace,
            windowIds: workspace.windowIds.filter((windowId) => !leaving.has(windowId)),
          }
        : workspace,
    ),
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

/**
 * Membership is a deduplicated set of live window ids, and group-complete: naming any member of a
 * group names them all. Admitting half a group would draw a gutter beside an absent pane and a tab
 * controlling a panel on another workspace.
 *
 * Expands rather than rejects, since "put this on that workspace" reasonably includes whatever the
 * window is docked into.
 */
function normalizeInfiniteCanvasWorkspaceWindowIds<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowIds: readonly string[],
): readonly string[] {
  const live = new Set(state.windows.map((window) => window.id));
  const named = [...new Set(windowIds)].filter((windowId) => live.has(windowId));
  const withGroups = named.flatMap((windowId) => {
    const group = getInfiniteCanvasWindowGroup(state, windowId);

    return group === null ? [windowId] : getInfiniteCanvasGroupWindowIds(group.tree);
  });

  return [...new Set(withGroups)].filter((windowId) => live.has(windowId));
}

/**
 * Re-expands every workspace's membership so it stays group-complete.
 *
 * Normalization establishes the invariant when membership is written, but docking, undocking, and
 * applying a layout recipe all change groups without touching membership, leaving a workspace
 * holding part of a group. Called once from the reducer rather than from each of those actions.
 */
function reconcileInfiniteCanvasWorkspaces<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): InfiniteCanvasState<Kind> {
  if (state.workspaces.length === 0) {
    return state;
  }

  const reconciled = state.workspaces.map((workspace) => {
    const windowIds = normalizeInfiniteCanvasWorkspaceWindowIds(state, workspace.windowIds);
    // A stored selection is cleaned against this workspace's *own* membership rather than
    // through `normalizeSelection`, which reads the active workspace and would filter an
    // inactive one against the wrong desktop.
    //
    // Entering already normalizes what it restores, so a stale id here is inert rather than
    // dangerous. It is cleaned anyway because it survives every reload otherwise: a window
    // closed once leaves its name in a document forever, and "a workspace names no window
    // that does not exist" is a simpler thing to hold than the same claim about membership
    // alone.
    const admitted = new Set(windowIds);
    const selectedWindowIds = workspace.selection.windowIds.filter((windowId) =>
      admitted.has(windowId),
    );
    const anchorWindowId =
      workspace.selection.anchorWindowId !== null &&
      admitted.has(workspace.selection.anchorWindowId)
        ? workspace.selection.anchorWindowId
        : null;

    // Identical when nothing moved, so the document comparison — which is reference
    // equality — does not read reconciliation as an edit.
    const isUnchanged =
      windowIds.length === workspace.windowIds.length &&
      windowIds.every((windowId, index) => windowId === workspace.windowIds[index]) &&
      selectedWindowIds.length === workspace.selection.windowIds.length &&
      anchorWindowId === workspace.selection.anchorWindowId;

    return isUnchanged
      ? workspace
      : {
          ...workspace,
          selection: { ...workspace.selection, anchorWindowId, windowIds: selectedWindowIds },
          windowIds,
        };
  });

  const withWorkspaces = reconciled.every(
    (workspace, index) => workspace === state.workspaces[index],
  )
    ? state
    : { ...state, workspaces: reconciled };

  return reconcileActiveAgainstMembership(withWorkspaces);
}

/**
 * Clears the active window and selection when membership stops admitting them, so verbs keyed to
 * the active window do not aim at something the canvas no longer draws.
 *
 * Activation applies this rule on entry, but membership can also change under a stationary camera.
 * Placed here rather than in `moveWindow` because `removeWindow` and `setWindows` can do it too,
 * and the reducer already runs this reconciliation once.
 *
 * Falls back to the selection anchor, then the last selectable window, then nothing. Returns the
 * identical state when nothing changed.
 */
function reconcileActiveAgainstMembership<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): InfiniteCanvasState<Kind> {
  const selection = normalizeSelection(state, state.selection);
  const keepsActive =
    state.activeWindowId !== null &&
    isInfiniteCanvasWindowInActiveWorkspace(state, state.activeWindowId);
  const activeWindowId = keepsActive
    ? state.activeWindowId
    : (selection.anchorWindowId ?? getSelectableWindowIds(state).at(-1) ?? null);

  return selection === state.selection && activeWindowId === state.activeWindowId
    ? state
    : { ...state, activeWindowId, selection };
}

/**
 * Drops a window from every workspace. Called alongside `detachInfiniteCanvasWindowFromGroups`,
 * since a membership naming a closed window would put a dead id back into the filter.
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

/**
 * Moves windows to a workspace as a single edit: they leave every other one and join this one.
 * `addWindow` and `removeWindow` cannot express this between them — two dispatches would be two
 * undo entries with the window on both workspaces in between.
 *
 * Takes a set rather than one id, so moving three windows is one undo entry rather than three.
 * Moving one window is a set of one.
 *
 * The whole group moves. Membership is group-complete and reconciliation re-expands it after every
 * action, so moving one pane without its siblings would be pulled straight back. Normalizing the
 * set as a whole handles this, since it already dedupes, drops dead ids, and expands groups.
 *
 * Returns the identical state when nothing would change, including for an empty set or one naming
 * only windows already here, so a no-op lands no history entry.
 */
function moveInfiniteCanvasWindowsToWorkspace<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{ windowIds: readonly string[]; workspaceId: string }>,
): InfiniteCanvasState<Kind> {
  const target = findInfiniteCanvasWorkspace(state, input.workspaceId);

  if (target === null) {
    return state;
  }

  const moving = new Set(normalizeInfiniteCanvasWorkspaceWindowIds(state, input.windowIds));

  if (moving.size === 0) {
    return state;
  }

  const workspaces = state.workspaces.map((workspace) => {
    if (workspace.id === input.workspaceId) {
      const missing = [...moving].filter((windowId) => !workspace.windowIds.includes(windowId));

      return missing.length === 0
        ? workspace
        : { ...workspace, windowIds: [...workspace.windowIds, ...missing] };
    }

    const remaining = workspace.windowIds.filter((windowId) => !moving.has(windowId));

    return remaining.length === workspace.windowIds.length
      ? workspace
      : { ...workspace, windowIds: remaining };
  });

  return workspaces.every((workspace, index) => workspace === state.workspaces[index])
    ? state
    : { ...state, workspaces };
}

export {
  activateInfiniteCanvasWorkspace,
  addInfiniteCanvasWindowToWorkspace,
  closeInfiniteCanvasWorkspace,
  createInfiniteCanvasWorkspace,
  reconcileInfiniteCanvasWorkspaces,
  detachInfiniteCanvasWindowFromWorkspaces,
  findInfiniteCanvasWorkspace,
  getInfiniteCanvasWorkspaceWindowIds,
  isInfiniteCanvasWindowInActiveWorkspace,
  moveInfiniteCanvasWindowsToWorkspace,
  removeInfiniteCanvasWindowFromWorkspace,
  renameInfiniteCanvasWorkspace,
  reorderInfiniteCanvasWorkspace,
  setInfiniteCanvasWorkspaceWindows,
};
