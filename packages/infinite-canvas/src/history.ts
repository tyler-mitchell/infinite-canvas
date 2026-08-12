import { normalizeSelection } from "./selection";
import type {
  InfiniteCanvasAction,
  InfiniteCanvasDocument,
  InfiniteCanvasHistory,
  InfiniteCanvasState,
} from "./types";

/**
 * Undo/redo over the *document* — the windows and the groups. Everything else in
 * `InfiniteCanvasState` is a view onto it: where the camera is looking, what is
 * selected, which pointer is dragging. Panning is not an edit, and undo should
 * never scroll the canvas out from under someone who just wanted their window
 * back.
 *
 * History lives in state rather than beside it in the store, because undo has to
 * be a command like every other mutation. That is the framework's central bet —
 * pointer, keyboard, and programmatic drivers compile to one vocabulary — and a
 * stack hidden in the store could not be gated by `isInfiniteCanvasCommandEnabled`
 * or replayed by anything that speaks actions.
 *
 * A drag is one entry, not one per frame. `interaction.step` never records;
 * instead the checkpoint is taken when a mutating drag *begins*, capturing the
 * document as it stood before the first pixel moved.
 */

/** Undo restores this and nothing else. */
const INFINITE_CANVAS_HISTORY_LIMIT = 100;

/**
 * Typed at `never`, not at the `string` default. An empty stack holds documents of
 * no window kind, so it assigns into `InfiniteCanvasHistory<Kind>` for every
 * `Kind` — readonly arrays are covariant. Typed at `string` it would only fit a
 * canvas whose windows had no narrower kind, which is none of them.
 */
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

/**
 * Reference equality is the whole test. Every reducer in this framework returns
 * the identical array when it changed nothing, so two documents share references
 * exactly when no edit happened.
 */
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

/** Oldest entries fall off the back; an unbounded stack is a memory leak with a nice name. */
function pushInfiniteCanvasHistory<Kind extends string>(
  history: InfiniteCanvasHistory<Kind>,
  document: InfiniteCanvasDocument<Kind>,
): InfiniteCanvasHistory<Kind> {
  const past = [...history.past, document];

  return {
    // Any new edit orphans the redo branch. Keeping it would let a redo resurrect
    // a document that never followed from what the user is now looking at.
    future: [],
    past: past.length > INFINITE_CANVAS_HISTORY_LIMIT ? past.slice(1) : past,
  };
}

/**
 * Restore a document, then repair everything that pointed into the old one. A
 * window the undo brought back may not be selected; one it removed must not be.
 */
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
    // An interaction cannot survive the document it was manipulating.
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

/** Drags that move something. A pan or a marquee edits the view, not the document. */
const MUTATING_INTERACTION_KINDS = new Set([
  "groupGutter",
  "groupMove",
  "groupResize",
  "move",
  "resize",
]);

/**
 * Whether an action should leave a checkpoint behind, given what it produced.
 *
 * The subtle case is a drag. `interaction.step` fires once per pointer event and
 * must never record, or a single drag would bury the stack. Instead the whole
 * drag is checkpointed at its *start*, before the first pixel moves — which also
 * means a drag that is cancelled mid-flight still has somewhere to return to.
 *
 * A drag start is recorded even when the document did not change, because the
 * mutation is about to happen. Everything else is recorded only if it actually
 * changed something: focusing a window, panning, and selecting are not edits.
 */
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
  isInfiniteCanvasHistoryCheckpoint,
  isSameInfiniteCanvasDocument,
  pushInfiniteCanvasHistory,
  redoInfiniteCanvasHistory,
  undoInfiniteCanvasHistory,
};
