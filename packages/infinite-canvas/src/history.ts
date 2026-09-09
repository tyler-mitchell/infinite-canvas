import { getCameraNavigationFrame } from "./camera-navigation";
import { getVisibleWorldRect, rectsEqual, unionRects } from "./geometry";
import { normalizeSelection } from "./selection";
import type {
  InfiniteCanvasAction,
  InfiniteCanvasDocument,
  InfiniteCanvasHistory,
  InfiniteCanvasRect,
  InfiniteCanvasState,
} from "./types";

/** Stores document undo and redo. A drag creates one checkpoint at its start. */

const INFINITE_CANVAS_HISTORY_LIMIT = 100;

/** `never` lets this empty history assign to every window-kind history. */
const EMPTY_INFINITE_CANVAS_HISTORY: InfiniteCanvasHistory<never> = {
  future: [],
  past: [],
};

function getInfiniteCanvasDocument<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): InfiniteCanvasDocument<Kind> {
  return {
    activeWorkspaceId: state.activeWorkspaceId,
    connections: state.connections,
    groups: state.groups,
    windows: state.windows,
    workspaces: state.workspaces,
  };
}

/** Compares documents by shared window and group references. */
function isSameInfiniteCanvasDocument<Kind extends string>(
  left: InfiniteCanvasDocument<Kind>,
  right: InfiniteCanvasDocument<Kind>,
): boolean {
  return (
    left.windows === right.windows &&
    left.groups === right.groups &&
    left.workspaces === right.workspaces &&
    left.connections === right.connections &&
    left.activeWorkspaceId === right.activeWorkspaceId
  );
}

/** Discards oldest entries when the history limit is reached. */
function pushInfiniteCanvasHistory<Kind extends string>(
  history: InfiniteCanvasHistory<Kind>,
  document: InfiniteCanvasDocument<Kind>,
): InfiniteCanvasHistory<Kind> {
  const past = [...history.past, document];

  return {
    // A new edit clears the redo branch.
    future: [],
    past: past.length > INFINITE_CANVAS_HISTORY_LIMIT ? past.slice(1) : past,
  };
}

/** Restores document fields and repairs dependent runtime state. */
function applyInfiniteCanvasDocument<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  document: InfiniteCanvasDocument<Kind>,
  history: InfiniteCanvasHistory<Kind>,
): InfiniteCanvasState<Kind> {
  const restored = {
    ...state,
    activeWorkspaceId: document.activeWorkspaceId,
    connections: document.connections,
    groups: document.groups,
    workspaces: document.workspaces,
    history,
    interaction: null,
    snapPreview: null,
    windows: document.windows,
  } satisfies InfiniteCanvasState<Kind>;
  const selection = normalizeSelection(restored, restored.selection);
  const isActiveWindowPresent = document.windows.some(
    (window) => window.id === state.activeWindowId && window.mode !== "minimized",
  );

  return {
    ...restored,
    activeWindowId: isActiveWindowPresent
      ? state.activeWindowId
      : (selection.anchorWindowId ?? null),
    selection,
  };
}

/** Every placed thing a document holds, keyed so two documents can be compared by id. */
function getDocumentRects<Kind extends string>(
  document: InfiniteCanvasDocument<Kind>,
): ReadonlyMap<string, InfiniteCanvasRect> {
  return new Map([
    ...document.windows.map((window) => [window.id, window.rect] as const),
    ...document.groups.map((group) => [group.id, group.rect] as const),
  ]);
}

/**
 * The world region that differs between two documents, or null when nothing placed moved.
 *
 * Undo on a canvas has a failure a linear editor does not: the reverted change can be off screen,
 * so a person presses undo, sees nothing move, and presses it again. Answering "where" needs the
 * changed region, and this derives it rather than storing it.
 *
 * Deriving beats recording. A rectangle attached to each history entry would have to be set by
 * every command that edits the document, and the one command that forgets produces an undo that
 * silently navigates nowhere. Both documents are already in hand at the moment of the question.
 *
 * A moved thing contributes both rectangles, so the frame covers where it left as well as where it
 * arrived. Something added or removed contributes the one rectangle it has.
 */
function getInfiniteCanvasDocumentChangeRect<Kind extends string>(
  before: InfiniteCanvasDocument<Kind>,
  after: InfiniteCanvasDocument<Kind>,
): InfiniteCanvasRect | null {
  const from = getDocumentRects(before);
  const to = getDocumentRects(after);

  return unionRects(
    [...new Set([...from.keys(), ...to.keys()])].flatMap((id) => {
      const left = from.get(id);
      const right = to.get(id);

      if (left === undefined || right === undefined) {
        return left === undefined ? (right === undefined ? [] : [right]) : [left];
      }

      return rectsEqual(left, right) ? [] : [left, right];
    }),
  );
}

/**
 * How much of the viewport edge counts as "not really visible".
 *
 * A change touching the very edge of the screen is technically on it and still easy to miss, so the
 * camera moves for anything nearer the border than this.
 */
const CHANGE_REVEAL_MARGIN = 80;

/**
 * Whether the whole region sits inside the visible world, with room to spare.
 *
 * Containment, not intersection. `isWorldRectWithinViewport` is the culling predicate and answers
 * "is any of this on screen", which is the wrong question here: a window moved far away produces a
 * region spanning both positions, that region always overlaps the current view, and an
 * intersection test therefore reports every long move as already visible and never moves the
 * camera. The test caught exactly that.
 */
