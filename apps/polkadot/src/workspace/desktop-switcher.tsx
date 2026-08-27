import {
  useInfiniteCanvasActions,
  useInfiniteCanvasSelector,
  type InfiniteCanvasWindow,
} from "@hyphened/infinite-canvas";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  CornerUpRight,
  Layers,
  LayoutGrid,
  PencilLine,
  Plus,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "ui";
import { tv } from "ui/tv";

import type { WindowKind } from "../canvas/window-registry";
import { createDesktop } from "./create-desktop";
import { useInlineRename } from "./use-inline-rename";

/**
 * Which desktop you are on, and every way of changing that.
 *
 * The rail reads project ▸ canvas ▸ desktop, and the first two are switchers whose name *is* the
 * control. This is the third, built the same way, because a user who has learned that clicking the
 * canvas name reaches the other canvases has already learned this.
 *
 * It replaces a pill that only ever said where you were. That pill returned `null` whenever no
 * desktop was active, which is the state you are in most often and the one where the question
 * "what else is there" actually gets asked — so the app hid the answer exactly when it mattered.
 * Showing every window is a row here rather than the whole click target.
 *
 * Every verb is the framework's: `workspace.enter`, `workspace.showAll`, `workspace.create` and
 * `workspace.close` through the command layer, and `setWorkspaceTitle` and `reorderWorkspace`
 * through actions, since a title and a destination index are things only the user knows and so have
 * no state-resolved command form. Nothing about a desktop is modelled here.
 */

/** The radio value standing for "no desktop filter", which `activeWorkspaceId: null` means. */
const EVERY_WINDOW = "every-window";

const desktopSwitcher = tv({
  slots: {
    count: "ml-auto pl-3 text-[11px] text-[var(--ink-faint)] tabular-nums",
    icon: "size-3 text-[var(--accent)]",
    input:
      "w-40 rounded-md bg-[var(--ground-sunken)] px-1.5 py-0.5 text-[12px] text-[var(--ink)] outline-none inset-ring-1 inset-ring-[var(--accent)]",
    itemTitle: "truncate",
    /** Where a window lives, when the point of the row is that it does not live here. */
    where: "ml-auto pl-3 text-[11px] text-[var(--ink-faint)]",
    trigger:
      "group/desktop flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[12px] text-[var(--ink)] transition-colors duration-150 ease-[var(--ease-swift)] outline-none hover:bg-[var(--surface-hover)] focus-visible:bg-[var(--surface-hover)] data-popup-open:bg-[var(--surface-hover)]",
  },
  variants: {
    filtered: {
      // A desktop filter is a state you can forget you are in — an empty canvas looks identical to
      // lost work — so the trigger carries the accent while one is on and is plain while it is not.
      false: {},
      true: { trigger: "bg-[var(--accent-wash)]" },
    },
  },
});

/** How full a desktop is, in the words that make an empty one read as a filter rather than a loss. */
function describeWindowCount(count: number) {
  if (count === 0) {
    return "empty";
  }

  return count === 1 ? "1 window" : `${String(count)} windows`;
}

/**
 * How many of the elsewhere list to show before it stops being orientation and starts being a list.
 *
 * The library rail is where you go to see everything. This is here to answer "where did the rest of
 * my canvas go", and the honest answer to that on a large canvas is a number, not eighty rows.
 */
const ELSEWHERE_LIMIT = 6;

