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
export { useInfiniteCanvasAnnounce } from "./announcer";
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
  MINIMUM_GROUP_PANE_EXTENT,
  getInfiniteCanvasGroupDockEdgeAtPoint,
  getInfiniteCanvasGroupGutterWeights,
  getInfiniteCanvasGroupLayout,
  getInfiniteCanvasGroupMinimumSize,
  resolveInfiniteCanvasGroupMetrics,
} from "./group-layout";
export type {
  InfiniteCanvasGroupAccordionHeader,
  InfiniteCanvasGroupGutter,
  InfiniteCanvasGroupLayout,
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
  DEFAULT_INFINITE_CANVAS_GROUP_TITLE,
  findInfiniteCanvasGroup,
  getInfiniteCanvasGroupProjection,
  getInfiniteCanvasGroupTabLabel,
  getInfiniteCanvasGroupTitle,
  getInfiniteCanvasGroupableWindowIds,
  getInfiniteCanvasGroupedWindowIds,
  getInfiniteCanvasWindowGroup,
  isInfiniteCanvasWindowGrouped,
  reconcileInfiniteCanvasGroups,
} from "./group-state";
export type {
  InfiniteCanvasGroupProjection,
  InfiniteCanvasGroupTabLabel,
  InfiniteCanvasGroupTabLabelContext,
} from "./group-state";
export {
  EMPTY_INFINITE_CANVAS_HISTORY,
  INFINITE_CANVAS_HISTORY_LIMIT,
  canRedoInfiniteCanvas,
  canUndoInfiniteCanvas,
  getInfiniteCanvasDocument,
  getInfiniteCanvasDocumentChangeRect,
  redoInfiniteCanvasHistory,
  undoInfiniteCanvasHistory,
} from "./history";
export {
  INFINITE_CANVAS_RECIPE_VERSION,
  applyInfiniteCanvasRecipe,
  captureInfiniteCanvasRecipe,
  getInfiniteCanvasRecipeOrigin,
} from "./recipes";
export {
  InfiniteCanvasPortal,
  useInfiniteCanvasDesktopPortalRoot,
  useInfiniteCanvasPortalRoots,
  useInfiniteCanvasWindowPortalRoot,
} from "./portal";
export type { InfiniteCanvasPortalScope } from "./portal";
export { createInfiniteCanvasHandle } from "./canvas-handle";
export type { InfiniteCanvasHandle } from "./canvas-handle";
export {
  InfiniteCanvasProvider,
  createInfiniteCanvasStore,
  useInfiniteCanvasActions,
  useInfiniteCanvasSelectionBounds,
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
  parseInfiniteCanvasRecipe,
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
export { getInfiniteCanvasContextualEntries } from "./contextual-entries";
export type { InfiniteCanvasContextualEntry } from "./contextual-entries";
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
export { getInfiniteCanvasWindowProxies, getInfiniteCanvasWindowProxy } from "./window-proxy";
export {
  getInfiniteCanvasMinimizedWindowItems,
  getInfiniteCanvasVisibleWindowItems,
  getInfiniteCanvasWindowPresence,
  getInfiniteCanvasWindowPresenceItem,
} from "./window-presence";
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
export {
  getInfiniteCanvasContextualGroup,
  getInfiniteCanvasDirectionalFocusTarget,
  getInfiniteCanvasWindowNearestCameraCenter,
  isInfiniteCanvasWindowFullyVisible,
} from "./window-focus";
export {
  getInfiniteCanvasPlacedWindowRect,
  getInfiniteCanvasVacantRect,
  getInfiniteCanvasWindowPlacementRect,
} from "./window-placement";
export type {
  InfiniteCanvasWindowPlacement,
  InfiniteCanvasWindowPlacementRegion,
} from "./window-placement";
export {
  getInfiniteCanvasAlignedRects,
  getInfiniteCanvasDistributedRects,
  getInfiniteCanvasSwappedRects,
} from "./window-arrange";
export {
  DEFAULT_INFINITE_CANVAS_DETAIL_POLICY,
  getInfiniteCanvasWindowDetailLevel,
} from "./detail-level";
export type { InfiniteCanvasDetailLevel, InfiniteCanvasDetailPolicy } from "./detail-level";
export type { InfiniteCanvasAlignment, InfiniteCanvasDistribution } from "./window-arrange";
export { getInfiniteCanvasMinimapLayout, getInfiniteCanvasMinimapWorldPoint } from "./minimap";
export type {
  InfiniteCanvasMinimapGroup,
  InfiniteCanvasMinimapLayout,
  InfiniteCanvasMinimapOptions,
  InfiniteCanvasMinimapWindow,
} from "./minimap";
export { getInfiniteCanvasOffscreenIndicators } from "./offscreen";
export type {
  InfiniteCanvasOffscreenIndicator,
  InfiniteCanvasOffscreenOptions,
  InfiniteCanvasOffscreenTargetKind,
} from "./offscreen";
export {
  focusInfiniteCanvasCommandSurface,
  focusInfiniteCanvasCommandSurfaceFrom,
  registerInfiniteCanvasHotkeys,
  shouldHandleInfiniteCanvasKeyboardEvent,
} from "./keyboard";
export {
  DEFAULT_CONNECTION_HANDLE_OFFSET_PX,
  DEFAULT_CONNECTION_HANDLE_RADIUS_PX,
  getInfiniteCanvasConnectionAffordanceRect,
  getInfiniteCanvasConnectionAffordanceWindowId,
  getInfiniteCanvasConnectionHandles,
  getInfiniteCanvasConnectionPreviewPath,
} from "./window-connection";
export type {
  InfiniteCanvasConnectionEdge,
  InfiniteCanvasConnectionHandle,
  InfiniteCanvasConnectionHandleOptions,
} from "./window-connection";
export { cloneInfiniteCanvasState, resetInfiniteCanvasState } from "./state";
// Aliased because the internal name is bare inside a module that is all about windows.
export { findWindow as findInfiniteCanvasWindow } from "./stacking";
export {
  DEFAULT_INFINITE_CANVAS_ZOOM,
  DEFAULT_INFINITE_CANVAS_INPUT_POLICY,
  MIN_RENDERABLE_INFINITE_CANVAS_ZOOM,
  DEFAULT_INFINITE_CANVAS_SNAP_POLICY,
  resolveInfiniteCanvasChromeMetrics,
  resolveInfiniteCanvasZoomPolicy,
} from "./constants";
// Projection and rectangle helpers for consumer overlays and scene layers.
export {
  getInfiniteCanvasContentViewport,
  getInfiniteCanvasContentWorldRect,
  getInfiniteCanvasOccluderWorldRects,
  getRectCenter,
  getVisibleWorldRect,
  isUsableViewport,
  isWorldRectWithinViewport,
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
  DEFAULT_INFINITE_CANVAS_COMPOSITOR,
  resolveInfiniteCanvasCompositorPolicy,
} from "./compositor/policy";
export type {
  InfiniteCanvasAreaLightOptions,
  InfiniteCanvasCompositorPolicy,
  InfiniteCanvasCompositorPolicyInput,
  InfiniteCanvasContactShadowOptions,
  InfiniteCanvasFocusFieldOptions,
  InfiniteCanvasGridOptions,
  InfiniteCanvasParticleFieldOptions,
  InfiniteCanvasProximityOptions,
} from "./compositor/policy";
export {
  EMPTY_INFINITE_CANVAS_DROP,
  createInfiniteCanvasDropInteraction,
  getInfiniteCanvasDropPlacement,
  isPointInsideInfiniteCanvasViewport,
  normalizeInfiniteCanvasDropValidation,
} from "./drop-interaction";
export type { InfiniteCanvasDropPlacementInput } from "./drop-interaction";
export { getInfiniteCanvasNativeDropPayload, URI_LIST_TYPE } from "./native-drop";
export {
  createInfiniteCanvasEdgeTargetResolver,
  createInfiniteCanvasOverlayTargetResolver,
  createInfiniteCanvasSceneObjectTargetResolver,
  getInfiniteCanvasSelectableTargetFromSpatialTarget,
  getInfiniteCanvasSelectionBounds,
  getInfiniteCanvasSelectionTargetBounds,
  resolveInfiniteCanvasSpatialTarget,
} from "./spatial-target";
export type { InfiniteCanvasSelectionBoundsInput } from "./spatial-target";
export {
  DEFAULT_INFINITE_CANVAS_RASTERIZATION,
  resolveInfiniteCanvasRasterizationPolicy,
} from "./rasterization-layer";
export { useInfiniteCanvasVisibilitySummary, useInfiniteCanvasWindowFramed } from "./visibility";
export type {
  InfiniteCanvasPathDataOptions,
  InfiniteCanvasRectFacing,
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
export type { InfiniteCanvasHotkeyAction, InfiniteCanvasHotkeyRegistrationInput } from "./keyboard";
export type {
  InfiniteCanvasSignals,
  InfiniteCanvasStateValidator,
  InfiniteCanvasStore,
} from "./store";
export type {
  InfiniteCanvasRasterDisplayMode,
  InfiniteCanvasRasterizationPolicy,
  InfiniteCanvasRasterizationPolicyInput,
  InfiniteCanvasRasterSnapshot,
  InfiniteCanvasRasterSummary,
} from "./rasterization-layer";
export type { InfiniteCanvasVisibilityState, InfiniteCanvasVisibilitySummary } from "./visibility";
export type {
  InfiniteCanvasWindowPresence,
  InfiniteCanvasWindowPresenceItem,
} from "./window-presence";
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
  InfiniteCanvasChromeMetricsInput,
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
  InfiniteCanvasGroupMetrics,
  InfiniteCanvasGroupMetricsInput,
  InfiniteCanvasGroupMoveInteraction,
  InfiniteCanvasGroupResizeInteraction,
  InfiniteCanvasHistory,
  InfiniteCanvasDropCommitContext,
  InfiniteCanvasDropPlacement,
  InfiniteCanvasDropInteraction,
  InfiniteCanvasDropPayload,
  InfiniteCanvasDropPolicy,
  InfiniteCanvasDropTargetContext,
  InfiniteCanvasDropValidationInput,
  InfiniteCanvasDropValidationResult,
  InfiniteCanvasEmptyCanvasDragMode,
  InfiniteCanvasFileDropPayload,
  InfiniteCanvasNativeDropPayload,
  InfiniteCanvasTextDropPayload,
  InfiniteCanvasInputPolicy,
  InfiniteCanvasInteraction,
  InfiniteCanvasHotkeyBinding,
  InfiniteCanvasHudPolicy,
  InfiniteCanvasHudPolicyInput,
  InfiniteCanvasMarqueeInteraction,
  InfiniteCanvasMarqueeMode,
  InfiniteCanvasMoveInteraction,
  InfiniteCanvasMoveOriginRect,
  InfiniteCanvasOverlayReadContext,
  InfiniteCanvasOverlayRenderContext,
  InfiniteCanvasPanInteraction,
  InfiniteCanvasPoint,
  InfiniteCanvasPointerMode,
  InfiniteCanvasRecipe,
  InfiniteCanvasRecipeGroup,
  InfiniteCanvasRecipePlacement,
  InfiniteCanvasRecipeWindow,
  InfiniteCanvasRect,
  InfiniteCanvasResizeHandle,
  InfiniteCanvasResizeInteraction,
  InfiniteCanvasResolvedDropTarget,
  InfiniteCanvasResolveSpatialTarget,
  InfiniteCanvasResolvedSpatialTarget,
  InfiniteCanvasSceneLayerPlacement,
  InfiniteCanvasSceneLayerRenderContext,
  InfiniteCanvasSceneLayerSpace,
  InfiniteCanvasSerializedState,
  InfiniteCanvasSelection,
  InfiniteCanvasSelectionTarget,
  InfiniteCanvasSelectionTargetType,
  InfiniteCanvasSize,
  InfiniteCanvasSpatialTarget,
  InfiniteCanvasSpatialTargetGeometryContext,
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
  InfiniteCanvasViewportInsets,
  InfiniteCanvasViewportInsetsInput,
  InfiniteCanvasViewportOccluder,
  InfiniteCanvasWindow,
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
  InfiniteCanvasWindowCapabilities,
  InfiniteCanvasWindowCapability,
  InfiniteCanvasWindowMode,
  InfiniteCanvasWindowProximity,
  InfiniteCanvasWindowProxy,
  InfiniteCanvasWindowRegistry,
  InfiniteCanvasWindowRegistryInput,
  InfiniteCanvasWindowRenderContext,
  InfiniteCanvasWindowTextSelection,
  InfiniteCanvasWindowWheelBehavior,
  InfiniteCanvasWorkspace,
  InfiniteCanvasZoomPolicy,
  InfiniteCanvasZoomPolicyInput,
} from "./types";
export { isInfiniteCanvasWindowCapable } from "./window-capabilities";
export { useInfiniteCanvasWindowProximity } from "./window-proximity";
export { findInfiniteCanvasWorkspace } from "./workspace";
export { getInfiniteCanvasActivity, isInfiniteCanvasActivityTransient } from "./activity";
export type { InfiniteCanvasActivity } from "./activity";
export {
  getInfiniteCanvasWorkspaceWindowIds,
  isInfiniteCanvasWindowInActiveWorkspace,
} from "./workspace-membership";
