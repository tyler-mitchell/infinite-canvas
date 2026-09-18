import { type } from "arktype";
import { flatMorph } from "@ark/util";
import { cameraNavigation } from "./camera";
import { getParents } from "./layout/tree";
import type { CanvasState } from "./state.types";
import type { TargetKey } from "./selection";

const schema = type.module({
  Finite: type("number").narrow(
    (value, ctx) => Number.isFinite(value) || ctx.mustBe("a finite number"),
  ),
  Positive: "Finite > 0",
  Nonnegative: "Finite >= 0",
  Point: { x: "Finite", y: "Finite" },
  Size: { width: "Positive", height: "Positive" },
  Rect: { x: "Finite", y: "Finite", width: "Positive", height: "Positive" },
  Window: {
    "id?": "string > 0",
    "kind?": "string > 0",
    title: "string = ''",
    mode: "'normal' | 'minimized' | 'maximized' = 'normal'",
    isPinned: "boolean = false",
    heightMode: "'content' | 'manual' = 'content'",
    rect: "Rect",
    "restoreRect?": "Rect",
    "data?": "unknown",
    "minSize?": "Size",
    "maxSize?": "Size",
    "aspectRatio?": "Positive",
    "layout?": { type: "string > 0", "[string]": "unknown" },
    "children?": "string[]",
    "item?": { "[string]": "unknown" },
    "capabilities?": {
      "closable?": "boolean",
      "maximizable?": "boolean",
      "minimizable?": "boolean",
      "movable?": "boolean",
      "resizable?": "boolean",
    },
  },
  Content: {
    windows: [{ "[string]": "Window" }, "=", () => ({})],
    connections: [
      {
        "[string]": {
          "id?": "string > 0",
          kind: "string",
          from: "string",
          to: "string",
          "data?": "unknown",
        },
      },
      "=",
      () => ({}),
    ],
    workspaces: [
      { "[string]": { "id?": "string > 0", title: "string", windowIds: "string[]" } },
      "=",
      () => ({}),
    ],
    "workspaceOrder?": "string[]",
    cameraStops: [
      type({ id: "string > 0", "title?": "string", navigation: cameraNavigation }).array(),
      "=",
      () => [],
    ],
  },
  TargetKey: type("string").narrow(
    (key, ctx): key is TargetKey => key.includes(":") || ctx.mustBe("a qualified selection key"),
  ),
  Target: { type: "string > 0", id: "string > 0", "kind?": "string", "data?": "unknown" },
  Selection: { targets: { "[string]": "Target" }, anchor: "TargetKey | null" },
  Camera: { center: "Point", zoom: "Positive" },
  View: {
    activeWindowId: "string | null = null",
    cameraStopId: "string | null = null",
    camera: ["Camera", "=", () => ({ center: { x: 0, y: 0 }, zoom: 1 })],
    selection: ["Selection", "=", () => ({ targets: {}, anchor: null })],
    stackingOrder: ["TargetKey[]", "=", () => []],
    activeChildren: [{ "[string]": "string" }, "=", () => ({})],
  },
  Capabilities: {
    closable: "boolean = true",
    maximizable: "boolean = true",
    minimizable: "boolean = true",
    movable: "boolean = true",
    resizable: "boolean = true",
  },
  WindowDefinition: {
    size: ["Size", "=", () => ({ width: 320, height: 240 })],
    "minSize?": "Size",
    "aspectRatio?": "Positive",
    capabilities: ["Capabilities", "=", () => ({})],
    bodyDragThreshold: "Nonnegative = 4",
    headerDragThreshold: "Nonnegative = 0",
    resizeDragThreshold: "Nonnegative = 0",
    maximizePadding: "Nonnegative = 36",
    "schema?": "unknown",
    detail: [
      { summaryBelow: "Nonnegative = 180", fullAbove: "Nonnegative = 240" },
      "=",
      () => ({}),
    ],
  },
  Pointer: {
    pointerId: "number.integer",
    point: "Point",
    altKey: "boolean",
    ctrlKey: "boolean",
    metaKey: "boolean",
    shiftKey: "boolean",
  },
  ResizeHandle:
    "'north' | 'south' | 'east' | 'west' | 'north-east' | 'north-west' | 'south-east' | 'south-west'",
  CameraLimits: {
    minZoom: "Positive = 0.1",
    maxZoom: "Positive = 4",
    zoomSpeed: "Positive = 0.002",
    padding: "Nonnegative = 36",
  },
  Placement: {
    gap: "Nonnegative = 0",
    reach: "Nonnegative = 6",
    undock: "'keep' | 'vacancy' = 'keep'",
    dissolve: "'keep' | 'vacancy' = 'vacancy'",
  },
  Viewport: { width: "Nonnegative", height: "Nonnegative" },
  ViewportInsets: {
    top: "Nonnegative = 0",
    right: "Nonnegative = 0",
    bottom: "Nonnegative = 0",
    left: "Nonnegative = 0",
  },
  Input: {
    pointer: "Pointer | null = null",
    viewport: ["Viewport", "=", () => ({ width: 0, height: 0 })],
    viewportInsets: ["ViewportInsets", "=", () => ({})],
    viewportOccluders: ["Rect[]", "=", () => []],
    contentSizes: [{ "[string]": "Size" }, "=", () => ({})],
  },
});

