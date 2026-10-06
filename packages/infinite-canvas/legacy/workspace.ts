import { getInfiniteCanvasWindowGroup } from "./group-state";
import { getInfiniteCanvasGroupWindowIds } from "./group-tree";
import {
  EMPTY_INFINITE_CANVAS_SELECTION,
  getSelectableWindowIds,
  getSelectedWindowIds,
  normalizeSelection,
} from "./selection";
import {
  getInfiniteCanvasWorkspaceWindowIds,
  isInfiniteCanvasWindowInActiveWorkspace,
} from "./workspace-membership";
import type { InfiniteCanvasState, InfiniteCanvasWorkspace } from "./types";

/** Implements virtual desktops as window membership filters on one canvas. */
function findInfiniteCanvasWorkspace<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  workspaceId: string,
): InfiniteCanvasWorkspace | null {
  return state.workspaces.find((workspace) => workspace.id === workspaceId) ?? null;
}

function createInfiniteCanvasWorkspace<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{
    activate?: boolean;
    title?: string;
    windowIds?: readonly string[];
    workspaceId: string;
  }>,
): InfiniteCanvasState<Kind> {
  const { activate = true, title, windowIds = [], workspaceId } = input;

  if (findInfiniteCanvasWorkspace(state, workspaceId) !== null) {
    return activate ? activateInfiniteCanvasWorkspace(state, workspaceId) : state;
  }

  const created = {
    ...state,
    workspaces: [
      ...state.workspaces,
      {
        camera: state.camera,
        id: workspaceId,
        selection: EMPTY_INFINITE_CANVAS_SELECTION,
        title: title ?? workspaceId,
        windowIds: normalizeInfiniteCanvasWorkspaceWindowIds(state, windowIds),
      },
    ],
  };
  return activate ? activateInfiniteCanvasWorkspace(created, workspaceId) : created;
}

/** Closes a workspace without closing its windows. */
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

/** Saves outgoing camera and selection, then restores the incoming workspace. */
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

  // Preserve array identity when no workspace is active.
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

  // Normalize against incoming membership.
  const selection = normalizeSelection(entered, target?.selection ?? entered.selection);
  // Use a selectable member when the saved selection has no window.
  const selectedWindowId =
    selection.anchorTarget?.type === "window"
      ? selection.anchorTarget.id
      : getSelectedWindowIds(selection).at(-1);
  const activeWindowId = selectedWindowId ?? getSelectableWindowIds(entered).at(-1) ?? null;

  return { ...entered, activeWindowId, selection };
}

/** Renames a workspace with a trimmed non-empty title. */
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

/** Moves a workspace to a clamped final index. */
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

/** Adds one live window without replacing other membership. */
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

/** Removes a window and its complete group from one workspace. */
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

/** Returns unique live IDs and expands each selected group. */
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

/** Restores group-complete membership after group changes. */
function reconcileInfiniteCanvasWorkspaces<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): InfiniteCanvasState<Kind> {
  if (state.workspaces.length === 0) {
    return state;
  }

  const reconciled = state.workspaces.map((workspace) => {
    const windowIds = normalizeInfiniteCanvasWorkspaceWindowIds(state, workspace.windowIds);
    const selection = normalizeSelection(
      {
        ...state,
        activeWorkspaceId: workspace.id,
        workspaces: state.workspaces.map((entry) =>
          entry.id === workspace.id ? { ...entry, windowIds } : entry,
        ),
      },
      workspace.selection,
    );

    // Preserve workspace identity when no membership changed.
    const isUnchanged =
      windowIds.length === workspace.windowIds.length &&
      windowIds.every((windowId, index) => windowId === workspace.windowIds[index]) &&
      selection === workspace.selection;

    return isUnchanged
      ? workspace
      : {
          ...workspace,
          selection,
          windowIds,
        };
  });

  return reconciled.every((workspace, index) => workspace === state.workspaces[index])
    ? state
    : { ...state, workspaces: reconciled };
}

/** Moves windows and their complete groups to one workspace. */
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
  findInfiniteCanvasWorkspace,
  getInfiniteCanvasWorkspaceWindowIds,
  isInfiniteCanvasWindowInActiveWorkspace,
  moveInfiniteCanvasWindowsToWorkspace,
  removeInfiniteCanvasWindowFromWorkspace,
  renameInfiniteCanvasWorkspace,
  reorderInfiniteCanvasWorkspace,
  setInfiniteCanvasWorkspaceWindows,
};
