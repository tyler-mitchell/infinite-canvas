import { useInfiniteCanvasSelector } from "@hyphened/infinite-canvas/legacy";
import { useValue } from "@legendapp/state/react";
import { tv } from "ui/tv";

import { projectContent$ } from "../content/project-content";
import { FLOATING_SURFACE } from "../material";

const emptyProject = tv({
  slots: {
    action:
      "rounded-[var(--radius-sm)] border border-[var(--line-strong)] bg-[var(--surface-raised)] px-3 py-1.5 font-mono text-[12px] text-[var(--ink)] transition-colors duration-100 ease-[var(--ease-swift)] hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:border-[var(--accent)] focus-visible:outline-none",
    card: `pointer-events-auto flex max-w-[19rem] flex-col items-center gap-3 rounded-[var(--radius-lg)] ${FLOATING_SURFACE} px-6 py-5 text-center`,
    line: "text-[12px] leading-[1.5] text-[var(--ink-faint)]",
    /* The layer spans the viewport and lets pointer gestures through to the canvas. */
    root: "pointer-events-none absolute inset-0 grid place-items-center",
    title: "font-mono text-[13px] text-[var(--ink-muted)]",
  },
});

/**
 * What the canvas says when the project holds nothing.
 *
 * Keyed on the project being empty rather than on the canvas being empty. Closing every window is
 * a normal thing to do and leaves a canvas with no windows; showing an invitation then would tell
 * somebody with fifty notes that they have nothing. This appears only before the first item exists.
 *
 * Nothing renders while the listing is still null, so a slow read does not flash "empty" at a
 * project that is full.
 */
export function EmptyProjectInvitation({
  onCreate,
  projectId,
}: Readonly<{ onCreate: () => void; projectId: string }>) {
  const insets = useInfiniteCanvasSelector((state) => state.viewportInsets);
  const listing = useValue(projectContent$[projectId]);
  const styles = emptyProject();

  if (listing == null || listing.items.length > 0) {
    return null;
  }

  return (
    <div
      className={styles.root()}
      /* Centred in the space the rail and the bars leave, not in the window. */
      style={{
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
        paddingTop: insets.top,
      }}
    >
      <div className={styles.card()}>
        <span className={styles.title()}>This project is empty</span>
        <span className={styles.line()}>
          Start with a note. Drag a line between two notes to connect them.
        </span>
        <button className={styles.action()} onClick={onCreate} type="button">
          New note
        </button>
      </div>
    </div>
  );
}
