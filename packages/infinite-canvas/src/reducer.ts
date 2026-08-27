import { executeInfiniteCanvasCommand } from "./commands";
import { navigateCamera } from "./camera-navigation";
import { isUsableViewport } from "./geometry";
import { findInfiniteCanvasGroupNode, isInfiniteCanvasGroupContainer } from "./group-tree";
import { applyInfiniteCanvasRecipe } from "./recipes";
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
import type { InfiniteCanvasAction, InfiniteCanvasState, InfiniteCanvasZoomPolicy } from "./types";
import { isInfiniteCanvasWindowCapable } from "./window-capabilities";

type InfiniteCanvasReducerOptions = Readonly<{
  zoomPolicy?: InfiniteCanvasZoomPolicy;
}>;

/**
 * The document is checkpointed here, once, around the pure transition — rather
 * than inside forty reducer cases that would each have to remember. A drag is one
 * entry: `interaction.step` never records, and the checkpoint is taken when the
 * drag begins.
 *
 * Hydrating or resetting the desktop discards the stack. Undoing across a
 * document you have never seen is not undo, it is a surprise.
 */
function reduceInfiniteCanvasState<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  action: InfiniteCanvasAction<Kind>,
  options: InfiniteCanvasReducerOptions = {},
): InfiniteCanvasState<Kind> {
  const applied = applyInfiniteCanvasAction(state, action, options);
  // Workspace membership is group-complete, and a dozen actions move a window between trees
  // without touching membership — docking, undocking, applying a recipe. Reconciling here,
  // once, is the same choice the history checkpoint makes: the alternative is forty cases
  // that each have to remember. Guarded on reference equality so an untouched canvas pays
  // nothing.
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
    /**
     * Hydration replaces the document but never the measurement.
     *
     * `viewport` is the one field that is measured from the DOM rather than authored, which is
     * why `serializeInfiniteCanvasState` deliberately omits it — restoring a viewport would
     * hydrate a canvas sized for someone else's monitor. The consequence was that hydrating
     * *adopted* the incoming document's viewport, which for a parsed document is the fallback's,
     * and that is `0 x 0`.
     *
     * A canvas in that state is not subtly wrong. World origin projects to screen origin instead
     * of the viewport centre, so content lands off the top-left corner; `isUsableViewport` is
     * false, so culling, `view.fitAll`, `view.fitSelection`, and viewport snapping are all inert.
     * And it does not recover: the resize observer already fired at the real size, so it has no
     * reason to fire again.
     *
     * Keeping the live measurement is therefore not a special case — it is the same rule
     * persistence already follows, applied on the way back in.
     */
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
    case "interaction.startGroupResize": {
      const group = findInfiniteCanvasGroup(state, action.groupId);

      // A shell that closed under the pointer is not worth throwing over.
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
    // A grouped pane is resized by its seam, not its edge; a window that declares itself
    // unresizable is not resized at all. Both refusals live here rather than inside
    // `beginWindowResize` because the grouped one already did.
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
    // Re-project after every step. A group-move drags several windows at once, and
    // a selection can mix grouped and floating windows; rather than teaching the
    // interaction layer which is which, the projection simply wins. It is a no-op
    // when there are no groups.
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
    // Re-solve immediately: every member's rect was placed against the old sizes, so a strip
    // that grows without this draws over the pane beneath it until the next unrelated edit.
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
    // A window that is gone, or collapsed into the dock, cannot keep occupying a
    // layout slot. Detaching after the fact keeps `stacking` group-blind.
    case "window.setTitle":
      return renameWindow(state, action);
    case "window.close":
      return detachInfiniteCanvasWindowFromWorkspaces(
        detachInfiniteCanvasWindowFromGroups(closeWindow(state, action.windowId), action.windowId),
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
    /**
     * A window opened while a desktop is active joins that desktop.
     *
     * Without this it joins none, and a workspace is a membership filter — so the window layer
     * drops it on the very frame it was created and the user sees nothing happen. Every other
     * path into `workspaces` removes ids (`detach`, `reconcile`) or moves them deliberately;
     * nothing added one, so the only way a new window could ever become visible again was to
     * leave the desktop entirely.
     *
     * "Where it was made" is the only defensible answer. The alternative — belonging to no
     * desktop and appearing only under "show all" — makes creating a window a silent no-op in
     * the one view the user is looking at.
     *
     * `addInfiniteCanvasWindowToWorkspace` is a no-op when no workspace is active, so a canvas
     * that never creates one is untouched, and it refuses ids that are not live windows, which
     * is why the open has to happen first.
     */
    case "window.open":
      return state.activeWorkspaceId === null
        ? openWindow(state, action.window)
        : addInfiniteCanvasWindowToWorkspace(openWindow(state, action.window), {
            windowId: action.window.id,
            workspaceId: state.activeWorkspaceId,
          });
    case "window.restore":
      return restoreWindow(state, action.windowId);
    case "window.togglePinned":
      return toggleWindowPinned(state, action.windowId);
    default:
      return assertUnknownInfiniteCanvasAction(action);
  }
}

/**
 * An action type the reducer does not know, said out loud.
 *
 * The switch above is exhaustive over `InfiniteCanvasAction`, and TypeScript enforces that: adding
 * a case to the union without handling it here stops compiling. Taking `never` keeps that exactly —
 * a new unhandled action is not assignable and fails the build the same way it always did.
 *
 * What was missing was the runtime half. Type exhaustiveness is a compile-time promise, and the
 * actions that break it arrive at runtime: replayed from a document written by another version,
 * sent by a consumer that is not using TypeScript, or typed into a console. Any of those fell out
 * of the switch and returned `undefined`, and the caller then read `.groups` off it — so the
 * message a developer got was "Cannot read properties of undefined (reading 'groups')", naming a
 * field with nothing to do with what went wrong, three layers below where it did.
 *
 * This throws rather than returning `state` unchanged, and the choice is narrower than it looks:
 * the previous behaviour already crashed. The only question was whether the crash names the cause.
 * A silent no-op would be a third thing — a mistyped command doing nothing with no signal at all —
 * which is worst of all for the console and agent callers this exists to serve.
 */
function assertUnknownInfiniteCanvasAction(action: never): never {
  throw new Error(
    `Unknown infinite canvas action type: ${String((action as { type?: unknown }).type)}`,
  );
}

export { reduceInfiniteCanvasState };
