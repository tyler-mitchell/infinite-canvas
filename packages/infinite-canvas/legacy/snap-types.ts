import type { InfiniteCanvasRect, InfiniteCanvasSnapGuide } from "./types";

type SnapCandidate = Omit<InfiniteCanvasSnapGuide, "sourceAnchor"> &
  Readonly<{
    priority: number;
  }>;

type SnapAnchor = Readonly<{
  axis: "x" | "y";
  kind: InfiniteCanvasSnapGuide["kind"];
  position: number;
  sourceAnchor: InfiniteCanvasSnapGuide["sourceAnchor"];
}>;

type SnapAdjustment = Readonly<{
  delta: number;
  guides: readonly InfiniteCanvasSnapGuide[];
  priority: number;
  sourceAnchor: InfiniteCanvasSnapGuide["sourceAnchor"];
}>;

type WindowSnapSource = Readonly<{
  id: string;
  rect: InfiniteCanvasRect;
}>;

export type { SnapAdjustment, SnapAnchor, SnapCandidate, WindowSnapSource };
