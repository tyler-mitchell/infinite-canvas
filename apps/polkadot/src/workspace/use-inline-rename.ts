import { useObservable, useValue } from "@legendapp/state/react";
import { getHotkeyManager } from "@tanstack/hotkeys";
import { useCallback, useEffect, useRef } from "react";

// One hook owns selection and commit rules for all inline rename fields.
type InlineRename = Readonly<{
  /** null hides the field. */
  draft: string | null;
  /** Props for the rename input. */
  inputProps: Readonly<{
    autoFocus: true;
    onBlur: () => void;
    onChange: (event: { target: { value: string } }) => void;
    ref: React.RefObject<HTMLInputElement | null>;
    value: string;
  }>;
  /** Show the field with the current value. */
  start: () => void;
}>;

function useInlineRename(
  input: Readonly<{ current: string | undefined; onRename: (title: string) => void }>,
): InlineRename {
  const draft$ = useObservable<string | null>(null);
  const draft = useValue(draft$);
  const inputRef = useRef<HTMLInputElement>(null);
  // Read current inputs at commit time without re-registering hotkeys.
  const latest = useRef(input);

  latest.current = input;

  const commit = useCallback(() => {
    const next = (draft$.peek() ?? "").trim();

    draft$.set(null);

    const { current, onRename } = latest.current;

    if (next.length > 0 && current !== undefined && next !== current) {
      onRename(next);
    }
  }, [draft$]);

  const isEditing = draft !== null;

  useEffect(() => {
    const node = inputRef.current;

    if (node === null) {
      return;
    }

    // Select the current name when the field appears.
    node.select();

    const manager = getHotkeyManager();
    const handles = [
      manager.register("Enter", commit, { ignoreInputs: false, target: node }),
      manager.register(
        "Escape",
        () => {
          draft$.set(null);
        },
        { ignoreInputs: false, target: node },
      ),
    ];

    return () => {
      for (const handle of handles) {
        if (handle.isActive) {
          handle.unregister();
        }
      }
    };
  }, [commit, draft$, isEditing]);

  return {
    draft,
    inputProps: {
      autoFocus: true,
      onBlur: commit,
      onChange: (event) => {
        draft$.set(event.target.value);
      },
      ref: inputRef,
      value: draft ?? "",
    },
    start: () => {
      if (input.current !== undefined) {
        draft$.set(input.current);
      }
    },
  };
}

export { useInlineRename };
export type { InlineRename };
