import { getHotkeyManager } from "@tanstack/hotkeys";
import type { HotkeyRegistrationHandle, RegisterableHotkey } from "@tanstack/hotkeys";

import { getInfiniteCanvasHotkeyBindings, type InfiniteCanvasHotkeyBinding } from "./operations";
import type { InfiniteCanvasCommand, InfiniteCanvasDispatch, InfiniteCanvasState } from "./types";

/** Consumer keyboard action that shares the canvas keyboard scope. */
type InfiniteCanvasHotkeyAction<Kind extends string = string> = Readonly<{
  description: string;
  hotkeys: readonly RegisterableHotkey[];
  id: string;
  /** Returns whether the action applies. The default is `true`. */
  isEnabled?: (state: InfiniteCanvasState<Kind>) => boolean;
  label: string;
  /** Runs the action and can return a promise for completion tracking. */
  run: (state: InfiniteCanvasState<Kind>) => Promise<void> | void;
}>;

type InfiniteCanvasHotkeyRegistrationInput<Kind extends string> = Readonly<{
  /** Adds consumer actions without replacing canvas bindings. */
  hotkeyActions?: readonly InfiniteCanvasHotkeyAction<Kind>[];
  bindings?: readonly InfiniteCanvasHotkeyBinding[];
  dispatch: InfiniteCanvasDispatch<Kind>;
  isCommandEnabled: (command: InfiniteCanvasCommand) => boolean;
  getState: () => InfiniteCanvasState<Kind>;
  target: HTMLElement;
}>;

type ResolvedHotkey<Kind extends string> = Readonly<{
  description: string;
  hotkey: RegisterableHotkey;
  isEnabled: (state: InfiniteCanvasState<Kind>) => boolean;
  label: string;
  run: (state: InfiniteCanvasState<Kind>) => void;
}>;

const INFINITE_CANVAS_KEYBOARD_EXCLUSION_SELECTOR = [
  "[data-infinite-canvas-body='true']",
  "[data-infinite-canvas-command-scope='ignore']",
  "[data-infinite-canvas-control='true']",
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "[contenteditable='true']",
  "[contenteditable='']",
].join(",");

function isElement(value: EventTarget | null): value is Element {
  return typeof Element !== "undefined" && value instanceof Element;
}

function isKeyboardEventComposing(event: KeyboardEvent) {
  return event.isComposing || event.key === "Process";
}

function isInsideCommandSurface(target: EventTarget | null, surface: HTMLElement) {
  return target === surface || (isElement(target) && surface.contains(target));
}

function isExcludedCommandTarget(target: EventTarget | null) {
  return isElement(target) && target.closest(INFINITE_CANVAS_KEYBOARD_EXCLUSION_SELECTOR) !== null;
}

function shouldHandleInfiniteCanvasKeyboardEvent(event: KeyboardEvent, surface: HTMLElement) {
  return (
    !event.defaultPrevented &&
    !isKeyboardEventComposing(event) &&
    isInsideCommandSurface(event.target, surface) &&
    !isExcludedCommandTarget(event.target)
  );
}

/** Combines command bindings and consumer actions for keyboard registration. */
function resolveInfiniteCanvasHotkeys<Kind extends string>({
  hotkeyActions = [],
  bindings = getInfiniteCanvasHotkeyBindings(),
  dispatch,
  isCommandEnabled,
}: Pick<
  InfiniteCanvasHotkeyRegistrationInput<Kind>,
  "hotkeyActions" | "bindings" | "dispatch" | "isCommandEnabled"
>): readonly ResolvedHotkey<Kind>[] {
  return [
    ...bindings.map((binding) => ({
      description: binding.description,
      hotkey: binding.hotkey,
      isEnabled: () => isCommandEnabled(binding.command),
      label: binding.label,
      run: () => dispatch(binding.command),
    })),
    ...hotkeyActions.flatMap((action) =>
      action.hotkeys.map((hotkey) => ({
        description: action.description,
        hotkey,
        isEnabled: action.isEnabled ?? (() => true),
        label: action.label,
        run: action.run,
      })),
    ),
  ];
}

function registerInfiniteCanvasHotkeys<Kind extends string>({
  hotkeyActions,
  bindings,
  dispatch,
  isCommandEnabled,
  getState,
  target,
}: InfiniteCanvasHotkeyRegistrationInput<Kind>) {
  const manager = getHotkeyManager();
  const handles = resolveInfiniteCanvasHotkeys({
    hotkeyActions,
    bindings,
    dispatch,
    isCommandEnabled,
  }).map((entry): HotkeyRegistrationHandle =>
    manager.register(
      entry.hotkey,
      (event) => {
        if (!shouldHandleInfiniteCanvasKeyboardEvent(event, target)) {
          return;
        }

        // Claim owned chords even when disabled so the browser cannot handle them.
        event.preventDefault();
        event.stopPropagation();

        const state = getState();

        if (entry.isEnabled(state)) {
          entry.run(state);
        }
      },
      {
        conflictBehavior: "warn",
        ignoreInputs: true,
        meta: {
          description: entry.description,
          name: entry.label,
        },
        preventDefault: false,
        stopPropagation: false,
        target,
      },
    ),
  );

  return () => {
    handles.forEach((handle) => {
      if (handle.isActive) {
        handle.unregister();
      }
    });
  };
}

function focusInfiniteCanvasCommandSurface(surface: HTMLElement | null) {
  surface?.focus({
    preventScroll: true,
  });
}

function getInfiniteCanvasCommandSurfaceElement(viewport: HTMLElement | null) {
  return (
    viewport?.querySelector<HTMLElement>("[data-infinite-canvas-command-scope='surface']") ?? null
  );
}

/** Returns keyboard focus to the nearest canvas command surface. */
function focusInfiniteCanvasCommandSurfaceFrom(element: HTMLElement) {
  focusInfiniteCanvasCommandSurface(
    getInfiniteCanvasCommandSurfaceElement(
      element.closest<HTMLElement>("[data-infinite-canvas-viewport='true']"),
    ),
  );
}

export {
  focusInfiniteCanvasCommandSurface,
  focusInfiniteCanvasCommandSurfaceFrom,
  registerInfiniteCanvasHotkeys,
  resolveInfiniteCanvasHotkeys,
  shouldHandleInfiniteCanvasKeyboardEvent,
};

export type { InfiniteCanvasHotkeyAction, InfiniteCanvasHotkeyRegistrationInput };
