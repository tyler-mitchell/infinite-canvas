import { createFileRoute } from "@tanstack/react-router";
import {
  createInfiniteCanvasEdgeTargetResolver,
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
  getInfiniteCanvasRectConnectorSegment,
  getInfiniteCanvasWindowPresence,
  getTargetBounds,
  InfiniteCanvasDesktop,
  worldPointToScreenPoint,
  worldRectToScreenRect,
  type InfiniteCanvasConnection,
  type InfiniteCanvasOverlayRenderContext,
  type InfiniteCanvasState,
  type InfiniteCanvasWindow,
  type InfiniteCanvasWorldSegment,
  useInfiniteCanvasState,
} from "@hyphened/infinite-canvas";
import { InfiniteCanvasCompositorSurface } from "@hyphened/infinite-canvas/scene";
import { useState } from "react";
import { Button } from "ui";
import { CommandPalette } from "../showcases/command-palette.tsx";

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

/** The link kind, shared by the store records and the edge targets that select them. */
const LINK_KIND = "workflow-link";

/** A link's label is the consumer's payload, the way a window's body content is. */
const getLinkLabel = (connection: InfiniteCanvasConnection) =>
  typeof connection.data === "object" && connection.data !== null && "label" in connection.data
    ? String((connection.data as { label: unknown }).label)
    : "link";

const link = (input: Readonly<{ from: string; label: string; to: string }>) =>
  ({
    data: { label: input.label },
    from: input.from,
    id: `${input.from}->${input.to}`,
    kind: LINK_KIND,
    to: input.to,
  }) satisfies InfiniteCanvasConnection;

type CardSpec = Readonly<{
  id: string;
  lines: readonly string[];
  rect: { height: number; width: number; x: number; y: number };
  title: string;
}>;

