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

const collectionWindow = tv({
  slots: {
    bar: "sticky top-0 z-10 flex items-center justify-between gap-2 bg-[var(--surface)] px-3 py-2",
    count: "text-[11px] tabular-nums text-[var(--ink-faint)]",
    empty: "grid place-items-center px-6 py-10 text-center text-[12.5px] text-[var(--ink-faint)]",
    notice: "grid h-full place-items-center px-6 text-center text-[12.5px] text-[var(--ink-faint)]",
    root: "flex min-h-full flex-col",
    /*
     * A listed item is a bordered block, not a line of text.
     *
     * The window body is the darker container and each block sits a step above it, so a collection
     * reads as a thing holding things. A flush row separated only by hover has no edge until the
     * pointer finds it, which leaves the window looking like one flat rectangle.
     */
    row: "flex w-full items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-raised)] px-2.5 py-2 text-left text-[12.5px] text-[var(--ink-muted)] transition-colors duration-100 ease-[var(--ease-swift)] hover:border-[var(--line-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] focus-visible:border-[var(--accent)] focus-visible:outline-none",
    rowIcon: "size-3.5 shrink-0 text-[var(--ink-faint)]",
    rowTitle: "min-w-0 flex-1 truncate",
    rows: "flex flex-1 flex-col gap-1.5 px-2 pb-2",
    staticLabel:
      "flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium tracking-[-0.005em] text-[var(--ink)]",
    /** The hit target stays constant during canvas zoom. */
    trigger:
      "flex min-h-[calc(var(--icx-screen-px)*24)] items-center gap-1 rounded-[var(--radius-sm)] px-[calc(var(--icx-screen-px)*6)] py-[calc(var(--icx-screen-px)*3)] text-[11px] font-medium tracking-[-0.005em] text-[var(--ink)] transition-colors duration-100 ease-[var(--ease-swift)] hover:bg-[var(--surface-hover)]",
    triggerIcon: "size-3 text-[var(--ink-faint)]",
  },
});

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
  const { projectId } = useLoaderData({ from: "/canvas/$canvasId" });
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
              // Prevent the canvas from starting a marquee.
              event.stopPropagation();
            }}
          >
            {listable === undefined ? <Layers className={styles.triggerIcon()} /> : null}
            {listable?.label ?? listsKind}
            <ChevronDown className={styles.triggerIcon()} />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {/* Base UI requires DropdownMenuLabel inside a group. */}
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
