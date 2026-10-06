import { type, type Type } from "arktype";
import {
  add as sum,
  clamp,
  clamp0,
  max,
  minMax,
  resizeTracks,
  resolveTracks,
  type Rect,
  type LayoutOperation,
  type Size,
} from "@hyphened/math/cpu";

export type Proposal = { width?: number; height?: number };
export type LayoutItem<Item> = {
  id: string;
  item: Item;
  size(proposal: Proposal): Size;
};
export type Placement = { id: string; rect: Rect; visible: boolean };

export type Operation = LayoutOperation;

export type Control =
  | { type: "sash"; rect: Rect; axis: Axis; index: number; sizes: number[] }
  | { type: "tabs"; rect: Rect; children: string[]; active: string }
  | { type: "header"; rect: Rect; axis: Axis; child: string; expanded: boolean }
  | { type: "custom"; rect: Rect; name: string; data?: unknown };

export type Changes = {
  layout?: Record<string, unknown>;
  items?: Record<string, Record<string, unknown>>;
  children?: string[];
};

export type Arranged = {
  size: Size;
  children: Placement[];
  controls: Control[];
  changes?: Changes;
};

export type DockEdge = "north" | "south" | "east" | "west" | "center";
export type ItemProperties = Record<string, unknown>;
export type DockPlacement = {
  place: "before" | "after" | "append";
  target?: ItemProperties;
  window?: ItemProperties;
};

export type Layout<Options extends Type = Type, Item extends Type = Type> = {
  options: Options;
  item: Item;
  accepts?: readonly Operation["type"][];
  presents?: "all" | "one";
  collapses?: boolean;
  dock?(input: {
    options: Options["infer"];
    edge: DockEdge;
    target?: Item["infer"];
    items: readonly Item["infer"][];
  }): DockPlacement | undefined;
  absorb?(input: {
    options: Options["infer"];
    slot: Item["infer"];
    child: Options["infer"];
    items: readonly Item["infer"][];
  }): ItemProperties[] | undefined;
  size(input: {
    options: Options["infer"];
    items: readonly LayoutItem<Item["infer"]>[];
    proposal: Proposal;
  }): Size;
  arrange(input: {
    options: Options["infer"];
    items: readonly LayoutItem<Item["infer"]>[];
    rect: Rect;
    active?: string;
    operation?: Operation;
  }): Arranged;
};

export type Axis = "horizontal" | "vertical";

const axes = {
  horizontal: { position: "x", extent: "width", cross: "height", before: "west", after: "east" },
  vertical: { position: "y", extent: "height", cross: "width", before: "north", after: "south" },
} as const;

const appendOnCenter = ({ edge }: { edge: DockEdge }): DockPlacement | undefined =>
  edge === "center" ? { place: "append" } : undefined;

export const oriented = ({
  axis,
  along,
  across,
}: {
  axis: Axis;
  along: number | undefined;
  across: number | undefined;
}): Proposal =>
  axis === "horizontal" ? { width: along, height: across } : { width: across, height: along };

const splitOptions = type({
  type: "'split'",
  axis: "'horizontal' | 'vertical' = 'horizontal'",
  gap: "number >= 0 = 6",
});
const splitItem = type({
  factor: "number > 0 = 1",
  hidden: "boolean = false",
});

type SplitInput = Parameters<Layout<typeof splitOptions, typeof splitItem>["size"]>[0];

const splitTracks = ({
  options,
  items,
  across,
}: Pick<SplitInput, "options" | "items"> & { across: number | undefined }) => {
  const { extent } = axes[options.axis];
  const shown = items.filter(({ item }) => !item.hidden);
  const limit = (along: number) =>
    shown.map(({ size }) => size(oriented({ axis: options.axis, along, across }))[extent]);
  const minimums = limit(0);
  const maximums = limit(Infinity);
  return {
    shown,
    gaps: options.gap * clamp0(shown.length - 1),
    tracks: shown.map(({ item }, index) => ({
      base: 0,
      factor: item.factor,
      min: minimums[index],
      max: maximums[index],
    })),
  };
};

