import { observable, ObservableHint, type OpaqueObject } from "@legendapp/state";

// Keep one pending action. Each action owns its inverse.
type UndoableAction = Readonly<{
  /** Text for the command palette row. */
  describe: string;
  undo: () => Promise<void>;
}>;

const undoableAction$ = observable<OpaqueObject<UndoableAction> | null>(null);

const rememberUndoableAction = (action: UndoableAction) => {
  undoableAction$.set(ObservableHint.opaque({ ...action }));
};

// Hide the action while its inverse runs.
const undoLastAction = async () => {
  const action = undoableAction$.peek();

  if (action === null) {
    return;
  }

  undoableAction$.set(null);
  try {
    await action.undo();
  } catch (error) {
    if (undoableAction$.peek() === null) rememberUndoableAction(action);
    console.warn("Could not undo action", { description: action.describe, error });
    throw error;
  }
};

export { rememberUndoableAction, undoableAction$, undoLastAction };
export type { UndoableAction };
