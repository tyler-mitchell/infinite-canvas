import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
  InfiniteCanvasDesktop,
  useInfiniteCanvasActions,
  useInfiniteCanvasSelector,
  useInfiniteCanvasStore,
} from "@hyphened/infinite-canvas";
import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { Button } from "ui";

import { CommandPalette } from "../showcases/command-palette.tsx";
import { exposeCanvasDevHandle } from "../showcases/dev-handle.ts";
import { CanvasThemeSwitcher } from "../showcases/theme-switcher.tsx";

/** A workspace filters one canvas and stores its camera and selection. */
type Kind = "brief" | "note";

const windowDefinitions = defineInfiniteCanvasWindowRegistry<Kind>({
  brief: {
    kind: "brief",
    renderBody: ({ window }) => (
      <div className="flex h-full flex-col gap-2 p-3 text-sm">
        <p className="font-medium">{window.title}</p>
        <p className="text-muted-foreground">
          Switch desktops and come back — the camera and selection you left are restored, and the
          switch is a single undo entry.
        </p>
      </div>
    ),
  },
  note: {
    kind: "note",
    renderBody: ({ window }) => <p className="p-3 text-sm text-muted-foreground">{window.title}</p>,
  },
});

const paneAt = (id: string, kind: Kind, title: string, x: number, y: number) =>
  createInfiniteCanvasWindow<Kind>({
    id,
    kind,
    minSize: { height: 140, width: 220 },
    rect: { height: 200, width: 320, x, y },
    title,
  });

const RESEARCH = ["sources", "notes"];
const WRITING = ["draft", "outline"];

const initialState = createInfiniteCanvasState<Kind>({
  activeWindowId: "sources",
  windows: [
    paneAt("sources", "brief", "sources.md", -520, -160),
    paneAt("notes", "note", "reading notes", -160, -160),
    paneAt("draft", "brief", "draft.md", -520, 120),
    paneAt("outline", "note", "outline", -160, 120),
    paneAt("scratch", "note", "scratch (on no desktop)", 220, -20),
  ],
});

function WorkspaceSwitcher() {
  const actions = useInfiniteCanvasActions<Kind>();
  const store = useInfiniteCanvasStore<Kind>();
  const sequenceRef = useRef(0);
  const workspaces = useInfiniteCanvasSelector((state) => state.workspaces);
  const activeWorkspaceId = useInfiniteCanvasSelector((state) => state.activeWorkspaceId);
  const activeWindowId = useInfiniteCanvasSelector((state) => state.activeWindowId);

  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 flex items-center gap-1.5 rounded-lg border border-border bg-popover/90 p-1.5 backdrop-blur">
      <CanvasThemeSwitcher />
      <span className="mx-1 h-4 w-px bg-border" />
      <Button
        onClick={() => {
          actions.executeCommand({ type: "workspace.showAll" });
        }}
        size="xs"
        variant={activeWorkspaceId === null ? "secondary" : "ghost"}
      >
        All windows
      </Button>
      {workspaces.map((workspace) => (
        <Button
          key={workspace.id}
          onClick={() => {
            actions.dispatch({ type: "workspace.activate", workspaceId: workspace.id });
          }}
          size="xs"
          variant={activeWorkspaceId === workspace.id ? "secondary" : "ghost"}
        >
          {workspace.title}
        </Button>
      ))}
      <span className="mx-1 h-4 w-px bg-border" />
      <span className="px-1 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
        send to
      </span>
      {workspaces
        .filter((workspace) => !workspace.windowIds.includes(activeWindowId ?? ""))
        .map((workspace) => (
          <Button
            disabled={activeWindowId === null}
            key={workspace.id}
            onClick={() => {
              actions.executeCommand({
                type: "workspace.moveActiveWindow",
                workspaceId: workspace.id,
              });
            }}
            size="xs"
            variant="ghost"
          >
            → {workspace.title}
          </Button>
        ))}
      <span className="mx-1 h-4 w-px bg-border" />
      <Button
        onClick={() => {
          // The one-time camera read prevents rerenders during a pan.
          const { camera } = store.state$.peek();
          sequenceRef.current += 1;
          const ordinal = sequenceRef.current;
          const cascade = (ordinal % 5) * 28;

          actions.openWindow(
            createInfiniteCanvasWindow<Kind>({
              id: `scratch-${ordinal}`,
              kind: "note",
              minSize: { height: 140, width: 220 },
              rect: {
                height: 200,
                width: 320,
                x: camera.center.x - 160 + cascade,
                y: camera.center.y - 100 + cascade,
              },
              title: `note ${ordinal}`,
            }),
          );
        }}
        size="xs"
        variant="ghost"
      >
        New window
      </Button>
      <span className="mx-1 h-4 w-px bg-border" />
      <Button
        onClick={() => {
          actions.executeCommand({ direction: "next", type: "workspace.cycle" });
        }}
        size="xs"
        variant="ghost"
      >
        Next
      </Button>
      <Button
        onClick={() => {
          actions.executeCommand({ type: "workspace.removeActiveWindow" });
        }}
        size="xs"
        variant="ghost"
      >
        Drop window
      </Button>
    </div>
  );
}

export const Route = createFileRoute("/workspaces")({
  component: WorkspacesShowcase,
  staticData: {
    showcase: {
      description: "Virtual desktops: named sets of windows, each with its own camera.",
      order: 9,
      title: "Workspaces",
    },
  },
});

function WorkspacesShowcase() {
  return (
    <div className="absolute inset-0">
      <InfiniteCanvasDesktop
        initialState={{
          ...initialState,
          workspaces: [
            {
              camera: { center: { x: -340, y: -60 }, zoom: 1 },
              id: "research",
              selection: { anchorWindowId: "sources", windowIds: ["sources"] },
              title: "Research",
              windowIds: RESEARCH,
            },
            {
              camera: { center: { x: -340, y: 220 }, zoom: 1 },
              id: "writing",
              selection: { anchorWindowId: null, windowIds: [] },
              title: "Writing",
              windowIds: WRITING,
            },
          ],
        }}
        renderOverlay={(context) => {
          exposeCanvasDevHandle(context);
          return (
            <>
              <CommandPalette />
              <WorkspaceSwitcher />
            </>
          );
        }}
        storageKey="infinite-canvas-playground-workspaces"
        windowDefinitions={windowDefinitions}
      />
    </div>
  );
}
