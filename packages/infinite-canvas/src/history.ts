import { unionRects } from "./geometry";
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

      return isSameRect(left, right) ? [] : [left, right];
    }),
  );
}

function isSameRect(left: InfiniteCanvasRect, right: InfiniteCanvasRect): boolean {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
}

function undoInfiniteCanvasHistory<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): InfiniteCanvasState<Kind> {
  const previous = state.history.past.at(-1);

  if (previous === undefined) {
    return state;
  }

  return applyInfiniteCanvasDocument(state, previous, {
    future: [getInfiniteCanvasDocument(state), ...state.history.future],
    past: state.history.past.slice(0, -1),
  });
}

function redoInfiniteCanvasHistory<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): InfiniteCanvasState<Kind> {
  const [next, ...future] = state.history.future;

  if (next === undefined) {
    return state;
  }

  return applyInfiniteCanvasDocument(state, next, {
    future,
    past: [...state.history.past, getInfiniteCanvasDocument(state)],
  });
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
