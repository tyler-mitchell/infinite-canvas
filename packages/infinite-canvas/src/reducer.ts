import { executeInfiniteCanvasCommand } from "./commands";
import { navigateCamera } from "./camera-navigation";
import {
  closeInfiniteCanvasConnection,
  detachInfiniteCanvasConnectionsFromWindow,
  openInfiniteCanvasConnection,
  updateInfiniteCanvasConnection,
} from "./connection";
import { isUsableViewport } from "./geometry";
import { findInfiniteCanvasGroupNode, isInfiniteCanvasGroupContainer } from "./group-tree";
import { applyInfiniteCanvasRecipe } from "./recipes";
import { getInfiniteCanvasPlacedWindowRect } from "./window-placement";
import {
  activateInfiniteCanvasWorkspace,
  addInfiniteCanvasWindowToWorkspace,
  moveInfiniteCanvasWindowsToWorkspace,
  closeInfiniteCanvasWorkspace,
  createInfiniteCanvasWorkspace,
  reconcileInfiniteCanvasWorkspaces,
  removeInfiniteCanvasWindowFromWorkspace,
  renameInfiniteCanvasWorkspace,
  reorderInfiniteCanvasWorkspace,
  detachInfiniteCanvasWindowFromWorkspaces,
  setInfiniteCanvasWorkspaceWindows,
} from "./workspace";
import {
  EMPTY_INFINITE_CANVAS_HISTORY,
  getInfiniteCanvasDocument,
  isInfiniteCanvasHistoryCheckpoint,
  pushInfiniteCanvasHistory,
} from "./history";
import {
  closeInfiniteCanvasGroup,
  createInfiniteCanvasGroup,
  detachInfiniteCanvasWindowFromGroups,
  dockInfiniteCanvasWindowIntoGroup,
  equalizeInfiniteCanvasGroupChildrenInState,
  renameInfiniteCanvasGroup,
  reorderInfiniteCanvasGroupChildInState,
  setInfiniteCanvasGroupActiveChildInState,
  setInfiniteCanvasGroupAxisInState,
  setInfiniteCanvasGroupChildWeightsInState,
  setInfiniteCanvasGroupLayoutModeInState,
  findInfiniteCanvasGroup,
  getInfiniteCanvasWindowGroup,
  isInfiniteCanvasWindowGrouped,
  setInfiniteCanvasGroupRect,
  syncInfiniteCanvasGroupWindowRects,
  undockInfiniteCanvasWindowFromGroup,
} from "./group-state";
import { panCameraByScreenDelta, zoomCameraAtScreenPoint } from "./geometry";
import {
  beginCanvasPan,
  beginInfiniteCanvasGroupGutterDrag,
  beginInfiniteCanvasGroupResize,
  beginInfiniteCanvasGroupMove,
  beginMarqueeSelection,
  beginWindowMove,
  beginWindowResize,
  finishCanvasInteraction,
  stepCanvasInteraction,
} from "./interaction";
import {
  addSelection,
  addTargetSelection,
  clearSelection,
  removeSelection,
  removeTargetSelection,
  replaceSelection,
  replaceTargetSelection,
  selectAllVisibleWindows,
  toggleSelection,
  toggleTargetSelection,
} from "./selection";
import {
  closeWindow,
  findWindow,
  focusWindow,
  maximizeWindow,
  minimizeWindow,
  openWindow,
  renameWindow,
  restoreWindow,
  toggleWindowPinned,
} from "./stacking";
import { resetInfiniteCanvasState } from "./state";
import type {
  InfiniteCanvasAction,
  InfiniteCanvasRect,
  InfiniteCanvasState,
  InfiniteCanvasZoomPolicy,
} from "./types";
import { isInfiniteCanvasWindowCapable } from "./window-capabilities";

type InfiniteCanvasReducerOptions<Kind extends string = string> = Readonly<{
  /** Returns bounds for all selected windows and consumer targets. */
  getSelectionBounds?: (state: InfiniteCanvasState<Kind>) => InfiniteCanvasRect | null;
  zoomPolicy?: InfiniteCanvasZoomPolicy;
}>;

/** Applies one action and records one checkpoint when the document changes. */
function reduceInfiniteCanvasState<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  action: InfiniteCanvasAction<Kind>,
  options: InfiniteCanvasReducerOptions<Kind> = {},
): InfiniteCanvasState<Kind> {
  const applied = applyInfiniteCanvasAction(state, action, options);
  // Reconcile group-complete workspace membership after all actions.
  const nextState =
    applied.groups === state.groups && applied.workspaces === state.workspaces
      ? applied
      : reconcileInfiniteCanvasWorkspaces(applied);

  if (action.type === "desktop.hydrate" || action.type === "desktop.reset") {
    return { ...nextState, history: EMPTY_INFINITE_CANVAS_HISTORY };
  }

  if (nextState === state || !isInfiniteCanvasHistoryCheckpoint(action, state, nextState)) {
    return nextState;
  }

  return {
    ...nextState,
    history: pushInfiniteCanvasHistory(state.history, getInfiniteCanvasDocument(state)),
  };
}

