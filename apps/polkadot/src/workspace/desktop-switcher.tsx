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

// This value represents no desktop filter.
const EVERY_WINDOW = "every-window";

const desktopSwitcher = tv({
  slots: {
    count: "ml-auto pl-3 text-[11px] text-[var(--ink-faint)] tabular-nums",
    icon: "size-3 text-[var(--accent)]",
    input:
      "w-40 rounded-md bg-[var(--ground-sunken)] px-1.5 py-0.5 text-[12px] text-[var(--ink)] outline-none inset-ring-1 inset-ring-[var(--accent)]",
    itemTitle: "truncate",
    where: "ml-auto pl-3 text-[11px] text-[var(--ink-faint)]",
    trigger:
      "group/desktop flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[12px] text-[var(--ink)] transition-colors duration-150 ease-[var(--ease-swift)] outline-none hover:bg-[var(--surface-hover)] focus-visible:bg-[var(--surface-hover)] data-popup-open:bg-[var(--surface-hover)]",
  },
  variants: {
    filtered: {
      // The trigger uses accent color while a desktop filter is active.
      false: {},
      true: { trigger: "bg-[var(--accent-wash)]" },
    },
  },
});

function describeWindowCount(count: number) {
  if (count === 0) {
    return "empty";
  }

  return count === 1 ? "1 window" : `${String(count)} windows`;
}

// Limit orientation rows so this menu does not replace the library.
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

  // List visible windows outside the active desktop.
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
  // Omit desktops that already contain every selected window.
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

  if (workspaces.length === 0) {
    return null;
  }

  if (rename.draft !== null) {
    return <input aria-label="Desktop name" className={styles.input()} {...rename.inputProps} />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={styles.trigger()}
        onPointerDown={(event) => {
          // Stop the canvas from starting a marquee.
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
          {/* All windows clears the desktop filter. */}
          <DropdownMenuRadioItem value={EVERY_WINDOW}>
            <Layers />
            <span className={styles.itemTitle()}>All windows</span>
          </DropdownMenuRadioItem>
          {workspaces.map((workspace) => (
            <DropdownMenuRadioItem key={workspace.id} value={workspace.id}>
              <span className={styles.itemTitle()}>{workspace.title}</span>
              {/* Each row shows its window count. */}
              <span className={styles.count()}>
                {describeWindowCount(workspace.windowIds.length)}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {elsewhere.length === 0 ? null : (
          <>
            <DropdownMenuSeparator />
            {/* Base UI requires DropdownMenuLabel inside DropdownMenuGroup. */}
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
              {/* Show the number of hidden rows after the limit. */}
              {elsewhere.length > ELSEWHERE_LIMIT ? (
                <DropdownMenuLabel>
                  and {String(elsewhere.length - ELSEWHERE_LIMIT)} more
                </DropdownMenuLabel>
              ) : null}
            </DropdownMenuGroup>
          </>
        )}
        {/* Move the current selection without entering the target desktop. */}
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
                    // One dispatch creates one undo step for the complete selection.
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
            {/* Buttons avoid pointer conflicts between drag reorder and menu items. */}
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
          // Closing a desktop keeps its windows.
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
