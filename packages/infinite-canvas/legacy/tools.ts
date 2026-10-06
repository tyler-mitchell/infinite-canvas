import { type, type Type } from "arktype";
import type { WebMCPOptions } from "use-webmcp-tool";
import { editComponentProps, insertComponent } from "./component";
import { canvasModel, commandInputs } from "./schema";
import { findWindow } from "./stacking";
import type { InfiniteCanvasStore } from "./store";
import type { InfiniteCanvasCommand, InfiniteCanvasWindowDefinition } from "./types";

const identification = type({ id: "string > 0" }).onUndeclaredKey("reject");
const cameraNavigation = canvasModel.CameraNavigationRequest.onUndeclaredKey("reject");
const cameraState = canvasModel.Camera.onUndeclaredKey("reject");
const commandSchema = Object.entries(commandInputs).reduce<Type>(
  (schema, [commandType, input]) =>
    schema.or(input.and({ type: type.enumerated(commandType) }).onUndeclaredKey("reject")),
  type("never"),
);
const commandExecution = identification.or(
  type({ command: commandSchema }).onUndeclaredKey("reject"),
);

export type CanvasToolsContext<Kind extends string = string> = Readonly<{
  tools: readonly WebMCPOptions<unknown, unknown>[];
}> &
  Pick<
    InfiniteCanvasStore<Kind>,
    "camera" | "dispatch" | "getState" | "snapshot" | "getContextualCommands"
  >;

export type CanvasToolsOptions<Kind extends string = string> =
  | boolean
  | readonly WebMCPOptions<unknown, unknown>[]
  | ((context: CanvasToolsContext<Kind>) => readonly WebMCPOptions<unknown, unknown>[]);

export function createCanvasTools<Kind extends string>({
  store,
}: Readonly<{
  store: InfiniteCanvasStore<Kind>;
}>): readonly WebMCPOptions<unknown, unknown>[] {
  return [
    {
      name: "canvas.state",
      description: "Read current canvas state, including an active interaction.",
      annotations: { readOnlyHint: true },
      execute: () => store.getState(),
    },
    {
      name: "canvas.layout",
      description: "Read resolved window and group bounds and visible window IDs.",
      annotations: { readOnlyHint: true },
      execute: () => {
        const layout = store.layout$.peek();
        return {
          windowRects: Object.fromEntries(layout.windowRects),
          groupRects: Object.fromEntries(layout.groupRects),
          visibleWindowIds: [...layout.visibleWindowIds],
        };
      },
    },
    {
      name: "camera.navigate",
      description:
        "Focus a component, group, selection, point, or rectangle. Wait for the camera to arrive.",
      inputSchema: cameraNavigation.toJsonSchema(),
      execute: async (input, { signal }) => {
        const request = cameraNavigation(input);
        if (request instanceof type.errors) return new Error(request.summary);
        const result = await store.camera.navigate({ ...request, signal });
        return result === "completed"
          ? store.getState().camera
          : new Error(`Camera navigation ${result}.`);
      },
    },
    {
      name: "camera.set",
      description: "Set an exact camera position and zoom without animation.",
      inputSchema: cameraState.toJsonSchema(),
      execute: async (input, { signal }) => {
        const camera = cameraState(input);
        if (camera instanceof type.errors) return new Error(camera.summary);
        const result = await store.camera.animate({ camera, signal, transition: false });
        return result === "completed"
          ? store.getState().camera
          : new Error(`Camera navigation ${result}.`);
      },
    },
    {
      name: "camera.stop",
      description: "Stop camera movement at its current position.",
      execute: () => {
        store.camera.stop();
        return store.getState().camera;
      },
    },
    {
      name: "command.list",
      description: "List available canvas commands.",
      annotations: { readOnlyHint: true },
      execute: () => store.getContextualCommands(),
    },
    {
      name: "command.execute",
      description: "Execute a listed command ID or a parameterized canvas command.",
      inputSchema: commandExecution.toJsonSchema(),
      execute: async (input, { signal }) => {
        const commandInput = commandExecution(input);
        if (commandInput instanceof type.errors) return new Error(commandInput.summary);
        const command =
          "id" in commandInput
            ? store.getContextualCommands().find(({ id }) => id === commandInput.id)?.command
            : (commandInput.command as InfiniteCanvasCommand);
        if (command === undefined || !store.isCommandEnabled(command))
          return new Error("Command unavailable.");
        const result = await store.dispatch(command, { signal });
        if (result !== undefined && result !== "completed") return new Error(`Command ${result}.`);
        return { executed: "id" in commandInput ? commandInput.id : command.type };
      },
    },
    {
      name: "component.catalog",
      description: "List registered component schemas.",
      annotations: { readOnlyHint: true },
      execute: () =>
        Object.values<InfiniteCanvasWindowDefinition<Kind>>(store.windowDefinitions).flatMap(
          ({ kind, schema, actions }) =>
            schema === undefined
              ? []
              : [
                  {
                    id: kind,
                    schema: schema.in.toJsonSchema(),
                    actions: Object.entries(actions ?? {}).map(([id, action]) => ({
                      id,
                      label: action.label,
                      description: action.description,
                      multiple: action.multiple ?? false,
                    })),
                  },
                ],
        ),
    },
    {
      name: "component.create",
      description: "Insert a registered component on the canvas or in a group.",
      inputSchema: canvasModel.ComponentCreate.toJsonSchema(),
      execute: (input) => {
        const result = insertComponent({ store, input });
        return result instanceof type.errors ? new Error(result.summary) : result;
      },
    },
    {
      name: "component.inspect",
      description: "Read a component and its properties.",
      annotations: { readOnlyHint: true },
      inputSchema: identification.toJsonSchema(),
      execute: (input) => {
        const parsed = identification(input);
        if (parsed instanceof type.errors) return new Error(parsed.summary);
        const window = findWindow(store.getState(), parsed.id);
        return window === null
          ? new Error("Window does not exist.")
          : { id: window.id, component: window.kind, props: window.data };
      },
    },
    {
      name: "component.configure",
      description: "Update registered component properties.",
      inputSchema: canvasModel.ComponentPropsEdit.toJsonSchema(),
      execute: (input) => {
        const result = editComponentProps({ store, input });
        return result instanceof type.errors ? new Error(result.summary) : result;
      },
    },
    {
      name: "canvas.describe",
      description: "Read the canvas document.",
      annotations: { readOnlyHint: true },
      execute: () => store.snapshot(),
    },
  ];
}
