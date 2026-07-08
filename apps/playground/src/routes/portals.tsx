import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
  InfiniteCanvasDesktop,
  InfiniteCanvasPortal,
} from "@infinite-canvas/react";
import { Button } from "ui";

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

/**
 * The trap this route exists to demonstrate: a window frame is
 * `transform: scale(zoom)`, which makes it the containing block for
 * `position: fixed`. Anything inside a window body that positions itself against
 * the viewport lands in the wrong place, at the wrong size.
 *
 * The unportalled popover below is absolutely positioned inside the body, so it
 * scales with the canvas. The portalled one mounts into the window's own root —
 * a sibling of the frame, outside every transform — and stays at natural size.
 */
function WindowMenu() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="grid content-start gap-3 p-4 text-xs text-white/60">
      <Button onClick={() => setIsOpen((open) => !open)} size="xs" variant="ghost">
        {isOpen ? "Close menu" : "Open menu"}
      </Button>
      <p>Zoom the canvas, then open the menu. Only one of these stays readable.</p>

      {isOpen ? (
        <div className="absolute top-16 left-4 rounded border border-border bg-popover p-2 text-[10px]">
          in-body: scaled by zoom
        </div>
      ) : null}

      {isOpen ? (
        // The window root is `pointer-events: none` so it never blankets the body it
        // covers; interactive portalled content opts back in, exactly as `renderOverlay`
        // content does.
        <InfiniteCanvasPortal scope="window">
          <div className="pointer-events-auto absolute top-16 right-4 rounded border border-emerald-500/50 bg-popover p-2 text-[10px]">
            portalled: natural size
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
        subtitle="Window bodies are inside a transform. Portalled content escapes it."
        title="Portals"
        windowDefinitions={registry}
      />
    </div>
  );
}
