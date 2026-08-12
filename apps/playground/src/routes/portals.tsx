import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
  InfiniteCanvasDesktop,
  InfiniteCanvasPortal,
} from "@hyphened/infinite-canvas";
import { Button } from "ui";
import { CommandPalette } from "../showcases/command-palette.tsx";

export const Route = createFileRoute("/portals")({
  component: PortalsShowcase,
  staticData: {
    showcase: {
      description: "Popovers that escape the window's transform instead of being scaled by it.",
      order: 8,
      title: "Portals",
    },
  },
});

type Kind = "menu";

const POPOVER_CLASS = "absolute bottom-4 w-36 rounded border p-2 text-[10px] leading-snug";

/**
 * The trap this route exists to demonstrate: a window frame is
 * `transform: scale(zoom)`, which makes it the containing block for
 * `position: fixed`. Anything inside a window body that positions itself against
 * the viewport lands in the wrong place, at the wrong size.
 *
 * The unportalled popover below is absolutely positioned inside the body, so it
 * scales with the canvas. The portalled one mounts into the window's own root —
 * a sibling of the frame, outside every transform — and stays at natural size.
 *
 * Every claim here is one the reader can falsify in a gesture, because from `0.1.0` until
 * 2026-07-08 this route rendered the bug rather than the feature and nobody noticed: the
 * window portal root painted underneath the opaque window body it belonged to.
 */
function WindowMenu() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="grid content-start gap-3 p-4 text-xs text-white/60">
      <Button onClick={() => setIsOpen((open) => !open)} size="xs" variant="ghost">
        {isOpen ? "Close menu" : "Open menu"}
      </Button>
      <p>
        Open the menu, then zoom. Two popovers, identical at 100%. One grows with the canvas; one
        does not. If they stay the same size as each other, <code>scope=&quot;window&quot;</code> is
        broken.
      </p>

      {isOpen ? (
        // Inside the body, so inside the frame's `transform: scale(zoom)`. This one is
        // wrong on purpose: it is the control.
        <div className={`${POPOVER_CLASS} left-4 border-red-400/50 bg-popover`}>
          <div className="font-medium text-red-200">in-body</div>
          scales with zoom, and resolves <code>position: fixed</code> against the frame
        </div>
      ) : null}

      {isOpen ? (
        // The window root is `pointer-events: none` so it never blankets the body it
        // covers; interactive portalled content opts back in, exactly as `renderOverlay`
        // content does. It renders after the frame and shares the frame's stack value, so
        // it paints above its own window — until 2026-07-08 it painted underneath, and
        // this route showed the bug rather than the feature.
        <InfiniteCanvasPortal scope="window">
          <div
            className={`${POPOVER_CLASS} pointer-events-auto right-4 border-emerald-500/50 bg-popover`}
          >
            <div className="font-medium text-emerald-200">portalled</div>
            constant size, tracks the window, above it
          </div>
        </InfiniteCanvasPortal>
      ) : null}

      {isOpen ? (
        // `scope="desktop"` leaves the window behind entirely: this badge is pinned to the
        // viewport, not to the frame, and does not move when the window does.
        <InfiniteCanvasPortal scope="desktop">
          <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 rounded-md border border-sky-400/40 bg-popover/90 px-2.5 py-1.5 text-[10px] text-sky-100 backdrop-blur">
            scope=&quot;desktop&quot; — pinned to the viewport. Drag the window; this stays.
          </div>
        </InfiniteCanvasPortal>
      ) : null}
    </div>
  );
}

const registry = defineInfiniteCanvasWindowRegistry<Kind>({
  menu: {
    kind: "menu",
    // Opt in. A window that never opens a popover mounts no tracking root.
    portalRoot: true,
    renderBody: () => <WindowMenu />,
  },
});

const initialState = createInfiniteCanvasState<Kind>({
  windows: [
    createInfiniteCanvasWindow({
      id: "menus",
      kind: "menu",
      rect: { height: 260, width: 360, x: 0, y: 0 },
      title: "Popovers",
    }),
  ],
});

function PortalsShowcase() {
  return (
    <div className="absolute inset-0">
      <InfiniteCanvasDesktop
        initialState={initialState}
        renderOverlay={() => <CommandPalette />}
        subtitle='Open the menu and zoom — the HUD reads the zoom out for you. The red popover grows with the canvas; the green one holds its size and stays above its window. If they agree, scope="window" is broken.'
        title="Portals"
        windowDefinitions={registry}
      />
    </div>
  );
}
