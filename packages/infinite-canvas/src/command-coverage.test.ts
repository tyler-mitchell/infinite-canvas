import { expect, test } from "vite-plus/test";

import { DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS } from "./commands";
import type { InfiniteCanvasAction, InfiniteCanvasCommandId } from "./types";

/**
 * The command registry is supposed to be the whole vocabulary. It was half of one.
 *
 * `DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS` feeds three surfaces —
 * `getInfiniteCanvasHotkeyBindings` derives chords strictly from it, the palette lists it,
 * and `getAvailableInfiniteCanvasContextualCommands` filters it. So an action with no
 * descriptor cannot be bound to a chord, cannot appear in a palette, and cannot be reached
 * by a consumer who replaced the chrome that happened to call it directly.
 *
 * On 2026-08-12 that described every window-lifecycle verb (close, minimize, maximize,
 * pin) and eight of nine group verbs. The reducer handled all of them; nothing surfaced
 * them. The defect was invisible because the two vocabularies were only ever compared by
 * eye, and the reducer's own exhaustive switch — which TypeScript does enforce — says
 * nothing about whether a verb ever reaches a user.
 *
 * This is that comparison, made structural. The map below is typed as a `Record` over the
 * action union, so **adding an action to `InfiniteCanvasAction` fails the typecheck until
 * it is classified here**: either it names a command that reaches it, or it declares why it
 * is deliberately chromeless. Divergence stops being something to notice and becomes
 * something that cannot compile.
 *
 * A chromeless reason is not an escape hatch to be filled in idly — the four below are the
 * only shapes that have earned it:
 *
 * - `pointer` — the action *is* a gesture. There is no keyboard form of "drag by 4px".
 * - `lifecycle` — the host drives it (hydrate, reset, viewport measurement).
 * - `parameterized` — it needs an argument no palette entry can supply (which window id,
 *   which rect, which recipe). The command layer reaches these with the argument resolved
 *   from state instead, which is what the `activeWindow.*` and `group.*` families are.
 * - `indirection` — it exists to run commands, so giving it one would be circular.
 */

type ChromelessReason = "indirection" | "lifecycle" | "parameterized" | "pointer";

const ACTION_COMMAND_COVERAGE: Readonly<
  Record<InfiniteCanvasAction<"demo">["type"], ChromelessReason | InfiniteCanvasCommandId>