function isRectFullyVisible(
  camera: InfiniteCanvasState<string>["camera"],
  viewport: InfiniteCanvasState<string>["viewport"],
  rect: InfiniteCanvasRect,
): boolean {
  const visible = getVisibleWorldRect(camera, viewport);

  return (
    rect.x - CHANGE_REVEAL_MARGIN >= visible.x &&
    rect.y - CHANGE_REVEAL_MARGIN >= visible.y &&
    rect.x + rect.width + CHANGE_REVEAL_MARGIN <= visible.x + visible.width &&
    rect.y + rect.height + CHANGE_REVEAL_MARGIN <= visible.y + visible.height
  );
}

/**
 * Moves the camera to the reverted change, unless it is already comfortably in view.
 *
 * This is the point of undo on a canvas: the change can be anywhere, so a person presses undo, sees
 * nothing move, and presses it again. Two edits then vanish with no feedback.
 *
 * The guard matters as much as the move. An unnecessary camera jump is more disruptive than no
 * jump, so a change already on screen leaves the camera exactly where it is — undoing a typo in
 * front of you must not re-frame the view.
 */
function revealChange<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  from: InfiniteCanvasDocument<Kind>,
  to: InfiniteCanvasDocument<Kind>,
): InfiniteCanvasState<Kind> {
  const rect = getInfiniteCanvasDocumentChangeRect(from, to);

  if (rect === null) {
    return state;
  }

  // Marked whether or not the camera moves: "what just happened" is the question either way.
  const revealed = {
    ...state,
    revealedChange: { rect, token: (state.revealedChange?.token ?? 0) + 1 },
  } satisfies InfiniteCanvasState<Kind>;

  if (isRectFullyVisible(state.camera, state.viewport, rect)) {
    return revealed;
  }

  // Never zooms in past 1: framing a small change should not magnify it.
  const camera = getCameraNavigationFrame(state, rect, {
    maxZoom: 1,
    paddingPx: 96,
    type: "fit",
  });

  return camera === null ? revealed : { ...revealed, camera };
}

function undoInfiniteCanvasHistory<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): InfiniteCanvasState<Kind> {
  const previous = state.history.past.at(-1);

  if (previous === undefined) {
    return state;
  }

  const current = getInfiniteCanvasDocument(state);

  return revealChange(
    applyInfiniteCanvasDocument(state, previous, {
      future: [current, ...state.history.future],
      past: state.history.past.slice(0, -1),
    }),
    current,
    previous,
  );
}

function redoInfiniteCanvasHistory<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): InfiniteCanvasState<Kind> {
  const [next, ...future] = state.history.future;

  if (next === undefined) {
    return state;
  }

  const current = getInfiniteCanvasDocument(state);

  // Redo has the same problem and the same answer, from one derived region.
  return revealChange(
    applyInfiniteCanvasDocument(state, next, { future, past: [...state.history.past, current] }),
    current,
    next,
  );
}

function canUndoInfiniteCanvas<Kind extends string>(state: InfiniteCanvasState<Kind>): boolean {
  return state.history.past.length > 0;
}

function canRedoInfiniteCanvas<Kind extends string>(state: InfiniteCanvasState<Kind>): boolean {
  return state.history.future.length > 0;
}

/** Drag kinds that edit the document. */
const MUTATING_INTERACTION_KINDS = new Set([
  "groupGutter",
  "groupMove",
  "groupResize",
  "move",
  "resize",
]);

/** Records one checkpoint at drag start. Other edits record after a document change. */
function isInfiniteCanvasHistoryCheckpoint<Kind extends string>(
  action: InfiniteCanvasAction<Kind>,
  previousState: InfiniteCanvasState<Kind>,
  nextState: InfiniteCanvasState<Kind>,
): boolean {
  const isMutatingDragStart =
    previousState.interaction === null &&
    nextState.interaction !== null &&
    MUTATING_INTERACTION_KINDS.has(nextState.interaction.kind);

  if (isMutatingDragStart) {
    return true;
  }

  if (action.type === "interaction.step" || action.type === "interaction.finish") {
    return false;
  }

  if (action.type === "command.execute" && isInfiniteCanvasHistoryCommand(action.command.type)) {
    return false;
  }

  return !isSameInfiniteCanvasDocument(
    getInfiniteCanvasDocument(previousState),
    getInfiniteCanvasDocument(nextState),
  );
}

function isInfiniteCanvasHistoryCommand(commandType: string): boolean {
  return commandType === "history.redo" || commandType === "history.undo";
}

export {
  EMPTY_INFINITE_CANVAS_HISTORY,
  INFINITE_CANVAS_HISTORY_LIMIT,
  canRedoInfiniteCanvas,
  canUndoInfiniteCanvas,
  getInfiniteCanvasDocument,
  getInfiniteCanvasDocumentChangeRect,
  isInfiniteCanvasHistoryCheckpoint,
  isSameInfiniteCanvasDocument,
  pushInfiniteCanvasHistory,
  redoInfiniteCanvasHistory,
  undoInfiniteCanvasHistory,
};
