import { useObservable, useValue } from "@legendapp/state/react";
import { getHotkeyManager } from "@tanstack/hotkeys";
import { useCallback, useEffect, useRef } from "react";

/**
 * Rename something in place, by replacing its trigger with a field that already holds its name.
 *
 * Three switchers had this written out separately — canvas, project, desktop — and the copies were
 * identical but for the call that applies the new name. That is not an aesthetic complaint: the
 * same defect shipped in all three because it was copied into all three. An `autoFocus` input
 * seeded with the current name leaves the caret at the end, so the first keystroke appends, and a
 * desktop renamed twice ended up titled "Desktop 1ResearchResearch" in the database. It was found
 * and fixed for desktops on 2026-08-27; the other two still had it hours later.
 *
 * So the behaviour lives once. What a caller supplies is the name to seed and what to do with the
 * new one; what it keeps is its own label and its own styling, because those genuinely differ.
 *
 * **The commit rules are the part worth reading**, since each was a decision one of the three had
 * made and the others inherited without stating:
 *
 * - Trimmed, and an empty result is a cancel rather than a rename to nothing. Nothing here should
 *   be able to end up nameless by way of a stray keystroke and a blur.
 * - Unchanged is a no-op, so blurring a field you opened and did not edit writes nothing — no
 *   revision bump, no round trip, no undo entry.
 * - Blur commits. Clicking away from a field you have typed into and losing the edit is the
 *   behaviour nobody expects, and it is the one every one of the three already agreed on.
 * - Escape abandons, Enter commits, both through the hotkey manager rather than an `onKeyDown`.
 *   `ignoreInputs: false` because the target *is* the input — that default exists to stop global
 *   chords firing while someone types, which is the opposite of what these two are for. Scoping to
 *   the element means they exist only while the field does, and the manager owns conflict
 *   detection rather than each field deciding for itself.
 */

type InlineRename = Readonly<{
  /** The live draft, or `null` when the field is not showing. Render the input only when non-null. */
  draft: string | null;
  /** Spread onto the `<input>`. The caller still owns `aria-label` and `className`. */
  inputProps: Readonly<{
    autoFocus: true;
    onBlur: () => void;
    onChange: (event: { target: { value: string } }) => void;
    ref: React.RefObject<HTMLInputElement | null>;
    value: string;
  }>;
  /** Open the field, seeded with the current name. A no-op when there is nothing to rename. */
  start: () => void;
}>;

function useInlineRename(
  input: Readonly<{ current: string | undefined; onRename: (title: string) => void }>,
): InlineRename {
  const draft$ = useObservable<string | null>(null);
  const draft = useValue(draft$);
  const inputRef = useRef<HTMLInputElement>(null);
  /*
   * The latest inputs, read at commit time rather than captured.
   *
   * `onRename` is usually an inline closure and `current` changes as the route reloads, so
   * depending on either would re-register the hotkeys mid-edit — and re-registering while a field
   * is focused is how a scoped chord ends up bound to a node that has already gone.
   */
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

    /*
     * Selected on arrival, which is the whole reason this is shared.
     *
     * Renaming is replacing far more often than editing, and `autoFocus` alone leaves the caret at
     * the end so the first thing typed lands after the old name. Here rather than in `onFocus`,
     * which React's `autoFocus` beats to the element.
     */
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
    // Re-registers when the field appears or disappears, never on a keystroke.
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
