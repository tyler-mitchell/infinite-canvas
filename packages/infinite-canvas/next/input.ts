import type { Point } from "./geometry";
import { type } from "arktype";
import type { RegisterableHotkey } from "@tanstack/hotkeys";
import type { Canvas, PointerState } from "./state.types";
import { componentInsertion, type ComponentInsertion } from "./components";

export function readPointer(
  event: Pick<
    PointerEvent,
    "pointerId" | "clientX" | "clientY" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey"
  >,
  viewport: HTMLElement,
): PointerState {
  return {
    pointerId: event.pointerId,
    point: getViewportPoint(viewport, getClientPoint(event)),
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
  };
}

export function report(error: unknown) {
  if (error instanceof type.errors) console.warn("Canvas input failed.", error.summary);
  else if (error instanceof Error) console.warn("Canvas input failed.", error);
}

export const COMPONENT_TRANSFER_TYPE = "application/x-canvas-component";
const transferInput = componentInsertion.omit("id").and({ "id?": "string > 0" });
const transferText = type("string.json.parse").to(transferInput);

export function readComponentTransfer({
  transfer,
  format = COMPONENT_TRANSFER_TYPE,
}: {
  transfer: Pick<DataTransfer, "getData">;
  format?: string;
}): ComponentInsertion | Error | null {
  const encoded = transfer.getData(format);
  const text = encoded || transfer.getData("text/plain");
  if (text === "") return null;
  const input = transferText(text);
  if (input instanceof type.errors) return encoded === "" ? null : new Error(input.summary);
  return { ...input, id: input.id ?? crypto.randomUUID() };
}

type Commands = Canvas["commands"];

export type HotkeyBinding =
  | {
      [Name in keyof Commands]: { command: Name; input?: Parameters<Commands[Name]["run"]>[0] };
    }[keyof Commands]
  | { label: string; run: () => unknown; canRun?: () => boolean }
  | null;

export type Hotkeys = Readonly<Partial<Record<RegisterableHotkey & string, HotkeyBinding>>>;

export const defaultHotkeys = {
  "Mod+Z": { command: "undo" },
  "Mod+Shift+Z": { command: "redo" },
  "Mod+Y": { command: "redo" },
  "Mod+A": { command: "selectAll" },
  "Shift+1": { command: "fitAll" },
  "Shift+2": { command: "fitSelection" },
  ArrowLeft: { command: "nudgeSelection", input: { x: -1, y: 0, unit: "step" } },
  ArrowRight: { command: "nudgeSelection", input: { x: 1, y: 0, unit: "step" } },
  ArrowUp: { command: "nudgeSelection", input: { x: 0, y: -1, unit: "step" } },
  ArrowDown: { command: "nudgeSelection", input: { x: 0, y: 1, unit: "step" } },
  "Shift+ArrowLeft": { command: "nudgeSelection", input: { x: -1, y: 0, unit: "largeStep" } },
  "Shift+ArrowRight": { command: "nudgeSelection", input: { x: 1, y: 0, unit: "largeStep" } },
  "Shift+ArrowUp": { command: "nudgeSelection", input: { x: 0, y: -1, unit: "largeStep" } },
  "Shift+ArrowDown": { command: "nudgeSelection", input: { x: 0, y: 1, unit: "largeStep" } },
  "Alt+ArrowLeft": { command: "focusDirection", input: { direction: "left" } },
  "Alt+ArrowRight": { command: "focusDirection", input: { direction: "right" } },
  "Alt+ArrowUp": { command: "focusDirection", input: { direction: "up" } },
  "Alt+ArrowDown": { command: "focusDirection", input: { direction: "down" } },
  "Alt+Shift+ArrowLeft": {
    command: "resizeWindow",
    input: { by: { x: -1, y: 0, unit: "largeStep" } },
  },
  "Alt+Shift+ArrowRight": {
    command: "resizeWindow",
    input: { by: { x: 1, y: 0, unit: "largeStep" } },
  },
  "Alt+Shift+ArrowUp": {
    command: "resizeWindow",
    input: { by: { x: 0, y: -1, unit: "largeStep" } },
  },
  "Alt+Shift+ArrowDown": {
    command: "resizeWindow",
    input: { by: { x: 0, y: 1, unit: "largeStep" } },
  },
  "Mod+Shift+ArrowLeft": { command: "placeWindow", input: { region: "left" } },
  "Mod+Shift+ArrowRight": { command: "placeWindow", input: { region: "right" } },
  "Mod+Shift+ArrowUp": { command: "placeWindow", input: { region: "top" } },
  "Mod+Shift+ArrowDown": { command: "placeWindow", input: { region: "bottom" } },
  "Mod+Shift+Enter": { command: "placeWindow", input: { region: "fill" } },
} satisfies Hotkeys;

