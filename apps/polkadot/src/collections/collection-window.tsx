import { useInfiniteCanvasActions, useInfiniteCanvasState } from "@hyphened/infinite-canvas";
import { useValue } from "@legendapp/state/react";
import { ChevronDown, Layers, Link2 } from "lucide-react";
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
import type { ContentItemRecord } from "../database/database.client";
import { useLoaderData } from "@tanstack/react-router";

import { projectContent$ } from "../content/project-content";
import { relations$ } from "../relations/relation-store";
import {
  getCollectionEntry,
  resolveCollectionItems,
  setCollectionQuestion,
} from "./collection-store";
import { openItemWindow } from "../canvas/open-item";
import { getListableKind, LISTABLE_KINDS } from "./listable-kinds";

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
    /** The header for a question with no alternatives, shaped like the trigger but inert. */
    staticLabel:
      "flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium tracking-[-0.005em] text-[var(--ink)]",
    /*
     * Sized in screen pixels, so it stays hittable when the canvas is zoomed out.
     *
     * A control inside a window lives under `transform: scale(zoom)`, so authored padding shrinks
     * with everything else: this measured 28px tall at 100% and 14.9px at 0.53, which is the lowest
     * zoom that still renders a body for a window this size. Below any reasonable target, and worst
     * exactly when the user has zoomed out to work across several windows.
     *
     * `--icx-screen-px` is the world length of one screen pixel, published by the framework on the
     * frame whose style is rewritten every tick anyway — so this holds its size with no subscription
     * to zoom and no re-render. The type stays in world units deliberately: text that stopped
     * scaling would make the header the only thing on the canvas ignoring the camera.
     */
    trigger:
      "flex min-h-[calc(var(--icx-screen-px)*24)] items-center gap-1 rounded-[var(--radius-sm)] px-[calc(var(--icx-screen-px)*6)] py-[calc(var(--icx-screen-px)*3)] text-[11px] font-medium tracking-[-0.005em] text-[var(--ink)] transition-colors duration-100 ease-[var(--ease-swift)] hover:bg-[var(--surface-hover)]",
    triggerIcon: "size-3 text-[var(--ink-faint)]",
  },
});

/**
 * The rows, shared by both questions.
 *
 * A kind icon per row rather than one for the whole list, because a connection collection is
 * mixed — a note connected to a picture — and the header cannot say what each row is when the rows
 * disagree.
 */
function ItemRows({
  items,
  onOpen,
  styles,
}: Readonly<{
  items: readonly ContentItemRecord[];
  onOpen: (item: ContentItemRecord) => void;
  styles: ReturnType<typeof collectionWindow>;
}>) {
  return (
    <div className={styles.rows()}>
      {items.map((item) => {
        const listable = getListableKind(item.kind);

        return (
          <button
            className={styles.row()}
            key={item.id}
            onClick={() => {
              onOpen(item);
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
        );
      })}
    </div>
  );
}

export function CollectionWindowBody({ collectionId }: Readonly<{ collectionId: string }>) {
  const actions = useInfiniteCanvasActions<WindowKind>();
  const state = useInfiniteCanvasState<WindowKind>();
  // `renderBody` hands over a window and nothing else, so the route is read rather than passed.
  const { projectId } = useLoaderData({ from: "/canvas/$canvasId" });
  /*
   * Derived from the two live authorities rather than a cache of its own.
   *
   * Both are already subscribed to here, so a note created anywhere, an item archived, or a
   * connection cut redraws this list on the same tick that changed it. There is nothing to
   * invalidate and no writer that has to remember this window exists.
   */
  const listing = useValue(projectContent$);
  const relations = useValue(relations$);
  const entry = getCollectionEntry({ collectionId, listing, projectId });
  const styles = collectionWindow();
  const openItem = (item: ContentItemRecord) => {
    openItemWindow({ actions, item, state });
  };

  if (entry.status === "loading") {
    return <div className={styles.notice()}>Loading…</div>;
  }

  if (entry.collection === null) {
    return (
      <div className={styles.notice()}>{entry.error ?? "Could not open this collection."}</div>
    );
  }

  const collection = entry.collection;
  const question = collection.content;
  const items = resolveCollectionItems({ listing, projectId, question, relations });

  /*
   * A connection collection has no kind to pick, so it says what it is instead of offering a menu.
   *
   * The alternative was one header with a disabled menu, which would be a control that exists to
   * be unusable. A collection asks one of two questions and the header is where it says which; the
   * picker belongs to the question that has alternatives.
   */
  if ("connectedTo" in question) {
    return (
      <div className={styles.root()}>
        <div className={styles.bar()}>
          <span className={styles.staticLabel()}>
            <Link2 className={styles.triggerIcon()} />
            Connected
          </span>
          <span className={styles.count()}>{items.length}</span>
        </div>
        {items.length === 0 ? (
          <div className={styles.empty()}>Not connected to anything yet.</div>
        ) : (
          <ItemRows items={items} onOpen={openItem} styles={styles} />
        )}
      </div>
    );
  }

  const listsKind = question.listsKind;
  const listable = getListableKind(listsKind);

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
                void setCollectionQuestion({ collection, question: { listsKind: value } });
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
        <ItemRows items={items} onOpen={openItem} styles={styles} />
      )}
    </div>
  );
}
