import { createFileRoute } from "@tanstack/react-router";
import {
  createInfiniteCanvasEdgeTargetResolver,
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
  getInfiniteCanvasWindowConnectorSegment,
  getInfiniteCanvasWindowPresence,
  getInfiniteCanvasWindowProxy,
  getInfiniteCanvasWorldSegmentSceneTransform,
  getSelectionTargets,
  InfiniteCanvasDesktop,
  worldPointToScreenPoint,
  worldRectToScreenRect,
  type InfiniteCanvasOverlayRenderContext,
  type InfiniteCanvasSceneLayer,
  type InfiniteCanvasState,
  type InfiniteCanvasWindow,
  type InfiniteCanvasWorldSegment,
} from "@infinite-canvas/react";
import { useMemo, useState } from "react";
import { Button } from "ui";
import { exposeCanvasDevHandle } from "../showcases/dev-handle.ts";

export const Route = createFileRoute("/workflow-board")({
  component: WorkflowBoardShowcase,
  staticData: {
    showcase: {
      description: "Connectors, edge selection, ports, contextual commands, workspaces.",
      order: 4,
      title: "Workflow board",
    },
  },
});

type CardKind = "stage";
type WorkspaceId = "launch" | "research";

type Connection = Readonly<{ from: string; id: string; label: string; to: string }>;

type CardSpec = Readonly<{
  id: string;
  lines: readonly string[];
  rect: { height: number; width: number; x: number; y: number };
  title: string;
}>;

function makeWorkspaceState(cards: readonly CardSpec[]): InfiniteCanvasState<CardKind> {
  return createInfiniteCanvasState<CardKind>({
    camera: { center: { x: 470, y: 220 }, zoom: 0.8 },
    windows: cards.map((card, index) =>
      createInfiniteCanvasWindow<CardKind, { lines: readonly string[] }>({
        data: { lines: card.lines },
        id: card.id,
        kind: "stage",
        rect: card.rect,
        title: card.title,
        zIndex: index,
      }),
    ),
  });
}

const workspaces: Record<
  WorkspaceId,
  { connections: readonly Connection[]; label: string; state: InfiniteCanvasState<CardKind> }
> = {
  launch: {
    connections: [
      { from: "intake", id: "intake-review", label: "triage", to: "review" },
      { from: "review", id: "review-ship", label: "approve", to: "ship" },
    ],
    label: "Launch",
    state: makeWorkspaceState([
      {
        id: "intake",
        lines: ["Click a card's right port,", "then another card's left port", "to draw a link."],
        rect: { height: 170, width: 270, x: 0, y: 60 },
        title: "Intake",
      },
      {
        id: "review",
        lines: ["Click a link to select it;", "delete it from the action bar."],
        rect: { height: 170, width: 270, x: 360, y: 0 },
        title: "Review",
      },
      {
        id: "ship",
        lines: ["Links are scene-layer meshes;", "labels are projected DOM."],
        rect: { height: 170, width: 270, x: 720, y: 90 },
        title: "Ship",
      },
    ]),
  },
  research: {
    connections: [{ from: "collect", id: "collect-distill", label: "summarize", to: "distill" }],
    label: "Research",
    state: makeWorkspaceState([
      {
        id: "collect",
        lines: ["A second workspace:", "its own documentKey remounts", "the provider boundary."],
        rect: { height: 170, width: 280, x: 80, y: 40 },
        title: "Collect",
      },
      {
        id: "distill",
        lines: ["Layout, selection, and links", "stay scoped per workspace."],
        rect: { height: 170, width: 280, x: 500, y: 180 },
        title: "Distill",
      },
    ]),
  },
};

const registry = defineInfiniteCanvasWindowRegistry<CardKind>({
  stage: {
    kind: "stage",
    overflowY: "auto",
    renderBody: ({ window }) => <StageCardBody window={window} />,
    textSelection: "none",
  },
});