export function getHotkeyDefinitions({ canvas, hotkeys }: { canvas: Canvas; hotkeys: Hotkeys }) {
  const commands: Record<
    string,
    { label: string; canRun(input: unknown): boolean; run(input: unknown): unknown }
  > = canvas.commands;
  return Object.entries(hotkeys).flatMap(([hotkey, binding]) => {
    if (binding == null) return [];
    const action =
      "command" in binding
        ? {
            label: commands[binding.command].label,
            canRun: () => commands[binding.command].canRun(binding.input ?? {}),
            run: () => commands[binding.command].run(binding.input ?? {}),
          }
        : binding;
    return [
      {
        hotkey: hotkey as RegisterableHotkey,
        options: { meta: { name: action.label } },
        callback: (event: KeyboardEvent) => {
          if (event.defaultPrevented || event.isComposing || event.key === "Process") return;
          if (
            event.target instanceof Element &&
            event.target.closest(
              "input,textarea,select,button,a,[contenteditable='true'],[contenteditable=''],[data-canvas-control],[data-canvas-keyboard='ignore']",
            )
          )
            return;
          event.preventDefault();
          event.stopPropagation();
          if (action.canRun?.() !== false) void action.run();
        },
      },
    ];
  });
}

type PointerLike = Pick<PointerEvent, "clientX" | "clientY">;

function getClientPoint(event: PointerLike): Point {
  return {
    x: event.clientX,
    y: event.clientY,
  };
}

function getViewportPoint(element: HTMLElement, point: Point): Point {
  const bounds = element.getBoundingClientRect();

  return {
    x: point.x - bounds.left,
    y: point.y - bounds.top,
  };
}

function capturePointer(element: Pick<HTMLElement, "setPointerCapture">, pointerId: number) {
  // Pointer capture can fail after release or for synthetic events.
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Handlers still track the pointer by ID.
  }
}

function releasePointer(
  element: Pick<HTMLElement, "hasPointerCapture" | "releasePointerCapture">,
  pointerId: number,
) {
  if (element.hasPointerCapture(pointerId)) {
    element.releasePointerCapture(pointerId);
  }
}

function isPrimaryButton(event: Pick<PointerEvent, "button" | "isPrimary">) {
  return event.button === 0 && event.isPrimary;
}

/** Screen pixels a press travels before it is a drag rather than a click. */
const DRAG_THRESHOLD_PX = 6;

/** Elements that own their own press: a drag must not start on them. */
const INTERACTIVE_TARGET_SELECTOR = [
  "[data-infinite-canvas-control='true']",
  "[data-canvas-control]",
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "[contenteditable='true']",
  "[contenteditable='']",
].join(",");

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE_TARGET_SELECTOR) !== null;
}

function clearNativeTextSelection() {
  const selection = typeof document === "undefined" ? null : document.getSelection();

  if (selection !== null && !selection.isCollapsed) {
    selection.removeAllRanges();
  }
}

export {
  DRAG_THRESHOLD_PX,
  capturePointer,
  clearNativeTextSelection,
  getClientPoint,
  getViewportPoint,
  isInteractiveTarget,
  isPrimaryButton,
  releasePointer,
};
