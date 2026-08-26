import { useInfiniteCanvasActions, useInfiniteCanvasSelector } from "@hyphened/infinite-canvas";
import { LayoutGrid, X } from "lucide-react";
import { tv } from "ui/tv";

/**
 * Which desktop you are on, and the way off it.
 *
 * A desktop is a membership filter, so entering an empty one shows an empty canvas — which looks
 * exactly like losing your work. This was alarming the first time it happened during testing, with
 * the windows sitting safely in the layout the whole time. The count is the part that matters:
 * "empty" explains the blank canvas, and clicking leaves.
 *
 * It lives in the identity rail because it answers "where am I", which is what that rail is for —
 * project, then canvas, then desktop.
 */

const indicator = tv({
  slots: {
    close: "size-3 opacity-60 transition-opacity duration-150 group-hover/desktop:opacity-100",
    count: "text-[var(--ink-faint)]",
    icon: "size-3 text-[var(--accent)]",
    root: "group/desktop flex items-center gap-1.5 rounded-md bg-[var(--accent-wash)] px-1.5 py-0.5 text-[12px] text-[var(--ink)] transition-colors duration-150 ease-[var(--ease-swift)] outline-none hover:bg-[var(--surface-hover)] focus-visible:bg-[var(--surface-hover)]",
  },
});

export function DesktopIndicator() {
  const actions = useInfiniteCanvasActions();
  const activeWorkspaceId = useInfiniteCanvasSelector((state) => state.activeWorkspaceId);
  const workspaces = useInfiniteCanvasSelector((state) => state.workspaces);
  const active = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
  const styles = indicator();

  if (active === undefined) {
    return null;
  }

  return (
    <button
      className={styles.root()}
      onClick={() => {
        actions.executeCommand({ type: "workspace.showAll" });
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      title="Show every window on this canvas"
      type="button"
    >
      <LayoutGrid className={styles.icon()} />
      {active.title}
      <span className={styles.count()}>
        {active.windowIds.length === 0
          ? "empty"
          : `${String(active.windowIds.length)} ${active.windowIds.length === 1 ? "window" : "windows"}`}
      </span>
      <X className={styles.close()} />
    </button>
  );
}
