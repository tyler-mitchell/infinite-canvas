import { arrangeGrid, columnSize, gridItemOptions, gridOptions } from "@hyphened/math/cpu";
import type { Layout } from "./kinds";

const options = gridOptions.merge({ type: "'grid'" });

export const grid: Layout<typeof options, typeof gridItemOptions> = {
  options,
  item: gridItemOptions,
  accepts: ["move", "resize"],
  dock: () => ({ place: "append" }),
  size: ({ options, items, proposal }) =>
    columnSize({
      options,
      items,
      proposal,
      height: (width) => arrangeGrid({ options, items, width }).height,
    }),
  arrange: ({ options, items, rect, operation }) => {
    const {
      rects,
      items: changed,
      height,
    } = arrangeGrid({
      options,
      items,
      width: rect.width,
      origin: rect,
      operation,
    });
    return {
      size: { width: rect.width, height: Math.max(height, rect.height) },
      controls: [],
      children: [
        ...Object.entries(rects).map(([id, rect]) => ({
          id,
          visible: true,
          rect,
        })),
        ...items.filter(({ item }) => item.hidden).map(({ id }) => ({ id, visible: false, rect })),
      ],
      ...(Object.keys(changed).length === 0
        ? {}
        : {
            changes: { items: changed },
          }),
    };
  },
};
