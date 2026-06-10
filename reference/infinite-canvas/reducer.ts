import { executeInfiniteCanvasCommand } from "#/experiments/infinite-canvas/commands";
import { navigateCamera } from "#/experiments/infinite-canvas/camera-navigation";
import {
  panCameraByScreenDelta,
  zoomCameraAtScreenPoint,
} from "#/experiments/infinite-canvas/geometry";
import {
  beginCanvasPan,
  beginMarqueeSelection,
  beginWindowMove,
  beginWindowResize,
  finishCanvasInteraction,
  stepCanvasInteraction,
} from "#/experiments/infinite-canvas/interaction";
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
} from "#/experiments/infinite-canvas/selection";
import {
  closeWindow,
  focusWindow,
  maximizeWindow,
  minimizeWindow,
  openWindow,
  restoreWindow,
  toggleWindowPinned,
} from "#/experiments/infinite-canvas/stacking";
import { resetInfiniteCanvasState } from "#/experiments/infinite-canvas/state";
import type {
  InfiniteCanvasAction,
  InfiniteCanvasState,
  InfiniteCanvasZoomPolicy,
} from "#/experiments/infinite-canvas/types";

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
    case "interaction.startMove":
      return beginWindowMove(state, action.pointerId, action.windowId, action.point);
    case "interaction.startPan":
      return beginCanvasPan(state, action.pointerId, action.point, action.clearSelection);
    case "interaction.startResize":
      return beginWindowResize(
        state,
        action.pointerId,
        action.windowId,
        action.handle,
        action.point,
      );
    case "interaction.step":
      return stepCanvasInteraction(state, action.pointerId, action.point, action.snapPolicy);
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
    case "window.close":
      return closeWindow(state, action.windowId);
    case "window.focus":
      return focusWindow(state, action.windowId);
    case "window.maximize":
      return maximizeWindow(state, action.windowId);
    case "window.minimize":
      return minimizeWindow(state, action.windowId);
    case "window.open":
      return openWindow(state, action.window);
    case "window.restore":
      return restoreWindow(state, action.windowId);
    case "window.togglePinned":
      return toggleWindowPinned(state, action.windowId);
  }
}

export { reduceInfiniteCanvasState };
