import { getInfiniteCanvasWindowGroup } from "./group-state";
import { getInfiniteCanvasGroupWindowIds } from "./group-tree";
import { getSelectableWindowIds, normalizeSelection } from "./selection";
import {
  getInfiniteCanvasWorkspaceWindowIds,
  isInfiniteCanvasWindowInActiveWorkspace,
} from "./workspace-membership";
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
 * Membership as a delta, which is the difference between a verb and a race.
 *
 * `setInfiniteCanvasWorkspaceWindows` takes the whole list, so a caller wanting "put this
 * window on that desktop" has to read the membership, append, and write it back — and a
 * window added by anything else between the read and the write is discarded. That is the same
 * defect `equalizeInfiniteCanvasGroupChildren` exists to avoid, where the record is keyed by
 * child id and a pane docked mid-flight keeps its old weight.
 *
 * Both forms stay. The absolute one is what a recipe or a restore needs; this is what a
 * gesture needs.
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

function removeInfiniteCanvasWindowFromWorkspace<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{ windowId: string; workspaceId: string }>,
): InfiniteCanvasState<Kind> {
  const target = findInfiniteCanvasWorkspace(state, input.workspaceId);

  if (target === null || !target.windowIds.includes(input.windowId)) {
    return state;
  }

  return {
    ...state,
    workspaces: state.workspaces.map((workspace) =>
      workspace.id === input.workspaceId
        ? {
            ...workspace,
            windowIds: workspace.windowIds.filter((windowId) => windowId !== input.windowId),
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
 * Membership is a set of ids that exist — deduplicated, never naming a closed window — and
 * **group-complete**.
 *
 * A group is one world object: a shell with a rect, gutters between its panes, and a tab
 * strip across them. Letting a workspace admit half of one would render a gutter between a
 * visible pane and an absent one, and a tab controlling a panel on another desktop. So naming
 * any member names them all, which is the same reasoning that makes the group the source of
 * truth and a member's rect its projection.
 *
 * This is an expansion rather than a rejection for the same reason `createInfiniteCanvasGroup`
 * drops rather than steals: the user's gesture was "put this on that desktop", and the honest
 * reading of it includes the thing the window is docked into.
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
  addInfiniteCanvasWindowToWorkspace,
  closeInfiniteCanvasWorkspace,
  createInfiniteCanvasWorkspace,
  detachInfiniteCanvasWindowFromWorkspaces,
  findInfiniteCanvasWorkspace,
  getInfiniteCanvasWorkspaceWindowIds,
  isInfiniteCanvasWindowInActiveWorkspace,
  removeInfiniteCanvasWindowFromWorkspace,
  renameInfiniteCanvasWorkspace,
  setInfiniteCanvasWorkspaceWindows,
};
