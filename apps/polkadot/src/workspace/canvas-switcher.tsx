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

import { formatRelativeTimeNarrow } from "../content/relative-time";
import type { CanvasSummary } from "../database/database.client";
import * as database from "../database/operations";
import { CanvasRemovalDialog } from "./canvas-removal-dialog";
import { useInlineRename } from "./use-inline-rename";
import { createCanvas } from "./create-canvas";
import { duplicateCanvas } from "./duplicate-canvas";
import { useGoToCanvas } from "./use-go-to-canvas";

// The menu loads canvas lists when it opens.
const canvasSwitcher = tv({
  slots: {
    chevron:
      "size-3 text-[var(--ink-faint)] transition-transform duration-150 ease-[var(--ease-swift)] group-data-popup-open/switcher:rotate-180",
    empty: "px-1.5 py-1 text-[12px] text-[var(--ink-faint)]",
    itemWhen: "ml-auto pl-3 text-[10.5px] text-[var(--ink-faint)] tabular-nums",
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
  // All archive rows use the same time reference.
  const now = Date.now();
  const isRemoving = useValue(isRemoving$);
  const styles = canvasSwitcher();

  const goToCanvas = useGoToCanvas();
  const openCanvas = (nextCanvasId: string) => {
    if (nextCanvasId !== canvasId) {
      void goToCanvas({ canvasId: nextCanvasId });
    }
  };

  // The root route selects the next available canvas.
  const leaveRemovedCanvas = () => {
    void navigate({ to: "/" });
  };

  const rename = useInlineRename({
    current: title,
    // Refresh the route after the stored title changes.
    onRename: (nextTitle) => {
      void database.canvases.rename({ canvasId, title: nextTitle }).then(() => router.invalidate());
    },
  });

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
            // Stop the canvas from starting a marquee.
            event.stopPropagation();
          }}
        >
          {title}
          <ChevronDown className={styles.chevron()} />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {/* Base UI requires DropdownMenuLabel inside a group. */}
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
                  {canvas.archived_at === undefined ? null : (
                    <span className={styles.itemWhen()}>
                      {formatRelativeTimeNarrow({ iso: canvas.archived_at, now })}
                    </span>
                  )}
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
          {/* Archive is reversible. Delete is destructive. */}
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
