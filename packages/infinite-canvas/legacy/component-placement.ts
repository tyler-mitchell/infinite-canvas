import { type } from "arktype";
import { createComponentWindow, DEFAULT_COMPONENT_SIZE } from "./component";
import { resolveInfiniteCanvasGroupInsertion } from "./group-state";
import { getCanvasLayout } from "./layout";
import { reduceInfiniteCanvasState } from "./operations";
import type {
  InfiniteCanvasPoint,
  InfiniteCanvasSize,
  InfiniteCanvasState,
  InfiniteCanvasWindowDefinition,
} from "./types";

export function resolveComponentPlacement<Kind extends string>({
  state,
  components,
  componentId,
  windowId,
  worldPoint,
  contentSize,
  size = DEFAULT_COMPONENT_SIZE,
}: Readonly<{
  state: InfiniteCanvasState<Kind>;
  components: Readonly<Record<string, InfiniteCanvasWindowDefinition<Kind>>>;
  componentId: string;
  windowId: string;
  worldPoint?: InfiniteCanvasPoint;
  contentSize?: InfiniteCanvasSize;
  size?: InfiniteCanvasSize;
}>) {
  const definition = components[componentId];
  if (definition?.schema === undefined) return new Error("The component is not registered.");
  if (state.windows.some((window) => window.id === windowId))
    return new Error("That window id is already in use.");
  const componentSize = definition.size ?? size;
  const point = worldPoint ?? state.camera.center;
  const schema = definition.schema;
  const project = (measured?: InfiniteCanvasSize) => {
    const height = measured?.height ?? componentSize.height;
    const rect = {
      ...componentSize,
      height,
      x: point.x - componentSize.width / 2,
      y: point.y - height / 2,
    };
    const insertion =
      worldPoint === undefined
        ? null
        : resolveInfiniteCanvasGroupInsertion({ state, worldPoint, windowId, rect });
    const targets = state.selection.targets;
    const [selected] = targets;
    const selectedGroup =
      worldPoint === undefined && targets.length === 1 && selected?.type === "group"
        ? state.groups.find((group) => group.id === selected.id)
        : undefined;
    const target =
      insertion?.target ??
      (selectedGroup === undefined ? undefined : { groupId: selectedGroup.id });
    const input = {
      windowId,
      componentId,
      props: {},
      rect: insertion?.rect ?? rect,
      ...(target === undefined ? {} : { target }),
      ...(measured === undefined ? {} : { contentSize: measured }),
    };
    const window = createComponentWindow({
      id: windowId,
      definition: {
        kind: definition.kind,
        schema,
        minSize: definition.minSize,
        aspectRatio: definition.aspectRatio,
      },
      contentSize: measured,
      props: input.props,
      rect: input.rect,
    });
    if (window instanceof type.errors) return window;
    const preview = reduceInfiniteCanvasState(state, { type: "window.open", window, target });
    const placement = getCanvasLayout(preview).windowRects.get(windowId);
    if (placement === undefined) return new Error("The component cannot be inserted here.");
    return { input, rect: placement, window };
  };
  const initial = project();
  if (
    initial instanceof Error ||
    initial instanceof type.errors ||
    contentSize?.width !== initial.rect.width
  )
    return initial;
  return project(contentSize);
}
