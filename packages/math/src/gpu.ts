export * from "./scalar";
export { CurveSample } from "./curvature-wave";
export { thinFilmReflectance } from "./thin-film";
export { ditherOffset, interleavedGradientNoise } from "./noise";

export {
  composeTransforms,
  identityTransform,
  invertTransform,
  rotationTransform,
  scalingTransform,
  Transform,
  transformDeterminant,
  transformDirection,
  transformPoint,
  transformRect,
  translationTransform,
} from "./transform";

export { containScale, coverScale, type Size, type SizeLimits } from "./size";
export { cross2, magSq2, normalize2, perpendicularCCW, type Point } from "./vector";

export {
  cameraShowingKernel as cameraShowing,
  panCameraKernel as panCamera,
  screenToClip,
  screenToWorldKernel as screenToWorld,
  View,
  viewportRect,
  visibleWorldRectKernel as visibleWorldRect,
  worldToScreenKernel as worldToScreen,
  zoomCameraAboutKernel as zoomCameraAbout,
} from "./camera";

export {
  alignRectInKernel as alignRectIn,
  approxEqualsRect,
  areaOfRectKernel as areaOfRect,
  aspectRatioOfRect,
  centerOfRect,
  clampPointToRect,
  clampRectWithinKernel as clampRectWithin,
  containsPointKernel as containsPoint,
  containsRectKernel as containsRect,
  distanceToRect,
  gapBetweenRects,
  insetRect,
  insetRectByKernel as insetRectBy,
  Insets,
  Intersection,
  intersectionRect,
  intersectsRectKernel as intersectsRect,
  lerpRect,
  outsetRect,
  outsetRectByKernel as outsetRectBy,
  overlapsRect,
  Pieces,
  Rect,
  rectBottom,
  rectRight,
  scaleRectAbout,
  subtractRect,
  translateRectKernel as translateRect,
  unionRectKernel as unionRect,
} from "./rect";
