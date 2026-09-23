import {
  getRunnableCommands,
  type Canvas,
  type RunnableCommand,
} from "@hyphened/infinite-canvas/next";
import { useHotkeys } from "@tanstack/react-hotkeys";
import { observer } from "@legendapp/state/react";
import { createElement, useState, type ReactNode } from "react";

import { tv } from "../tv.ts";
import { Button, type ButtonProps } from "./button.tsx";
import { canvasIcons } from "./canvas-icons.ts";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command.tsx";
import { type } from "arktype";
import { FieldError, FieldGroup, FieldLegend, FieldSet } from "./field.tsx";
import { Keycap } from "./keycap.tsx";
import { Row } from "./row.tsx";
import { SchemaForm, type SchemaValues } from "./schema-form.tsx";

const launcher = tv({
  slots: {
    trigger: "gap-1.5",
    entry: "flex min-w-0 flex-col",
    hint: "text-pk-meta text-pk-ink-faint",
    arguments: "gap-3 p-4",
    actions: "mt-1 gap-2",
  },
});

function CommandArguments({
  command,
  onDone,
  onCancel,
}: {
  command: RunnableCommand;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<SchemaValues>(command.input as SchemaValues);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    const result = await command.run(values);
    if (result.error === null) {
      onDone();
      return;
    }
    setError(
      result.error instanceof type.errors ? result.error.summary : result.error.message,
    );
  };
  return (
    <FieldSet className={launcher().arguments()}>
      <FieldLegend variant="label">{command.label}</FieldLegend>
      {command.description !== undefined && (
        <p className={launcher().hint()}>{command.description}</p>
      )}
      <FieldGroup>
        <SchemaForm
          schema={command.schema}
          values={values}
          onChange={(next) => {
            setValues(next);
            setError(null);
            return null;
          }}
        />
      </FieldGroup>
      {error !== null && <FieldError>{error}</FieldError>}
      <Row justify="end" className={launcher().actions()}>
        <Button tone="ghost" onClick={onCancel}>
          Back
        </Button>
        <Button onClick={() => void submit()}>Run</Button>
      </Row>
    </FieldSet>
  );
}

export type CanvasLauncherProps = Omit<ButtonProps, "onClick" | "children"> & {
  canvas: Canvas;
  hotkey?: "Mod+K" | "Mod+P" | false;
  label?: ReactNode;
  placeholder?: string;
};

/** Lists commands by scope and collects required arguments. */
export const CanvasLauncher = observer(function CanvasLauncher({
  canvas,
  hotkey = "Mod+K",
  label = "Commands",
  placeholder = "Run a command…",
  className,
  tone = "soft",
  size = "sm",
  ...props
}: CanvasLauncherProps) {
  const [open, setOpen] = useState(false);
  useHotkeys(
    hotkey === false
      ? []
      : [
          {
            hotkey,
            options: { meta: { name: "Commands" } },
            callback: (event: KeyboardEvent) => {
              event.preventDefault();
              setOpen((previous) => !previous);
            },
          },
        ],
  );
  const commands = getRunnableCommands(canvas);
  const [asking, setAsking] = useState<RunnableCommand | null>(null);
  const close = () => {
    setAsking(null);
    setOpen(false);
  };
  const run = (execute: () => Promise<unknown>) => {
    close();
    void execute();
  };
  return (
    <>
      <Button
        tone={tone}
        size={size}
        className={launcher().trigger({ className })}
        aria-keyshortcuts={hotkey === false ? undefined : "Meta+K Control+K"}
        onClick={() => setOpen(true)}
        {...props}
      >
        {label}
        {hotkey !== false && (
          <>
            <Keycap>⌘</Keycap>
            <Keycap>K</Keycap>
          </>
        )}
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Commands"
        description="Search and run a canvas command."
      >
        {asking !== null ? (
          <CommandArguments command={asking} onDone={close} onCancel={() => setAsking(null)} />
        ) : (
          <Command>
            <CommandInput placeholder={placeholder} />
            <CommandList>
              <CommandEmpty>No matching command.</CommandEmpty>
              {(["selection", "canvas"] as const).map((scope) => (
                <CommandGroup key={scope} heading={scope === "selection" ? "Selection" : "Canvas"}>
                  {commands.filter((command) => command.scope === scope).map((command) => (
                    <CommandItem
                      key={command.name}
                      value={`${command.label} ${command.name}`}
                      onSelect={() => command.ready ? run(command.run) : setAsking(command)}
                    >
                      {createElement(canvasIcons[command.icon] ?? canvasIcons.edit)}
                      <span className={launcher().entry()}>
                        {command.label}
                        {command.description === undefined ? null : (
                          <span className={launcher().hint()}>{command.description}</span>
                        )}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        )}
      </CommandDialog>
    </>
  );
});
