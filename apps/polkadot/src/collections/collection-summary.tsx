import {
  useInfiniteCanvasSelector,
  type InfiniteCanvasSize,
} from "@hyphened/infinite-canvas/legacy";
import { useValue } from "@legendapp/state/react";
import { tv } from "ui/tv";

import {
  getSummaryPadding,
  getSummaryScreenSize,
  SUMMARY_SCREEN_PX,
} from "../canvas/summary-metrics";
import type { WindowKind } from "../canvas/window-registry";
import { useLoaderData } from "@tanstack/react-router";

import { projectContent$ } from "../content/project-content";
import { relations$ } from "../relations/relation-store";
import { getCollectionEntry, resolveCollectionItems } from "./collection-store";

const collectionSummary = tv({
  slots: {
    count: "tabular-nums text-[var(--ink-faint)]",
    root: "grid h-full place-items-center gap-[0.35em] text-center leading-[1.4] text-[var(--ink-muted)]",
    title: "max-w-full truncate font-medium text-[var(--ink)]",
  },
});

export function CollectionSummary({
  bodySize,
  collectionId,
  title,
}: Readonly<{ bodySize: InfiniteCanvasSize; collectionId: string; title: string }>) {
  const zoom = useInfiniteCanvasSelector<WindowKind, number>((state) => state.camera.zoom);
  const { projectId } = useLoaderData({ from: "/canvas/$canvasId" });
  const listing = useValue(projectContent$[projectId]);
  const relations = useValue(relations$[projectId]) ?? [];
  const question = getCollectionEntry({ collectionId, listing, projectId }).collection?.content;
  const styles = collectionSummary();
  // Keep the count hidden until the project listing loads.
  const items =
    question === undefined
      ? undefined
      : resolveCollectionItems({ listing, projectId, question, relations });

  return (
    <div
      className={styles.root()}
      style={{
        fontSize: SUMMARY_SCREEN_PX / zoom,
        // The same inset a note card uses, so two kinds do not disagree about their own margins.
        padding: getSummaryPadding(getSummaryScreenSize(bodySize, zoom)) / zoom,
      }}
    >
      <span className={styles.title()}>{title}</span>
      {items === undefined ? null : <span className={styles.count()}>{items.length}</span>}
    </div>
  );
}
