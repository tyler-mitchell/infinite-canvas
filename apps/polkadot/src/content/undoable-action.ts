import { observable } from "@legendapp/state";

// Keep one pending action. Each action owns its inverse.
type UndoableAction = Readonly<{
  /** Text for the command palette row. */
  describe: string;
  undo: () => Promise<void>;
}>;

const undoableAction$ = observable<UndoableAction | null>(null);

const rememberUndoableAction = (action: UndoableAction) => {
  undoableAction$.set(action);
};

// Clear the action before the write to prevent a second undo.
const undoLastAction = async () => {
  const undo = undoableAction$.peek()?.undo;

  if (undo === undefined) {
    return;
  }

  undoableAction$.set(null);
  await undo();
};

export { rememberUndoableAction, undoableAction$, undoLastAction };
export type { UndoableAction };
