import { arrangeLanes, columnItem, columnOptions, columnSize } from "@hyphened/math/cpu";
import type { Layout } from "./kinds";

const lanesOptions = columnOptions.merge({ type: "'lanes'" });
export const lanes: Layout<typeof lanesOptions, typeof columnItem> = {
  options: lanesOptions,
  item: columnItem,
  accepts: ["move", "resize"],
  dock: () => ({ place: "append" }),
  size: ({ options, items, proposal }) =>
    columnSize({
      options,
      items,
      proposal,
      height: (width) => arrangeLanes({ options, items, width }).height,
    }),
  arrange: ({ options, items, rect, operation }) => {
    const {
      rects,
      items: changed,
      height,
      order,
    } = arrangeLanes({
      options,
      items,
      width: rect.width,
      origin: rect,
      operation,
    });
    return {
      size: { width: rect.width, height },
      controls: [],
      children: [
        ...Object.entries(rects).map(([id, rect]) => ({ id, visible: true, rect })),
        ...items.filter(({ item }) => item.hidden).map(({ id }) => ({ id, visible: false, rect })),
      ],
      ...(Object.keys(changed).length === 0
        ? {}
        : {
            changes: {
              items: changed,
              ...(order !== undefined
                ? {
                    children: [
                      ...order,
                      ...items.filter(({ item }) => item.hidden).map(({ id }) => id),
                    ],
                  }
                : {}),
            },
          }),
    };
  },
};
