import { type, type ArkErrors, type Type } from "arktype";
import type { CanvasContext } from "./state.types";
import type { WindowState } from "./document.types";
import { intersectsRect, type Point, type Rect } from "./geometry";
import { getDockArrangement } from "./layout/dock";

export type ComponentAction<Props> = {
  label: string;
  icon?: string;
  multiple?: boolean;
  enabled?: (props: Props) => boolean;
} & (
  | { set: Partial<Props>; update?: never }
  | { set?: never; update: (props: Props) => Partial<Props> }
);

export type ComponentActionRuntime = {
  label: string;
  icon: string;
  multiple: boolean;
  apply: (data: unknown) => unknown;
};

export function bindComponentActions<Schema extends Type>({
  schema,
  actions,
}: {
  schema: Schema;
  actions: Readonly<Record<string, ComponentAction<Schema["infer"]>>>;
}): Readonly<Record<string, ComponentActionRuntime>> {
  return Object.fromEntries(
    Object.entries(actions).map(([id, action]) => [
      id,
      {
        label: action.label,
        icon: action.icon ?? "edit",
        multiple: action.multiple ?? false,
        apply: (data: unknown) => {
          const props = schema.out(data);
          if (props instanceof type.errors) return props;
          if (props === null || typeof props !== "object" || Array.isArray(props))
            return new Error("Component actions require object properties.");
          if (action.enabled?.(props) === false)
            return new Error("The component action is unavailable.");
          const patch = action.update === undefined ? action.set : action.update(props);
          return schema.out(Object.assign({}, props, patch));
        },
      },
    ]),
  );
}

export const placementRegion = type.enumerated(
  "center",
  "fill",
  "left",
  "right",
  "top",
  "bottom",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
);

export const windowCreation = type({
  "id?": "string > 0",
  kind: "string > 0",
  title: "string",
  "data?": "unknown",
  "rect?": { x: "number", y: "number", width: "number > 0", height: "number > 0" },
  "placement?": {
    "region?": placementRegion,
    "gap?": "number >= 0",
  },
  "target?": { window: "string > 0", "edge?": "'north' | 'south' | 'east' | 'west' | 'center'" },
});

export type WindowCreation = typeof windowCreation.infer;

export type ComponentPlacement = { input: WindowCreation; window: WindowState; rect: Rect };
export const componentInsertion = type({
  kind: "string > 0",
  id: "string > 0",
  "data?": "unknown",
  "point?": { x: "number", y: "number" },
  "size?": { width: "number > 0", height: "number > 0" },
});
export type ComponentInsertion = typeof componentInsertion.infer;
export type ComponentDrop = {
  pointerId: number | null;
  startPoint: Point;
  point: Point;
  insertion: ComponentInsertion;
  threshold: number;
  phase: "press" | "drag";
};

export function getComponentPlacement({
  canvas,
  insertion,
}: {
  canvas: Pick<CanvasContext, "state" | "computed" | "configuration" | "inputs">;
  insertion: ComponentInsertion;
}): ComponentPlacement | ArkErrors | Error {
  const component = canvas.configuration.components[insertion.kind];
  if (component?.schema === undefined) return new Error("The component is not registered.");
  const point = insertion.point ?? canvas.computed.camera.center.get();
  if (
    insertion.point !== undefined &&
    Object.entries(canvas.computed.occupiedRects.get()).some(
      ([id, rect]) =>
        id.startsWith("occluder:") &&
        intersectsRect({ rect, other: { ...point, width: 0, height: 0 } }),
    )
  ) {
    return new Error("Drop on the canvas, outside its controls.");
  }
  const preferredSize = canvas.state.config.windowDefinitions[insertion.kind].size.get();
  const measured = canvas.state.input.contentSizes[insertion.id].get();
  const size =
    insertion.size ?? (measured?.width === preferredSize.width ? measured : preferredSize);
  const selection = canvas.computed.selectionTargets;
  const selected =
    insertion.point === undefined && selection.length === 1 && selection[0].type.get() === "window"
      ? canvas.state.document.content.windows[selection[0].id.get()]
      : undefined;
  const drop = canvas.computed.dockDrop.get();
  const activeDrop = drop?.window === insertion.id ? drop : null;
  const container =
    selected?.layout.get() === undefined ? undefined : { window: selected.id.get() };
  const target =
    activeDrop === null ? container : { window: activeDrop.target, edge: activeDrop.edge };
  const preferred = { ...size, x: point.x - size.width / 2, y: point.y - size.height / 2 };
  const input: WindowCreation = {
    id: insertion.id,
    kind: insertion.kind,
    title: component.label ?? insertion.kind,
    data: insertion.data ?? {},
    ...(target === undefined ? {} : { target }),
    rect: preferred,
  };
  const creation = canvas.inputs.openWindow(input);
  if (creation instanceof type.errors) return creation;
  const rootId = target === undefined ? undefined : canvas.computed.windowRoot[target.window].get();
  const rootRect = rootId === undefined ? undefined : canvas.computed.rootRect[rootId].get();
  const docked =
    activeDrop !== null
      ? canvas.computed.arrangement[rootId!].rects[insertion.id].get()
      : rootId === undefined || rootRect === undefined || container === undefined
        ? undefined
        : getDockArrangement({
            rootId,
            rect: rootRect,
            windows: canvas.computed.subtree[rootId].windows.get(),
            limits: canvas.computed.subtree[rootId].limits.get(),
            layouts: canvas.configuration.layouts,
            wrappers: canvas.configuration.wrappers,
            drop: {
              window: insertion.id,
              target: container.window,
              edge: "center",
              rect: creation.rect,
              kind: insertion.kind,
            },
            active: canvas.computed.view.activeChildren.get(),
            operations: canvas.computed.operations[rootId].get(),
            minSize: canvas.state.config.windowDefinitions[insertion.kind].minSize.get(),
            measured,
          }).rects[insertion.id];
  const rect = docked ?? creation.rect;
  return {
    input,
    rect,
    window: {
      id: insertion.id,
      kind: insertion.kind,
      title: creation.title,
      data: creation.data,
      mode: "normal",
      heightMode: "content",
      isPinned: false,
      rect,
    },
  };
}
