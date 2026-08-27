import {
  getAvailableInfiniteCanvasContextualCommands,
  useInfiniteCanvasActions,
  useInfiniteCanvasStore,
  type InfiniteCanvasCommandId,
} from "@hyphened/infinite-canvas";
import { useValue } from "@legendapp/state/react";
import { FilePlus2, Columns3, Maximize, MousePointerSquareDashed, Scan, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";

import { getAppAction, isAppActionEnabled } from "../app-actions";
import type { WindowKind } from "../canvas/window-registry";
import { openProject$ } from "../projects/open-project";
import { RadialMenu, type RadialItem } from "./radial-menu";

/**
 * Right-click on the canvas opens a wheel of verbs where the pointer already is.
 *
 * **A fixed six, not a list of whatever applies.** A radial menu earns its shape from position
 * being learnable — the verb you want is at four o'clock whether or not the others are available
 * today. Rebuilding the ring from live enablement would move every item whenever a selection
 * changed, which is the failure the selection rail already avoids by staying "visible and dim
 * rather than appearing and disappearing as a selection grows". Completeness belongs to the
 * palette; a wheel is for the handful you reach for without looking.
 *
 * Enablement still comes from the framework rather than being re-derived:
 * `getAvailableInfiniteCanvasContextualCommands` answers which of its own verbs are live against
 * this state, and `isAppActionEnabled` answers for this app's. A dimmed spoke is a fact about now,
 * not a guess.
 *
 * The framework has no context-menu affordance — no `contextmenu` handling anywhere in it — so the
 * listener is here. It is on the document for the same reason the framework's paste listener is:
 * the canvas is not focusable, and the event has to be caught wherever it lands.
 */

/** Where a native menu is the right answer and this one would be in the way. */
const wantsNativeMenu = (target: EventTarget | null) =>
  target instanceof Element &&
  target.closest("input, textarea, select, [contenteditable='true'], a[href]") !== null;

function CanvasContextMenu() {
  const actions = useInfiniteCanvasActions<WindowKind>();
  const store = useInfiniteCanvasStore<WindowKind>();
  const projectId = useValue(openProject$) ?? "";
  const [origin, setOrigin] = useState<Readonly<{ x: number; y: number }> | null>(null);

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      if (event.defaultPrevented || wantsNativeMenu(event.target)) {
        return;
      }

      event.preventDefault();
      setOrigin({ x: event.clientX, y: event.clientY });
    };

    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  if (origin === null) {
    return null;
  }

  /*
   * Read once, when the wheel opens, rather than subscribed. What is enabled is a fact about the
   * moment of the press — the state cannot change underneath a menu that is capturing the pointer,
   * and subscribing would re-render the ring mid-animation on every camera tick.
   */
  const state = store.state$.peek();
  const context = { actions, projectId, state };
  const available = new Set(
    getAvailableInfiniteCanvasContextualCommands(state).map((command) => command.id),
  );
  const canvasVerb = (id: InfiniteCanvasCommandId, icon: RadialItem["icon"], label: string) => ({
    icon,
    isEnabled: available.has(id),
    label,
    run: () => {
      actions.executeCommand({ type: id } as Parameters<typeof actions.executeCommand>[0]);
    },
  });
  const appVerb = (id: string, icon: RadialItem["icon"], label: string) => {
    const action = getAppAction(id);

    return {
      icon,
      isEnabled: action !== undefined && isAppActionEnabled(action, context),
      label,
      run: () => {
        action?.run(context);
      },
    };
  };

  return (
    <RadialMenu
      items={[
        appVerb("note.create", FilePlus2, "New note"),
        appVerb("group.createFromSelection", Columns3, "Group selected"),
        canvasVerb("view.fitSelection", Scan, "Fit selection"),
        canvasVerb("view.fitAll", Maximize, "Fit all"),
        canvasVerb("selection.selectAllVisible", MousePointerSquareDashed, "Select all"),
        canvasVerb("history.undo", Undo2, "Undo"),
      ]}
      onClose={() => {
        setOrigin(null);
      }}
      origin={origin}
    />
  );
}

export { CanvasContextMenu };
