import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { createCanvasState } from "@hyphened/infinite-canvas";
import {
  CanvasPortal,
  CanvasTools,
  CanvasViewport,
  WindowDragHandle,
} from "@hyphened/infinite-canvas/react";
import "@hyphened/infinite-canvas/theme.css";
import { Button } from "ui";
import { CanvasCommands } from "../showcases/canvas-commands";
import { WindowControls } from "../showcases/sample-canvas";

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

const POPOVER_CLASS = "absolute bottom-4 w-36 rounded border p-2 text-[10px] leading-snug";

function WindowMenu() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="grid content-start gap-3 p-4 text-xs text-white/60">
      <Button onClick={() => setIsOpen((open) => !open)} size="xs" variant="ghost">
        {isOpen ? "Close menu" : "Open menu"}
      </Button>
      <p>
        Open the menu, then zoom. Two popovers, identical at 100%. One grows with the canvas; one
        does not. The window portal retains its screen size.
      </p>

      {isOpen ? (
        // This comparison case stays inside the scaled frame.
        <div className={`${POPOVER_CLASS} left-4 border-red-400/50 bg-popover`}>
          <div className="font-medium text-red-200">in-body</div>
          scales with zoom, and resolves <code>position: fixed</code> against the frame
        </div>
      ) : null}

      {isOpen ? (
        // The portal restores pointer events and paints above its own frame.
        <CanvasPortal scope="window">
          <div
            className={`${POPOVER_CLASS} pointer-events-auto right-4 border-emerald-500/50 bg-popover`}
          >
            <div className="font-medium text-emerald-200">portalled</div>
            constant size, tracks the window, above it
          </div>
        </CanvasPortal>
      ) : null}

      {isOpen ? (
        // The desktop portal stays fixed to the viewport.
        <CanvasPortal scope="viewport">
          <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 rounded-md border border-sky-400/40 bg-popover/90 px-2.5 py-1.5 text-[10px] text-sky-100 backdrop-blur">
            This message stays fixed to the viewport when the window moves.
          </div>
        </CanvasPortal>
      ) : null}
    </div>
  );
}

function PortalsShowcase() {
  const [canvas] = useState(() =>
    createCanvasState({
      windowDefinitions: { menu: {} },
      document: {
        content: {
          windows: {
            menus: {
              kind: "menu",
              title: "Popovers",
              rect: { x: 0, y: 0, width: 360, height: 260 },
            },
          },
        },
      },
    }),
  );
  return (
    <div className="absolute inset-0">
      <CanvasViewport
        canvas={canvas}
        renderWindow={(window) => (
          <>
            <WindowDragHandle className="flex h-9 items-center justify-between border-b border-white/10 px-3">
              <span>Popovers</span>
              <WindowControls canvas={canvas} window={window} />
            </WindowDragHandle>
            <WindowMenu />
          </>
        )}
      >
        <CanvasCommands canvas={canvas} />
        <CanvasTools canvas={canvas} />
      </CanvasViewport>
    </div>
  );
}
