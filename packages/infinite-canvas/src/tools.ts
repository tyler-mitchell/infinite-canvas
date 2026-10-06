import { type, type Type } from "arktype";
import type { WebMCPOptions } from "use-webmcp-tool";
import type { Result } from "./model";
import type { Canvas } from "./state.types";

const execution = type({ name: "string > 0", input: "unknown" });

export function createCanvasTools(canvas: Canvas): WebMCPOptions<unknown, unknown>[] {
  const commands: Record<
    string,
    {
      label: string;
      description?: string;
      icon: string;
      surface?: "edit" | "view" | "none";
      input: Type;
      check(input: unknown): string | null;
      run(input: unknown): Promise<Result<unknown>>;
    }
  > = canvas.commands;
  return [
    {
      name: "canvas.state",
      description: "Read the canvas document, current view, and active interaction.",
      annotations: { readOnlyHint: true },
      execute: () => ({
        document: canvas.state.document.peek(),
        view: canvas.computed.view.peek(),
        camera: canvas.computed.camera.peek(),
        drag: canvas.state.session.drag.peek(),
      }),
    },
    {
      name: "canvas.layout",
      description: "Read current window rectangles, visibility, parents, and layout controls.",
      annotations: { readOnlyHint: true },
      execute: () => ({
        windows: canvas.computed.workspaceWindows.map((window) => {
          const id = window.id.peek();
          return {
            id,
            parent: canvas.computed.parents[id].peek() ?? null,
            rect: canvas.computed.windowRect[id].peek(),
            visible: canvas.computed.windowVisible[id].peek(),
            controls:
              canvas.computed.arrangement[canvas.computed.windowRoot[id].peek()].controls[
                id
              ].peek() ?? [],
          };
        }),
      }),
    },
    {
      name: "command.list",
      description: "List canvas commands and their input types.",
      annotations: { readOnlyHint: true },
      execute: () =>
        Object.entries(commands).map(([name, command]) => ({
          name,
          label: command.label,
          ...(command.description === undefined ? {} : { description: command.description }),
          icon: command.icon,
          surface: command.surface ?? "edit",
          input: command.input.toJsonSchema({
            fallback: { default: (context) => context.base },
          }),
        })),
    },
    {
      name: "command.check",
      description: "Check whether a canvas command accepts the input in the current state.",
      inputSchema: execution.toJsonSchema(),
      annotations: { readOnlyHint: true },
      execute: (input) => {
        const request = execution(input);
        if (request instanceof type.errors) return new Error(request.summary);
        const command = commands[request.name];
        if (command === undefined) return { available: false, reason: "Unknown canvas command." };
        const refused = command.check(request.input);
        return refused === null ? { available: true } : { available: false, reason: refused };
      },
    },
    {
      name: "command.execute",
      description: "Run a canvas command and wait for its result.",
      inputSchema: execution.toJsonSchema(),
      execute: async (input) => {
        const request = execution(input);
        if (request instanceof type.errors) return new Error(request.summary);
        const command = commands[request.name];
        if (command === undefined) return new Error("Unknown canvas command.");
        const result = await command.run(request.input);
        if (result.error !== null)
          return new Error(
            result.error instanceof type.errors ? result.error.summary : result.error.message,
          );
        return { data: result.data };
      },
    },
  ];
}