function makeWorkspaceState(
  cards: readonly CardSpec[],
  connections: readonly InfiniteCanvasConnection[],
): InfiniteCanvasState<CardKind> {
  return createInfiniteCanvasState<CardKind>({
    camera: { center: { x: 470, y: 220 }, zoom: 0.8 },
    connections,
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

const workspaces: Record<WorkspaceId, { label: string; state: InfiniteCanvasState<CardKind> }> = {
  launch: {
    label: "Launch",
    state: makeWorkspaceState(
      [
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
          lines: ["Links undo with the board;", "labels are projected DOM."],
          rect: { height: 170, width: 270, x: 720, y: 90 },
          title: "Ship",
        },
      ],
      [
        link({ from: "intake", label: "triage", to: "review" }),
        link({ from: "review", label: "approve", to: "ship" }),
      ],
    ),
  },
  research: {
    label: "Research",
    state: makeWorkspaceState(
      [
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
      ],
      [link({ from: "collect", label: "summarize", to: "distill" })],
    ),
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
  connection: InfiniteCanvasConnection,
): InfiniteCanvasWorldSegment | null {
  const from = getTargetBounds({ state, target: { type: "window", id: connection.from } });
  const to = getTargetBounds({ state, target: { type: "window", id: connection.to } });
  return from && to ? getInfiniteCanvasRectConnectorSegment(from, to) : null;
}

/** Ignore stale edge selections after a link or workspace changes. */
function selectedConnectionId(state: InfiniteCanvasState<CardKind>): string | null {
  const target = state.selection.targets.find(
    (candidate) => candidate.type === "edge" && candidate.kind === LINK_KIND,
  );

  return state.connections.some((connection) => connection.id === target?.id)
    ? (target?.id ?? null)
    : null;
}

/*
 * The framework draws the links. This route names no pass and writes no shader: it dispatches
 * `connection.open` and `connection.close`, and the compositor's connections pass reads the same
 * `state.connections` the reducer owns. The resolver below is what makes an edge selectable, which
 * is a hit-testing concern rather than a drawing one.
 */
const spatialTargetResolvers = [
  createInfiniteCanvasEdgeTargetResolver<CardKind>({
    id: "workflow-links",
    targets: (context) =>
      context.state.connections.flatMap((connection) => {
        const segment = connectionSegment(context.state, connection);
        return segment === null
          ? []
          : [
              {
                data: { label: getLinkLabel(connection) },
                end: segment.end,
                hitRadius: 12,
                id: connection.id,
                kind: LINK_KIND,
                start: segment.start,
              },
            ];
      }),
  }),
] as const;

function WorkflowBoardShowcase() {
  const [workspaceId, setWorkspaceId] = useState<WorkspaceId>("launch");
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);

  const workspace = workspaces[workspaceId];

  return (
    <div className="absolute inset-0">
      <InfiniteCanvasDesktop
        tools
        documentKey={`workflow-${workspaceId}`}
        initialState={workspace.state}
        renderOverlay={(context) => (
          <>
            <CommandPalette />
            <BoardOverlay
              context={context}
              pendingFrom={pendingFrom}
              setPendingFrom={setPendingFrom}
              setWorkspaceId={setWorkspaceId}
              workspaceId={workspaceId}
            />
          </>
        )}
        sceneSurface={InfiniteCanvasCompositorSurface}
        spatialTargetResolvers={spatialTargetResolvers}
        subtitle="Scene-layer links, selectable edges, ports, and scoped workspaces."
        title={`Workflow — ${workspace.label}`}
        windowDefinitions={registry}
      />
    </div>
  );
}

function BoardOverlay({
  context,
  pendingFrom,
  setPendingFrom,
  setWorkspaceId,
  workspaceId,
}: {
  context: InfiniteCanvasOverlayRenderContext<CardKind>;
  pendingFrom: string | null;
  setPendingFrom: (windowId: string | null) => void;
  setWorkspaceId: (workspaceId: WorkspaceId) => void;
  workspaceId: WorkspaceId;
}) {
  const state = useInfiniteCanvasState<CardKind>();
  const selectedId = selectedConnectionId(state);

  return (
    <div className="pointer-events-none absolute inset-0 z-[65]">
      <ConnectionLabels />
      <WindowPorts context={context} pendingFrom={pendingFrom} setPendingFrom={setPendingFrom} />
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
        <Button onClick={() => context.dispatch({ type: "view.fitAll" })} size="xs" variant="ghost">
          Fit board
        </Button>
        {selectedId === null ? null : (
          <Button
            onClick={() => {
              context.dispatch({ connectionId: selectedId, type: "connection.close" });
              context.dispatch({ type: "selection.clear" });
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

function ConnectionLabels() {
  const state = useInfiniteCanvasState<CardKind>();
  return (
    <>
      {state.connections.map((connection) => {
        const segment = connectionSegment(state, connection);
        if (segment === null) {
          return null;
        }
        const point = worldPointToScreenPoint(state.camera, state.viewport, segment.midpoint);
        return (
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded border border-sky-300/25 bg-[#07121a]/90 px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-sky-200/80 uppercase"
            key={connection.id}
            style={{ left: point.x, top: point.y }}
          >
            {getLinkLabel(connection)}
          </div>
        );
      })}
    </>
  );
}

function WindowPorts({
  context,
  pendingFrom,
  setPendingFrom,
}: {
  context: InfiniteCanvasOverlayRenderContext<CardKind>;
  pendingFrom: string | null;
  setPendingFrom: (windowId: string | null) => void;
}) {
  const state = useInfiniteCanvasState<CardKind>();
  return (
    <>
      {state.windows
        .filter((window) => window.mode !== "minimized")
        .map((window) => {
          const rect = worldRectToScreenRect(state.camera, state.viewport, window.rect);
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
                  // A repeated pair is the reducer's problem: opening an existing id is a no-op.
                  context.dispatch({
                    connection: link({ from: pendingFrom, label: "link", to: window.id }),
                    type: "connection.open",
                  });
                  setPendingFrom(null);
                }}
                x={rect.left}
                y={portY}
              />
            </span>
          );
        })}
      <Dock context={context} />
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

function Dock({ context }: { context: InfiniteCanvasOverlayRenderContext<CardKind> }) {
  const state = useInfiniteCanvasState<CardKind>();
  const presence = getInfiniteCanvasWindowPresence(state);
  const linkCount = state.connections.length;
  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 flex items-center gap-1.5 rounded-lg border border-border bg-popover/90 p-1.5 backdrop-blur">
      {presence.visible.map((item) => (
        <Button
          key={item.id}
          onClick={() => {
            context.dispatch({ type: "window.focus", windowId: item.id });
            context.dispatch({
              request: { target: { type: "window", windowId: item.id } },
              type: "camera.navigate",
            });
          }}
          size="xs"
          variant={item.isActive ? "secondary" : "ghost"}
        >
          {item.title}
        </Button>
      ))}
      <span className="mx-1 h-4 w-px bg-border" />
      <span className="px-1 font-mono text-[10px] text-muted-foreground">
        {linkCount} link{linkCount === 1 ? "" : "s"}
      </span>
    </div>
  );
}
