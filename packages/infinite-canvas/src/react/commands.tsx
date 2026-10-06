import { Button } from "@base-ui/react/button";
import { Menu } from "@base-ui/react/menu";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { observer, useValue } from "@legendapp/state/react";
import { type } from "arktype";
import { createContext, useContext, useMemo, useState, type ComponentPropsWithRef } from "react";
import { createPortal } from "react-dom";
import type { MutationResult, Result } from "../model";
import { capturePointer, getViewportPoint, isPrimaryButton } from "../input";
import { useCanvasViewport } from "./context";

type CommandProps<Input> = {
  command: {
    label: string;
    description?: string;
    canRun(input: Input): boolean;
    run(input: Input): Promise<Result<unknown>>;
  };
  input: NoInfer<Input>;
};

export type CommandTriggerProps<Input = unknown> = Button.Props & CommandProps<Input>;
export type CommandMenuItemProps<Input = unknown> = Menu.Item.Props & CommandProps<Input>;

export function CommandTrigger<Input>({
  command,
  input,
  disabled,
  ...props
}: CommandTriggerProps<Input>) {
  const enabled = useValue(() => command.canRun(input));
  return (
    <Button
      {...mergeProps<typeof Button>(
        {
          children: command.label,
          title: command.description,
          onClick: () => void command.run(input),
        },
        props,
      )}
      disabled={disabled || !enabled}
      data-slot="command-trigger"
      data-canvas-control
    />
  );
}

export function CommandMenuItem<Input>({
  command,
  input,
  disabled,
  ...props
}: CommandMenuItemProps<Input>) {
  const enabled = useValue(() => command.canRun(input));
  return (
    <Menu.Item
      {...mergeProps<typeof Menu.Item>(
        {
          children: command.label,
          title: command.description,
          onClick: () => void command.run(input),
        },
        props,
      )}
      disabled={disabled || !enabled}
      data-slot="command-menu-item"
      data-canvas-control
    />
  );
}

const PaletteContext = createContext<{
  error: string | null;
  reportError: (error: MutationResult | null) => void;
} | null>(null);

function usePalette() {
  const palette = useContext(PaletteContext);
  if (palette === null) throw new Error("Palette parts require Palette.Root.");
  return palette;
}

function PaletteRoot({
  portal = false,
  autocomplete,
  render,
  ref,
  ...props
}: ComponentPropsWithRef<"aside"> & {
  render?: useRender.RenderProp;
  portal?: boolean;
  autocomplete?: Omit<Autocomplete.Root.Props<string>, "items" | "children" | "inline" | "open">;
}) {
  const { canvas } = useCanvasViewport();
  const [error, setError] = useState<string | null>(null);
  const context = useMemo(
    () => ({
      error,
      reportError: (error: MutationResult | null) => {
        const message = error instanceof type.errors ? error.summary : (error?.message ?? null);
        setError(message);
        if (error != null) console.warn("Component insertion failed.", error);
      },
    }),
    [error],
  );
  const items = useMemo(
    () =>
      Object.entries(canvas.configuration.components)
        .filter(
          ([, component]) =>
            component.schema !== undefined && !(component.schema({}) instanceof type.errors),
        )
        .map(([kind]) => kind),
    [canvas],
  );
  const element = useRender({
    defaultTagName: "aside",
    render,
    ref,
    props: { ...props, "data-slot": "component-palette", "data-canvas-control": "" },
  });
  const node = (
    <PaletteContext.Provider value={context}>
      <Autocomplete.Root {...autocomplete} items={items} inline open>
        {element}
      </Autocomplete.Root>
    </PaletteContext.Provider>
  );
  return portal && typeof document !== "undefined" ? createPortal(node, document.body) : node;
}

const PaletteItem = observer(function PaletteItem({
  kind,
  threshold,
  ...props
}: Autocomplete.Item.Props & { kind: string; threshold?: number }) {
  const { canvas, viewport, transferType } = useCanvasViewport();
  const { reportError } = usePalette();
  const dragging =
    canvas.state.session.drop.insertion.kind.get() === kind &&
    canvas.state.session.drop.phase.get() === "drag";
  return (
    <Autocomplete.Item
      {...mergeProps<typeof Autocomplete.Item>(
        {
          onPointerDown: (event) => {
            if (props.draggable === true) return;
            const element = viewport.current;
            if (element === null || !isPrimaryButton(event)) return;
            const error = canvas.actions.beginDrop.run({
              insertion: { id: crypto.randomUUID(), kind },
              ...(threshold === undefined ? {} : { threshold }),
              point: getViewportPoint({ element, event }),
              pointerId: event.pointerId,
            });
            reportError(error);
            if (error !== undefined) return;
            event.preventDefault();
            event.stopPropagation();
            capturePointer({ canvas, element, pointerId: event.pointerId });
          },
          onDragStart: (event) => {
            const element = viewport.current;
            if (element === null) {
              event.preventDefault();
              return;
            }
            const insertion = { id: crypto.randomUUID(), kind };
            event.dataTransfer.setData(transferType, JSON.stringify(insertion));
            event.dataTransfer.effectAllowed = "copy";
            reportError(
              canvas.actions.beginDrop.run({
                insertion,
                point: getViewportPoint({ element, event }),
              }),
            );
          },
          onDragEnd: () => {
            if (canvas.state.session.drop.pointerId.peek() === null)
              reportError(canvas.actions.cancelDrag.run({}));
          },
          onClick: (event) => {
            if (event.detail === 0)
              reportError(canvas.actions.insertComponent.run({ kind, id: crypto.randomUUID() }));
          },
        },
        props,
      )}
      value={kind}
      data-slot="component-palette-item"
      data-dragging={dragging || undefined}
    />
  );
});

const PaletteError = observer(function PaletteError({
  render,
  ref,
  children,
  ...props
}: ComponentPropsWithRef<"p"> & { render?: useRender.RenderProp }) {
  const { error } = usePalette();
  const { canvas } = useCanvasViewport();
  const dropError = canvas.computed.dropPlacement.error.get();
  const message =
    dropError == null
      ? error
      : dropError instanceof type.errors
        ? dropError.summary
        : dropError.message;
  return useRender({
    defaultTagName: "p",
    render,
    ref,
    enabled: message !== null,
    props: { ...props, role: "alert", children: children ?? message },
  });
});

export const Palette = {
  Root: PaletteRoot,
  Item: PaletteItem,
  Error: PaletteError,
  Input: Autocomplete.Input,
  List: Autocomplete.List,
  Empty: Autocomplete.Empty,
  Clear: Autocomplete.Clear,
};