const keyed = <Entity extends { id?: string }>(record: Record<string, Entity>) =>
  flatMorph(record, (id, entity) => [id, { ...entity, id }]);

const content = schema.Content.pipe((input, ctx) => {
  const records = [input.windows, input.connections, input.workspaces];
  if (
    records.some(
      (record) =>
        Array.isArray(record) ||
        Object.entries(record).some(([id, entity]) => entity.id !== undefined && entity.id !== id),
    )
  )
    return ctx.error("entity records keyed by their IDs");
  const content = {
    ...input,
    windows: keyed(input.windows),
    connections: keyed(input.connections),
    workspaces: keyed(input.workspaces),
  };
  const windows = Object.values(content.windows);
  if (windows.some((window) => window.kind === undefined && window.layout === undefined))
    return ctx.error("windows with a kind or a layout");
  if (windows.some((window) => (window.children !== undefined) !== (window.layout !== undefined)))
    return ctx.error("children on windows with a layout only");
  const children = windows.flatMap((window) => window.children ?? []);
  if (
    new Set(children).size !== children.length ||
    children.some((id) => content.windows[id] === undefined)
  )
    return ctx.error("live child windows with one parent each");
  const parents = getParents(content.windows);
  const rooted = ({ id, steps }: { id: string; steps: number }): boolean =>
    parents[id] === undefined || (steps > 0 && rooted({ id: parents[id], steps: steps - 1 }));
  if (windows.some((window) => !rooted({ id: window.id, steps: windows.length })))
    return ctx.error("window trees without cycles");
  if (
    Object.values(content.connections).some(
      (connection) => !content.windows[connection.from] || !content.windows[connection.to],
    )
  )
    return ctx.error("connections between live windows");
  if (
    Object.values(content.workspaces).some(
      (workspace) =>
        new Set(workspace.windowIds).size !== workspace.windowIds.length ||
        workspace.windowIds.some((id) => !content.windows[id]),
    )
  )
    return ctx.error("distinct live workspace members");
  if (new Set(content.cameraStops.map((stop) => stop.id)).size !== content.cameraStops.length)
    return ctx.error("distinct camera stop IDs");
  const workspaceOrder = content.workspaceOrder ?? Object.keys(content.workspaces);
  return workspaceOrder.length === Object.keys(content.workspaces).length &&
    new Set(workspaceOrder).size === workspaceOrder.length &&
    workspaceOrder.every((id) => content.workspaces[id] !== undefined)
    ? { ...content, workspaceOrder }
    : ctx.error("one ordering entry per workspace");
});

export const viewState = schema.View.narrow(
  (view, ctx) =>
    (Object.entries(view.selection.targets).every(
      ([key, target]) => key === `${target.type}:${target.id}`,
    ) &&
      (view.selection.anchor === null ||
        view.selection.targets[view.selection.anchor] !== undefined)) ||
    ctx.mustBe("selection keys and an anchor matching their targets"),
);

export const canvasSnapshot = type({
  content: content.default(() => ({})),
  canvasView: viewState.default(() => ({})),
  workspaceViews: type({ "[string]": viewState }).default(() => ({})),
  activeWorkspaceId: "string | null = null",
}).pipe((document, ctx) => {
  const workspaceViews = {
    ...Object.fromEntries(
      Object.keys(document.content.workspaces).map((id) => [
        id,
        viewState.assert({
          camera: document.canvasView.camera,
        }),
      ]),
    ),
    ...document.workspaceViews,
  };
  return (document.activeWorkspaceId === null ||
    document.content.workspaces[document.activeWorkspaceId] !== undefined) &&
    Object.keys(workspaceViews).every((id) => document.content.workspaces[id] !== undefined)
    ? { ...document, workspaceViews }
    : ctx.error("views for live workspaces");
});

const windowDefinition = schema.WindowDefinition.pipe(({ schema, ...definition }) => ({
  ...definition,
  minSize:
    definition.minSize ??
    (schema === undefined ? { width: 100, height: 80 } : { width: 1, height: 1 }),
}));
export const containerDefinition = windowDefinition.assert({ minSize: { width: 1, height: 1 } });
const cameraLimits = schema.CameraLimits.narrow(
  (camera, ctx) => camera.minZoom <= camera.maxZoom || ctx.mustBe("ordered zoom limits"),
);

export const canvasStateSchema = type({
  config: {
    windowDefinitions: { "[string]": windowDefinition },
    historyLimit: "number.integer >= 0 = 100",
    dropThreshold: "number >= 0 = 6",
    nudge: type({ step: "number > 0 = 1", largeStep: "number > 0 = 10" }).default(() => ({})),
    camera: cameraLimits.default(() => ({})),
    placement: schema.Placement.default(() => ({})),
    docking: type({ edgeZone: "0 <= number <= 0.5 = 0.25" }).default(() => ({})),
    snapping: type({
      enabled: "boolean = true",
      threshold: "number >= 0 = 6",
      edges: "boolean = true",
      centers: "boolean = true",
    }).default(() => ({})),
  },
  document: canvasSnapshot.default(() => ({})),
  input: schema.Input.default(() => ({})),
}).pipe((state): CanvasState => ({
  ...state,
  session: {
    camera: null,
    drop: null,
    tabDrag: null,
    drag: null,
    press: null,
    pan: null,
    marquee: null,
  },
}));

export const pointerInput = schema.Pointer;
export const resizeHandle = schema.ResizeHandle;
