import { useInfiniteCanvasActions, useInfiniteCanvasSelector } from "@hyphened/infinite-canvas";
import { useObservable, useValue } from "@legendapp/state/react";
import { getHotkeyManager } from "@tanstack/hotkeys";
import { Bookmark, BookmarkPlus, Check, Crosshair, Frame, Trash2 } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "ui";
import { tv } from "ui/tv";

import {
  getCurrentFraming,
  getNextViewTitle,
  getSavedViews,
  loadSavedViews,
  reframeView,
  removeSavedView,
  savedViews$,
  saveView,
  type SavedViewRect,
} from "./saved-views";

const savedViewMenu = tv({
  slots: {
    count: "ml-auto pl-3 text-[11px] text-[var(--ink-faint)] tabular-nums",
    icon: "size-3 text-[var(--accent)]",
    input:
      "w-40 rounded-md bg-[var(--ground-sunken)] px-1.5 py-0.5 text-[12px] text-[var(--ink)] outline-none inset-ring-1 inset-ring-[var(--accent)]",
    itemTitle: "truncate",
    trigger:
      "flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[12px] text-[var(--ink)] transition-colors duration-150 ease-[var(--ease-swift)] outline-none hover:bg-[var(--surface-hover)] focus-visible:bg-[var(--surface-hover)] data-popup-open:bg-[var(--surface-hover)]",
  },
  variants: {
    // One mode prevents simultaneous reframe and remove states.
    mode: {
      browse: {},
      reframe: { trigger: "bg-[var(--accent-wash)]" },
      remove: { trigger: "bg-[var(--accent-wash)]" },
    },
  },
});

type SavedViewMode = "browse" | "reframe" | "remove";

const MODE_PROMPT: Readonly<Record<SavedViewMode, string>> = {
  browse: "Saved views",
  reframe: "Reframe which view?",
  remove: "Remove which view?",
};

const MODE_ICON: Readonly<Record<SavedViewMode, ReactNode>> = {
  browse: <Crosshair />,
  reframe: <Frame />,
  remove: <Trash2 />,
};

export function SavedViewMenu({ canvasId }: Readonly<{ canvasId: string }>) {
  const actions = useInfiniteCanvasActions();
  const camera = useInfiniteCanvasSelector((state) => state.camera);
  const viewport = useInfiniteCanvasSelector((state) => state.viewport);
  const insets = useInfiniteCanvasSelector((state) => state.viewportInsets);
  const listing = useValue(savedViews$);
  // Capture the framing when Save is pressed, before the title is typed.
  const draft$ = useObservable<Readonly<{ rect: SavedViewRect; title: string }> | null>(null);
  const draft = useValue(draft$);
  const mode$ = useObservable<SavedViewMode>("browse");
  const mode = useValue(mode$);
  const inputRef = useRef<HTMLInputElement>(null);
  const views = getSavedViews(listing, canvasId) ?? [];
  const styles = savedViewMenu({ mode });

  useEffect(() => {
    void loadSavedViews(canvasId);
  }, [canvasId]);

  const commitSave = () => {
    const pending = draft$.peek();

    draft$.set(null);

    if (pending === null || pending.title.trim().length === 0) {
      return;
    }

    void saveView({ canvasId, rect: pending.rect, title: pending.title.trim() });
  };

  // Scope Enter and Escape to the title field.
  useEffect(() => {
    const node = inputRef.current;

    if (node === null) {
      return;
    }

    // Select the suggested name when the field appears.
    node.select();

    const manager = getHotkeyManager();
    const handles = [
      manager.register("Enter", commitSave, { ignoreInputs: false, target: node }),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft !== null, draft$]);

  if (draft !== null) {
    return (
      <input
        aria-label="View name"
        autoFocus
        className={styles.input()}
        onBlur={commitSave}
        onChange={(event) => {
          draft$.set({ rect: draft.rect, title: event.target.value });
        }}
        ref={inputRef}
        value={draft.title}
      />
    );
  }

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        // Closing the menu restores browse mode.
        if (!open) {
          mode$.set("browse");
        }
      }}
    >
      <DropdownMenuTrigger
        className={styles.trigger()}
        onPointerDown={(event) => {
          // Stop the canvas from starting a marquee.
          event.stopPropagation();
        }}
      >
        <Bookmark className={styles.icon()} />
        Views
        {views.length === 0 ? null : <span className={styles.count()}>{views.length}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {/* Base UI requires DropdownMenuLabel inside DropdownMenuGroup. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>{MODE_PROMPT[mode]}</DropdownMenuLabel>
          {/* Empty text waits for the list query. */}
          {views.length === 0 ? (
            <DropdownMenuLabel>
              {getSavedViews(listing, canvasId) === null ? "" : "Nothing saved here yet."}
            </DropdownMenuLabel>
          ) : (
            views.map((view) => (
              <DropdownMenuItem
                key={view.id}
                onClick={() => {
                  if (mode === "remove") {
                    void removeSavedView({ canvasId, viewId: view.id });

                    return;
                  }

                  // Reframe with the same rect that a new view stores.
                  if (mode === "reframe") {
                    void reframeView({
                      canvasId,
                      rect: getCurrentFraming({ camera, insets, viewport }),
                      viewId: view.id,
                    });

                    return;
                  }

                  // The stored rect already excludes viewport insets, so fit adds no padding.
                  actions.navigateToRect({
                    behavior: { paddingPx: 0, type: "fit" },
                    rect: view.rect,
                  });
                }}
              >
                {MODE_ICON[mode]}
                <span className={styles.itemTitle()}>{view.title}</span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {mode !== "browse" ? (
          <DropdownMenuItem
            closeOnClick={false}
            onClick={() => {
              mode$.set("browse");
            }}
          >
            <Check />
            Done
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem
              onClick={() => {
                draft$.set({
                  rect: getCurrentFraming({ camera, insets, viewport }),
                  title: getNextViewTitle(views),
                });
              }}
            >
              <BookmarkPlus />
              Save this view
            </DropdownMenuItem>
            {/* A list mode keeps one action per menu row. */}
            {views.length === 0 ? null : (
              <>
                {/* Reframe stays above Remove because it is used more often. */}
                <DropdownMenuItem
                  closeOnClick={false}
                  onClick={() => {
                    mode$.set("reframe");
                  }}
                >
                  <Frame />
                  Reframe a view
                </DropdownMenuItem>
                <DropdownMenuItem
                  closeOnClick={false}
                  onClick={() => {
                    mode$.set("remove");
                  }}
                >
                  <Trash2 />
                  Remove a view
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
