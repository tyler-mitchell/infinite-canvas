import { createFileRoute } from "@tanstack/react-router";
import { syncState, type Observable } from "@legendapp/state";
import { observer } from "@legendapp/state/react";
import { ObservablePersistLocalStorage } from "@legendapp/state/persist-plugins/local-storage";
import { syncObservable } from "@legendapp/state/sync";
import { useRef, useState } from "react";
import { Button, buttonVariants } from "ui";
import {
  createCanvasState,
  documentTransform,
  type Canvas,
  type WindowState,
} from "@hyphened/infinite-canvas";
import {
  CanvasTools,
  CanvasViewport,
  CommandTrigger,
  WindowDragHandle,
} from "@hyphened/infinite-canvas/react";
import "@hyphened/infinite-canvas/theme.css";
import { CanvasCommands } from "../showcases/canvas-commands";
import { WindowControls } from "../showcases/sample-canvas";

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

const WorkspaceWindow = observer(function WorkspaceWindow({
  canvas,
  window,
}: {
  canvas: Canvas;
  window: Observable<WindowState>;
}) {
  return (
    <>
      <WindowDragHandle className="flex h-9 shrink-0 items-center justify-between border-b border-white/10 px-3">
        <span className="text-xs">{window.title.get()}</span>
        <WindowControls canvas={canvas} window={window} />
      </WindowDragHandle>
      <div className="min-h-0 flex-1 overflow-auto p-3 text-sm" data-canvas-scroll="native">
        <p>{window.title.get()}</p>
        {window.kind.get() === "brief" && (
          <p className="mt-2 text-white/50">
            Each workspace retains its camera and selection. Window edits remain shared.
          </p>
        )}
      </div>
    </>
  );
});

const WorkspaceSwitcher = observer(function WorkspaceSwitcher({ canvas }: { canvas: Canvas }) {
  const sequence = useRef(0);
  const activeWorkspaceId = canvas.state.document.activeWorkspaceId.get();
  const activeWindowId = canvas.computed.view.activeWindowId.get();
  const workspaces = canvas.computed.workspaces;
  const workspaceIds = workspaces.map((workspace) => workspace.id.get());
  const ghostButton = buttonVariants({ size: "xs", variant: "ghost" });
  const error = syncState(canvas.state.document).error.get();
  return (
    <div
      data-canvas-control
      className="absolute bottom-4 left-4 z-70 flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-1.5 rounded-lg border border-white/15 bg-neutral-950/95 p-1.5"
    >
      <CommandTrigger
        command={canvas.commands.activateWorkspace}
        input={{ workspaceId: null }}
        className={buttonVariants({
          size: "xs",
          variant: activeWorkspaceId === null ? "secondary" : "ghost",
        })}
      >
        All windows
      </CommandTrigger>
      {workspaces.map((workspace) => (
        <CommandTrigger
          key={workspace.id.get()}
          command={canvas.commands.activateWorkspace}
          input={{ workspaceId: workspace.id.get() }}
          className={buttonVariants({
            size: "xs",
            variant: activeWorkspaceId === workspace.id.get() ? "secondary" : "ghost",
          })}
        >
          {workspace.title.get()}
        </CommandTrigger>
      ))}
      <span className="px-1 text-[10px] uppercase text-white/40">Send to</span>
      {workspaces
        .filter((workspace) => !workspace.windowIds.includes(activeWindowId ?? ""))
        .map((workspace) => (
          <CommandTrigger
            key={workspace.id.get()}
            className={ghostButton}
            disabled={activeWindowId === null}
            command={canvas.commands.moveWindowsToWorkspace}
            input={{
              workspace: workspace.id.get(),
              windows: activeWindowId === null ? [] : [activeWindowId],
            }}
          >
            → {workspace.title.get()}
          </CommandTrigger>
        ))}
      <Button
        size="xs"
        variant="ghost"
        onClick={() => {
          sequence.current += 1;
          const center = canvas.computed.camera.center.peek();
          const cascade = (sequence.current % 5) * 28;
          void canvas.commands.openWindow.run({
            kind: "note",
            title: `Note ${sequence.current}`,
            rect: {
              x: center.x - 160 + cascade,
              y: center.y - 100 + cascade,
              width: 320,
              height: 200,
            },
          });
        }}
      >
        New window
      </Button>
      <CommandTrigger
        className={ghostButton}
        disabled={workspaces.length === 0}
        command={canvas.commands.activateWorkspace}
        input={{
          workspaceId:
            workspaceIds[
              (workspaceIds.indexOf(activeWorkspaceId ?? "") + 1) % workspaceIds.length
            ] ?? null,
        }}
      >
        Next
      </CommandTrigger>
      <CommandTrigger
        className={ghostButton}
        disabled={activeWindowId === null}
        command={canvas.commands.removeWorkspaceWindows}
        input={{
          workspace: activeWorkspaceId ?? "",
          windows: activeWindowId === null ? [] : [activeWindowId],
        }}
      >
        Drop window
      </CommandTrigger>
      {error != null && (
        <p role="alert" className="text-xs text-red-300">
          The workspace could not be saved: {String(error)}
        </p>
      )}
    </div>
  );
});

function WorkspacesShowcase() {
  const [canvas] = useState(() => {
    const canvas = createCanvasState({
      windowDefinitions: {
        brief: { minSize: { width: 220, height: 140 } },
        note: { minSize: { width: 220, height: 140 } },
      },
      document: {
        content: {
          windows: {
            sources: {
              kind: "brief",
              title: "sources.md",
              rect: { x: -520, y: -160, width: 320, height: 200 },
            },
            notes: {
              kind: "note",
              title: "reading notes",
              rect: { x: -160, y: -160, width: 320, height: 200 },
            },
            draft: {
              kind: "brief",
              title: "draft.md",
              rect: { x: -520, y: 120, width: 320, height: 200 },
            },
            outline: {
              kind: "note",
              title: "outline",
              rect: { x: -160, y: 120, width: 320, height: 200 },
            },
            scratch: {
              kind: "note",
              title: "scratch (on no desktop)",
              rect: { x: 220, y: -20, width: 320, height: 200 },
            },
          },
          workspaces: {
            research: { title: "Research", windowIds: ["sources", "notes"] },
            writing: { title: "Writing", windowIds: ["draft", "outline"] },
          },
        },
        canvasView: { activeWindowId: "sources" },
        workspaceViews: {
          research: {
            camera: { center: { x: -340, y: -60 }, zoom: 1 },
            activeWindowId: "sources",
            selection: {
              targets: { "window:sources": { type: "window", id: "sources" } },
              anchor: "window:sources",
            },
            stackingOrder: ["window:notes", "window:sources"],
          },
          writing: {
            camera: { center: { x: -340, y: 220 }, zoom: 1 },
            activeWindowId: null,
            selection: { targets: {}, anchor: null },
            stackingOrder: ["window:draft", "window:outline"],
          },
        },
      },
    });
    syncObservable(canvas.state.document, {
      persist: {
        name: "playground.workspaces",
        plugin: ObservablePersistLocalStorage,
        transform: documentTransform(canvas),
      },
      onError: (error) => console.warn("Workspace persistence failed.", error),
    });
    return canvas;
  });
  return (
    <div className="absolute inset-0">
      <CanvasViewport
        canvas={canvas}
        emptyCanvasDrag="marquee"
        renderWindow={(window) => <WorkspaceWindow canvas={canvas} window={window} />}
      >
        <CanvasCommands canvas={canvas} />
        <CanvasTools canvas={canvas} />
        <WorkspaceSwitcher canvas={canvas} />
      </CanvasViewport>
    </div>
  );
}
