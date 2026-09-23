import type { Rect, Size, SizeConstraints } from "@hyphened/math/cpu";
import {
  arrangeWindows,
  type BoundLayout,
  type LayoutNode,
} from "./arrange";
import type { DockEdge, Operation } from "./kinds";
import { getDockChange, getParents, type Tree } from "./tree";

export type DockDrop = {
  window: string;
  target: string;
  edge: DockEdge;
  rect: Rect;
  kind?: string;
};

const previewWrapperId = "dock-preview";

export function getDockArrangement({
  rootId,
  rect,
  windows,
  limits,
  drop,
  layouts,
  wrappers,
  active,
  operations,
  minSize,
  measured,
}: {
  rootId: string;
  rect: Rect;
  windows: Tree;
  limits: Readonly<Record<string, SizeConstraints>>;
  drop: DockDrop;
  layouts: Readonly<Record<string, BoundLayout>>;
  wrappers: Readonly<Record<DockEdge, NonNullable<LayoutNode["layout"]>>>;
  active: Readonly<Record<string, string>>;
  operations: Readonly<Record<string, Operation>>;
  minSize: Size;
  measured: Size | undefined;
}) {
  const change = getDockChange({
    windows: { ...windows, [drop.window]: windows[drop.window] ?? { kind: drop.kind } },
    layouts,
    window: drop.window,
    target: drop.target,
    edge: drop.edge,
    wrapper: { id: previewWrapperId, layout: wrappers[drop.edge] },
  });
  const container = getParents(change.windows)[drop.window];
  const dropped: SizeConstraints = {
    min: minSize,
    max: { width: Infinity, height: Infinity },
    ideal: drop.rect,
    ...(measured === undefined ? {} : { measured }),
  };
  return arrangeWindows({
    id: change.wrapper?.around === rootId ? previewWrapperId : rootId,
    rect,
    nodes: change.windows,
    layouts,
    limits: { [drop.window]: dropped, ...limits },
    active: { ...active, [container]: drop.window },
    operations: {
      ...operations,
      [container]: { type: "move", rects: { [drop.window]: drop.rect } },
    },
  });
}
