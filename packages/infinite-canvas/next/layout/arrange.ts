import { type, type ArkErrors, type Type } from "arktype";
import type { Rect, Size } from "../geometry";
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

export function bindLayout<Options extends Type, Item extends Type>(
  layout: Layout<Options, Item>,
): BoundLayout {
  const parse = ({ options, items }: Request) => {
    const parsed: Options["infer"] | ArkErrors = layout.options(options);
    if (parsed instanceof type.errors) return parsed;
    const entries = items.map((entry) => {
      const item: Item["infer"] | ArkErrors = layout.item(entry.item ?? {});
      return { ...entry, item };
    });
    const invalid = entries.map(({ item }) => item).find((item) => item instanceof type.errors);
    if (invalid instanceof type.errors) return invalid;
    return {
      options: parsed,
      items: entries.flatMap((entry) => (entry.item instanceof type.errors ? [] : [entry])),
    };
  };
  return {
    options: layout.options,
    item: layout.item,
    accepts: layout.accepts ?? [],
    presents: layout.presents ?? "all",
    collapses: layout.collapses ?? false,
    dock: ({ options, edge, target, items }) => {
      const parsed: Options["infer"] | ArkErrors = layout.options(options);
      const item: Item["infer"] | ArkErrors | undefined =
        target === undefined ? undefined : layout.item(target);
      const siblings = items.map((sibling): Item["infer"] | ArkErrors =>
        layout.item(sibling ?? {}),
      );
      const valid = siblings.flatMap((sibling) =>
        sibling instanceof type.errors ? [] : [sibling],
      );
      return parsed instanceof type.errors ||
        item instanceof type.errors ||
        valid.length !== siblings.length
        ? undefined
        : layout.dock?.({
            options: parsed,
            edge,
            items: valid,
            ...(item === undefined ? {} : { target: item }),
          });
    },
    absorb: ({ options, slot, child, items }) => {
      const own: Options["infer"] | ArkErrors = layout.options(options);
      const inner: Options["infer"] | ArkErrors = layout.options(child);
      const place: Item["infer"] | ArkErrors = layout.item(slot ?? {});
      const parsed = items.map((item): Item["infer"] | ArkErrors => layout.item(item ?? {}));
      if (
        own instanceof type.errors ||
        inner instanceof type.errors ||
        place instanceof type.errors
      )
        return undefined;
      const valid = parsed.flatMap((item) => (item instanceof type.errors ? [] : [item]));
      return valid.length === parsed.length
        ? layout.absorb?.({ options: own, child: inner, slot: place, items: valid })
        : undefined;
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
  sizes?: Readonly<Record<string, (proposal: Proposal) => Size>>;
  active?: Readonly<Record<string, string>>;
  operations?: Readonly<Record<string, Operation>>;
};

export type SizeLimits = { min: Size; max: Size; ideal: Size; measured?: Size };

export const limitedSize =
  ({ min, max, ideal, measured }: SizeLimits) =>
  (proposal: Proposal): Size => {
    const width = Math.max(min.width, Math.min(max.width, proposal.width ?? ideal.width));
    const fitted = measured?.width === width ? measured.height : ideal.height;
    return { width, height: Math.max(min.height, Math.min(max.height, proposal.height ?? fitted)) };
  };

export const getLimitedSizes = (limits: Readonly<Record<string, SizeLimits>>) =>
  Object.fromEntries(Object.entries(limits).map(([id, entry]) => [id, limitedSize(entry)]));

const anySize = (proposal: Proposal): Size => ({
  width: proposal.width ?? 0,
  height: proposal.height ?? 0,
});

const within = ({ size, own }: { size: Size; own: (proposal: Proposal) => Size }): Size => {
  const min = own({ width: 0, height: 0 });
  const max = own({ width: Infinity, height: Infinity });
  return {
    width: Math.max(min.width, Math.min(max.width, size.width)),
    height: Math.max(min.height, Math.min(max.height, size.height)),
  };
};

export function getWindowSize({
  id,
  nodes,
  layouts,
  sizes = {},
}: Pick<ArrangeInput, "id" | "nodes" | "layouts" | "sizes">) {
  return (proposal: Proposal): Size => {
    const node = nodes[id];
    const own = sizes[id];
    const layout = node?.layout === undefined ? undefined : layouts[node.layout.type];
    if (node?.layout === undefined || layout === undefined || node.children === undefined)
      return (own ?? anySize)(proposal);
    const ideal = own?.({});
    const measured = layout.size({
      options: node.layout,
      proposal: { width: proposal.width ?? ideal?.width, height: proposal.height ?? ideal?.height },
      items: node.children.map((child) => ({
        id: child,
        item: nodes[child]?.item,
        size: getWindowSize({ id: child, nodes, layouts, sizes }),
      })),
    });
    if (measured instanceof type.errors) return (own ?? anySize)(proposal);
    return own === undefined ? measured : within({ size: measured, own });
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
  const width = Math.min(slot.width, fitted.width);
  const height = Math.min(slot.height, fitted.height);
  return {
    width,
    height,
    x: slot.x + (slot.width - width) * fractions[x],
    y: slot.y + (slot.height - height) * fractions[y],
  };
}

export function arrangeWindows(input: ArrangeInput): Arrangement {
  const { nodes, layouts, sizes = {}, active = {}, operations = {} } = input;
  const sizeOf = (id: string) => getWindowSize({ id, nodes, layouts, sizes });
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
