export * from "./core";
export {
  InfiniteCanvas,
  InfiniteCanvasDesktop,
  InfiniteCanvasHud,
  InfiniteCanvasViewport,
  InfiniteCanvasWindowLayer,
} from "./infinite-canvas";
export type { InfiniteCanvasDesktopProps, InfiniteCanvasViewportProps } from "./infinite-canvas";
export { INFINITE_CANVAS_SLOTS, getInfiniteCanvasWindowStateAttributes } from "./data-attributes";
export type { InfiniteCanvasSlot } from "./data-attributes";
export {
  CommandTrigger,
  CommandMenuItem,
  type CommandTriggerProps,
  type CommandMenuItemProps,
} from "./command-trigger";
export { defineInfiniteCanvasWindowRegistry, getInfiniteCanvasWindowData } from "./factory";
export type { InfiniteCanvasSceneSurface, InfiniteCanvasSceneSurfaceProps } from "./scene-surface";
export { DEFAULT_INFINITE_CANVAS_HUD_POLICY, resolveInfiniteCanvasHudPolicy } from "./canvas-hud";
export { useInfiniteCanvasAnnounce } from "./announcer";
export { DEFAULT_INFINITE_CANVAS_ICONS, useInfiniteCanvasIcons } from "./icons";
export type { InfiniteCanvasIconName, InfiniteCanvasIconProps, InfiniteCanvasIcons } from "./icons";
export {
  InfiniteCanvasPortal,
  useInfiniteCanvasDesktopPortalRoot,
  useInfiniteCanvasPortalRoots,
  useInfiniteCanvasWindowPortalRoot,
} from "./portal";
export type { InfiniteCanvasPortalScope } from "./portal";
export {
  InfiniteCanvasProvider,
  useInfiniteCanvasDispatch,
  useInfiniteCanvasSelectionBounds,
  useInfiniteCanvasSelector,
  useInfiniteCanvasState,
  useInfiniteCanvasState$,
  useInfiniteCanvasStore,
} from "./react/store";
export { getInfiniteCanvasWindowProxies } from "./window-proxy";
export {
  getInfiniteCanvasLongestUnoccludedRun,
  getInfiniteCanvasLongestUnoccludedSegment,
  getInfiniteCanvasPathData,
  getInfiniteCanvasRectBundledConnectorPaths,
  getInfiniteCanvasRectConnectorPath,
  getInfiniteCanvasRectConnectorPoint,
  getInfiniteCanvasRectConnectorSegment,
  getInfiniteCanvasSegmentsWithinRect,
  getInfiniteCanvasUnoccludedRuns,
  getInfiniteCanvasUnoccludedSegments,
  getInfiniteCanvasViewportScreenRect,
  getInfiniteCanvasWindowConnectorPoint,
  getInfiniteCanvasWindowConnectorPath,
  getInfiniteCanvasWindowConnectorSegment,
  getInfiniteCanvasWindowProxyCullingRect,
  getInfiniteCanvasWorldPath,
  getInfiniteCanvasWorldPathPointAtProgress,
  getInfiniteCanvasWorldSegment,
  getVisibleInfiniteCanvasWindowProxies,
} from "./scene-layer-geometry";
export type {
  InfiniteCanvasPathDataOptions,
  InfiniteCanvasRectFacing,
  InfiniteCanvasWindowConnectorOptions,
  InfiniteCanvasWindowConnectorPathOptions,
  InfiniteCanvasWindowConnectorRoute,
  InfiniteCanvasWorldPath,
  InfiniteCanvasWorldSegment,
} from "./scene-layer-geometry";
export {
  focusInfiniteCanvasCommandSurface,
  focusInfiniteCanvasCommandSurfaceFrom,
  registerInfiniteCanvasHotkeys,
  shouldHandleInfiniteCanvasKeyboardEvent,
} from "./keyboard";
export type { InfiniteCanvasHotkeyRegistrationInput } from "./keyboard";
export type { InfiniteCanvasEdgePanPolicy } from "./constants";
export {
  DEFAULT_INFINITE_CANVAS_CURSOR_POLICY,
  getInfiniteCanvasIdleCursor,
  getInfiniteCanvasInteractionCursor,
  getInfiniteCanvasPointerMode,
  withInfiniteCanvasPointerMode,
} from "./input-policy";
export {
  DEFAULT_INFINITE_CANVAS_DIAGNOSTICS,
  resolveInfiniteCanvasDiagnosticsPolicy,
} from "./diagnostics";
export type {
  InfiniteCanvasDiagnosticsPolicy,
  InfiniteCanvasDiagnosticsPolicyInput,
} from "./diagnostics";
export {
  DEFAULT_INFINITE_CANVAS_COMPOSITOR,
  resolveInfiniteCanvasCompositorPolicy,
} from "./compositor/policy";
export type {
  InfiniteCanvasAreaLightOptions,
  InfiniteCanvasCompositorPolicy,
  InfiniteCanvasCompositorPolicyInput,
  InfiniteCanvasConnectionsOptions,
  InfiniteCanvasContactShadowOptions,
  InfiniteCanvasDropPreviewOptions,
  InfiniteCanvasFocusFieldOptions,
  InfiniteCanvasGridOptions,
  InfiniteCanvasParticleFieldOptions,
  InfiniteCanvasProximityOptions,
} from "./compositor/policy";
export { getInfiniteCanvasNativeDropPayload, URI_LIST_TYPE } from "./native-drop";
export {
  DEFAULT_INFINITE_CANVAS_RASTERIZATION,
  resolveInfiniteCanvasRasterizationPolicy,
} from "./rasterization-layer";
export type {
  InfiniteCanvasRasterDisplayMode,
  InfiniteCanvasRasterizationPolicy,
  InfiniteCanvasRasterizationPolicyInput,
  InfiniteCanvasRasterSnapshot,
  InfiniteCanvasRasterSummary,
} from "./rasterization-layer";
export { useInfiniteCanvasVisibilitySummary, useInfiniteCanvasWindowFramed } from "./visibility";
export type { InfiniteCanvasVisibilityState, InfiniteCanvasVisibilitySummary } from "./visibility";
export type {
  InfiniteCanvasHotkeyBinding,
  InfiniteCanvasHudPolicy,
  InfiniteCanvasHudPolicyInput,
  InfiniteCanvasOverlayReadContext,
  InfiniteCanvasOverlayRenderContext,
  InfiniteCanvasResolveSpatialTarget,
  InfiniteCanvasSceneLayerPlacement,
  InfiniteCanvasSceneLayerRenderContext,
  InfiniteCanvasSceneLayerSpace,
  InfiniteCanvasStackBands,
  InfiniteCanvasTheme,
  InfiniteCanvasViewport as InfiniteCanvasViewportSize,
  InfiniteCanvasWindowBodyPointerBehavior,
  InfiniteCanvasWindowDefinition,
  InfiniteCanvasWindowFrameChrome,
  InfiniteCanvasWindowFrameActiveCornersProps,
  InfiniteCanvasWindowFrameBodyProps,
  InfiniteCanvasWindowFrameControlsProps,
  InfiniteCanvasWindowFrameHeaderProps,
  InfiniteCanvasWindowFrameRenderContext,
  InfiniteCanvasSlotElementProps,
  InfiniteCanvasSlotRender,
  InfiniteCanvasWindowFrameSlots,
  InfiniteCanvasWindowFrameSurfaceProps,
  InfiniteCanvasWindowFrameTitleProps,
  InfiniteCanvasWindowProxy,
  InfiniteCanvasWindowRegistry,
  InfiniteCanvasWindowRegistryInput,
  InfiniteCanvasWindowRenderContext,
  InfiniteCanvasWindowTextSelection,
  InfiniteCanvasWindowWheelBehavior,
} from "./types";
export { useInfiniteCanvasWindowProximity } from "./window-proximity";
export { useComponentPalette, type ComponentPalettePayload } from "./use-component-palette";
