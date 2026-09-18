import { createFileRoute } from "@tanstack/react-router";
import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
  CommandTrigger,
  InfiniteCanvasDesktop,
} from "@hyphened/infinite-canvas";
import { Button } from "ui";
import { CommandPalette } from "../showcases/command-palette.tsx";

export const Route = createFileRoute("/persistence")({
  component: PersistenceShowcase,
  staticData: {
    showcase: {
      description: "Saved layouts survive reload; unavailable components retain their data.",
      order: 6,
      title: "Persistence",
    },
  },
});

type Kind = "note";

const STORAGE_KEY = "playground.persistence.v1";

const registry = defineInfiniteCanvasWindowRegistry<Kind>({
  note: {
    kind: "note",
    overflowY: "auto",
    renderBody: ({ window }) => (
      <div className="grid content-start gap-2 p-4 text-xs leading-relaxed text-white/60">
        <div className="font-mono text-[10px] tracking-wider text-white/40 uppercase">
          {window.id}
        </div>
        <p>Move or resize me, then reload the page. The layout is restored.</p>
        <p className="text-white/40">
          The configured storage key owns this document. Reset restores its starting layout.
        </p>
      </div>
    ),
  },
});

const initialState = createInfiniteCanvasState<Kind>({
  camera: { center: { x: 260, y: 130 }, zoom: 0.95 },
  windows: [
    createInfiniteCanvasWindow({
      id: "persisted-a",
      kind: "note",
      rect: { height: 220, width: 340, x: 0, y: 0 },
      title: "Persisted A",
      zIndex: 1,
    }),
    createInfiniteCanvasWindow({
      id: "persisted-b",
      kind: "note",
      rect: { height: 220, width: 340, x: 420, y: 160 },
      title: "Persisted B",
      zIndex: 0,
    }),
  ],
});

function PersistenceShowcase() {
  return (
    <div className="absolute inset-0">
      <InfiniteCanvasDesktop
        tools
        initialState={initialState}
        renderOverlay={() => {
          return (
            <>
              <CommandPalette />
              <div className="pointer-events-auto absolute bottom-4 left-4 flex items-center gap-1.5 rounded-lg border border-border bg-popover/90 p-1.5 backdrop-blur">
                <span
                  className="px-2 font-mono text-[10px] text-muted-foreground"
                  data-testid="storage-key"
                >
                  {STORAGE_KEY}
                </span>
                <CommandTrigger
                  data-testid="reset-persisted"
                  commandId="desktop.reset"
                  render={<Button size="xs" variant="ghost" />}
                >
                  Reset saved layout
                </CommandTrigger>
              </div>
            </>
          );
        }}
        storageKey={STORAGE_KEY}
        subtitle="Layout persists across reloads; the persisted payload is validated on hydration."
        title="Persistence"
        windowDefinitions={registry}
      />
    </div>
  );
}
