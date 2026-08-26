import { useInfiniteCanvasActions, useInfiniteCanvasState } from "@hyphened/infinite-canvas";
import { useValue } from "@legendapp/state/react";
import { ChevronDown, FileText, Image as ImageIcon, Layers } from "lucide-react";
import { useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "ui";
import { tv } from "ui/tv";

import type { WindowKind } from "../canvas/window-registry";
import { openProject$ } from "../projects/open-project";
import {
  collections$,
  ensureCollectionLoaded,
  resolved$,
  setCollectionKind,
} from "./collection-store";
import { openItemWindow } from "./open-item";

/**
 * A window that lists what else is in this project.
 *
 * The first kind that is *about* the others. A note holds prose and an image holds pixels; a
 * collection holds a question — "what images are here" — and answers it from the database each time
 * it opens, rather than storing an answer that goes stale the moment anything else is created.
 *
 * Rows are buttons, not prose: clicking one opens that item's window. That is what makes the
 * collection part of the canvas rather than a panel bolted to it — the list is a way of *getting
 * to* things, and every row's destination is a window like any other.
 */

const collectionWindow = tv({
  slots: {
    /** Sits above the rows and does not scroll with them. */
    bar: "sticky top-0 z-10 flex items-center justify-between gap-2 bg-[var(--surface)] px-3 py-2",
    count: "text-[11px] tabular-nums text-[var(--ink-faint)]",
    empty: "grid place-items-center px-6 py-10 text-center text-[12.5px] text-[var(--ink-faint)]",
    notice: "grid h-full place-items-center px-6 text-center text-[12.5px] text-[var(--ink-faint)]",
    root: "flex min-h-full flex-col",
    /**
     * A row reads as a destination, not a control: no fill at rest, the surface arriving under the
     * pointer — the same rule the dock items and the window controls follow.
     */
    row: "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-[var(--ink-muted)] transition-colors duration-100 ease-[var(--ease-swift)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] focus-visible:bg-[var(--surface-hover)] focus-visible:outline-none",
    rowIcon: "size-3.5 shrink-0 text-[var(--ink-faint)]",
    rowTitle: "min-w-0 flex-1 truncate",
    rows: "flex flex-1 flex-col pb-2",
    trigger:
      "flex items-center gap-1 rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[11px] font-medium tracking-[-0.005em] text-[var(--ink)] transition-colors duration-100 ease-[var(--ease-swift)] hover:bg-[var(--surface-hover)]",
    triggerIcon: "size-3 text-[var(--ink-faint)]",
  },
});

/**
 * What a collection can list, and how each reads.
 *
 * A lookup rather than a switch, and deliberately not derived from the window registry: a
 * collection lists *content kinds*, and the registry is the set of kinds that happen to have a
 * window today. They agree right now and there is no reason they must.
 */
const LISTABLE_KINDS = [
  { icon: FileText, kind: "note", label: "Notes" },
  { icon: ImageIcon, kind: "image", label: "Images" },
] as const;

const getListable = (kind: string) => LISTABLE_KINDS.find((entry) => entry.kind === kind);

export function CollectionWindowBody({ collectionId }: Readonly<{ collectionId: string }>) {
  const actions = useInfiniteCanvasActions<WindowKind>();
  const state = useInfiniteCanvasState<WindowKind>();
  // `renderBody` hands over a window and nothing else, so the project is read rather than passed.
  const projectId = useValue(openProject$);
  const entry = useValue(collections$[collectionId]);
  const items = useValue(resolved$[collectionId]) ?? [];
  const styles = collectionWindow();

  useEffect(() => {
    if (projectId !== null) {
      ensureCollectionLoaded(collectionId, projectId);
    }
  }, [collectionId, projectId]);

  if (entry === undefined || entry.status === "loading") {
    return <div className={styles.notice()}>Loading…</div>;
  }

  if (entry.status === "error" || entry.collection === null) {
    return (
      <div className={styles.notice()}>{entry.error ?? "Could not open this collection."}</div>
    );
  }

  const listsKind = entry.collection.content.listsKind;
  const listable = getListable(listsKind);

  return (
    <div className={styles.root()}>
      <div className={styles.bar()}>
        <DropdownMenu>
          <DropdownMenuTrigger
            className={styles.trigger()}
            onPointerDown={(event) => {
              // Without this the press also reaches the canvas root and starts a marquee beneath.
              event.stopPropagation();
            }}
          >
            {listable === undefined ? <Layers className={styles.triggerIcon()} /> : null}
            {listable?.label ?? listsKind}
            <ChevronDown className={styles.triggerIcon()} />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {/*
              The label lives inside the radio group on purpose. Base UI's `DropdownMenuLabel` reads
              `MenuGroupContext` and *throws* outside a group rather than warning — a radio group
              supplies that context, so this is both the semantically right container (pick one) and
              the safe one.
            */}
            <DropdownMenuRadioGroup
              onValueChange={(value) => {
                if (projectId !== null) {
                  void setCollectionKind({ collectionId, listsKind: value, projectId });
                }
              }}
              value={listsKind}
            >
              <DropdownMenuLabel>Lists</DropdownMenuLabel>
              {LISTABLE_KINDS.map(({ icon: Icon, kind, label }) => (
                <DropdownMenuRadioItem key={kind} value={kind}>
                  <Icon />
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className={styles.count()}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className={styles.empty()}>Nothing of this kind yet.</div>
      ) : (
        <div className={styles.rows()}>
          {items.map((item) => (
            <button
              className={styles.row()}
              key={item.id}
              onClick={() => {
                openItemWindow({ actions, item, state });
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              title={item.title}
              type="button"
            >
              {listable === undefined ? null : <listable.icon className={styles.rowIcon()} />}
              <span className={styles.rowTitle()}>{item.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
