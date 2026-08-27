import {
  getAvailableInfiniteCanvasContextualCommands,
  getInfiniteCanvasGroupWindowIds,
  useInfiniteCanvasActions,
  useInfiniteCanvasStore,
  type InfiniteCanvasCommandId,
} from "@hyphened/infinite-canvas";
import { useValue } from "@legendapp/state/react";
import {
  AlignHorizontalSpaceAround,
  Columns2,
  Columns3,
  FilePlus2,
  FlipHorizontal,
  Grip,
  Maximize,
  Maximize2,
  Minus,
  MousePointerSquareDashed,
  Pin,
  Rows3,
  Scan,
  SquareSplitHorizontal,
  Undo2,
  Ungroup,
  X,
} from "lucide-react";
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

/**
 * The window under the press, or `null` for bare canvas.
 *
 * `data-infinite-canvas-window-id` is the framework's own behavioural attribute — the contract
 * `data-attributes.ts` keeps deliberately separate from the `data-slot` styling one — so this reads
 * the identity the framework publishes rather than inventing a way to ask.
 */
const getWindowUnderPointer = (target: EventTarget | null) =>
  target instanceof Element
    ? (target
        .closest("[data-infinite-canvas-window-id]")
        ?.getAttribute("data-infinite-canvas-window-id") ?? null)
    : null;

/**
 * The group whose chrome was pressed — a gutter, a tab strip, an accordion header.
 *
 * Not the group a *pane* belongs to. The framework draws group chrome and window frames as disjoint
 * layers on purpose, so a press either lands on a member window or on the shell around it, and the
 * two can be asked separately without either shadowing the other.
 */
const getGroupUnderPointer = (target: EventTarget | null) =>
  target instanceof Element
    ? (target
        .closest("[data-infinite-canvas-group-id]")
        ?.getAttribute("data-infinite-canvas-group-id") ?? null)
    : null;

function CanvasContextMenu() {
  const actions = useInfiniteCanvasActions<WindowKind>();
  const store = useInfiniteCanvasStore<WindowKind>();
  const projectId = useValue(openProject$) ?? "";
  const [press, setPress] = useState<Readonly<{
    groupId: string | null;
    windowId: string | null;
    x: number;
    y: number;
  }> | null>(null);

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      if (event.defaultPrevented || wantsNativeMenu(event.target)) {
        return;
      }

      event.preventDefault();
      setPress({
        groupId: getGroupUnderPointer(event.target),
        windowId: getWindowUnderPointer(event.target),
        x: event.clientX,
        y: event.clientY,
      });
    };

    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  /*
   * Pressing a window makes it the active one, which is what every desktop does and what the
   * framework's `activeWindow.*` verbs need in order to be about the thing you pressed rather than
   * whatever was focused before.
   *
   * In an effect rather than in the render that follows the press: dispatching a command while
   * rendering is a side effect in render, and React is entitled to run that twice.
   */
  const pressedWindowId = press?.windowId ?? null;
  const pressedGroupId = press?.groupId ?? null;

  useEffect(() => {
    if (pressedWindowId !== null) {
      actions.focusWindow(pressedWindowId);

      return;
    }

    /*
     * A group's chrome is not a window, and every `group.*` verb acts on the *active window's*
     * container — the same rule the group rail follows. Pressing a shell while some other group's
     * member was active would otherwise reshape that other group, silently and somewhere else on
     * the canvas. Any member identifies the container, so the first one settles it.
     */
    if (pressedGroupId !== null) {
      const group = store.state$.peek().groups.find((candidate) => candidate.id === pressedGroupId);
      const member =
        group === undefined ? undefined : getInfiniteCanvasGroupWindowIds(group.tree)[0];

      if (member !== undefined) {
        actions.focusWindow(member);
      }
    }
  }, [actions, pressedGroupId, pressedWindowId, store]);

  if (press === null) {
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

  /*
   * Three rings, chosen by what was pressed, rather than one ring trying to serve all of them.
   *
   * The three vocabularies barely overlap — closing and pinning mean nothing on bare canvas,
   * creating a note has nothing to do with the window you pressed, and reshaping a container means
   * nothing without one. Offering all eighteen would be a list wearing a wheel's shape, and reusing
   * six angles with different meanings would put a different verb under the same direction, which
   * is precisely what a wheel must never do.
   *
   * Group chrome is checked only where no window was pressed. The framework draws the two as
   * disjoint layers, so a press lands on a pane or on the shell around it and never ambiguously on
   * both — but reading it in this order says which one wins if that ever stops being true.
   */
  if (press.windowId === null && press.groupId !== null) {
    return (
      <RadialMenu
        items={[
          canvasVerb("group.setLayout.split", SquareSplitHorizontal, "Side by side"),
          canvasVerb("group.setLayout.tabs", Columns2, "Tabbed"),
          canvasVerb("group.setLayout.accordion", Rows3, "Folded"),
          canvasVerb("group.flipAxis", FlipHorizontal, "Flip axis"),
          canvasVerb("group.equalizeChildren", AlignHorizontalSpaceAround, "Equalize"),
          canvasVerb("group.dissolve", Ungroup, "Ungroup"),
        ]}
        onClose={() => {
          setPress(null);
        }}
        origin={press}
      />
    );
  }

  const items =
    press.windowId === null
      ? [
          appVerb("note.create", FilePlus2, "New note"),
          appVerb("group.createFromSelection", Columns3, "Group selected"),
          canvasVerb("view.fitSelection", Scan, "Fit selection"),
          canvasVerb("view.fitAll", Maximize, "Fit all"),
          canvasVerb("selection.selectAllVisible", MousePointerSquareDashed, "Select all"),
          canvasVerb("history.undo", Undo2, "Undo"),
        ]
      : [
          canvasVerb("activeWindow.toggleMaximized", Maximize2, "Maximize"),
          canvasVerb("activeWindow.togglePinned", Pin, "Pin"),
          canvasVerb("window.undock", Grip, "Undock"),
          canvasVerb("activeWindow.close", X, "Close"),
          canvasVerb("activeWindow.minimize", Minus, "Minimize"),
          canvasVerb("view.fitSelection", Scan, "Fit"),
        ];

  return (
    <RadialMenu
      items={items}
      onClose={() => {
        setPress(null);
      }}
      origin={press}
    />
  );
}

export { CanvasContextMenu };
