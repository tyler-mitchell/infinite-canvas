import { type, type ArkErrors, type Type } from "arktype";
import {
  alignRectIn,
  clamp,
  clamp0,
  resolveSize,
  type Rect,
  type Size,
  type SizeConstraints,
} from "@hyphened/math/cpu";
import type {
  Arranged,
  Changes,
  Control,
  DockEdge,
  DockPlacement,
  ItemProperties,
  Layout,
  LayoutItem,
  Operation,
  Proposal,
} from "./kinds";

export type LayoutNode = {
  layout?: { type: string } & Record<string, unknown>;
  children?: readonly string[];
  item?: Record<string, unknown>;
};

type Request = { options: unknown; items: readonly LayoutItem<unknown>[] };

export type BoundLayout = {
  options: Type;
  item: Type;
  accepts: readonly Operation["type"][];
  presents: "all" | "one";
  collapses: boolean;
  dock(input: {
    options: unknown;
    edge: DockEdge;
    target?: ItemProperties;
    items: readonly unknown[];
  }): DockPlacement | undefined;
  absorb(input: {
    options: unknown;
    slot: unknown;
    child: unknown;
    items: readonly unknown[];
  }): ItemProperties[] | undefined;
  size(input: Request & { proposal: Proposal }): Size | ArkErrors;
  arrange(
    input: Request & { rect: Rect; active?: string; operation?: Operation },
  ): Arranged | ArkErrors;
};

export function bindLayout(layout: Layout): BoundLayout {
  const request = type({ options: layout.options, items: layout.item.array() });
  const docking = request.merge({ "target?": layout.item });
  const absorption = request.merge({ child: layout.options, slot: layout.item });
  const parse = ({ options, items }: Request) => {
    const parsed = request({ options, items: items.map((entry) => entry.item ?? {}) });
    if (parsed instanceof type.errors) return parsed;
    return {
      options: parsed.options,
      items: items.map((entry, index) => ({ ...entry, item: parsed.items[index] })),
    };
  };
  return {
    options: layout.options,
    item: layout.item,
    accepts: layout.accepts ?? [],
    presents: layout.presents ?? "all",
    collapses: layout.collapses ?? false,
    dock: ({ options, edge, target, items }) => {
      const parsed = docking({
        options,
        items: items.map((item) => item ?? {}),
        ...(target === undefined ? {} : { target }),
      });
      return parsed instanceof type.errors ? undefined : layout.dock?.({ ...parsed, edge });
    },
    absorb: ({ options, slot, child, items }) => {
      const parsed = absorption({
        options,
        child,
        slot: slot ?? {},
        items: items.map((item) => item ?? {}),
      });
      return parsed instanceof type.errors ? undefined : layout.absorb?.(parsed);
    },
    size: ({ proposal, ...input }) => {
      const request = parse(input);
      return request instanceof type.errors ? request : layout.size({ ...request, proposal });
    },
    arrange: ({ rect, active, operation, ...input }) => {
      const request = parse(input);
      return request instanceof type.errors
        ? request
        : layout.arrange({ ...request, rect, active, operation });
    },
  };
}

export type Alignment = "stretch" | "start" | "center" | "end";

export type Arrangement = {
  size: Size;
  rects: Record<string, Rect>;
  visible: Record<string, boolean>;
  controls: Record<string, Control[]>;
  changes: Record<string, Changes>;
};

export type ArrangeInput = {
  id: string;
  rect: Rect;
  nodes: Readonly<Record<string, LayoutNode>>;
  layouts: Readonly<Record<string, BoundLayout>>;
  limits?: Readonly<Record<string, SizeConstraints>>;
  active?: Readonly<Record<string, string>>;
  operations?: Readonly<Record<string, Operation>>;
};