> = {
  // `view.navigate` is a command *type* with no default descriptor — a consumer supplies
  // the target — so the reachable representatives are the two that resolve one from state.
  //
  // `camera.panBy` and `camera.zoomAt` were classified `pointer` until 2026-08-12, which was
  // the map recording a real gap as if it were a design choice: panning and zooming genuinely
  // had no keyboard form, and on an infinite canvas that is the primary interaction.
  "camera.navigate": "view.fitAll",
  "camera.panBy": "view.pan.right",
  "camera.zoomAt": "view.zoomIn",
  "command.execute": "indirection",
  "desktop.hydrate": "lifecycle",
  "desktop.reset": "lifecycle",
  // Every group verb below is reached by a command that resolves the container from the
  // active window, rather than by a palette entry that could not know which container.
  //
  // `group.close` and `group.reorderChild` were classified `parameterized` when this map was
  // first written, hours before the commands existed. That was too generous: both resolve
  // perfectly well from the active window, exactly as equalize and flip do, and calling them
  // parameterized was the map excusing a gap rather than recording one. Corrected here when
  // the commands landed.
  "group.close": "group.dissolve",
  "group.create": "parameterized",
  "group.dockWindow": "window.dock.right",
  "group.equalizeChildren": "group.equalizeChildren",
  "group.reorderChild": "group.moveChild.end",
  "group.setActiveChild": "parameterized",
  "group.setAxis": "group.flipAxis",
  "group.setChildWeights": "group.growPane",
  "group.setLayoutMode": "group.setLayout.tabs",
  "group.setRect": "pointer",
  "group.undockWindow": "window.undock",
  "interaction.finish": "pointer",
  "interaction.startGroupGutter": "pointer",
  "interaction.startGroupResize": "pointer",
  "interaction.startMarquee": "pointer",
  "interaction.startMove": "pointer",
  "interaction.startPan": "pointer",
  "interaction.startResize": "pointer",
  "interaction.step": "pointer",
  "recipe.apply": "parameterized",
  "selection.add": "parameterized",
  "selection.clear": "selection.clear",
  "selection.remove": "selection.removeActive",
  "selection.replace": "parameterized",
  "selection.selectAllVisible": "selection.selectAllVisible",
  "selection.targets.add": "parameterized",
  "selection.targets.remove": "parameterized",
  "selection.targets.replace": "parameterized",
  "selection.targets.toggle": "parameterized",
  "selection.toggle": "parameterized",
  "viewport.set": "lifecycle",
  // Creating and titling a set stays the consumer's: a palette entry cannot invent which set,
  // any more than it can invent which window to open. Switching and editing membership do
  // resolve from state — cycle, show all, take the active window off this desktop — and those
  // landed the same day the model did rather than waiting for someone to notice.
  "workspace.activate": "workspace.cycle.next",
  "workspace.close": "parameterized",
  "workspace.create": "parameterized",
  "workspace.setWindows": "workspace.removeActiveWindow",
  "window.close": "activeWindow.close",
  "window.focus": "window.focus.left",
  "window.maximize": "activeWindow.toggleMaximized",
  "window.minimize": "activeWindow.minimize",
  "window.open": "parameterized",
  // Restoring is deliberately not an `activeWindow.*` verb: minimizing hands
  // `activeWindowId` to the next visible window, so a restore keyed to the active window
  // could never be enabled. Bringing one back is a "which one?" choice and belongs to the
  // presence surface, which has `getInfiniteCanvasMinimizedWindowItems` for exactly that.
  "window.restore": "parameterized",
  "window.togglePinned": "activeWindow.togglePinned",
  // Renaming needs a string only the user has. A palette entry cannot invent a title any
  // more than it can invent which window to open, so all three renames stay here — but the
  // *actions* exist, which is the part that was missing: nothing in the model could be
  // renamed at all, so a consumer building an inline edit had to close the thing and
  // recreate it, losing its id, z-index, membership and history.
  "window.setTitle": "parameterized",
  "group.setTitle": "parameterized",
  "workspace.setTitle": "parameterized",
};

const CHROMELESS_REASONS = new Set<string>([
  "indirection",
  "lifecycle",
  "parameterized",
  "pointer",
]);

test("every action names a real command or declares why it has none", () => {
  const declared = new Set<string>(
    DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS.map((descriptor) => descriptor.id),
  );

  for (const [action, coverage] of Object.entries(ACTION_COMMAND_COVERAGE)) {
    if (CHROMELESS_REASONS.has(coverage)) {
      continue;
    }

    // A command id that no longer exists is the same defect in reverse: the map claims a
    // verb is reachable when the descriptor it names has been renamed or dropped.
    expect(
      declared.has(coverage),
      `${action} names a command that does not exist: ${coverage}`,
    ).toBe(true);
  }
});

test("the window lifecycle is reachable as commands, not only as chrome buttons", () => {
  // The specific regression this file was written for. These four lived exclusively as
  // `onClick` handlers on the frame's control buttons, which meant a consumer who replaced
  // the header slot — the entire point of the slot API — had no way to close a window
  // except by reaching past the command layer to the raw actions facade.
  const declared = new Set(DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS.map(({ id }) => id));

  for (const id of [
    "activeWindow.close",
    "activeWindow.minimize",
    "activeWindow.toggleMaximized",
    "activeWindow.togglePinned",
  ]) {
    expect(declared.has(id as InfiniteCanvasCommandId)).toBe(true);
  }
});

test("no command id is declared twice", () => {
  // Two descriptors sharing an id makes one of them unreachable, and which one wins is
  // registration order.
  const ids = DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS.map((descriptor) => descriptor.id);

  expect(ids.length).toBe(new Set(ids).size);
});
