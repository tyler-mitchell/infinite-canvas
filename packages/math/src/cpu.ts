export * from "./axis";
export * from "./layout";
export * from "./columns";
export * from "./tracks";
export * from "./grid";
export * from "./grid-geometry";
export { compactGrid, moveGrid } from "./grid-motion";
export * from "./occupancy";
export * from "./overview";
export { getAdjacentRect, getPlacementRect, getVacantRect, type PlacementRegion } from "./placement";
export { interpolateCamera } from "./zoom-interpolation";
export { add, max, min } from "@thi.ng/transducers";
export { activitySchedule } from "./activity-schedule";
export { timelineDuration } from "./timeline";
export { argmin, argminN, argminT, DIST_SQ, DIST_SQ1 } from "@thi.ng/distance";

export * from "./matrix";
export * from "@thi.ng/math";
export { intersectRayRect, pointInRect, testRayRect, testRectRect } from "@thi.ng/geom-isec";
export { hilbert2d, spiral2d, zcurve2d } from "@thi.ng/grid-iterators";
export { interval, union, type Interval } from "@thi.ng/intervals";
export {
  add2,
  cross2,
  dist2,
  distSq2,
  dot2,
  heading,
  mag2,
  magSq2,
  max2,
  min2,
  mul2,
  mulN2,
  neg,
  normalize2,
  perpendicularCCW,
  perpendicularCW,
  sub2,
  type ReadonlyVec,
  type Vec,
} from "@thi.ng/vectors";
export {
  fitScales, fitAspectSize, intrinsicSize, resolveSize, pixelSize,
  type Size, type SizeLimits, type SizeConstraints,
} from "./size";
export { type Point } from "./vector";

export {
  cameraMatrix,
  cameraEquals,
  cameraShowing,
  panCamera,
  type Camera,
  type Projection,
  screenToWorld,
  visibleWorldRect,
  worldToScreen,
  zoomCameraAbout,
} from "./camera";
export { type Insets } from "./rect";
export {
  combineInsets, insetsOfOccluder, getCameraDestination, getCameraTrack,
  type CameraBehavior, type CameraFraming, type CameraTrack, type PlacedSection,
} from "./framing";

export {
  alignRectIn,
  areaOfRect,
  centroidOfRect,
  clampRectWithin,
  containsPoint,
  containsRect,
  fitRectInto,
  insetRectBy,
  mapPoint,
  rectCorners,
  rectFromCorners,
  unmapPoint,
  rectWithCentroid,
  translateRect,
  intersectsRect,
  outsetRectBy,
  pruneContainedRects,
  Rect,
  resizeRect,
  unionRect,
  unionRects,
  type ResizeHandle,
} from "./rect";
export { curvatureWave } from "./curvature-wave";
export { perspectiveMatrix } from "./perspective";