export const split: Layout<typeof splitOptions, typeof splitItem> = {
  options: splitOptions,
  item: splitItem,
  accepts: ["sash"],
  collapses: true,
  dock: ({ options, edge, target, items }) => {
    const { before, after } = axes[options.axis];
    if (target === undefined)
      return edge !== "center"
        ? undefined
        : {
            place: "append",
            window: {
              factor: items.length === 0 ? 1 : sum(items.map((item) => item.factor)) / items.length,
            },
          };
    if (edge !== before && edge !== after) return undefined;
    const factor = target.factor / 2;
    return { place: edge === before ? "before" : "after", target: { factor }, window: { factor } };
  },
  absorb: ({ options, slot, child, items }) => {
    if (child.axis !== options.axis) return undefined;
    const total = sum(items.map((item) => item.factor));
    return items.map((item) => ({ factor: (item.factor / total) * slot.factor }));
  },
  size: ({ options, items, proposal }) => {
    const { extent, cross } = axes[options.axis];
    const { shown, gaps, tracks } = splitTracks({ options, items, across: proposal[cross] });
    const wanted = proposal[extent];
    const ideal = () =>
      sum(
        shown.map(
          ({ size }) =>
            size(oriented({ axis: options.axis, along: undefined, across: proposal[cross] }))[
              extent
            ],
        ),
      );
    const along = clamp(
      wanted ?? ideal() + gaps,
      ...minMax(
        sum(tracks.map((track) => track.min)) + gaps,
        sum(tracks.map((track) => track.max)) + gaps,
      ),
    );
    const sizes = resolveTracks({ available: clamp0(along - gaps), tracks });
    const across = clamp0(
      max(
        shown.map(
          ({ size }, index) =>
            size(oriented({ axis: options.axis, along: sizes[index], across: proposal[cross] }))[
              cross
            ],
        ),
      ),
    );
    return { width: 0, height: 0, [extent]: along, [cross]: across };
  },
  arrange: ({ options, items, rect, operation }) => {
    const { position, extent, cross } = axes[options.axis];
    const { shown, gaps, tracks } = splitTracks({ options, items, across: rect[cross] });
    const available = clamp0(rect[extent] - gaps);
    const sizes =
      operation?.type === "sash"
        ? resizeTracks({ ...operation, tracks })
        : resolveTracks({ available, tracks });
    const offsets = sizes.map(
      (_, index) => rect[position] + sum(sizes.slice(0, index)) + options.gap * index,
    );
    return {
      size: rect,
      children: [
        ...shown.map(({ id }, index) => ({
          id,
          visible: true,
          rect: { ...rect, [position]: offsets[index], [extent]: sizes[index] },
        })),
        ...items.filter(({ item }) => item.hidden).map(({ id }) => ({ id, visible: false, rect })),
      ],
      controls: shown.slice(0, -1).map((_, index) => ({
        type: "sash" as const,
        axis: options.axis,
        index,
        sizes,
        rect: { ...rect, [position]: offsets[index] + sizes[index], [extent]: options.gap },
      })),
      ...(operation?.type === "sash"
        ? {
            changes: {
              items: Object.fromEntries(
                shown.map(({ id }, index) => [id, { factor: sizes[index] }]),
              ),
            },
          }
        : {}),
    };
  },
};

const largest = ({
  items,
  proposal,
}: {
  items: readonly LayoutItem<{ hidden: boolean }>[];
  proposal: Proposal;
}): Size => {
  const sizes = items.filter(({ item }) => !item.hidden).map(({ size }) => size(proposal));
  return {
    width: clamp0(max(sizes.map((size) => size.width))),
    height: clamp0(max(sizes.map((size) => size.height))),
  };
};

const reduced = (value: number | undefined, by: number) =>
  value === undefined ? undefined : clamp0(value - by);

const tabsOptions = type({ type: "'tabs'", stripSize: "number >= 0 = 30" });
const stackItem = type({ hidden: "boolean = false" });

export const tabs: Layout<typeof tabsOptions, typeof stackItem> = {
  options: tabsOptions,
  item: stackItem,
  presents: "one",
  dock: appendOnCenter,
  size: ({ options, items, proposal }) => {
    const body = largest({
      items,
      proposal: { ...proposal, height: reduced(proposal.height, options.stripSize) },
    });
    return { ...body, height: body.height + options.stripSize };
  },
  arrange: ({ options, items, rect, active }) => {
    const shown = items.filter(({ item }) => !item.hidden);
    const current = shown.find(({ id }) => id === active) ?? shown[0];
    const strip = clamp(options.stripSize, ...minMax(0, rect.height));
    const body = { ...rect, y: rect.y + strip, height: clamp0(rect.height - strip) };
    return {
      size: rect,
      children: items.map(({ id }) => ({ id, rect: body, visible: id === current?.id })),
      controls:
        current === undefined
          ? []
          : [
              {
                type: "tabs",
                rect: { ...rect, height: strip },
                children: shown.map(({ id }) => id),
                active: current.id,
              },
            ],
    };
  },
};

const accordionOptions = type({
  type: "'accordion'",
  axis: "'horizontal' | 'vertical' = 'vertical'",
  headerSize: "number >= 0 = 28",
});

export const accordion: Layout<typeof accordionOptions, typeof stackItem> = {
  options: accordionOptions,
  item: stackItem,
  presents: "one",
  dock: appendOnCenter,
  size: ({ options, items, proposal }) => {
    const { extent } = axes[options.axis];
    const headers = options.headerSize * items.filter(({ item }) => !item.hidden).length;
    const body = largest({
      items,
      proposal: { ...proposal, [extent]: reduced(proposal[extent], headers) },
    });
    return { ...body, [extent]: body[extent] + headers };
  },
  arrange: ({ options, items, rect, active }) => {
    const { position, extent } = axes[options.axis];
    const shown = items.filter(({ item }) => !item.hidden);
    const expanded = clamp0(shown.findIndex(({ id }) => id === active));
    const header =
      shown.length === 0 ? 0 : clamp(options.headerSize, ...minMax(0, rect[extent] / shown.length));
    const body = clamp0(rect[extent] - header * shown.length);
    const offsets = shown.map(
      (_, index) => rect[position] + index * header + (index > expanded ? body : 0),
    );
    return {
      size: rect,
      children: [
        ...shown.map(({ id }, index) => ({
          id,
          visible: index === expanded,
          rect: { ...rect, [position]: offsets[index] + header, [extent]: body },
        })),
        ...items.filter(({ item }) => item.hidden).map(({ id }) => ({ id, visible: false, rect })),
      ],
      controls: shown.map(({ id }, index) => ({
        type: "header" as const,
        axis: options.axis,
        child: id,
        expanded: index === expanded,
        rect: { ...rect, [position]: offsets[index], [extent]: header },
      })),
    };
  },
};
