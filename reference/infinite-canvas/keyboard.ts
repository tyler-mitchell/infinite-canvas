import { getHotkeyManager } from "@tanstack/hotkeys";
import type { HotkeyRegistrationHandle } from "@tanstack/hotkeys";

import {
  getInfiniteCanvasHotkeyBindings,
  isInfiniteCanvasCommandEnabled,
  type InfiniteCanvasHotkeyBinding,
} from "#/experiments/infinite-canvas/commands";
import type {
  InfiniteCanvasCommand,
  InfiniteCanvasState,
} from "#/experiments/infinite-canvas/types";

type InfiniteCanvasHotkeyRegistrationInput<Kind extends string> = Readonly<{
  bindings?: readonly InfiniteCanvasHotkeyBinding[];
  executeCommand: (command: InfiniteCanvasCommand) => void;
  getState: () => InfiniteCanvasState<Kind>;
  target: HTMLElement;
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

function registerInfiniteCanvasHotkeys<Kind extends string>({
  bindings = getInfiniteCanvasHotkeyBindings(),
  executeCommand,
  getState,
  target,
}: InfiniteCanvasHotkeyRegistrationInput<Kind>) {
  const manager = getHotkeyManager();
  const handles = bindings.map(
    (binding): HotkeyRegistrationHandle =>
      manager.register(
        binding.hotkey,
        (event) => {
          const state = getState();

          if (
            !shouldHandleInfiniteCanvasKeyboardEvent(event, target) ||
            !isInfiniteCanvasCommandEnabled(state, binding.command)
          ) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          executeCommand(binding.command);
        },
        {
          conflictBehavior: "warn",
          ignoreInputs: true,
          meta: {
            description: binding.description,
            name: binding.label,
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

export {
  focusInfiniteCanvasCommandSurface,
  registerInfiniteCanvasHotkeys,
  shouldHandleInfiniteCanvasKeyboardEvent,
};

export type { InfiniteCanvasHotkeyRegistrationInput };