export function DesktopSwitcher() {
  const actions = useInfiniteCanvasActions<WindowKind>();
  const activeWorkspaceId = useInfiniteCanvasSelector((state) => state.activeWorkspaceId);
  const workspaces = useInfiniteCanvasSelector((state) => state.workspaces);
  const windows = useInfiniteCanvasSelector<
    WindowKind,
    readonly InfiniteCanvasWindow<WindowKind>[]
  >((state) => state.windows);
  const selectedWindowIds = useInfiniteCanvasSelector<WindowKind, readonly string[]>(
    (state) => state.selection.windowIds,
  );
  const activeIndex = workspaces.findIndex((workspace) => workspace.id === activeWorkspaceId);
  const active = workspaces[activeIndex];
  const styles = desktopSwitcher({ filtered: active !== undefined });

  /**
   * What entering this desktop took off the screen, and where each piece went.
   *
   * The gap this closes: a desktop is a membership filter, so standing on one hides every window
   * that is not in it and says nothing about them. Creating a desktop hides *everything*, because a
   * new one starts empty — the canvas goes blank and the only honest reading available to the user
   * was "my work is gone". The counts on the rows above say how much is elsewhere; this says what,
   * and clicking a row is `window.reveal`, which is desktop-aware and goes there.
   *
   * A window filed on no desktop is in this list too, and that is not an edge case: it is every
   * window on the canvas the moment the first desktop is made.
   */
  const desktopByWindowId = new Map(
    workspaces.flatMap((workspace) =>
      workspace.windowIds.map((windowId) => [windowId, workspace.title] as const),
    ),
  );
  const elsewhere =
    active === undefined
      ? []
      : windows
          .filter((window) => window.mode !== "minimized" && !active.windowIds.includes(window.id))
          .map((window) => ({
            id: window.id,
            title: window.title,
            where: desktopByWindowId.get(window.id) ?? "no desktop",
          }));
  /**
   * The desktops a selection could still be filed onto.
   *
   * A desktop already holding every selected window is left out: moving them there is a no-op that
   * returns the identical state, so the row would be one that does nothing — the same reason the
   * connector palette leaves out the kind an edge already carries.
   */
  const filingTargets =
    selectedWindowIds.length === 0
      ? []
      : workspaces.filter((workspace) =>
          selectedWindowIds.some((windowId) => !workspace.windowIds.includes(windowId)),
        );

  const rename = useInlineRename({
    current: active?.title,
    onRename: (title) => {
      if (active !== undefined) {
        actions.setWorkspaceTitle({ title, workspaceId: active.id });
      }
    },
  });

  // No desktops means no question to answer. The first one is made from the palette, and a switcher
  // over an empty set is a control that teaches nothing while taking rail space forever.
  if (workspaces.length === 0) {
    return null;
  }

  // Renaming replaces the trigger rather than opening a dialog: the name is already here and
  // already the right size.
  if (rename.draft !== null) {
    return <input aria-label="Desktop name" className={styles.input()} {...rename.inputProps} />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={styles.trigger()}
        onPointerDown={(event) => {
          // Without this the press also reaches the canvas root and starts a marquee underneath.
          event.stopPropagation();
        }}
      >
        <LayoutGrid className={styles.icon()} />
        {active?.title ?? "All windows"}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuRadioGroup
          onValueChange={(value) => {
            if (value === EVERY_WINDOW) {
              actions.executeCommand({ type: "workspace.showAll" });
            } else {
              actions.executeCommand({ type: "workspace.enter", workspaceId: value });
            }
          }}
          value={activeWorkspaceId ?? EVERY_WINDOW}
        >
          <DropdownMenuLabel>Desktops</DropdownMenuLabel>
          {/* First, because it is the way out of a filter and the state you spend most time in. */}
          <DropdownMenuRadioItem value={EVERY_WINDOW}>
            <Layers />
            <span className={styles.itemTitle()}>All windows</span>
          </DropdownMenuRadioItem>
          {workspaces.map((workspace) => (
            <DropdownMenuRadioItem key={workspace.id} value={workspace.id}>
              <span className={styles.itemTitle()}>{workspace.title}</span>
              {/* The count on every row, not just the one you are on: it is what tells you which
                  desktop is worth entering before you enter it. */}
              <span className={styles.count()}>
                {describeWindowCount(workspace.windowIds.length)}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {elsewhere.length === 0 ? null : (
          <>
            <DropdownMenuSeparator />
            {/*
              Grouped because `DropdownMenuLabel` is Base UI's *group* label and reads
              `MenuGroupContext`: outside a group it throws, and the throw takes the canvas down to
              an error page rather than logging a warning. The label above is inside the radio group
              and was always safe; these two never were. This file's roadmap entry records that this
              section and the one below it were "typechecked and read, not driven" — this is what
              was waiting in them, and it fires the first time any window is on another desktop.
            */}
            <DropdownMenuGroup>
              <DropdownMenuLabel>Not on this desktop</DropdownMenuLabel>
              {elsewhere.slice(0, ELSEWHERE_LIMIT).map((window) => (
                <DropdownMenuItem
                  key={window.id}
                  onClick={() => {
                    actions.executeCommand({ type: "window.reveal", windowId: window.id });
                  }}
                >
                  <CornerUpRight />
                  <span className={styles.itemTitle()}>{window.title}</span>
                  <span className={styles.where()}>{window.where}</span>
                </DropdownMenuItem>
              ))}
              {/* A silent cap reads as "that is everything" when it is not. */}
              {elsewhere.length > ELSEWHERE_LIMIT ? (
                <DropdownMenuLabel>
                  and {String(elsewhere.length - ELSEWHERE_LIMIT)} more
                </DropdownMenuLabel>
              ) : null}
            </DropdownMenuGroup>
          </>
        )}
        {/*
          Filing a selection onto a desktop, from wherever you are standing.

          This used to read "Bring N windows here" and only appeared while a desktop was active,
          which made it unreachable by the gesture its own comment described — "select three notes,
          enter the desktop you want them on, one click". Entering a desktop **clears the
          selection**: `activateInfiniteCanvasWorkspace` normalizes the incoming selection against
          the workspace being entered, because a selected window the filter hides would arm every
          verb keyed to the active window against something nobody can see. That is the right rule,
          so the row was wrong — by the time you arrived there was nothing selected to bring. Driven
          before it was replaced: select two, enter, and the count goes 2 → 0.
          So the move happens *without* entering. You are most likely to be on "All windows" when
          you gather things anyway, which is the one place the old row could never appear. Each
          desktop that does not already hold the whole selection is offered; one that does is a row
          that would do nothing, which this file refuses elsewhere for the same reason.
        */}
        {filingTargets.length === 0 ? null : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                Move {describeWindowCount(selectedWindowIds.length)} to
              </DropdownMenuLabel>
              {filingTargets.map((workspace) => (
                <DropdownMenuItem
                  key={workspace.id}
                  onClick={() => {
                    // One dispatch for one gesture. `workspace.moveWindow` takes the set, so this
                    // is a single edit and a single undo rather than one per window.
                    actions.dispatch({
                      type: "workspace.moveWindows",
                      windowIds: selectedWindowIds,
                      workspaceId: workspace.id,
                    });
                  }}
                >
                  <ArrowDownToLine />
                  <span className={styles.itemTitle()}>{workspace.title}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        )}
        {active === undefined ? null : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={rename.start}>
              <PencilLine />
              Rename
            </DropdownMenuItem>
            {/* Two buttons rather than a drag. `motion`'s `Reorder` is available and is what a
                sortable list should use, but it owns the pointer for the whole row, which is the
                one thing a Base UI menu item also insists on — and a desktop list is three items
                long, where "up" and "down" are faster than a drag and work from the keyboard. */}
            <DropdownMenuItem
              disabled={activeIndex === 0}
              onClick={() => {
                actions.reorderWorkspace({ toIndex: activeIndex - 1, workspaceId: active.id });
              }}
            >
              <ArrowUp />
              Move up
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={activeIndex === workspaces.length - 1}
              onClick={() => {
                actions.reorderWorkspace({ toIndex: activeIndex + 1, workspaceId: active.id });
              }}
            >
              <ArrowDown />
              Move down
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            // The verb owns the naming. This is the control that calls it.
            createDesktop({
              actions,
              existingTitles: workspaces.map((workspace) => workspace.title),
            });
          }}
        >
          <Plus />
          New desktop
        </DropdownMenuItem>
        {active === undefined ? null : (
          // Not destructive, and deliberately not marked as such: closing a desktop keeps every
          // window on it. The framework refuses to delete what a membership filter filters.
          <DropdownMenuItem
            onClick={() => {
              actions.executeCommand({ type: "workspace.close", workspaceId: active.id });
            }}
          >
            <X />
            Close this desktop
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
