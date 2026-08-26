import {
  useInfiniteCanvasActions,
  useInfiniteCanvasSelector,
  type InfiniteCanvasWindow,
} from "@hyphened/infinite-canvas";
import { useObservable, useValue } from "@legendapp/state/react";
import { getHotkeyManager } from "@tanstack/hotkeys";
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
import { useEffect, useRef } from "react";
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
  const actions = useInfiniteCanvasActions();
  const activeWorkspaceId = useInfiniteCanvasSelector((state) => state.activeWorkspaceId);
  const workspaces = useInfiniteCanvasSelector((state) => state.workspaces);
  const draftTitle$ = useObservable<string | null>(null);
  const draftTitle = useValue(draftTitle$);
  const inputRef = useRef<HTMLInputElement>(null);
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
  /** The selected windows this desktop does not already hold — what "bring here" would move. */
  const selectedElsewhere =
    active === undefined
      ? []
      : selectedWindowIds.filter((windowId) => !active.windowIds.includes(windowId));

  const commitRename = () => {
    const title = (draftTitle$.peek() ?? "").trim();

    draftTitle$.set(null);

    if (active !== undefined && title.length > 0 && title !== active.title) {
      actions.setWorkspaceTitle({ title, workspaceId: active.id });
    }
  };

  /**
   * Enter and Escape through the hotkey manager, scoped to the field — the same bargain the canvas
   * switcher strikes. `ignoreInputs: false` because the target *is* an input, and the manager owns
   * conflict detection rather than each field deciding for itself.
   */
  useEffect(() => {
    const node = inputRef.current;

    if (node === null) {
      return;
    }

    // Selected on arrival, because renaming a desktop is replacing its name far more often than
    // editing it. `autoFocus` alone leaves the caret at the end, so the first thing typed lands
    // after the old name — "Desktop 1Research". Here rather than in `onFocus`, which React's
    // `autoFocus` beats to the element.
    node.select();

    const manager = getHotkeyManager();
    const handles = [
      manager.register("Enter", commitRename, { ignoreInputs: false, target: node }),
      manager.register(
        "Escape",
        () => {
          draftTitle$.set(null);
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
    // Re-registers when the field appears or disappears, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, draftTitle !== null, draftTitle$]);

  // No desktops means no question to answer. The first one is made from the palette, and a switcher
  // over an empty set is a control that teaches nothing while taking rail space forever.
  if (workspaces.length === 0) {
    return null;
  }

  // Renaming replaces the trigger rather than opening a dialog: the name is already here and
  // already the right size.
  if (draftTitle !== null) {
    return (
      <input
        aria-label="Desktop name"
        autoFocus
        className={styles.input()}
        onBlur={commitRename}
        onChange={(event) => {
          draftTitle$.set(event.target.value);
        }}
        ref={inputRef}
        value={draftTitle}
      />
    );
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
        {active === undefined ? null : (
          <>
            <DropdownMenuSeparator />
            {/*
              Filing a whole selection at once, which until now was one trip through the launcher
              per window: select three notes, enter the desktop you want them on, one click.

              One dispatch, and that is the framework's doing rather than this file's. It used to be
              N — one per window — which cost N undo entries for what the user did as one gesture,
              and left the desktop half-populated at every step in between. Batching it here would
              have restated the framework's own rule about what a single edit is, so it was recorded
              as an ask instead. `workspace.moveWindow` takes `windowIds` now, so the gesture and
              the edit are the same size.
            */}
            {selectedElsewhere.length === 0 ? null : (
              <DropdownMenuItem
                onClick={() => {
                  actions.dispatch({
                    type: "workspace.moveWindow",
                    windowIds: selectedElsewhere,
                    workspaceId: active.id,
                  });
                }}
              >
                <ArrowDownToLine />
                Bring {describeWindowCount(selectedElsewhere.length)} here
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => {
                draftTitle$.set(active.title);
              }}
            >
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
            actions.executeCommand({
              title: `Desktop ${String(workspaces.length + 1)}`,
              type: "workspace.create",
              workspaceId: globalThis.crypto.randomUUID(),
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
