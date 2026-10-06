import { type } from "arktype";
import { canvasModel } from "./schema";
import { getSelectedWindowIds } from "./selection";
import type {
  InfiniteCanvasCommandDescriptor,
  InfiniteCanvasState,
  InfiniteCanvasWindowDefinition,
} from "./types";

type ActionRegistry = Readonly<
  Record<string, Pick<InfiniteCanvasWindowDefinition, "schema" | "actions">>
>;

export function getComponentActionDescriptors<Kind extends string>({
  state,
  windowDefinitions,
}: Readonly<{
  state: InfiniteCanvasState<Kind>;
  windowDefinitions: ActionRegistry;
}>): readonly InfiniteCanvasCommandDescriptor[] {
  if (state.selection.targets.some((target) => target.type !== "window")) return [];
  const windows = state.windows.filter(({ id }) =>
    getSelectedWindowIds(state.selection).includes(id),
  );
  const [window] = windows;
  if (window === undefined || windows.some(({ kind }) => kind !== window.kind)) return [];
  return Object.entries(windowDefinitions[window.kind]?.actions ?? {}).map(
    ([actionId, action]) => ({
      id: `component:${encodeURIComponent(window.kind)}:${encodeURIComponent(actionId)}`,
      label: action.label,
      description: action.description ?? action.label,
      hotkeys: [],
      command: { type: "component.action", actionId, windowIds: windows.map(({ id }) => id) },
    }),
  );
}

export function resolveComponentAction<Kind extends string>({
  state,
  windowDefinitions,
  actionId,
  windowIds,
}: Readonly<{
  state: InfiniteCanvasState<Kind>;
  windowDefinitions?: ActionRegistry;
  actionId: string;
  windowIds: readonly string[];
}>): InfiniteCanvasState<Kind> | Error {
  const ids = new Set(windowIds);
  const windows = state.windows.filter(({ id }) => ids.has(id));
  const [window] = windows;
  if (
    window === undefined ||
    windows.length !== ids.size ||
    windows.some(({ kind }) => kind !== window.kind)
  )
    return new Error("Select components of one kind.");
  const definition = windowDefinitions?.[window.kind];
  const action = definition?.actions?.[actionId];
  const schema = definition?.schema;
  if (schema === undefined || action === undefined)
    return new Error("The component action is unavailable.");
  if (windows.length > 1 && action.multiple !== true)
    return new Error("This action requires one component.");
  const changes = windows.map((window) => {
    const data = canvasModel.JsonObject(window.data);
    if (data instanceof type.errors) return new Error(data.summary);
    const props = schema(data);
    if (props instanceof type.errors) return new Error(props.summary);
    const enabled = action.enabled?.(props) ?? true;
    if (enabled !== true)
      return new Error(
        typeof enabled === "string" ? enabled : "The component action is unavailable.",
      );
    const patch = action.set ?? action.update(props);
    if (patch instanceof Error) return patch;
    const next = canvasModel.JsonObject({ ...data, ...patch });
    if (next instanceof type.errors) return new Error(next.summary);
    const valid = schema(next);
    if (valid instanceof type.errors) return new Error(valid.summary);
    return { ...window, data: next };
  });
  const error = changes.find((change): change is Error => change instanceof Error);
  if (error !== undefined) return error;
  const changed = new Map(
    changes.flatMap((window) => (window instanceof Error ? [] : [[window.id, window] as const])),
  );
  return { ...state, windows: state.windows.map((window) => changed.get(window.id) ?? window) };
}