function applyInfiniteCanvasAction<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  action: InfiniteCanvasAction<Kind>,
  options: InfiniteCanvasReducerOptions<Kind> = {},
): InfiniteCanvasState<Kind> {
  switch (action.type) {
    case "camera.navigate":
      return navigateCamera(
        state,
        action.request,
        options.zoomPolicy,
        options.getSelectionBounds?.(state),
      );
    case "camera.panBy":
      return {
        ...state,
        camera: panCameraByScreenDelta(state.camera, action.delta),
      };
    case "camera.zoomAt":
      return {
        ...state,
        camera: zoomCameraAtScreenPoint(
          state.camera,
          state.viewport,
          action.anchor,
          action.zoom,
          options.zoomPolicy,
        ),
      };
    case "command.execute":
      return executeInfiniteCanvasCommand(
        state,
        action.command,
        options.zoomPolicy,
        options.getSelectionBounds?.(state),
      );
    case "connection.open":
      return openInfiniteCanvasConnection(state, action.connection);
    case "connection.close":
      return closeInfiniteCanvasConnection(state, action.connectionId);
    case "connection.update":
      return updateInfiniteCanvasConnection(state, action);
    // Keep the live viewport because persisted state does not own DOM measurements.
    case "desktop.hydrate":
      return isUsableViewport(state.viewport)
        ? { ...action.state, viewport: state.viewport }
        : action.state;
    case "desktop.reset":
      return resetInfiniteCanvasState(state, action.state);
    case "interaction.finish":
      return finishCanvasInteraction(state, action.pointerId);
    case "interaction.startMarquee":
      return beginMarqueeSelection(state, action.pointerId, action.point, action.mode);
    // A grouped window moves with its group.
    case "interaction.startMove": {
      const group = getInfiniteCanvasWindowGroup(state, action.windowId);

      return group === null
        ? beginWindowMove(state, action.pointerId, action.windowId, action.point)
        : beginInfiniteCanvasGroupMove(
            focusWindow(state, action.windowId),
            action.pointerId,
            group,
            action.point,
          );
    }
    case "interaction.startGroupGutter": {
      const group = findInfiniteCanvasGroup(state, action.groupId);
      const container =
        group === null ? null : findInfiniteCanvasGroupNode(group.tree, action.containerId);

      // Ignore a seam that left the current tree.
      if (container === null || !isInfiniteCanvasGroupContainer(container)) {
        return state;
      }

      return beginInfiniteCanvasGroupGutterDrag(state, {
        afterChildId: action.afterChildId,
        availableExtent: action.availableExtent,
        axis: action.axis,
        beforeChildId: action.beforeChildId,
        containerId: action.containerId,
        groupId: action.groupId,
        originContainer: container,
        originPointer: action.point,
        pointerId: action.pointerId,
      });
    }
    case "interaction.startGroupResize": {
      const group = findInfiniteCanvasGroup(state, action.groupId);

      // Ignore a group that closed before the pointer event.
      if (group === null) {
        return state;
      }

      return beginInfiniteCanvasGroupResize(
        state,
        action.pointerId,
        group,
        action.handle,
        action.minSize,
        action.point,
      );
    }
    case "interaction.startPan":
      return beginCanvasPan(state, action.pointerId, action.point, action.clearSelection);
    // Grouped panes use seams. Other windows must permit resize.
    case "interaction.startResize":
      if (
        isInfiniteCanvasWindowGrouped(state, action.windowId) ||
        !isInfiniteCanvasWindowCapable(findWindow(state, action.windowId), "resizable")
      ) {
        return state;
      }

      return beginWindowResize(
        state,
        action.pointerId,
        action.windowId,
        action.handle,
        action.point,
      );
    // Reapply group projection after each interaction step.
    case "interaction.step":
      return syncInfiniteCanvasGroupWindowRects(
        stepCanvasInteraction(state, action.pointerId, action.point, action.snapPolicy, {
          dockIntent: action.dockIntent === true,
        }),
      );
    case "selection.add":
      return addSelection(state, action.windowIds);
    case "selection.clear":
      return clearSelection(state);
    case "selection.remove":
      return removeSelection(state, action.windowIds);
    case "selection.replace":
      return replaceSelection(state, action.windowIds);
    case "selection.selectAllVisible":
      return selectAllVisibleWindows(state);
    case "selection.targets.add":
      return addTargetSelection(state, action.targets);
    case "selection.targets.remove":
      return removeTargetSelection(state, action.targets);
    case "selection.targets.replace":
      return replaceTargetSelection(state, action.targets);
    case "selection.targets.toggle":
      return toggleTargetSelection(state, action.targets);
    case "selection.toggle":
      return toggleSelection(state, action.windowIds);
    case "viewport.set":
      return {
        ...state,
        viewport: action.viewport,
      };
    case "viewportInsets.set":
      return {
        ...state,
        viewportInsets: action.insets,
      };
    case "viewportOccluders.set":
      return {
        ...state,
        viewportOccluders: action.occluders,
      };
    // Recompute member rects after chrome metrics change.
    case "groupMetrics.set":
      return syncInfiniteCanvasGroupWindowRects({
        ...state,
        groupMetrics: action.metrics,
      });
    case "workspace.create":
      return createInfiniteCanvasWorkspace(state, action);
    case "workspace.setTitle":
      return renameInfiniteCanvasWorkspace(state, action);
    case "workspace.close":
      return closeInfiniteCanvasWorkspace(state, action.workspaceId);
    case "workspace.activate":
      return activateInfiniteCanvasWorkspace(state, action.workspaceId);
    case "workspace.addWindow":
      return addInfiniteCanvasWindowToWorkspace(state, action);
    case "workspace.moveWindows":
      return moveInfiniteCanvasWindowsToWorkspace(state, action);
    case "workspace.removeWindow":
      return removeInfiniteCanvasWindowFromWorkspace(state, action);
    case "workspace.reorder":
      return reorderInfiniteCanvasWorkspace(state, action);
    case "workspace.setWindows":
      return setInfiniteCanvasWorkspaceWindows(state, action);
    case "group.setTitle":
      return renameInfiniteCanvasGroup(state, action);
    case "group.close":
      return closeInfiniteCanvasGroup(state, action.groupId);
    case "group.create":
      return createInfiniteCanvasGroup(state, action);
    case "group.dockWindow":
      return dockInfiniteCanvasWindowIntoGroup(state, action);
    case "group.reorderChild":
      return reorderInfiniteCanvasGroupChildInState(state, action);
    case "group.setActiveChild":
      return setInfiniteCanvasGroupActiveChildInState(state, action);
    case "group.equalizeChildren":
      return equalizeInfiniteCanvasGroupChildrenInState(state, action);
    case "group.setAxis":
      return setInfiniteCanvasGroupAxisInState(state, action);
    case "group.setChildWeights":
      return setInfiniteCanvasGroupChildWeightsInState(state, action);
    case "group.setLayoutMode":
      return setInfiniteCanvasGroupLayoutModeInState(state, action);
    case "group.setRect":
      return setInfiniteCanvasGroupRect(state, action);
    case "group.undockWindow":
      return undockInfiniteCanvasWindowFromGroup(state, action);
    case "recipe.apply":
      return applyInfiniteCanvasRecipe(state, action.recipe, action.placement);
    case "window.setTitle":
      return renameWindow(state, action);
    case "window.close":
      return detachInfiniteCanvasConnectionsFromWindow(
        detachInfiniteCanvasWindowFromWorkspaces(
          detachInfiniteCanvasWindowFromGroups(
            closeWindow(state, action.windowId),
            action.windowId,
          ),
          action.windowId,
        ),
        action.windowId,
      );
    case "window.focus":
      return focusWindow(state, action.windowId);
    // Detach a grouped window before it fills the viewport.
    case "window.maximize":
      return maximizeWindow(
        detachInfiniteCanvasWindowFromGroups(state, action.windowId),
        action.windowId,
      );
    case "window.minimize":
      return detachInfiniteCanvasWindowFromGroups(
        minimizeWindow(state, action.windowId),
        action.windowId,
      );
    // An opened window joins the active workspace.
    case "window.open": {
      // Placement resolves here so the canvas the window avoids is the current one.
      const opened =
        action.placement === undefined
          ? action.window
          : {
              ...action.window,
              rect: getInfiniteCanvasPlacedWindowRect(state, action.window, action.placement),
            };

      return state.activeWorkspaceId === null
        ? openWindow(state, opened)
        : addInfiniteCanvasWindowToWorkspace(openWindow(state, opened), {
            windowId: opened.id,
            workspaceId: state.activeWorkspaceId,
          });
    }
    case "window.restore":
      return restoreWindow(state, action.windowId);
    case "window.togglePinned":
      return toggleWindowPinned(state, action.windowId);
    default:
      return assertUnknownInfiniteCanvasAction(action);
  }
}

/** Throws for an action type that bypassed compile-time exhaustiveness. */
function assertUnknownInfiniteCanvasAction(action: never): never {
  throw new Error(
    `Unknown infinite canvas action type: ${String((action as { type?: unknown }).type)}`,
  );
}

export { reduceInfiniteCanvasState };