function StageCardBody({ window }: { window: InfiniteCanvasWindow<CardKind> }) {
  const lines =
    typeof window.data === "object" && window.data !== null && "lines" in window.data
      ? (window.data as { lines: readonly string[] }).lines
      : [];
  return (
    <div className="grid content-start gap-1.5 p-4 text-xs leading-relaxed text-white/55">
      {lines.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </div>
  );
}

function connectionSegment(
  state: InfiniteCanvasState<CardKind>,
  connection: Connection,
): InfiniteCanvasWorldSegment | null {
  const fromWindow = getWindow(state, connection.from);
  const toWindow = getWindow(state, connection.to);
  if (fromWindow === null || toWindow === null) {
    return null;
  }
  const from = getInfiniteCanvasWindowProxy(state, fromWindow);
  const to = getInfiniteCanvasWindowProxy(state, toWindow);
  return from && to ? getInfiniteCanvasWindowConnectorSegment(from, to) : null;
}

function getWindow(state: InfiniteCanvasState<CardKind>, windowId: string) {
  return state.windows.find((window) => window.id === windowId) ?? null;
}

function selectedConnectionId(state: InfiniteCanvasState<CardKind>): string | null {
  const target = getSelectionTargets(state.selection).find(
    (candidate) => candidate.type === "edge" && candidate.kind === "workflow-link",
  );
  return target?.id ?? null;
}

function WorkflowBoardShowcase() {
  const [workspaceId, setWorkspaceId] = useState<WorkspaceId>("launch");
  const [connectionsByWorkspace, setConnectionsByWorkspace] = useState<
    Record<WorkspaceId, readonly Connection[]>
  >({
    launch: workspaces.launch.connections,
    research: workspaces.research.connections,
  });
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const connections = connectionsByWorkspace[workspaceId];

  const setConnections = (
    update: (connections: readonly Connection[]) => readonly Connection[],
  ) => {
    setConnectionsByWorkspace((previous) => ({
      ...previous,
      [workspaceId]: update(previous[workspaceId]),
    }));
  };

  const sceneLayers = useMemo(
    () =>
      [
        {
          frameloop: "demand",
          id: "workflow-links",
          render: (context) => {
            const selectedId = selectedConnectionId(context.state);
            return (
              <group>
                {connections.map((connection) => {
                  const segment = connectionSegment(context.state, connection);
                  if (segment === null) {
                    return null;
                  }
                  const transform = getInfiniteCanvasWorldSegmentSceneTransform(segment, -4);
                  const isSelected = connection.id === selectedId;
                  return (
                    <mesh
                      key={connection.id}
                      position={transform.position}
                      rotation={transform.rotation}
                    >
                      <boxGeometry args={[transform.length, isSelected ? 4 : 2, 1]} />
                      <meshBasicMaterial
                        color={isSelected ? "#bae6fd" : "#38bdf8"}
                        opacity={isSelected ? 0.95 : 0.55}
                        transparent
                      />
                    </mesh>
                  );
                })}
              </group>
            );
          },
        },
      ] satisfies readonly InfiniteCanvasSceneLayer<CardKind>[],
    [connections],
  );

  const spatialTargetResolvers = useMemo(
    () =>
      [
        createInfiniteCanvasEdgeTargetResolver<CardKind>({
          id: "workflow-links",
          targets: (context) =>
            connections.flatMap((connection) => {
              const segment = connectionSegment(context.state, connection);
              return segment === null
                ? []
                : [
                    {
                      data: { label: connection.label },
                      end: segment.end,
                      hitRadius: 12,
                      id: connection.id,
                      kind: "workflow-link",
                      start: segment.start,
                    },
                  ];
            }),
        }),
      ] as const,
    [connections],
  );

  const workspace = workspaces[workspaceId];

  return (
    <div className="absolute inset-0">
      <InfiniteCanvasDesktop
        documentKey={`workflow-${workspaceId}`}
        initialState={workspace.state}
        renderOverlay={(context) => (
          <BoardOverlay
            connections={connections}
            context={context}
            pendingFrom={pendingFrom}
            setConnections={setConnections}
            setPendingFrom={setPendingFrom}
            setWorkspaceId={setWorkspaceId}
            workspaceId={workspaceId}
          />
        )}
        sceneLayers={sceneLayers}
        spatialTargetResolvers={spatialTargetResolvers}
        subtitle="Scene-layer links, selectable edges, ports, and scoped workspaces."
        title={`Workflow — ${workspace.label}`}
        windowDefinitions={registry}
      />
    </div>
  );
}

function BoardOverlay({
  connections,
  context,
  pendingFrom,
  setConnections,
  setPendingFrom,
  setWorkspaceId,
  workspaceId,
}: {
  connections: readonly Connection[];
  context: InfiniteCanvasOverlayRenderContext<CardKind>;
  pendingFrom: string | null;
  setConnections: (update: (connections: readonly Connection[]) => readonly Connection[]) => void;
  setPendingFrom: (windowId: string | null) => void;
  setWorkspaceId: (workspaceId: WorkspaceId) => void;
  workspaceId: WorkspaceId;
}) {
  exposeCanvasDevHandle(context);
  const selectedId = selectedConnectionId(context.state);

  return (
    <div className="pointer-events-none absolute inset-0 z-[65]">
      <ConnectionLabels connections={connections} context={context} />
      <WindowPorts
        connections={connections}
        context={context}
        pendingFrom={pendingFrom}
        setConnections={setConnections}
        setPendingFrom={setPendingFrom}
      />
      <div className="pointer-events-auto absolute top-4 right-4 flex items-center gap-1.5 rounded-lg border border-border bg-popover/90 p-1.5 backdrop-blur">
        {(Object.keys(workspaces) as WorkspaceId[]).map((id) => (
          <Button
            key={id}
            onClick={() => {
              setPendingFrom(null);
              setWorkspaceId(id);
            }}
            size="xs"
            variant={id === workspaceId ? "secondary" : "ghost"}
          >
            {workspaces[id].label}
          </Button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        <Button
          onClick={() => context.actions.executeCommand({ type: "view.fitAll" })}
          size="xs"
          variant="ghost"
        >
          Fit board
        </Button>
        {selectedId === null ? null : (
          <Button
            onClick={() => {
              setConnections((current) =>
                current.filter((connection) => connection.id !== selectedId),
              );
              context.actions.executeCommand({ type: "selection.clear" });
            }}
            size="xs"
            variant="destructive"
          >
            Delete link
          </Button>
        )}
      </div>
      {pendingFrom === null ? null : (
        <div className="pointer-events-none absolute top-16 right-4 rounded-md border border-sky-300/40 bg-popover/90 px-2.5 py-1.5 font-mono text-[10px] tracking-wider text-sky-100 uppercase">
          linking from {pendingFrom} — click a left port
        </div>
      )}
    </div>
  );
}

function ConnectionLabels({
  connections,
  context,
}: {
  connections: readonly Connection[];
  context: InfiniteCanvasOverlayRenderContext<CardKind>;
}) {
  return (
    <>
      {connections.map((connection) => {
        const segment = connectionSegment(context.state, connection);
        if (segment === null) {
          return null;
        }
        const point = worldPointToScreenPoint(
          context.state.camera,
          context.state.viewport,
          segment.midpoint,
        );
        return (
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded border border-sky-300/25 bg-[#07121a]/90 px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-sky-200/80 uppercase"
            key={connection.id}
            style={{ left: point.x, top: point.y }}
          >
            {connection.label}
          </div>
        );
      })}
    </>
  );
}

function WindowPorts({
  connections,
  context,
  pendingFrom,
  setConnections,
  setPendingFrom,
}: {
  connections: readonly Connection[];
  context: InfiniteCanvasOverlayRenderContext<CardKind>;
  pendingFrom: string | null;
  setConnections: (update: (connections: readonly Connection[]) => readonly Connection[]) => void;
  setPendingFrom: (windowId: string | null) => void;
}) {
  return (
    <>
      {context.state.windows
        .filter((window) => window.mode !== "minimized")
        .map((window) => {
          const rect = worldRectToScreenRect(
            context.state.camera,
            context.state.viewport,
            window.rect,
          );
          const portY = rect.top + rect.height / 2;
          const isPendingSource = pendingFrom === window.id;
          const canComplete = pendingFrom !== null && pendingFrom !== window.id;

          return (
            <span key={window.id}>
              <PortButton
                accented={isPendingSource}
                label={`Start link from ${window.title}`}
                onClick={() => {
                  setPendingFrom(isPendingSource ? null : window.id);
                }}
                x={rect.left + rect.width}
                y={portY}
              />
              <PortButton
                accented={canComplete}
                label={`Link into ${window.title}`}
                onClick={() => {
                  if (pendingFrom === null || pendingFrom === window.id) {
                    return;
                  }
                  const id = `${pendingFrom}->${window.id}`;
                  setConnections((current) =>
                    current.some((connection) => connection.id === id)
                      ? current
                      : [...current, { from: pendingFrom, id, label: "link", to: window.id }],
                  );
                  setPendingFrom(null);
                }}
                x={rect.left}
                y={portY}
              />
            </span>
          );
        })}
      <Dock connections={connections} context={context} />
    </>
  );
}

function PortButton({
  accented,
  label,
  onClick,
  x,
  y,
}: {
  accented: boolean;
  label: string;
  onClick: () => void;
  x: number;
  y: number;
}) {
  return (
    <button
      aria-label={label}
      className={[
        "pointer-events-auto absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-colors",
        accented
          ? "border-sky-200 bg-sky-300"
          : "border-sky-300/50 bg-[#0a1620] hover:bg-sky-300/40",
      ].join(" ")}
      onClick={onClick}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      style={{ left: x, top: y, zIndex: 80 }}
      type="button"
    />
  );
}

function Dock({
  connections,
  context,
}: {
  connections: readonly Connection[];
  context: InfiniteCanvasOverlayRenderContext<CardKind>;
}) {
  const presence = getInfiniteCanvasWindowPresence(context.state);
  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 flex items-center gap-1.5 rounded-lg border border-border bg-popover/90 p-1.5 backdrop-blur">
      {presence.visible.map((item) => (
        <Button
          key={item.id}
          onClick={() => {
            context.actions.focusWindow(item.id);
            context.actions.navigateToWindow({ windowId: item.id });
          }}
          size="xs"
          variant={item.isActive ? "secondary" : "ghost"}
        >
          {item.title}
        </Button>
      ))}
      <span className="mx-1 h-4 w-px bg-border" />
      <span className="px-1 font-mono text-[10px] text-muted-foreground">
        {connections.length} link{connections.length === 1 ? "" : "s"}
      </span>
    </div>
  );
}
