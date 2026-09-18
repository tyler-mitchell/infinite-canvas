export { canvasModel } from "./schema";
export type { CameraComposition, CameraFramingMode } from "./types";
export type {
  CameraAnimationRequest,
  CameraNavigation,
  CameraNavigationResult,
  CameraRig,
  CameraRigOptions,
  CameraTransition,
} from "./camera-rig";
export { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
export type { InfiniteCanvasStateInput, InfiniteCanvasWindowInput } from "./factory";
export { createInfiniteCanvasStore } from "./store";
export type {
  InfiniteCanvasSignals,
  InfiniteCanvasStore,
  InfiniteCanvasStoreOptions,
} from "./store";
export { reduceInfiniteCanvasState } from "./operations";
export type { InfiniteCanvasReducerOptions } from "./operations";
export {
  DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS,
  getInfiniteCanvasCommandGroup,
  getInfiniteCanvasContextualCommands,
  getInfiniteCanvasHotkeyBindings,
  isInfiniteCanvasCommandEnabled,
} from "./operations";
export type { CommandId } from "./operations";
export { getInfiniteCanvasContextualEntries } from "./contextual-entries";
export type { InfiniteCanvasContextualEntry } from "./contextual-entries";
export type { InfiniteCanvasHotkeyAction } from "./keyboard";
export {
  DEFAULT_INFINITE_CANVAS_EDGE_PAN,
  DEFAULT_INFINITE_CANVAS_INPUT_POLICY,
  DEFAULT_INFINITE_CANVAS_SNAP_POLICY,
  DEFAULT_INFINITE_CANVAS_ZOOM,
  MIN_RENDERABLE_INFINITE_CANVAS_ZOOM,
  resolveInfiniteCanvasChromeMetrics,
  resolveInfiniteCanvasZoomPolicy,
} from "./constants";
export {
  getInfiniteCanvasContentViewport,
  getInfiniteCanvasContentWorldRect,
  getInfiniteCanvasEdgePanVelocity,
  getInfiniteCanvasOccluderWorldRects,
  getRectCenter,
  getVisibleWorldRect,
  isUsableViewport,
  isWorldRectWithinViewport,
  rectContainsPoint,
  rectsEqual,
  rectsIntersect,
  screenPointToWorldPoint,
  unionRects,
  worldPointToScreenPoint,
  worldRectToScreenRect,
} from "./geometry";
export { getCanvasLayout, getTargetBounds } from "./layout";
export type { CanvasLayout } from "./layout";
export {
  DEFAULT_INFINITE_CANVAS_GROUP_METRICS,
  MINIMUM_GROUP_PANE_EXTENT,
  getInfiniteCanvasGroupDockEdgeAtPoint,
  getInfiniteCanvasGroupGutterWeights,
  getInfiniteCanvasGroupLayout,
  getInfiniteCanvasGroupMinimumSize,
  resolveInfiniteCanvasGroupMetrics,
} from "./layout";
export type {
  InfiniteCanvasGroupAccordionHeader,
  InfiniteCanvasGroupGutter,
  InfiniteCanvasGroupLayout,
  InfiniteCanvasGroupTabStrip,
  InfiniteCanvasGroupWindowPlacement,
} from "./layout";
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
  InfiniteCanvasGroupMasonry,
  InfiniteCanvasGroupNode,
  InfiniteCanvasGroupWindowNode,
  InfiniteCanvasGroupWindowNodeLayout,
} from "./group-tree";
export {
  DEFAULT_INFINITE_CANVAS_GROUP_TITLE,
  findInfiniteCanvasGroup,
  getInfiniteCanvasGroupTabLabel,
  getInfiniteCanvasGroupTitle,
  getInfiniteCanvasGroupableWindowIds,
  getInfiniteCanvasGroupedWindowIds,
  getInfiniteCanvasWindowGroup,
  isInfiniteCanvasWindowGrouped,
  reconcileInfiniteCanvasGroups,
  resolveInfiniteCanvasGroupInsertion,
} from "./group-state";
export type {
  InfiniteCanvasGroupTabLabel,
  InfiniteCanvasGroupTabLabelContext,
} from "./group-state";
export { getDocumentChangeRect, revealDocumentChange } from "./camera-navigation";
export {
  INFINITE_CANVAS_RECIPE_VERSION,
  applyInfiniteCanvasRecipe,
  captureInfiniteCanvasRecipe,
  getInfiniteCanvasRecipeOrigin,
} from "./recipes";
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
  getSelectableWindowIds,
  getSelectedWindowIds,
  getSelectionTargetKey,
  isSelectionTargetSelected,
  normalizeSelection,
  updateSelection,
} from "./selection";
export { getVisibleWindowBounds } from "./layout";
export {
  getInfiniteCanvasMinimizedWindowItems,
  getInfiniteCanvasVisibleWindowItems,
  getInfiniteCanvasWindowPresence,
  getInfiniteCanvasWindowPresenceItem,
} from "./window-presence";
export type {
  InfiniteCanvasWindowPresence,
  InfiniteCanvasWindowPresenceItem,
} from "./window-presence";
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
export type { InfiniteCanvasAlignment, InfiniteCanvasDistribution } from "./window-arrange";
export { getInfiniteCanvasPackedRects } from "./window-packing";
export {
  DEFAULT_INFINITE_CANVAS_DETAIL_POLICY,
  getInfiniteCanvasWindowDetailLevel,
} from "./detail-level";
export type { InfiniteCanvasDetailLevel, InfiniteCanvasDetailPolicy } from "./detail-level";
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
export {
  EMPTY_INFINITE_CANVAS_DROP,
  createInfiniteCanvasDropInteraction,
  getInfiniteCanvasDropPlacement,
  isPointInsideInfiniteCanvasViewport,
  normalizeInfiniteCanvasDropValidation,
} from "./drop-interaction";
export type { InfiniteCanvasDropPlacementInput } from "./drop-interaction";
export {
  createInfiniteCanvasEdgeTargetResolver,
  createInfiniteCanvasOverlayTargetResolver,
  createInfiniteCanvasSceneObjectTargetResolver,
  getInfiniteCanvasSelectableTargetFromSpatialTarget,
  getInfiniteCanvasSelectionBounds,
  resolveInfiniteCanvasSpatialTarget,
} from "./spatial-target";
export type {
  InfiniteCanvasSelectionBoundsInput,
  InfiniteCanvasSpatialEdgeTarget,
  InfiniteCanvasSpatialRectTarget,
  InfiniteCanvasSpatialTargetInput,
  InfiniteCanvasSpatialTargetResolverInput,
  InfiniteCanvasSpatialTargetSource,
} from "./spatial-target";
export { findWindow as findInfiniteCanvasWindow } from "./stacking";
export { isInfiniteCanvasWindowCapable } from "./window-capabilities";
export { findInfiniteCanvasWorkspace } from "./workspace";
export {
  getInfiniteCanvasWorkspaceWindowIds,
  isInfiniteCanvasWindowInActiveWorkspace,
} from "./workspace-membership";
export { getInfiniteCanvasActivity, isInfiniteCanvasActivityTransient } from "./activity";
export type { InfiniteCanvasActivity } from "./activity";
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
  InfiniteCanvasConnection,
  InfiniteCanvasContextualCommand,
  InfiniteCanvasCursor,
  InfiniteCanvasCursorInteraction,
  InfiniteCanvasCursorPolicy,
  InfiniteCanvasDirection,
  InfiniteCanvasDispatch,
  InfiniteCanvasDockPreview,
  InfiniteCanvasDocument,
  InfiniteCanvasDragStartInput,
  InfiniteCanvasDropCommitContext,
  InfiniteCanvasDropInteraction,
  InfiniteCanvasDropPayload,
  InfiniteCanvasDropPlacement,
  InfiniteCanvasDropPolicy,
  InfiniteCanvasDropTargetContext,
  InfiniteCanvasDropValidationInput,
  InfiniteCanvasDropValidationResult,
  InfiniteCanvasEmptyCanvasDragMode,
  InfiniteCanvasFileDropPayload,
  InfiniteCanvasGroup,
  InfiniteCanvasGroupGutterInteraction,
  InfiniteCanvasGroupMetrics,
  InfiniteCanvasGroupMetricsInput,
  InfiniteCanvasGroupResizeInteraction,
  DocumentContent,
  InfiniteCanvasInputPolicy,
  InfiniteCanvasInteraction,
  InfiniteCanvasMarqueeInteraction,
  InfiniteCanvasMarqueeMode,
  InfiniteCanvasMoveInteraction,
  InfiniteCanvasMoveOriginRect,
  InfiniteCanvasNativeDropPayload,
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
  InfiniteCanvasResolvedSpatialTarget,
  InfiniteCanvasSelection,
  InfiniteCanvasSelectionTarget,
  InfiniteCanvasSelectionTargetType,
  InfiniteCanvasSize,
  InfiniteCanvasSnapGuide,
  InfiniteCanvasSnapPolicy,
  InfiniteCanvasSnapPreview,
  InfiniteCanvasSpatialTarget,
  InfiniteCanvasSpatialTargetGeometryContext,
  InfiniteCanvasSpatialTargetResolver,
  InfiniteCanvasSpatialTargetResolverContext,
  InfiniteCanvasSpatialTargetResolverPhase,
  InfiniteCanvasSpatialWindowArea,
  InfiniteCanvasState,
  InfiniteCanvasTextDropPayload,
  InfiniteCanvasViewport,
  InfiniteCanvasViewportInsets,
  InfiniteCanvasViewportInsetsInput,
  InfiniteCanvasViewportOccluder,
  InfiniteCanvasWindow,
  InfiniteCanvasWindowCapabilities,
  InfiniteCanvasWindowCapability,
  InfiniteCanvasWindowMode,
  InfiniteCanvasWindowProximity,
  InfiniteCanvasWorkspace,
  InfiniteCanvasZoomPolicy,
  InfiniteCanvasZoomPolicyInput,
  TransformTarget,
} from "./types";
export { createCanvasTools, type CanvasToolsContext, type CanvasToolsOptions } from "./tools";
export {
  defineComponent,
  defineComponentRegistry,
  createComponentWindow,
  insertComponent,
  editComponentProps,
  type ComponentRenderContext,
} from "./component";
export type { ComponentAction, ContextMenuPolicy } from "./types";
