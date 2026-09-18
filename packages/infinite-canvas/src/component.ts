import { canvasModel } from "./schema";
import { type, type Type } from "arktype";
import type { ReactNode } from "react";
import type { InfiniteCanvasStore } from "./store";
import type { CameraRig } from "./camera-rig";
import { createInfiniteCanvasWindow } from "./factory";
import { findInfiniteCanvasGroupNode } from "./group-tree";
import { layoutDefinitions } from "./layout";
import type {
  ComponentAction,
  InfiniteCanvasRect,
  InfiniteCanvasSize,
  InfiniteCanvasWindowDefinition,
} from "./types";

export const DEFAULT_COMPONENT_SIZE: InfiniteCanvasSize = { width: 320, height: 240 };

export type ComponentRenderContext = Readonly<{
  camera: CameraRig;
  windowId: string;
  onPropsChange: (props: Record<string, unknown>) => void;
  onContentHeightChange?: (height: number) => void;
}>;

type ComponentOptions = Omit<
  InfiniteCanvasWindowDefinition,
  "actions" | "kind" | "renderBody" | "renderComponent" | "schema"
>;

export function defineComponent<Schema extends Type, const Id extends string>({
  id,
  schema,
  render,
  size,
  ...window
}: ComponentOptions &
  Readonly<{
    id: Id;
    schema: Schema;
    size?: InfiniteCanvasSize;
    actions?: Readonly<Record<string, ComponentAction<Schema["infer"]>>>;
    render?: (props: Schema["infer"], context: ComponentRenderContext) => ReactNode;
  }>) {
  return {
    ...window,
    kind: id,
    schema,
    size,
    renderComponent: render,
  };
}

export function defineComponentRegistry<const Schemas extends Readonly<Record<string, Type>>>({
  components,
  window = {},
}: Readonly<{
  window?: ComponentOptions;
  components: {
    readonly [Id in keyof Schemas]: ComponentOptions &
      Readonly<{
        schema: Schemas[Id];
        size?: InfiniteCanvasSize;
        actions?: Readonly<Record<string, ComponentAction<Schemas[Id]["infer"]>>>;
        render?: (props: Schemas[Id]["infer"], context: ComponentRenderContext) => ReactNode;
      }>;
  };
}>) {
  return Object.fromEntries(
    Object.entries(components).map(([id, definition]) => [
      id,
      defineComponent({ ...window, ...definition, id }),
    ]),
  ) as {
    readonly [Id in keyof Schemas & string]: ReturnType<typeof defineComponent<Schemas[Id], Id>>;
  };
}

/** Creates a window with validated, serializable component props. */
export function createComponentWindow<Kind extends string>({
  id,
  definition,
  contentSize,
  props,
  rect,
}: Readonly<{
  id: string;
  definition: Readonly<{
    kind: Kind;
    schema: Type;
    minSize?: InfiniteCanvasSize;
    aspectRatio?: number;
  }>;
  contentSize?: InfiniteCanvasSize;
  props: unknown;
  rect: InfiniteCanvasRect;
}>) {
  const input = canvasModel.ComponentCreate({
    windowId: id,
    componentId: definition.kind,
    ...(contentSize === undefined ? {} : { contentSize }),
    props,
    rect,
  });
  if (input instanceof type.errors) return input;
  const parsed = definition.schema(input.props);
  if (parsed instanceof type.errors) return parsed;
  return createInfiniteCanvasWindow({
    aspectRatio: definition.aspectRatio,
    contentSize: input.contentSize,
    minSize: definition.minSize ?? { width: 1, height: 1 },
    id,
    kind: definition.kind,
    title: definition.kind,
    rect,
    data: input.props,
  });
}

/** Inserts a registered component through the current store. */
export function insertComponent<Kind extends string>({
  store,
  input,
}: Readonly<{
  store: InfiniteCanvasStore<Kind>;
  input: unknown;
}>) {
  const creation = canvasModel.ComponentCreate(input);
  if (creation instanceof type.errors) return creation;
  const state = store.getState();
  if (state.windows.some((window) => window.id === creation.windowId))
    return new Error("That window id is already in use.");
  const target = creation.target;
  const group = target && state.groups.find((group) => group.id === target.groupId);
  const container =
    group && findInfiniteCanvasGroupNode(group.tree, target?.containerId ?? group.tree.id);
  if (
    target &&
    (container === null ||
      container === undefined ||
      (target.containerId !== undefined && container.kind !== "container"))
  )
    return new Error("The target group container does not exist.");
  if (
    target?.layout &&
    (container?.kind !== "container" ||
      layoutDefinitions[container.layout].members?.drop === undefined)
  )
    return new Error("The target layout does not support member placement.");
  const definition = store.windowDefinitions[creation.componentId];
  if (definition === undefined) return new Error("The component is not registered.");
  if (definition.schema === undefined) return new Error("The window kind has no component schema.");
  const size = definition.size ?? DEFAULT_COMPONENT_SIZE;
  const rect = creation.rect ?? {
    ...size,
    x: state.camera.center.x - size.width / 2,
    y: state.camera.center.y - size.height / 2,
  };
  const window = createComponentWindow({
    id: creation.windowId,
    definition: {
      kind: definition.kind,
      schema: definition.schema,
      minSize: definition.minSize,
      aspectRatio: definition.aspectRatio,
    },
    contentSize: creation.contentSize,
    props: creation.props,
    rect,
  });
  if (window instanceof type.errors) return window;
  store.dispatch({ type: "window.open", window, target });
  return (
    store.getState().windows.find((item) => item.id === window.id) ??
    new Error("The component could not be inserted.")
  );
}

export function editComponentProps<Kind extends string>({
  store,
  input,
}: Readonly<{
  store: InfiniteCanvasStore<Kind>;
  input: unknown;
}>) {
  const edit = canvasModel.ComponentPropsEdit(input);
  if (edit instanceof type.errors) return edit;
  const window = store.getState().windows.find((item) => item.id === edit.windowId);
  if (window === undefined) return new Error("The component window is missing.");
  const definition = store.windowDefinitions[window.kind];
  if (definition?.schema === undefined) return new Error("The component definition is missing.");
  const instance = canvasModel.JsonObject(window.data);
  if (instance instanceof type.errors) return instance;
  const props = { ...instance, ...edit.props };
  const parsed = definition.schema(props);
  if (parsed instanceof type.errors) return parsed;
  store.dispatch({ type: "window.setData", windowId: window.id, data: props });
  return props;
}
