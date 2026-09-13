import type { InfiniteCanvasGroupMasonry } from "@hyphened/infinite-canvas";

export const BOARD_GROUP_ID = "board";
export const TRACKS = 12;
export const WIDTH = 1200;

export const GAP = 12;
export const ROW_HEIGHT = ((WIDTH - GAP * (TRACKS - 1)) / TRACKS - GAP) / 2;

export const LATTICE: InfiniteCanvasGroupMasonry = {
  cols: TRACKS,
  compactType: "vertical",
  containerPadding: [0, 0],
  margin: [GAP, GAP],
  rowHeight: ROW_HEIGHT,
};
