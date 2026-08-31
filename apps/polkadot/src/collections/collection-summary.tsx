import { useInfiniteCanvasSelector } from "@hyphened/infinite-canvas";
import { useValue } from "@legendapp/state/react";
import { tv } from "ui/tv";

import type { WindowKind } from "../canvas/window-registry";
import { useLoaderData } from "@tanstack/react-router";

import { projectContent$ } from "../content/project-content";
import { relations$ } from "../relations/relation-store";
import { getCollectionEntry, resolveCollectionItems } from "./collection-store";

const collectionSummary = tv({
  slots: {
    count: "tabular-nums text-[var(--ink-faint)]",
    root: "grid h-full place-items-center gap-[0.35em] px-4 text-center leading-[1.4] text-[var(--ink-muted)]",
    title: "max-w-full truncate font-medium text-[var(--ink)]",
  },
});

// Keep summary text at a constant screen size during zoom.
const SUMMARY_SCREEN_PX = 11;

export function CollectionSummary({
  collectionId,
  title,
}: Readonly<{ collectionId: string; title: string }>) {
  const zoom = useInfiniteCanvasSelector<WindowKind, number>((state) => state.camera.zoom);
  const { projectId } = useLoaderData({ from: "/canvas/$canvasId" });
  const listing = useValue(projectContent$);
  const relations = useValue(relations$);
  const question = getCollectionEntry({ collectionId, listing, projectId }).collection?.content;
  const styles = collectionSummary();
  // Keep the count hidden until the project listing loads.
  const items =
    question === undefined
      ? undefined
      : resolveCollectionItems({ listing, projectId, question, relations });

  return (
    <div className={styles.root()} style={{ fontSize: SUMMARY_SCREEN_PX / zoom }}>
      <span className={styles.title()}>{title}</span>
      {items === undefined ? null : <span className={styles.count()}>{items.length}</span>}
    </div>
  );
}
