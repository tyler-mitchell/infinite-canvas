export {
  InfiniteCanvas,
  InfiniteCanvasDesktop,
  InfiniteCanvasHud,
  InfiniteCanvasViewport,
  InfiniteCanvasWindowLayer,
} from "./infinite-canvas";
export { INFINITE_CANVAS_SLOTS, getInfiniteCanvasWindowStateAttributes } from "./data-attributes";
export type { InfiniteCanvasSceneSurface, InfiniteCanvasSceneSurfaceProps } from "./scene-surface";
export type { InfiniteCanvasSlot } from "./data-attributes";
export { DEFAULT_INFINITE_CANVAS_HUD_POLICY, resolveInfiniteCanvasHudPolicy } from "./canvas-hud";
export { DEFAULT_INFINITE_CANVAS_ICONS, useInfiniteCanvasIcons } from "./icons";
export type { InfiniteCanvasIconName, InfiniteCanvasIconProps, InfiniteCanvasIcons } from "./icons";
export {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
  getInfiniteCanvasWindowData,
} from "./factory";
export {
  DEFAULT_INFINITE_CANVAS_GROUP_METRICS,
  getInfiniteCanvasGroupDockEdgeAtPoint,
  getInfiniteCanvasGroupGutterWeights,
  getInfiniteCanvasGroupLayout,
} from "./group-layout";
export type {
  InfiniteCanvasGroupAccordionHeader,
  InfiniteCanvasGroupGutter,
  InfiniteCanvasGroupLayout,
  InfiniteCanvasGroupMetrics,
  InfiniteCanvasGroupTabStrip,
  InfiniteCanvasGroupWindowPlacement,
} from "./group-layout";
export {
  DEFAULT_INFINITE_CANVAS_GROUP_WEIGHT,
  createInfiniteCanvasGroupWindowNode,
  dockInfiniteCanvasGroupWindow,
  findInfiniteCanvasGroupNode,
  getInfiniteCanvasGroupParent,
  getInfiniteCanvasGroupWindowIds,
  isInfiniteCanvasGroupContainer,
  normalizeInfiniteCanvasGroupTree,
  undockInfiniteCanvasGroupWindow,
} from "./group-tree";
export type {
  InfiniteCanvasGroupAxis,
  InfiniteCanvasGroupContainerNode,
  InfiniteCanvasGroupDockEdge,
  InfiniteCanvasGroupLayoutMode,
  InfiniteCanvasGroupNode,
  InfiniteCanvasGroupWindowNode,
} from "./group-tree";
export {
  findInfiniteCanvasGroup,
  getInfiniteCanvasGroupProjection,
  getInfiniteCanvasGroupedWindowIds,
  getInfiniteCanvasWindowGroup,
  isInfiniteCanvasWindowGrouped,
  reconcileInfiniteCanvasGroups,
} from "./group-state";
export type { InfiniteCanvasGroupProjection } from "./group-state";
export {
  EMPTY_INFINITE_CANVAS_HISTORY,
  INFINITE_CANVAS_HISTORY_LIMIT,
  canRedoInfiniteCanvas,
  canUndoInfiniteCanvas,
  getInfiniteCanvasDocument,
  redoInfiniteCanvasHistory,
  undoInfiniteCanvasHistory,
} from "./history";
export { createInfiniteCanvasHandle } from "./canvas-handle";
export type { InfiniteCanvasHandle } from "./canvas-handle";
export {
  InfiniteCanvasProvider,
  createInfiniteCanvasStore,
  useInfiniteCanvasActions,
  useInfiniteCanvasSelector,
  useInfiniteCanvasState,
  useInfiniteCanvasState$,
  useInfiniteCanvasStore,
} from "./store";
export {
  assertInfiniteCanvasStateMatchesWindowRegistry,
  getRegisteredInfiniteCanvasWindowKinds,
  getUnknownInfiniteCanvasWindowKinds,
  isRegisteredInfiniteCanvasWindow,
  isRegisteredInfiniteCanvasWindowKind,
  normalizeInfiniteCanvasStateForWindowRegistry,
  recoverInfiniteCanvasStateForWindowRegistry,
} from "./registry";
export {
  getInfiniteCanvasScopedStorageKey,
  parseInfiniteCanvasState,
  parseInfiniteCanvasStateJson,
  serializeInfiniteCanvasState,
  stringifyInfiniteCanvasState,
} from "./persistence";
export {
  parseInfiniteCanvasCamera,
  parseInfiniteCanvasPoint,
  parseInfiniteCanvasRect,
  parseInfiniteCanvasSelection,
  parseInfiniteCanvasSerializedState,
  parseInfiniteCanvasSize,
  parseInfiniteCanvasWindow,
} from "./validation";
export {
  DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS,
  executeInfiniteCanvasCommand,
  getAvailableInfiniteCanvasContextualCommands,
  getInfiniteCanvasCommandGroup,
  getInfiniteCanvasContextualCommands,
  getInfiniteCanvasHotkeyBindings,
  isInfiniteCanvasCommandEnabled,
} from "./commands";
export {
  DEFAULT_INFINITE_CANVAS_CAMERA_NAVIGATION_BEHAVIOR,
  getCameraNavigationFrame,
  getCameraNavigationTargetRect,
  getNavigableWindow,
  isCameraNavigationAvailable,
  navigateCamera,
  navigateCameraToWindow,
} from "./camera-navigation";
export {
  EMPTY_INFINITE_CANVAS_SELECTION,
  addSelection,
  addTargetSelection,
  clearSelection,
  getSelectableWindowIds,
  getSelectionAnchorTarget,
  getSelectionTargetKey,
  getSelectionTargets,
  getSelectedWindowBounds,
  getVisibleWindowBounds,
  getWindowBounds,
  hasInfiniteCanvasSelection,
  isSelectionTargetSelected,
  isWindowSelected,
  normalizeSelection,
  normalizeSelectionTargets,
  normalizeSelectionWindowIds,
  removeSelection,
  removeTargetSelection,
  replaceSelection,
  replaceTargetSelection,
  selectAllVisibleWindows,
  toggleSelection,
  toggleTargetSelection,
} from "./selection";
export {
  getInfiniteCanvasWindowSceneModels,
  getInfiniteCanvasWindowSceneModel,
} from "./scene-model";
export { getInfiniteCanvasWindowProxies, getInfiniteCanvasWindowProxy } from "./window-proxy";
export {
  getInfiniteCanvasMinimizedWindowItems,
  getInfiniteCanvasVisibleWindowItems,
  getInfiniteCanvasWindowPresence,
  getInfiniteCanvasWindowPresenceItem,
} from "./window-presence";
export {
  getInfiniteCanvasRectConnectorPath,
  getInfiniteCanvasRectConnectorPoint,
  getInfiniteCanvasRectConnectorSegment,
  getInfiniteCanvasViewportScreenRect,
  getInfiniteCanvasWindowConnectorPoint,
  getInfiniteCanvasWindowConnectorPath,
  getInfiniteCanvasWindowConnectorSegment,
  getInfiniteCanvasWindowProxyCullingRect,
  getInfiniteCanvasWorldPath,
  getInfiniteCanvasWorldPathPointAtProgress,
  getInfiniteCanvasWorldPathSceneTransforms,
  getInfiniteCanvasWorldSegment,
  getInfiniteCanvasWorldSegmentSceneTransform,
  getVisibleInfiniteCanvasWindowProxies,
} from "./scene-layer-geometry";
export {
  createInfiniteCanvasWindowLocalFrameRect,
  frameLocalPointToScenePoint,
  frameLocalRectToScenePlane,
  getInfiniteCanvasWindowBodyProjection,
  getInfiniteCanvasWindowSceneChromeMetrics,
  getInfiniteCanvasWindowSceneShell,
  getInfiniteCanvasWindowSceneShellLayout,
  getMinimumWorldLength,
  toInfiniteCanvasWindowWorldRect,
} from "./window-scene-shell";
export {
  getInfiniteCanvasDirectionalFocusTarget,
  getInfiniteCanvasWindowNearestCameraCenter,
  isInfiniteCanvasWindowFullyVisible,
} from "./window-focus";
export {
  focusInfiniteCanvasCommandSurface,
  registerInfiniteCanvasHotkeys,
  shouldHandleInfiniteCanvasKeyboardEvent,
} from "./keyboard";
export { cloneInfiniteCanvasState, resetInfiniteCanvasState } from "./state";
export {
  DEFAULT_INFINITE_CANVAS_ZOOM,
  DEFAULT_INFINITE_CANVAS_INPUT_POLICY,
  MIN_RENDERABLE_INFINITE_CANVAS_ZOOM,
  DEFAULT_INFINITE_CANVAS_SNAP_POLICY,
  resolveInfiniteCanvasZoomPolicy,
} from "./constants";
// Pure projection and rect helpers that consumer overlays/scene layers
// legitimately need (drop outlines, custom guides, hit affordances).
export {
  getRectCenter,
  getVisibleWorldRect,
  rectContainsPoint,
  rectsIntersect,
  screenPointToWorldPoint,
  unionRects,
  worldPointToScreenPoint,
  worldRectToScreenRect,
} from "./geometry";
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
export {
  EMPTY_INFINITE_CANVAS_DROP,
  createInfiniteCanvasDropInteraction,
  getInfiniteCanvasDropPlacement,
  isPointInsideInfiniteCanvasViewport,
  normalizeInfiniteCanvasDropValidation,
} from "./drop-interaction";
export type {
  InfiniteCanvasDropPlacement,
  InfiniteCanvasDropPlacementInput,
} from "./drop-interaction";
export {
  createInfiniteCanvasEdgeTargetResolver,
  createInfiniteCanvasOverlayTargetResolver,
  createInfiniteCanvasSceneObjectTargetResolver,
  getInfiniteCanvasSelectableTargetFromSpatialTarget,
  resolveInfiniteCanvasSpatialTarget,
} from "./spatial-target";
export {
  DEFAULT_INFINITE_CANVAS_RASTERIZATION,
  resolveInfiniteCanvasRasterizationPolicy,
} from "./rasterization-layer";
export {
  getInfiniteCanvasVisibilitySummary,
  getWindowFrustumVisibility,
  isWindowFramed,
  useInfiniteCanvasVisibilitySummary,
  useInfiniteCanvasWindowFramed,
  useInfiniteCanvasWindowFrustum,
} from "./visibility";
export type {
  InfiniteCanvasSceneSegmentTransform,
  InfiniteCanvasWindowConnectorOptions,
  InfiniteCanvasWindowConnectorPathOptions,
  InfiniteCanvasWindowConnectorRoute,
  InfiniteCanvasWorldPath,
  InfiniteCanvasWorldSegment,
} from "./scene-layer-geometry";
export type { InfiniteCanvasDesktopProps, InfiniteCanvasViewportProps } from "./infinite-canvas";
export type { InfiniteCanvasStateInput, InfiniteCanvasWindowInput } from "./factory";
export type { InfiniteCanvasStorageKeyInput } from "./persistence";
export type {
  InfiniteCanvasDiagnosticsPolicy,
  InfiniteCanvasDiagnosticsPolicyInput,
} from "./diagnostics";
export type { InfiniteCanvasHotkeyRegistrationInput } from "./keyboard";
export type { InfiniteCanvasStateValidator, InfiniteCanvasStore } from "./store";
export type {
  InfiniteCanvasRasterDisplayMode,
  InfiniteCanvasRasterizationPolicy,
  InfiniteCanvasRasterizationPolicyInput,
  InfiniteCanvasRasterSnapshot,
  InfiniteCanvasRasterSummary,
} from "./rasterization-layer";
export type {
  InfiniteCanvasVisibilityState,
  InfiniteCanvasVisibilitySummary,
  InfiniteCanvasWindowFrustumVisibility,
} from "./visibility";
export type {
  InfiniteCanvasWindowPresence,
  InfiniteCanvasWindowPresenceItem,
} from "./window-presence";
export type {
  InfiniteCanvasScenePlane,
  InfiniteCanvasWindowBodyProjection,
  InfiniteCanvasWindowSceneChromeMetrics,
  InfiniteCanvasWindowSceneHandle,
  InfiniteCanvasWindowSceneShell,
  InfiniteCanvasWindowSceneShellLayout,
} from "./window-scene-shell";
export type {
  InfiniteCanvasSpatialEdgeTarget,
  InfiniteCanvasSpatialRectTarget,
  InfiniteCanvasSpatialTargetInput,
  InfiniteCanvasSpatialTargetResolverInput,
  InfiniteCanvasSpatialTargetSource,
} from "./spatial-target";
export type {
  InfiniteCanvasAction,
  InfiniteCanvasCamera,
  InfiniteCanvasCameraNavigationBehavior,
  InfiniteCanvasCameraNavigationRequest,
  InfiniteCanvasCameraNavigationTarget,
  InfiniteCanvasChromeMetrics,
  InfiniteCanvasCommand,
  InfiniteCanvasCommandDescriptor,
  InfiniteCanvasCommandGroup,
  InfiniteCanvasCommandId,
  InfiniteCanvasCommands,
  InfiniteCanvasContextualCommand,
  InfiniteCanvasCursor,
  InfiniteCanvasCursorInteraction,
  InfiniteCanvasCursorPolicy,
  InfiniteCanvasDragStartInput,
  InfiniteCanvasDirection,
  InfiniteCanvasDockPreview,
  InfiniteCanvasDocument,
  InfiniteCanvasGroup,
  InfiniteCanvasGroupGutterInteraction,
  InfiniteCanvasGroupMoveInteraction,
  InfiniteCanvasHistory,
  InfiniteCanvasDropCommitContext,
  InfiniteCanvasDropInteraction,
  InfiniteCanvasDropPayload,
  InfiniteCanvasDropPolicy,
  InfiniteCanvasDropTargetContext,
  InfiniteCanvasDropValidationInput,
  InfiniteCanvasDropValidationResult,
  InfiniteCanvasEmptyCanvasDragMode,
  InfiniteCanvasInputPolicy,
  InfiniteCanvasInteraction,
  InfiniteCanvasHotkeyBinding,
  InfiniteCanvasHudPolicy,
  InfiniteCanvasHudPolicyInput,
  InfiniteCanvasMarqueeInteraction,
  InfiniteCanvasMarqueeMode,
  InfiniteCanvasMoveInteraction,
  InfiniteCanvasMoveOriginRect,
  InfiniteCanvasOverlayRenderContext,
  InfiniteCanvasPanInteraction,
  InfiniteCanvasPoint,
  InfiniteCanvasPointerMode,
  InfiniteCanvasRect,
  InfiniteCanvasResizeHandle,
  InfiniteCanvasResizeInteraction,
  InfiniteCanvasResolvedDropTarget,
  InfiniteCanvasResolveSpatialTarget,
  InfiniteCanvasResolvedSpatialTarget,
  InfiniteCanvasSceneLayer,
  InfiniteCanvasSceneLayerFrameloop,
  InfiniteCanvasSceneLayerPlacement,
  InfiniteCanvasSceneLayerRenderContext,
  InfiniteCanvasSceneLayerSpace,
  InfiniteCanvasSceneVector3,
  InfiniteCanvasSerializedState,
  InfiniteCanvasSelection,
  InfiniteCanvasSelectionTarget,
  InfiniteCanvasSelectionTargetType,
  InfiniteCanvasSize,
  InfiniteCanvasSpatialTarget,
  InfiniteCanvasSpatialTargetResolver,
  InfiniteCanvasSpatialTargetResolverContext,
  InfiniteCanvasSpatialTargetResolverPhase,
  InfiniteCanvasSpatialWindowArea,
  InfiniteCanvasSnapGuide,
  InfiniteCanvasSnapPolicy,
  InfiniteCanvasSnapPreview,
  InfiniteCanvasStackBands,
  InfiniteCanvasState,
  InfiniteCanvasTheme,
  InfiniteCanvasViewport as InfiniteCanvasViewportSize,
  InfiniteCanvasWindow,
  InfiniteCanvasWindowBodyPointerBehavior,
  InfiniteCanvasWindowDefinition,
  InfiniteCanvasWindowFrameChrome,
  InfiniteCanvasWindowFrameActiveCornersProps,
  InfiniteCanvasWindowFrameBodyProps,
  InfiniteCanvasWindowFrameControlsProps,
  InfiniteCanvasWindowFrameHeaderProps,
  InfiniteCanvasWindowFrameRenderContext,
  InfiniteCanvasWindowFrameSlots,
  InfiniteCanvasWindowFrameSurfaceProps,
  InfiniteCanvasWindowFrameTitleProps,
  InfiniteCanvasWindowMode,
  InfiniteCanvasWindowProxy,
  InfiniteCanvasWindowRegistry,
  InfiniteCanvasWindowRenderContext,
  InfiniteCanvasWindowSceneModel,
  InfiniteCanvasWindowTextSelection,
  InfiniteCanvasWindowWheelBehavior,
  InfiniteCanvasZoomPolicy,
  InfiniteCanvasZoomPolicyInput,
} from "./types";
