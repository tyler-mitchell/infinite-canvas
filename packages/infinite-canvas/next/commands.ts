import type { Type } from "arktype";
import type { Result } from "./model";
import type { Canvas } from "./state.types";

export type RunnableCommand = {
  name: string;
  label: string;
  icon: string;
  description?: string;
  /** `selection` needs what is selected; `canvas` runs without it. */
  scope: "selection" | "canvas";
  /** `edit` changes the document; `view` only moves the camera or the selection. */
  surface: "edit" | "view";
  /** False when the command still wants a value the selection cannot supply. */
  ready: boolean;
  /** The command's own input type, for asking the rest. */
  schema: Type;
  /** What the selection could supply; the seed for a form that asks the rest. */
  input: unknown;
  run: (input?: unknown) => Promise<Result<unknown>>;
};

type CommandEntry = {
  label: string;
  icon: string;
  description?: string;
  scope?: "selection" | "canvas";
  surface?: "edit" | "view" | "none";
  input: Type;
  canRun(input: unknown): boolean;
  run(input: unknown): Promise<Result<unknown>>;
};

export function getRunnableCommands(canvas: Canvas): RunnableCommand[] {
  const windows = canvas.computed.selectedWindows.map((window) => window.id.get());
  const active = canvas.computed.view.activeWindowId.get();
  const scope = { ...(active === null ? {} : { window: active }), windows };
  const commands: Record<string, CommandEntry> = canvas.commands;
  const kinds = new Set(canvas.computed.selectedWindows.map((window) => window.kind.get()));
  const kind = kinds.size === 1 ? kinds.values().next().value : undefined;
  const entries: { name: string; command: CommandEntry; input?: unknown }[] = [
    ...Object.entries(
      kind === undefined ? {} : (canvas.configuration.components[kind]?.actions ?? {}),
    ).map(([action, definition]) => ({
      name: `runComponentAction:${action}`,
      command: {
        ...commands.runComponentAction,
        label: definition.label,
        icon: definition.icon,
      },
      input: { action, windows },
    })),
    ...Object.entries(commands).map(([name, command]) => ({ name, command })),
  ];
  return entries.flatMap(({ name, command, input: supplied }) => {
    if (command.surface === "none") return [];
    const kind = command.scope ?? (command.canRun({}) ? ("canvas" as const) : ("selection" as const));
    const input = supplied ?? (kind === "selection" ? scope : {});
    const ready = command.canRun(input);
    if (!ready && command.scope === undefined) return [];
    return [
      {
        name,
        label: command.label,
        icon: command.icon,
        ...(command.description === undefined ? {} : { description: command.description }),
        scope: kind,
        surface: command.surface === "view" ? ("view" as const) : ("edit" as const),
        ready,
        schema: command.input,
        input,
        run: (given: unknown = input) => command.run(given),
      },
    ];
  });
}
