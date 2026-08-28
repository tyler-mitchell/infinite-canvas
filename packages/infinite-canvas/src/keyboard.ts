import { getHotkeyManager } from "@tanstack/hotkeys";
import type { HotkeyRegistrationHandle, RegisterableHotkey } from "@tanstack/hotkeys";

import {
  getInfiniteCanvasHotkeyBindings,
  isInfiniteCanvasCommandEnabled,
  type InfiniteCanvasHotkeyBinding,
} from "./commands";
import type { InfiniteCanvasCommand, InfiniteCanvasRect, InfiniteCanvasState } from "./types";

/**
 * A chord a consumer claims for a verb this canvas does not have.
 *
 * The canvas already lets a consumer put its own objects on the surface and *select* them —
 * `spatialTargetResolvers` resolves a pointer to one, `selection.targets` holds it, and the
 * framework's own pointerdown path selects it with modifiers intact. It knows nothing about what
 * those objects are, so it can offer no verb over them: cut this relation, rename this region,
 * collapse this lane. Those are the consumer's, and until this they had no keyboard at all.
 *
 * Distinct from {@link InfiniteCanvasHotkeyBinding}, which re-chords a command the canvas already
 * owns and is checked against `isInfiniteCanvasCommandEnabled`. Nothing here goes through the
 * command layer: `run` is the consumer's own, and `isEnabled` is the only thing that can answer
 * whether it applies right now. What the two share is everything about *when a keypress belongs to
 * the canvas* — the command surface, the exclusion list, the swallow rule — which is exactly the
 * part a consumer should not be restating.
 *
 * `hotkeys` is plural, mirroring {@link InfiniteCanvasCommandDescriptor}: Delete and Backspace mean
 * one thing to a user and it would be a strange API that made them two actions.
 */
type InfiniteCanvasHotkeyAction<Kind extends string = string> = Readonly<{
  description: string;
  hotkeys: readonly RegisterableHotkey[];
  id: string;
  /** Whether the verb applies to the canvas as it stands. Absent means always. */
  isEnabled?: (state: InfiniteCanvasState<Kind>) => boolean;
  label: string;
  /**
   * May return a promise, so a caller that reports completion can wait for it.
   *
   * A consumer verb over a consumer's own objects is often a write — cutting a relation, renaming a
   * region — and `=> void` gave it no way to say when that write landed. A keypress does not care
   * and ignores the result. A surface that answers "done" to something which cannot see the screen
   * does care, and was answering before the write returned.
   */
  run: (state: InfiniteCanvasState<Kind>) => Promise<void> | void;
}>;

type InfiniteCanvasHotkeyRegistrationInput<Kind extends string> = Readonly<{
  /**
   * Consumer verbs, registered *alongside* `bindings` rather than in place of them.
   *
   * The asymmetry with `bindings` is deliberate and is the whole point. Replacing the canvas's
   * keymap is a coherent thing to want; losing it because you wanted one extra chord is not.
   */
  actions?: readonly InfiniteCanvasHotkeyAction<Kind>[];
  bindings?: readonly InfiniteCanvasHotkeyBinding[];
  executeCommand: (command: InfiniteCanvasCommand) => void;
  /**
   * Where the selection is, for the bindings whose availability depends on it.
   *
   * The store's own lookup, passed in so a chord and the command it runs answer alike. Omitted, the
   * gate sees the windows only — which is what a canvas with no target resolvers has anyway.
   */
  getSelectionBounds?: (state: InfiniteCanvasState<Kind>) => InfiniteCanvasRect | null;
  getState: () => InfiniteCanvasState<Kind>;
  target: HTMLElement;
}>;

/** One chord, its handler, and whether it currently applies — the shape registration works over. */
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

/**
 * Canvas commands and consumer verbs, flattened to the one shape registration works over.
 *
 * Separate from the registration below because this package's test environment has no DOM. The
 * property that actually matters here — that supplying `actions` *adds* to the keymap rather than
 * replacing it — is a fact about this list, and inside the registration it would be unassertable
 * and free to regress in silence. What is left below is one handler shared by every entry, so the
 * scope guard, the swallow rule, and the enablement gate cannot come apart between a canvas chord
 * and a consumer's.
 */
function resolveInfiniteCanvasHotkeys<Kind extends string>({
  actions = [],
  bindings = getInfiniteCanvasHotkeyBindings(),
  executeCommand,
  getSelectionBounds,
}: Pick<
  InfiniteCanvasHotkeyRegistrationInput<Kind>,
  "actions" | "bindings" | "executeCommand" | "getSelectionBounds"
>): readonly ResolvedHotkey<Kind>[] {
  return [
    ...bindings.map((binding) => ({
      description: binding.description,
      hotkey: binding.hotkey,
      // Asked the same question the dispatch will ask, so a chord is never offered a fit the
      // command would then decline.
      isEnabled: (state: InfiniteCanvasState<Kind>) =>
        isInfiniteCanvasCommandEnabled(
          state,
          binding.command,
          undefined,
          getSelectionBounds?.(state),
        ),
      label: binding.label,
      run: () => {
        executeCommand(binding.command);
      },
    })),
    ...actions.flatMap((action) =>
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
  actions,
  bindings,
  executeCommand,
  getSelectionBounds,
  getState,
  target,
}: InfiniteCanvasHotkeyRegistrationInput<Kind>) {
  const manager = getHotkeyManager();
  const handles = resolveInfiniteCanvasHotkeys({
    actions,
    bindings,
    executeCommand,
    getSelectionBounds,
  }).map((entry): HotkeyRegistrationHandle =>
    manager.register(
      entry.hotkey,
      (event) => {
        if (!shouldHandleInfiniteCanvasKeyboardEvent(event, target)) {
          return;
        }

        // The chord belongs to the canvas the moment it lands on the command
        // surface, so swallow it even when the command is unavailable. Letting
        // an unavailable binding fall through to the browser is how
        // `Alt+ArrowLeft` at the left edge of your windows navigates Back and
        // takes the document with it — the failure arrives exactly when the
        // user is pressing hardest against a boundary.
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

/**
 * Hand keyboard control back to the canvas from any element inside it.
 *
 * Hotkeys only fire for events that land inside the command surface, so whenever an element that
 * holds DOM focus is about to lose it — a control being removed, a panel finishing its job —
 * something must claim it first. Otherwise it falls to `<body>`, every shortcut silently stops
 * working, and the user has no way to know why except to click the canvas again.
 *
 * The counterpart to {@link focusInfiniteCanvasCommandSurface}, which takes the surface element
 * and so requires the caller to know this framework's DOM contract. This one walks up from
 * whatever it is given, so a consumer's own chrome can return focus without restating a selector
 * that is not theirs to know.
 *
 * Here rather than beside the frame slots that first needed it: it is a keyboard-focus concern,
 * uses no React, and belongs with the function it is the counterpart to.
 */
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
  // Not in the barrel: the flattening is an implementation detail of registration, exported only
  // so the property it carries is reachable from a test in a package with no DOM.
  resolveInfiniteCanvasHotkeys,
  shouldHandleInfiniteCanvasKeyboardEvent,
};

export type { InfiniteCanvasHotkeyAction, InfiniteCanvasHotkeyRegistrationInput };
