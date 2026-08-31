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
        // This comparison case stays inside the scaled frame.
        <div className={`${POPOVER_CLASS} left-4 border-red-400/50 bg-popover`}>
          <div className="font-medium text-red-200">in-body</div>
          scales with zoom, and resolves <code>position: fixed</code> against the frame
        </div>
      ) : null}

      {isOpen ? (
        // The portal restores pointer events and paints above its own frame.
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
        // The desktop portal stays fixed to the viewport.
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
    // Only windows that use portals mount a portal root.
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
