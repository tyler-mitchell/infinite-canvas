import {
  getInfiniteCanvasContextualCommands,
  getInfiniteCanvasGroupWindowIds,
  useInfiniteCanvasActions,
  useInfiniteCanvasStore,
} from "@hyphened/infinite-canvas";
import { useLoaderData } from "@tanstack/react-router";

import { useGoToCanvas } from "../workspace/use-go-to-canvas";
import { useRefreshRoute } from "../workspace/use-refresh-route";
import { useEffect, useState } from "react";

import { getAppAction, isAppActionEnabled } from "../app-actions";
import type { WindowKind } from "../canvas/window-registry";
import { getActionIcon } from "./action-icons";
import { getRing, type CanvasRingEntry } from "./context-menu-rings";
import { RadialMenu } from "./radial-menu";

const wantsNativeMenu = (target: EventTarget | null) =>
  target instanceof Element &&
  target.closest("input, textarea, select, [contenteditable='true'], a[href]") !== null;

const getWindowUnderPointer = (target: EventTarget | null) =>
  target instanceof Element
    ? (target
        .closest("[data-infinite-canvas-window-id]")
        ?.getAttribute("data-infinite-canvas-window-id") ?? null)
    : null;

const getGroupUnderPointer = (target: EventTarget | null) =>
  target instanceof Element
    ? (target
        .closest("[data-infinite-canvas-group-id]")
        ?.getAttribute("data-infinite-canvas-group-id") ?? null)
    : null;

function CanvasContextMenu() {
  const actions = useInfiniteCanvasActions<WindowKind>();
  const store = useInfiniteCanvasStore<WindowKind>();
  const canvas = useLoaderData({ from: "/canvas/$canvasId" });
  const projectId = canvas.projectId;
  const [press, setPress] = useState<Readonly<{
    groupId: string | null;
    windowId: string | null;
    x: number;
    y: number;
  }> | null>(null);

  // The document owns this listener because the canvas is not focusable.
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

  const pressedWindowId = press?.windowId ?? null;
  const pressedGroupId = press?.groupId ?? null;

  useEffect(() => {
    if (pressedWindowId !== null) {
      actions.focusWindow(pressedWindowId);

      return;
    }

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

  // Read one state snapshot when the wheel opens.
  const state = store.state$.peek();
  const goToCanvas = useGoToCanvas();
  const refreshRoute = useRefreshRoute();
  const context = {
    actions,
    canvasId: canvas.id,
    canvasTitle: canvas.title,
    goToCanvas,
    projectId,
    refreshRoute,
    state,
  };
  const descriptors = new Map(
    getInfiniteCanvasContextualCommands(state).map((command) => [command.id, command]),
  );
  const canvasVerb = (entry: CanvasRingEntry) => {
    const descriptor = descriptors.get(entry.id);

    return {
      icon: entry.icon,
      isEnabled: descriptor?.enabled === true,
      label: entry.label,
      run: () => {
        if (descriptor !== undefined) {
          actions.executeCommand(descriptor.command);
        }
      },
    };
  };
  const appVerb = (id: string) => {
    const action = getAppAction(id);

    return {
      icon: getActionIcon(id),
      isEnabled: action !== undefined && isAppActionEnabled(action, context),
      label: action?.label ?? id,
      run: () => {
        void action?.run(context);
      },
    };
  };

  const ring = getRing(press);

  return (
    <RadialMenu
      items={ring.map((entry) => (entry.source === "app" ? appVerb(entry.id) : canvasVerb(entry)))}
      onClose={() => {
        setPress(null);
      }}
      origin={press}
    />
  );
}

export { CanvasContextMenu };
