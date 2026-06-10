export {
  InfiniteCanvas,
  InfiniteCanvasDesktop,
  InfiniteCanvasHud,
  InfiniteCanvasViewport,
  InfiniteCanvasWebGpuSurface,
  InfiniteCanvasWindowLayer,
} from "#/experiments/infinite-canvas/infinite-canvas";
export {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
} from "#/experiments/infinite-canvas/factory";
export {
  InfiniteCanvasProvider,
  createInfiniteCanvasStore,
  useInfiniteCanvasActions,
  useInfiniteCanvasSelector,
  useInfiniteCanvasState,
  useInfiniteCanvasState$,
  useInfiniteCanvasStore,
} from "#/experiments/infinite-canvas/store";
export {
  assertInfiniteCanvasStateMatchesWindowRegistry,
  getRegisteredInfiniteCanvasWindowKinds,
  getUnknownInfiniteCanvasWindowKinds,
  isRegisteredInfiniteCanvasWindow,
  isRegisteredInfiniteCanvasWindowKind,
  normalizeInfiniteCanvasStateForWindowRegistry,
  recoverInfiniteCanvasStateForWindowRegistry,
} from "#/experiments/infinite-canvas/registry";
export {
  getInfiniteCanvasScopedStorageKey,
  parseInfiniteCanvasState,
  parseInfiniteCanvasStateJson,
  serializeInfiniteCanvasState,
  stringifyInfiniteCanvasState,
} from "#/experiments/infinite-canvas/persistence";
export {
  parseInfiniteCanvasCamera,
  parseInfiniteCanvasPoint,
  parseInfiniteCanvasRect,
  parseInfiniteCanvasSelection,
  parseInfiniteCanvasSerializedState,
  parseInfiniteCanvasSize,
  parseInfiniteCanvasWindow,
} from "#/experiments/infinite-canvas/validation";
export {
  DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS,
  executeInfiniteCanvasCommand,
  getAvailableInfiniteCanvasContextualCommands,
  getInfiniteCanvasCommandGroup,
  getInfiniteCanvasContextualCommands,
  getInfiniteCanvasHotkeyBindings,
  isInfiniteCanvasCommandEnabled,
} from "#/experiments/infinite-canvas/commands";
export {
  DEFAULT_INFINITE_CANVAS_CAMERA_NAVIGATION_BEHAVIOR,
  getCameraNavigationFrame,
  getCameraNavigationTargetRect,
  getNavigableWindow,
  isCameraNavigationAvailable,
  navigateCamera,
  navigateCameraToWindow,
} from "#/experiments/infinite-canvas/camera-navigation";
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
} from "#/experiments/infinite-canvas/selection";
export {
  getInfiniteCanvasWindowSceneModels,
  getInfiniteCanvasWindowSceneModel,
} from "#/experiments/infinite-canvas/scene-model";
export {
  getInfiniteCanvasWindowProxies,
  getInfiniteCanvasWindowProxy,
} from "#/experiments/infinite-canvas/window-proxy";
export {
  getInfiniteCanvasMinimizedWindowItems,
  getInfiniteCanvasVisibleWindowItems,
  getInfiniteCanvasWindowPresence,
  getInfiniteCanvasWindowPresenceItem,
} from "#/experiments/infinite-canvas/window-presence";
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
} from "#/experiments/infinite-canvas/scene-layer-geometry";
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
} from "#/experiments/infinite-canvas/window-scene-shell";
export {
  focusInfiniteCanvasCommandSurface,
  registerInfiniteCanvasHotkeys,
  shouldHandleInfiniteCanvasKeyboardEvent,
} from "#/experiments/infinite-canvas/keyboard";
export {
  cloneInfiniteCanvasState,
  resetInfiniteCanvasState,
} from "#/experiments/infinite-canvas/state";
export {
  DEFAULT_INFINITE_CANVAS_ZOOM,
  DEFAULT_INFINITE_CANVAS_INPUT_POLICY,
  MIN_RENDERABLE_INFINITE_CANVAS_ZOOM,
  DEFAULT_INFINITE_CANVAS_SNAP_POLICY,
  resolveInfiniteCanvasZoomPolicy,
} from "#/experiments/infinite-canvas/constants";
export {
  DEFAULT_INFINITE_CANVAS_CURSOR_POLICY,
  getInfiniteCanvasIdleCursor,
  getInfiniteCanvasInteractionCursor,
  getInfiniteCanvasPointerMode,
  withInfiniteCanvasPointerMode,
} from "#/experiments/infinite-canvas/input-policy";
export {
  DEFAULT_INFINITE_CANVAS_DIAGNOSTICS,
  resolveInfiniteCanvasDiagnosticsPolicy,
} from "#/experiments/infinite-canvas/diagnostics";
export {
  EMPTY_INFINITE_CANVAS_DROP,
  createInfiniteCanvasDropInteraction,
  isPointInsideInfiniteCanvasViewport,
  normalizeInfiniteCanvasDropValidation,
} from "#/experiments/infinite-canvas/drop-interaction";
export {
  createInfiniteCanvasEdgeTargetResolver,
  createInfiniteCanvasOverlayTargetResolver,
  createInfiniteCanvasSceneObjectTargetResolver,
  getInfiniteCanvasSelectableTargetFromSpatialTarget,
  resolveInfiniteCanvasSpatialTarget,
} from "#/experiments/infinite-canvas/spatial-target";
export {
  DEFAULT_INFINITE_CANVAS_RASTERIZATION,
  resolveInfiniteCanvasRasterizationPolicy,
} from "#/experiments/infinite-canvas/rasterization-layer";
export {
  getInfiniteCanvasVisibilitySummary,
  getWindowFrustumVisibility,
  isWindowFramed,
  useInfiniteCanvasVisibilitySummary,
  useInfiniteCanvasWindowFramed,
  useInfiniteCanvasWindowFrustum,
} from "#/experiments/infinite-canvas/visibility";
export type {
  InfiniteCanvasSceneSegmentTransform,
  InfiniteCanvasWindowConnectorOptions,
  InfiniteCanvasWindowConnectorPathOptions,
  InfiniteCanvasWindowConnectorRoute,
  InfiniteCanvasWorldPath,
  InfiniteCanvasWorldSegment,
} from "#/experiments/infinite-canvas/scene-layer-geometry";
export type {
  InfiniteCanvasDesktopProps,
  InfiniteCanvasViewportProps,
} from "#/experiments/infinite-canvas/infinite-canvas";
export type {
  InfiniteCanvasStateInput,
  InfiniteCanvasWindowInput,
} from "#/experiments/infinite-canvas/factory";
export type { InfiniteCanvasStorageKeyInput } from "#/experiments/infinite-canvas/persistence";
export type {
  InfiniteCanvasDiagnosticsPolicy,
  InfiniteCanvasDiagnosticsPolicyInput,
} from "#/experiments/infinite-canvas/diagnostics";
export type { InfiniteCanvasHotkeyRegistrationInput } from "#/experiments/infinite-canvas/keyboard";
export type {
  InfiniteCanvasStateValidator,
  InfiniteCanvasStore,
} from "#/experiments/infinite-canvas/store";
export type {
  InfiniteCanvasRasterDisplayMode,
  InfiniteCanvasRasterizationPolicy,
  InfiniteCanvasRasterizationPolicyInput,
  InfiniteCanvasRasterSnapshot,
  InfiniteCanvasRasterSummary,
} from "#/experiments/infinite-canvas/rasterization-layer";
export type {
  InfiniteCanvasVisibilityState,
  InfiniteCanvasVisibilitySummary,
  InfiniteCanvasWindowFrustumVisibility,
} from "#/experiments/infinite-canvas/visibility";
export type {
  InfiniteCanvasWindowPresence,
  InfiniteCanvasWindowPresenceItem,
} from "#/experiments/infinite-canvas/window-presence";
export type {
  InfiniteCanvasScenePlane,
  InfiniteCanvasWindowBodyProjection,
  InfiniteCanvasWindowSceneChromeMetrics,
  InfiniteCanvasWindowSceneHandle,
  InfiniteCanvasWindowSceneShell,
  InfiniteCanvasWindowSceneShellLayout,
} from "#/experiments/infinite-canvas/window-scene-shell";
export type {
  InfiniteCanvasSpatialEdgeTarget,
  InfiniteCanvasSpatialRectTarget,
  InfiniteCanvasSpatialTargetInput,
  InfiniteCanvasSpatialTargetResolverInput,
  InfiniteCanvasSpatialTargetSource,
} from "#/experiments/infinite-canvas/spatial-target";
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
} from "#/experiments/infinite-canvas/types";
