import { useInfiniteCanvasActions, useInfiniteCanvasSelector } from "@hyphened/infinite-canvas";
import { useObservable, useValue } from "@legendapp/state/react";
import { getHotkeyManager } from "@tanstack/hotkeys";
import { Bookmark, BookmarkPlus, Check, Crosshair, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
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
  getSavedViews,
  loadSavedViews,
  removeSavedView,
  savedViews$,
  saveView,
  type SavedView,
  type SavedViewRect,
} from "./saved-views";

/**
 * The framings this canvas remembers, and the way back to one.
 *
 * The rail reads project ▸ canvas ▸ desktop, each a switcher whose name *is* the control. This sits
 * fourth and is built from the same parts, because it answers the same shape of question — which of
 * these named things do I want — and someone who has learned the other three has learned this.
 *
 * **It is not a switcher, and the difference is why there is no radio group here.** Entering a
 * desktop is a mode you remain in, so that control marks which one you are on. Going to a view is a
 * jump: the moment the camera arrives you are free to pan away, and nothing is "on" afterwards.
 * Marking one as current would be a claim that goes stale on the next scroll.
 *
 * Placed here rather than in the library rail on purpose. The rail browses *content* — presence
 * dots, connection counts, archive — and a framing is navigation, so a third mode there would put
 * two unrelated domains in one component. Placed here rather than in the palette because the list
 * should be visible without being summoned; the palette is where you go knowing the name.
 */

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
    removing: {
      // Removal is a mode, and a mode you cannot see you are in is how a jump becomes a deletion.
      true: { trigger: "bg-[var(--accent-wash)]" },
    },
  },
});

/**
 * The next "View n" this canvas is not already using.
 *
 * Max-ordinal rather than `length + 1`, which is the defect `open-note` already had to fix: a count
 * frees a number as soon as anything is removed, so deleting the second of three and saving again
 * produces a second "View 3" — two rows with one name, in the one surface whose job is telling them
 * apart.
 */
function getNextViewTitle(views: readonly SavedView[]) {
  const used = views.flatMap((view) => {
    const ordinal = /^View (\d+)$/.exec(view.title)?.[1];

    return ordinal === undefined ? [] : [Number(ordinal)];
  });

  return `View ${String(Math.max(0, ...used) + 1)}`;
}

export function SavedViewMenu({ canvasId }: Readonly<{ canvasId: string }>) {
  const actions = useInfiniteCanvasActions();
  const camera = useInfiniteCanvasSelector((state) => state.camera);
  const viewport = useInfiniteCanvasSelector((state) => state.viewport);
  const insets = useInfiniteCanvasSelector((state) => state.viewportInsets);
  const listing = useValue(savedViews$);
  /**
   * The framing captured when "Save this view" was pressed, held with the name being typed.
   *
   * The rect is taken at the gesture rather than at the commit, so that the view stored is the one
   * that was on screen when it was asked for — not whatever the camera happens to show by the time
   * a name has been finished.
   */
  const draft$ = useObservable<Readonly<{ rect: SavedViewRect; title: string }> | null>(null);
  const draft = useValue(draft$);
  const removing$ = useObservable(false);
  const removing = useValue(removing$);
  const inputRef = useRef<HTMLInputElement>(null);
  const views = getSavedViews(listing, canvasId) ?? [];
  const styles = savedViewMenu({ removing });

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

  /**
   * Enter and Escape through the hotkey manager, scoped to the field — the bargain both switchers
   * beside this one strike. `ignoreInputs: false` because the target *is* an input, and the manager
   * owns conflict detection rather than each field deciding for itself.
   */
  useEffect(() => {
    const node = inputRef.current;

    if (node === null) {
      return;
    }

    // Selected on arrival: the suggested name is a placeholder to replace far more often than to
    // edit, and `autoFocus` alone leaves the caret after it — "View 1Research".
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
    // Re-registers when the field appears or disappears, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft !== null, draft$]);

  // Naming replaces the trigger rather than opening a dialog — the same move the desktop and canvas
  // switchers make, and for the same reason: the field is already the right size and in the right
  // place.
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
        // Removal never survives the menu closing. A mode that outlives the surface that announced
        // it is one you return to without knowing, and the next click deletes instead of going.
        if (!open) {
          removing$.set(false);
        }
      }}
    >
      <DropdownMenuTrigger
        className={styles.trigger()}
        onPointerDown={(event) => {
          // Without this the press also reaches the canvas root and starts a marquee underneath.
          event.stopPropagation();
        }}
      >
        <Bookmark className={styles.icon()} />
        Views
        {views.length === 0 ? null : <span className={styles.count()}>{views.length}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {/*
          The group is not decoration. `DropdownMenuLabel` is Base UI's *group* label and reads
          `MenuGroupContext`, so a label outside a group throws and takes the whole canvas down with
          it — "Base UI: MenuGroupContext is missing" over an error page, not a warning in a console.
          Found by opening this menu; the typecheck had nothing to say about it.
        */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>{removing ? "Remove which view?" : "Saved views"}</DropdownMenuLabel>
          {/* Blank rather than "none yet" until a read answers: an empty state is a claim about the
              world, and a claim nobody has checked is the one thing a local-first app must not make. */}
          {views.length === 0 ? (
            <DropdownMenuLabel>
              {getSavedViews(listing, canvasId) === null ? "" : "Nothing saved here yet."}
            </DropdownMenuLabel>
          ) : (
            views.map((view) => (
              <DropdownMenuItem
                key={view.id}
                onClick={() => {
                  if (removing) {
                    void removeSavedView({ canvasId, viewId: view.id });

                    return;
                  }

                  /*
                   * `fit` with no padding, which is the difference between going there and
                   * arriving.
                   *
                   * `navigateToRect` defaults to `center`, and centring keeps the zoom you are
                   * already at — so jumping to a view saved at 18% while sitting at 12% moved the
                   * camera and left the framing wrong. Watched it happen: the windows slid across
                   * and the zoom readout never changed.
                   *
                   * Zero padding rather than the default 80, because the stored rect is *already*
                   * the region the chrome leaves — `getInfiniteCanvasContentWorldRect` computed it
                   * that way, and `getFitCamera` fits into that same inset region. Padding it again
                   * would zoom out by 80px every trip, so a view would drift wider each time it was
                   * re-saved from itself.
                   */
                  actions.navigateToRect({
                    behavior: { paddingPx: 0, type: "fit" },
                    rect: view.rect,
                  });
                }}
              >
                {removing ? <Trash2 /> : <Crosshair />}
                <span className={styles.itemTitle()}>{view.title}</span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {removing ? (
          <DropdownMenuItem
            closeOnClick={false}
            onClick={() => {
              removing$.set(false);
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
            {/*
              A mode rather than a control on every row.

              A trailing button inside a menu item is the obvious shape and the wrong one here: the
              item owns the click, so the button either never fires or fires alongside the jump.
              Switching the whole list into removal keeps one action per row, stays reachable from
              the keyboard, and — unlike a confirm dialog — says what it is about to do before the
              click rather than after it. Nothing is destroyed but the name and four numbers, which
              is why this needs no second confirmation.
            */}
            {views.length === 0 ? null : (
              <DropdownMenuItem
                closeOnClick={false}
                onClick={() => {
                  removing$.set(true);
                }}
              >
                <Trash2 />
                Remove a view
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