export function getWindowSize({
  id,
  nodes,
  layouts,
  limits = {},
}: Pick<ArrangeInput, "id" | "nodes" | "layouts" | "limits">) {
  const constraints = limits[id];
  const own = (proposal: Proposal) =>
    constraints === undefined
      ? { width: proposal.width ?? 0, height: proposal.height ?? 0 }
      : resolveSize({ constraints, proposal });
  return (proposal: Proposal): Size => {
    const node = nodes[id];
    const layout = node?.layout === undefined ? undefined : layouts[node.layout.type];
    if (node?.layout === undefined || layout === undefined || node.children === undefined)
      return own(proposal);
    const ideal = constraints?.ideal;
    const measured = layout.size({
      options: node.layout,
      proposal: { width: proposal.width ?? ideal?.width, height: proposal.height ?? ideal?.height },
      items: node.children.map((child) => ({
        id: child,
        item: nodes[child]?.item,
        size: getWindowSize({ id: child, nodes, layouts, limits }),
      })),
    });
    if (measured instanceof type.errors) return own(proposal);
    return constraints === undefined ? measured : resolveSize({ constraints, proposal: measured });
  };
}

const fractions = { start: 0, center: 0.5, end: 1, stretch: 0 };
const alignment = type({
  x: "'stretch' | 'start' | 'center' | 'end' = 'stretch'",
  y: "'stretch' | 'start' | 'center' | 'end' = 'stretch'",
});

function alignRect({
  slot,
  size,
  align,
}: {
  slot: Rect;
  size: (proposal: Proposal) => Size;
  align: unknown;
}): Rect {
  const parsed = alignment(align ?? {});
  const { x, y } =
    parsed instanceof type.errors ? { x: "stretch" as const, y: "stretch" as const } : parsed;
  const fitted = size({
    width: x === "stretch" ? slot.width : undefined,
    height: y === "stretch" ? slot.height : undefined,
  });
  const width = clamp(fitted.width, 0, clamp0(slot.width));
  const height = clamp(fitted.height, 0, clamp0(slot.height));
  return alignRectIn(slot, { width, height }, { x: fractions[x], y: fractions[y] });
}

export function arrangeWindows(input: ArrangeInput): Arrangement {
  const { nodes, layouts, limits = {}, active = {}, operations = {} } = input;
  const sizeOf = (id: string) => getWindowSize({ id, nodes, layouts, limits });
  const visit = ({
    id,
    rect,
    visible,
  }: {
    id: string;
    rect: Rect;
    visible: boolean;
  }): Arrangement => {
    const node = nodes[id];
    const leaf: Arrangement = {
      size: rect,
      rects: { [id]: rect },
      visible: { [id]: visible },
      controls: {},
      changes: {},
    };
    if (node?.layout === undefined || node.children === undefined) return leaf;
    const layout = layouts[node.layout.type];
    const arranged = layout?.arrange({
      options: node.layout,
      rect,
      active: active[id],
      operation: operations[id],
      items: node.children.map((child) => ({
        id: child,
        item: nodes[child]?.item,
        size: sizeOf(child),
      })),
    });
    if (arranged === undefined || arranged instanceof type.errors) {
      console.warn("The window layout could not be arranged. Its children are hidden.", {
        windowId: id,
        layout: node.layout.type,
        error: arranged?.summary ?? "The layout kind is not registered.",
      });
      return leaf;
    }
    const children = arranged.children.map((child) =>
      visit({
        id: child.id,
        visible: visible && child.visible,
        rect: child.visible
          ? alignRect({
              slot: child.rect,
              size: sizeOf(child.id),
              align: nodes[child.id]?.item?.align,
            })
          : child.rect,
      }),
    );
    const own = { ...rect, width: arranged.size.width, height: arranged.size.height };
    return {
      size: arranged.size,
      rects: Object.assign({ [id]: own }, ...children.map((child) => child.rects)),
      visible: Object.assign({ [id]: visible }, ...children.map((child) => child.visible)),
      controls: Object.assign(
        visible ? { [id]: arranged.controls } : {},
        ...children.map((child) => child.controls),
      ),
      changes: Object.assign(
        arranged.changes === undefined ? {} : { [id]: arranged.changes },
        ...children.map((child) => child.changes),
      ),
    };
  };
  return visit({ id: input.id, rect: input.rect, visible: true });
}
