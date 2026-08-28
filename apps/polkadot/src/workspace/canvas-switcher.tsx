import { useObservable, useValue } from "@legendapp/state/react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  CopyPlus,
  PencilLine,
  Plus,
  Trash2,
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

import type { CanvasSummary } from "../database/database.client";
import * as database from "../database/operations";
import { CanvasRemovalDialog } from "./canvas-removal-dialog";
import { useInlineRename } from "./use-inline-rename";
import { createCanvas } from "./create-canvas";
import { duplicateCanvas } from "./duplicate-canvas";
import { useGoToCanvas } from "./use-go-to-canvas";

/**
 * Which canvas this is, and how to reach another one.
 *
 * The canvas's name is the control rather than a label beside one. A route already names exactly
 * one document, so the thing that says which document you are looking at is the natural place to
 * change it — the same move a code editor makes with its branch name.
 *
 * The list loads when the menu opens rather than with the canvas. It is small, it goes stale the
 * moment another canvas is created, and paying for it on every canvas load would put a database
 * round trip in front of a surface most sessions never open.
 */

const canvasSwitcher = tv({
  slots: {
    chevron:
      "size-3 text-[var(--ink-faint)] transition-transform duration-150 ease-[var(--ease-swift)] group-data-popup-open/switcher:rotate-180",
    empty: "px-1.5 py-1 text-[12px] text-[var(--ink-faint)]",
    input:
      "w-40 rounded-md bg-[var(--ground-sunken)] px-1.5 py-0.5 text-[13px] font-medium tracking-[-0.01em] text-[var(--ink)] outline-none inset-ring-1 inset-ring-[var(--accent)]",
    itemTitle: "truncate",
    trigger:
      "group/switcher flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[13px] font-medium tracking-[-0.01em] text-[var(--ink)] transition-colors duration-150 ease-[var(--ease-swift)] outline-none hover:bg-[var(--surface-hover)] focus-visible:bg-[var(--surface-hover)] data-popup-open:bg-[var(--surface-hover)]",
  },
});

export function CanvasSwitcher({
  canvasId,
  projectId,
  title,
}: Readonly<{ canvasId: string; projectId: string; title: string }>) {
  const navigate = useNavigate();
  const router = useRouter();
  const canvases$ = useObservable<readonly CanvasSummary[]>([]);
  const archived$ = useObservable<readonly CanvasSummary[]>([]);
  const isRemoving$ = useObservable(false);
  const canvases = useValue(canvases$);
  const archived = useValue(archived$);
  const isRemoving = useValue(isRemoving$);
  const styles = canvasSwitcher();

  const goToCanvas = useGoToCanvas();
  // The guard is this surface's, not the hook's: the radio group hands back whatever is picked,
  // including the row you are already on, and re-entering the canvas you are in is not a move.
  const openCanvas = (nextCanvasId: string) => {
    if (nextCanvasId !== canvasId) {
      void goToCanvas({ canvasId: nextCanvasId });
    }
  };

  /**
   * Leaving the canvas that just stopped existing.
   *
   * `/` re-resolves the most recent remaining canvas, and bootstraps one when the last is gone,
   * so archiving or deleting the open canvas does not need to decide where to land — the root
   * route already answers that question for every other entry into the app.
   */
  const leaveRemovedCanvas = () => {
    void navigate({ to: "/" });
  };

  const rename = useInlineRename({
    current: title,
    // The title on screen comes from the route loader, so the rename is only visible once that
    // loader runs again.
    onRename: (nextTitle) => {
      void database.canvases.rename({ canvasId, title: nextTitle }).then(() => router.invalidate());
    },
  });

  // Renaming replaces the trigger rather than opening a dialog. The name is already here and
  // already the right size; a modal to change one word is ceremony.
  if (rename.draft !== null) {
    return <input aria-label="Canvas name" className={styles.input()} {...rename.inputProps} />;
  }

  return (
    <>
      <CanvasRemovalDialog
        canvasId={canvasId}
        onOpenChange={(open) => {
          isRemoving$.set(open);
        }}
        onRemoved={leaveRemovedCanvas}
        open={isRemoving}
      />
      <DropdownMenu
        onOpenChange={(open) => {
          if (open) {
            void database.canvases.list(projectId).then((records) => {
              canvases$.set(records);
            });
            void database.canvases.listArchived(projectId).then((records) => {
              archived$.set(records);
            });
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
          {title}
          <ChevronDown className={styles.chevron()} />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {/* The label names the radio group, and Base UI requires that literally: `GroupLabel`
            reads a context only `Group` and `RadioGroup` provide. */}
          <DropdownMenuRadioGroup onValueChange={openCanvas} value={canvasId}>
            <DropdownMenuLabel>Canvases</DropdownMenuLabel>
            {canvases.length === 0 ? (
              <div className={styles.empty()}>Loading…</div>
            ) : (
              canvases.map((canvas) => (
                <DropdownMenuRadioItem key={canvas.id} value={canvas.id}>
                  <span className={styles.itemTitle()}>{canvas.title}</span>
                </DropdownMenuRadioItem>
              ))
            )}
          </DropdownMenuRadioGroup>
          {archived.length > 0 ? (
            <DropdownMenuGroup>
              <DropdownMenuLabel>Archived</DropdownMenuLabel>
              {archived.map((canvas) => (
                <DropdownMenuItem
                  key={canvas.id}
                  onClick={() => {
                    void database.canvases.restore(canvas.id).then(() => {
                      openCanvas(canvas.id);
                    });
                  }}
                >
                  <ArchiveRestore />
                  <span className={styles.itemTitle()}>{canvas.title}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={rename.start}>
            <PencilLine />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              // The verb owns the naming, the same as "New canvas" below. This is the control.
              void duplicateCanvas({ canvasId, canvasTitle: title, projectId }).then((created) => {
                openCanvas(created.id);
              });
            }}
          >
            <CopyPlus />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              void createCanvas({ projectId }).then((created) => {
                openCanvas(created.id);
              });
            }}
          >
            <Plus />
            New canvas
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {/* Archive first, delete second, and the reversible one is not marked destructive —
            they are different decisions and should not look like the same one twice. */}
          <DropdownMenuItem
            onClick={() => {
              void database.canvases.archive(canvasId).then(leaveRemovedCanvas);
            }}
          >
            <Archive />
            Archive
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              isRemoving$.set(true);
            }}
            variant="destructive"
          >
            <Trash2 />
            Delete…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
