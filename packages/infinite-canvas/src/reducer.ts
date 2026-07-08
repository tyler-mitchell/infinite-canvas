import { executeInfiniteCanvasCommand } from "./commands";
import { navigateCamera } from "./camera-navigation";
import { findInfiniteCanvasGroupNode, isInfiniteCanvasGroupContainer } from "./group-tree";
import {
  closeInfiniteCanvasGroup,
  createInfiniteCanvasGroup,
  detachInfiniteCanvasWindowFromGroups,
  dockInfiniteCanvasWindowIntoGroup,
  reorderInfiniteCanvasGroupChildInState,
  setInfiniteCanvasGroupActiveChildInState,
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
  focusWindow,
  maximizeWindow,
  minimizeWindow,
  openWindow,
  restoreWindow,
  toggleWindowPinned,
} from "./stacking";
import { resetInfiniteCanvasState } from "./state";
import type { InfiniteCanvasAction, InfiniteCanvasState, InfiniteCanvasZoomPolicy } from "./types";

type InfiniteCanvasReducerOptions = Readonly<{
  zoomPolicy?: InfiniteCanvasZoomPolicy;
}>;

function reduceInfiniteCanvasState<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  action: InfiniteCanvasAction<Kind>,
  options: InfiniteCanvasReducerOptions = {},
): InfiniteCanvasState<Kind> {
  switch (action.type) {
    case "camera.navigate":
      return navigateCamera(state, action.request, options.zoomPolicy);
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
      return executeInfiniteCanvasCommand(state, action.command, options.zoomPolicy);
    case "desktop.hydrate":
      return action.state;
    case "desktop.reset":
      return resetInfiniteCanvasState(state, action.state);
    case "interaction.finish":
      return finishCanvasInteraction(state, action.pointerId);
    case "interaction.startMarquee":
      return beginMarqueeSelection(state, action.pointerId, action.point, action.mode);
    // Dragging a grouped window's header drags its shell: the group is one world
    // object, and the member has no rect of its own to move (DOCK-003). Focus
    // still lands on the window the user actually grabbed.
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

      // A stale seam -- the tree changed under the pointer -- is not worth throwing over.
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
    case "interaction.startPan":
      return beginCanvasPan(state, action.pointerId, action.point, action.clearSelection);
    case "interaction.startResize":
      if (isInfiniteCanvasWindowGrouped(state, action.windowId)) {
        return state;
      }

      return beginWindowResize(
        state,
        action.pointerId,
        action.windowId,
        action.handle,
        action.point,
      );
    // Re-project after every step. A group-move drags several windows at once, and
    // a selection can mix grouped and floating windows; rather than teaching the
    // interaction layer which is which, the projection simply wins. It is a no-op
    // when there are no groups.
    case "interaction.step":
      return syncInfiniteCanvasGroupWindowRects(
        stepCanvasInteraction(state, action.pointerId, action.point, action.snapPolicy),
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
    case "group.setChildWeights":
      return setInfiniteCanvasGroupChildWeightsInState(state, action);
    case "group.setLayoutMode":
      return setInfiniteCanvasGroupLayoutModeInState(state, action);
    case "group.setRect":
      return setInfiniteCanvasGroupRect(state, action);
    case "group.undockWindow":
      return undockInfiniteCanvasWindowFromGroup(state, action);
    // A window that is gone, or collapsed into the dock, cannot keep occupying a
    // layout slot. Detaching after the fact keeps `stacking` group-blind.
    case "window.close":
      return detachInfiniteCanvasWindowFromGroups(
        closeWindow(state, action.windowId),
        action.windowId,
      );
    case "window.focus":
      return focusWindow(state, action.windowId);
    // Maximizing a grouped window would have it cover its own shell. Tear it out
    // first: the user asked for the whole viewport, not for a pane.
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
    case "window.open":
      return openWindow(state, action.window);
    case "window.restore":
      return restoreWindow(state, action.windowId);
    case "window.togglePinned":
      return toggleWindowPinned(state, action.windowId);
  }
}

export { reduceInfiniteCanvasState };
