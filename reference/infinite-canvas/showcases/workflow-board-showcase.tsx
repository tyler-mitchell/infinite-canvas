"use client";

import {
  GitBranch,
  Image,
  Link2,
  MapPin,
  Minus,
  MousePointer2,
  Plus,
  ScanSearch,
  StickyNote,
  Trash2,
} from "lucide-react";
import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

import {
  InfiniteCanvasDesktop,
  createInfiniteCanvasEdgeTargetResolver,
  createInfiniteCanvasOverlayTargetResolver,
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
  getInfiniteCanvasWindowConnectorPath,
  getInfiniteCanvasWindowPresence,
  getInfiniteCanvasWindowProxy,
  getInfiniteCanvasWorldPathPointAtProgress,
  getInfiniteCanvasWorldPathSceneTransforms,
  getSelectionTargets,
  type InfiniteCanvasDropPolicy,
  type InfiniteCanvasOverlayRenderContext,
  type InfiniteCanvasPoint,
  type InfiniteCanvasRect,
  type InfiniteCanvasSceneLayer,
  type InfiniteCanvasSceneLayerRenderContext,
  type InfiniteCanvasSelectionTarget,
  type InfiniteCanvasSpatialTarget,
  type InfiniteCanvasState,
  type InfiniteCanvasWindow,
  type InfiniteCanvasWindowProxy,
  type InfiniteCanvasWorldPath,
} from "#/experiments/infinite-canvas";
import {
  rectContainsPoint,
  rectsIntersect,
  worldPointToScreenPoint,
} from "#/experiments/infinite-canvas/geometry";

type WorkflowBoardWindowKind = "decision" | "image" | "note" | "output";
type WorkflowBoardWorkspaceId = "launch" | "research";

type WorkflowBoardWindowData = Readonly<{
  accent: string;
  eyebrow: string;
  recordId: string;
  rows: readonly string[];
}>;

type WorkflowBoardAsset = Readonly<{
  accent: string;
  description: string;
  id: string;
  kind: WorkflowBoardWindowKind;
  label: string;
}>;

type WorkflowBoardConnection = Readonly<{
  from: string;
  id: string;
  label: string;
  to: string;
}>;

type WorkflowBoardVisibleConnection = Readonly<{
  connection: WorkflowBoardConnection;
  from: InfiniteCanvasWindowProxy<WorkflowBoardWindowKind>;
  isActive: boolean;
  to: InfiniteCanvasWindowProxy<WorkflowBoardWindowKind>;
  worldPath: InfiniteCanvasWorldPath;
}>;

type WorkflowBoardPendingConnection =
  | Readonly<{ fromWindowId: string; type: "create" }>
  | Readonly<{ connectionId: string; type: "reconnect-from" | "reconnect-to" }>
  | null;

type WorkflowBoardWorkspace = Readonly<{
  connections: readonly WorkflowBoardConnection[];
  id: WorkflowBoardWorkspaceId;
  label: string;
  state: InfiniteCanvasState<WorkflowBoardWindowKind>;
}>;

const workflowAssetTrayMetrics = {
  height: 244,
  left: 16,
  top: 124,
  width: 218,
} as const;

const workflowBoardAssets = [
  {
    accent: "#baf7ff",
    description: "Quick card",
    id: "asset-note",
    kind: "note",
    label: "Note",
  },
  {
    accent: "#9bd8ff",
    description: "Reference card",
    id: "asset-image",
    kind: "image",
    label: "Reference",
  },
  {
    accent: "#d7d1ff",
    description: "Decision node",
    id: "asset-decision",
    kind: "decision",
    label: "Decision",
  },
] satisfies readonly WorkflowBoardAsset[];

const workflowBoardWorkspaces = {
  launch: {
    connections: [
      {
        from: "brief-card",
        id: "brief-to-research",
        label: "context",
        to: "research-card",
      },
      {
        from: "research-card",
        id: "research-to-decision",
        label: "evidence",
        to: "decision-card",
      },
      {
        from: "decision-card",
        id: "decision-to-output",
        label: "handoff",
        to: "output-card",
      },
    ],
    id: "launch",
    label: "Launch Board",
    state: createInfiniteCanvasState<WorkflowBoardWindowKind>({
      activeWindowId: "decision-card",
      camera: {
        center: {
          x: 720,
          y: 420,
        },
        zoom: 0.74,
      },
      selection: ["decision-card"],
      windows: [
        createWorkflowBoardWindow({
          accent: "#baf7ff",
          eyebrow: "Brief",
          id: "brief-card",
          kind: "note",
          recordId: "brief:launch",
          rect: {
            height: 230,
            width: 315,
            x: 150,
            y: 260,
          },
          rows: ["Launch narrative", "Audience constraints", "Success metric"],
          title: "Launch Brief",
          zIndex: 2,
        }),
        createWorkflowBoardWindow({
          accent: "#9bd8ff",
          eyebrow: "Research",
          id: "research-card",
          kind: "note",
          recordId: "note:research",
          rect: {
            height: 245,
            width: 330,
            x: 570,
            y: 170,
          },
          rows: ["Customer quotes", "Competitive screenshots", "Metric assumptions"],
          title: "Research Notes",
          zIndex: 3,
        }),
        createWorkflowBoardWindow({
          accent: "#d7d1ff",
          eyebrow: "Decision",
          id: "decision-card",
          kind: "decision",
          recordId: "decision:pricing",
          rect: {
            height: 245,
            width: 330,
            x: 610,
            y: 500,
          },
          rows: ["Use annual plan as the primary CTA.", "Keep enterprise routing secondary."],
          title: "Pricing Decision",
          zIndex: 5,
        }),
        createWorkflowBoardWindow({
          accent: "#baf7ff",
          eyebrow: "Output",
          id: "output-card",
          isPinned: true,
          kind: "output",
          recordId: "output:handoff",
          rect: {
            height: 270,
            width: 360,
            x: 1040,
            y: 305,
          },
          rows: ["Landing page wireframe", "Copy review", "Analytics checklist"],
          title: "Handoff Output",
          zIndex: 4,
        }),
        createWorkflowBoardWindow({
          accent: "#9bd8ff",
          eyebrow: "Reference",
          id: "mood-reference",
          kind: "image",
          mode: "minimized",
          recordId: "asset:mood",
          rect: {
            height: 250,
            width: 330,
            x: 1035,
            y: 640,
          },
          rows: ["Brand contrast", "Hero crop"],
          title: "Mood Reference",
          zIndex: 1,
        }),
      ],
    }),
  },
  research: {
    connections: [
      {
        from: "brief-card",
        id: "brief-to-evidence",
        label: "script",
        to: "research-card",
      },
      {
        from: "research-card",
        id: "evidence-to-priority",
        label: "finding",
        to: "decision-card",
      },
      {
        from: "decision-card",
        id: "priority-to-output",
        label: "next",
        to: "output-card",
      },
    ],
    id: "research",
    label: "Research Board",
    state: createInfiniteCanvasState<WorkflowBoardWindowKind>({
      activeWindowId: "research-card",
      camera: {
        center: {
          x: 720,
          y: 420,
        },
        zoom: 0.72,
      },
      selection: ["research-card"],
      windows: [
        createWorkflowBoardWindow({
          accent: "#baf7ff",
          eyebrow: "Brief",
          id: "brief-card",
          kind: "note",
          recordId: "brief:research",
          rect: {
            height: 230,
            width: 315,
            x: 120,
            y: 210,
          },
          rows: ["Open questions", "Recruiting criteria", "Interview script"],
          title: "Study Brief",
          zIndex: 2,
        }),
        createWorkflowBoardWindow({
          accent: "#9bd8ff",
          eyebrow: "Evidence",
          id: "research-card",
          isPinned: true,
          kind: "note",
          recordId: "note:evidence",
          rect: {
            height: 260,
            width: 345,
            x: 560,
            y: 245,
          },
          rows: ["Transcript cluster", "Screenshot evidence", "Observed workflow"],
          title: "Evidence Cluster",
          zIndex: 4,
        }),
        createWorkflowBoardWindow({
          accent: "#d7d1ff",
          eyebrow: "Decision",
          id: "decision-card",
          kind: "decision",
          recordId: "decision:priority",
          rect: {
            height: 235,
            width: 325,
            x: 610,
            y: 575,
          },
          rows: ["Prioritize target resolution.", "Defer decorative scene effects."],
          title: "Priority Call",
          zIndex: 3,
        }),
        createWorkflowBoardWindow({
          accent: "#baf7ff",
          eyebrow: "Output",
          id: "output-card",
          kind: "output",
          recordId: "output:findings",
          rect: {
            height: 265,
            width: 365,
            x: 1030,
            y: 345,
          },
          rows: ["Findings board", "Open risks", "Next prototype pass"],
          title: "Findings Output",
          zIndex: 5,
        }),
      ],
    }),
  },
} satisfies Record<WorkflowBoardWorkspaceId, WorkflowBoardWorkspace>;

const workflowBoardRegistry = defineInfiniteCanvasWindowRegistry<WorkflowBoardWindowKind>({
  decision: {
    kind: "decision",
    overflowY: "auto",
    renderBody: (context) => <WorkflowBoardCardBody window={context.window} />,
    textSelection: "none",
  },
  output: {
    kind: "output",
    overflowY: "auto",
    renderBody: (context) => <WorkflowBoardCardBody window={context.window} />,
    textSelection: "none",
  },
  image: {
    kind: "image",
    overflowY: "auto",
    renderBody: (context) => <WorkflowBoardCardBody window={context.window} />,
    textSelection: "none",
  },
  note: {
    kind: "note",
    overflowY: "auto",
    renderBody: (context) => <WorkflowBoardCardBody window={context.window} />,
    textSelection: "none",
  },
});

function createWorkflowBoardWindow({
  accent,
  eyebrow,
  recordId,
  rows,
  ...input
}: Readonly<{
  accent: string;
  eyebrow: string;
  id: string;
  isPinned?: boolean;
  kind: WorkflowBoardWindowKind;
  mode?: InfiniteCanvasWindow<WorkflowBoardWindowKind>["mode"];
  recordId: string;
  rect: InfiniteCanvasRect;
  rows: readonly string[];
  title: string;
  zIndex: number;
}>) {
  return createInfiniteCanvasWindow<WorkflowBoardWindowKind, WorkflowBoardWindowData>({
    ...input,
    data: {
      accent,
      eyebrow,
      recordId,
      rows,
    },
  });
}

function getWorkflowBoardWindowData(
  window: InfiniteCanvasWindow<WorkflowBoardWindowKind>,
): WorkflowBoardWindowData {
  return typeof window.data === "object" && window.data !== null && "rows" in window.data
    ? (window.data as WorkflowBoardWindowData)
    : {
        accent: "#baf7ff",
        eyebrow: window.kind,
        recordId: window.id,
        rows: [],
      };
}

function WorkflowBoardCardBody({
  window,
}: Readonly<{
  window: InfiniteCanvasWindow<WorkflowBoardWindowKind>;
}>) {
  const data = getWorkflowBoardWindowData(window);

  return (
    <div className="grid h-full content-start gap-3 p-4 text-[12px] leading-relaxed text-white/58">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-medium uppercase" style={{ color: data.accent }}>
          {data.eyebrow}
        </div>
        <div className="truncate font-mono text-[9px] uppercase tracking-[0.12em] text-white/30">
          {data.recordId}
        </div>
      </div>
      {window.kind === "image" ? <WorkflowBoardImageSwatch accent={data.accent} /> : null}
      {data.rows.map((row) => (
        <div
          className="border-l bg-white/[0.035] px-3 py-2"
          key={row}
          style={{ borderColor: data.accent }}
        >
          {row}
        </div>
      ))}
    </div>
  );
}

function WorkflowBoardImageSwatch({
  accent,
}: Readonly<{
  accent: string;
}>) {
  return (
    <div
      className="h-24 border bg-white/[0.04]"
      style={{
        backgroundImage: `linear-gradient(135deg, ${accent}2E, rgba(255,255,255,0.03) 44%, rgba(215,209,255,0.18))`,
        borderColor: `${accent}42`,
      }}
    />
  );
}

function isWorkflowBoardAsset(payload: unknown): payload is WorkflowBoardAsset {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "id" in payload &&
    workflowBoardAssets.some((asset) => asset.id === payload.id)
  );
}

function getWorkflowBoardAssetSize(kind: WorkflowBoardWindowKind) {
  switch (kind) {
    case "decision":
      return {
        height: 235,
        width: 325,
      };
    case "output":
      return {
        height: 270,
        width: 360,
      };
    case "image":
      return {
        height: 250,
        width: 330,
      };
    case "note":
      return {
        height: 220,
        width: 305,
      };
  }
}

function centerRectOnPoint(
  point: InfiniteCanvasPoint,
  size: Readonly<{ height: number; width: number }>,
) {
  return {
    height: size.height,
    width: size.width,
    x: point.x - size.width / 2,
    y: point.y - size.height / 2,
  } satisfies InfiniteCanvasRect;
}

function getWorkflowBoardWindowProxies(state: InfiniteCanvasState<WorkflowBoardWindowKind>) {
  return state.windows
    .filter((window) => window.mode !== "minimized")
    .map((window) => getInfiniteCanvasWindowProxy(state, window));
}

function getWorkflowBoardVisibleConnections(
  windows: readonly InfiniteCanvasWindowProxy<WorkflowBoardWindowKind>[],
  activeWindowId: string | null,
  selectedTargets: readonly InfiniteCanvasSelectionTarget[],
  connections: readonly WorkflowBoardConnection[],
) {
  const windowsById = new Map(windows.map((window) => [window.id, window]));

  return connections
    .map((connection) => ({
      connection,
      from: windowsById.get(connection.from),
      to: windowsById.get(connection.to),
    }))
    .filter(hasWorkflowBoardConnectionEndpoints)
    .map(({ connection, from, to }) => {
      const pathOptions = {
        padding: 16,
        route: "orthogonal",
      } as const;

      return {
        connection,
        from,
        isActive:
          from.id === activeWindowId ||
          to.id === activeWindowId ||
          isSelectionTargetActive(selectedTargets, connection.id),
        to,
        worldPath: getInfiniteCanvasWindowConnectorPath(from, to, pathOptions),
      };
    });
}

function hasWorkflowBoardConnectionEndpoints(
  candidate: Readonly<{
    connection: WorkflowBoardConnection;
    from: InfiniteCanvasWindowProxy<WorkflowBoardWindowKind> | undefined;
    to: InfiniteCanvasWindowProxy<WorkflowBoardWindowKind> | undefined;
  }>,
): candidate is Readonly<{
  connection: WorkflowBoardConnection;
  from: InfiniteCanvasWindowProxy<WorkflowBoardWindowKind>;
  to: InfiniteCanvasWindowProxy<WorkflowBoardWindowKind>;
}> {
  return candidate.from !== undefined && candidate.to !== undefined;
}

function getWorkflowBoardConnectionTarget(
  connection: WorkflowBoardConnection,
): InfiniteCanvasSelectionTarget {
  return {
    data: {
      from: connection.from,
      label: connection.label,
      to: connection.to,
    },
    id: connection.id,
    kind: "workflow-connector",
    type: "edge",
  };
}

function isSelectionTargetActive(
  selectedTargets: readonly InfiniteCanvasSelectionTarget[],
  id: string,
) {
  return selectedTargets.some((target) => target.id === id);
}

function getWorkflowBoardEdgeTargets(
  state: InfiniteCanvasState<WorkflowBoardWindowKind>,
  connections: readonly WorkflowBoardConnection[],
) {
  return getWorkflowBoardVisibleConnections(
    getWorkflowBoardWindowProxies(state),
    state.activeWindowId,
    [],
    connections,
  ).flatMap(({ connection, worldPath }) =>
    worldPath.segments.map((segment) => ({
      data: {
        from: connection.from,
        label: connection.label,
        to: connection.to,
      },
      end: segment.end,
      hitRadius: 18,
      id: connection.id,
      kind: "workflow-connector",
      start: segment.start,
    })),
  );
}

function createWorkflowBoardConnectionId(
  fromWindowId: string,
  toWindowId: string,
  connections: readonly WorkflowBoardConnection[],
) {
  const baseId = `${fromWindowId}-to-${toWindowId}`;
  const collisionCount = connections.filter(
    (connection) => connection.id === baseId || connection.id.startsWith(`${baseId}-`),
  ).length;

  return collisionCount === 0 ? baseId : `${baseId}-${collisionCount + 1}`;
}

function createWorkflowBoardConnection(
  fromWindowId: string,
  toWindowId: string,
  connections: readonly WorkflowBoardConnection[],
): WorkflowBoardConnection {
  return {
    from: fromWindowId,
    id: createWorkflowBoardConnectionId(fromWindowId, toWindowId, connections),
    label: "link",
    to: toWindowId,
  };
}

function getWorkflowBoardTargetLabel(target: InfiniteCanvasSpatialTarget<WorkflowBoardWindowKind>) {
  switch (target.type) {
    case "edge":
      return "connector";
    case "empty-world":
      return "canvas";
    case "overlay":
      return "overlay";
    case "scene-object":
      return "scene object";
    case "window":
      return target.window.title;
  }
}

function getWorkflowBoardPlacementRect({
  size,
  target,
  worldPoint,
}: Readonly<{
  size: Readonly<{ height: number; width: number }>;
  target: InfiniteCanvasSpatialTarget<WorkflowBoardWindowKind>;
  worldPoint: InfiniteCanvasPoint;
}>) {
  switch (target.type) {
    case "window":
      return {
        height: size.height,
        width: size.width,
        x: target.window.rect.x + target.window.rect.width + 32,
        y: target.window.rect.y + 24,
      } satisfies InfiniteCanvasRect;
    case "edge":
    case "empty-world":
    case "overlay":
    case "scene-object":
      return centerRectOnPoint(worldPoint, size);
  }
}

function getWorkflowBoardDropPlacementRect({
  size,
  state,
  target,
  worldPoint,
}: Readonly<{
  size: Readonly<{ height: number; width: number }>;
  state: InfiniteCanvasState<WorkflowBoardWindowKind>;
  target: InfiniteCanvasSpatialTarget<WorkflowBoardWindowKind>;
  worldPoint: InfiniteCanvasPoint;
}>) {
  const preferredRect = getWorkflowBoardPlacementRect({
    size,
    target,
    worldPoint,
  });

  return target.type === "edge"
    ? getWorkflowBoardNearestOpenPlacementRect({
        preferredRect,
        size,
        state,
        worldPoint,
      })
    : preferredRect;
}

function getWorkflowBoardNearestOpenPlacementRect({
  preferredRect,
  size,
  state,
  worldPoint,
}: Readonly<{
  preferredRect: InfiniteCanvasRect;
  size: Readonly<{ height: number; width: number }>;
  state: InfiniteCanvasState<WorkflowBoardWindowKind>;
  worldPoint: InfiniteCanvasPoint;
}>) {
  const occupiedRects = state.windows
    .filter((window) => window.mode !== "minimized")
    .map((window) => inflateRect(window.rect, 28));
  const candidateRects = getWorkflowBoardEdgeDropCandidateOffsets(size).map((offset) =>
    centerRectOnPoint(
      {
        x: worldPoint.x + offset.x,
        y: worldPoint.y + offset.y,
      },
      size,
    ),
  );

  return (
    candidateRects.find((candidateRect) =>
      occupiedRects.every((occupiedRect) => !rectsIntersect(candidateRect, occupiedRect)),
    ) ?? preferredRect
  );
}

function getWorkflowBoardEdgeDropCandidateOffsets(
  size: Readonly<{ height: number; width: number }>,
) {
  const horizontalStep = size.width + 56;
  const verticalStep = size.height + 56;
  const ringIndexes = [0, 1, 2, 3] as const;
  const offsets: readonly InfiniteCanvasPoint[] = ringIndexes.flatMap((ring) =>
    Array.from({ length: ring * 2 + 1 }, (_, index) => index - ring).flatMap((column) =>
      Array.from({ length: ring * 2 + 1 }, (_, index) => index - ring)
        .filter((row) => Math.max(Math.abs(column), Math.abs(row)) === ring)
        .map((row) => ({
          x: column * horizontalStep,
          y: row * verticalStep,
        })),
    ),
  );

  return [...offsets].sort(
    (left, right) => Math.hypot(left.x, left.y) - Math.hypot(right.x, right.y),
  );
}

function createWorkflowBoardDropWindowId(
  payload: WorkflowBoardAsset,
  state: InfiniteCanvasState<WorkflowBoardWindowKind>,
) {
  const prefix = `card-${payload.kind}`;
  const nextIndex = getWorkflowBoardDropOrdinal(payload, state);

  return `${prefix}-${nextIndex}`;
}

function getWorkflowBoardDropOrdinal(
  payload: WorkflowBoardAsset,
  state: InfiniteCanvasState<WorkflowBoardWindowKind>,
) {
  const prefix = `card-${payload.kind}`;

  return (
    state.windows.filter((window) => window.id === prefix || window.id.startsWith(`${prefix}-`))
      .length + 1
  );
}

function getWorkflowBoardDropRows(target: InfiniteCanvasSpatialTarget<WorkflowBoardWindowKind>) {
  return [
    "Created from the asset tray.",
    `Drop target: ${getWorkflowBoardTargetLabel(target)}.`,
    "Links stay attached while cards move.",
  ];
}

function getConnectionFromTarget(
  target: InfiniteCanvasSpatialTarget<WorkflowBoardWindowKind>,
  connections: readonly WorkflowBoardConnection[],
) {
  return target.type === "edge"
    ? (connections.find((connection) => connection.id === target.id) ?? null)
    : null;
}

function removeConnectionById(
  connections: readonly WorkflowBoardConnection[],
  connectionId: string,
) {
  return connections.filter((connection) => connection.id !== connectionId);
}

function appendConnectionIfMissing(
  connections: readonly WorkflowBoardConnection[],
  nextConnection: WorkflowBoardConnection,
) {
  return connections.some(
    (connection) =>
      connection.from === nextConnection.from &&
      connection.to === nextConnection.to &&
      connection.label === nextConnection.label,
  )
    ? connections
    : [...connections, nextConnection];
}

function getWorkflowBoardBounds(state: InfiniteCanvasState<WorkflowBoardWindowKind>) {
  const visibleWindowRects = state.windows
    .filter((window) => window.mode !== "minimized")
    .map((window) => window.rect);
  const fallbackRect = {
    height: 1,
    width: 1,
    x: state.camera.center.x,
    y: state.camera.center.y,
  } satisfies InfiniteCanvasRect;

  return visibleWindowRects.reduce(getUnionRect, visibleWindowRects[0] ?? fallbackRect);
}

function getUnionRect(left: InfiniteCanvasRect, right: InfiniteCanvasRect) {
  const x = Math.min(left.x, right.x);
  const y = Math.min(left.y, right.y);
  const maxX = Math.max(left.x + left.width, right.x + right.width);
  const maxY = Math.max(left.y + left.height, right.y + right.height);

  return {
    height: maxY - y,
    width: maxX - x,
    x,
    y,
  } satisfies InfiniteCanvasRect;
}

function inflateRect(rect: InfiniteCanvasRect, amount: number) {
  return {
    height: rect.height + amount * 2,
    width: rect.width + amount * 2,
    x: rect.x - amount,
    y: rect.y - amount,
  } satisfies InfiniteCanvasRect;
}

function renderWorkflowBoardConnectionsLayer(
  context: InfiniteCanvasSceneLayerRenderContext<WorkflowBoardWindowKind, WorkflowBoardAsset>,
  connections: readonly WorkflowBoardConnection[],
) {
  const selectedTargets = getSelectionTargets(context.state.selection);
  const visibleConnections = getWorkflowBoardVisibleConnections(
    context.visibleWindows,
    context.state.activeWindowId,
    selectedTargets,
    connections,
  );

  return (
    <group>
      {visibleConnections.map(({ connection, isActive, worldPath }) => (
        <WorkflowConnectionMesh isActive={isActive} key={connection.id} path={worldPath} />
      ))}
    </group>
  );
}

function WorkflowConnectionMesh({
  isActive,
  path,
}: Readonly<{
  isActive: boolean;
  path: InfiniteCanvasWorldPath;
}>) {
  const transforms = getInfiniteCanvasWorldPathSceneTransforms(path, -4);
  const endpoints = [path.points.at(0), path.points.at(-1)].filter(
    (point): point is InfiniteCanvasPoint => point !== undefined,
  );

  return (
    <group>
      {transforms.map((transform, index) => (
        <group
          key={`${transform.position.join(":")}-${index}`}
          position={transform.position}
          rotation={transform.rotation}
        >
          <mesh>
            <boxGeometry args={[transform.length, isActive ? 7 : 4, 2]} />
            <meshBasicMaterial
              color={isActive ? "#e0fdff" : "#67d3e0"}
              opacity={isActive ? 0.42 : 0.18}
              transparent
            />
          </mesh>
          <mesh position={[0, 0, 2]}>
            <boxGeometry args={[transform.length, 1.5, 2]} />
            <meshBasicMaterial color="#f0feff" opacity={isActive ? 0.32 : 0.1} transparent />
          </mesh>
        </group>
      ))}
      {endpoints.map((point) => (
        <mesh key={`${point.x}:${point.y}`} position={[point.x, -point.y, -2]}>
          <circleGeometry args={[isActive ? 6 : 4, 18]} />
          <meshBasicMaterial
            color={isActive ? "#efffff" : "#8ee6f0"}
            opacity={isActive ? 0.52 : 0.22}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

function renderWorkflowBoardDropPreviewLayer(
  context: InfiniteCanvasSceneLayerRenderContext<WorkflowBoardWindowKind, WorkflowBoardAsset>,
) {
  if (context.drop.status !== "dragging" || !isWorkflowBoardAsset(context.drop.payload)) {
    return null;
  }

  const target = context.drop.dropTarget.target;
  const rect =
    target === null
      ? centerRectOnPoint(
          context.drop.worldPoint,
          getWorkflowBoardAssetSize(context.drop.payload.kind),
        )
      : getWorkflowBoardDropPlacementRect({
          size: getWorkflowBoardAssetSize(context.drop.payload.kind),
          state: context.state,
          target,
          worldPoint: context.drop.worldPoint,
        });

  return (
    <WorkflowDropPreviewMesh
      accent={context.drop.payload.accent}
      isValid={context.drop.dropTarget.status === "valid"}
      rect={rect}
    />
  );
}

function WorkflowDropPreviewMesh({
  accent,
  isValid,
  rect,
}: Readonly<{
  accent: string;
  isValid: boolean;
  rect: InfiniteCanvasRect;
}>) {
  const center = {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };

  return (
    <group position={[center.x, -center.y, 8]}>
      <mesh>
        <boxGeometry args={[rect.width, rect.height, 2]} />
        <meshBasicMaterial color={isValid ? accent : "#ff8f8f"} opacity={0.16} transparent />
      </mesh>
      <WorkflowPreviewRail
        height={3}
        opacity={0.75}
        width={rect.width}
        x={0}
        y={-rect.height / 2}
      />
      <WorkflowPreviewRail height={3} opacity={0.75} width={rect.width} x={0} y={rect.height / 2} />
      <WorkflowPreviewRail
        height={rect.height}
        opacity={0.75}
        width={3}
        x={-rect.width / 2}
        y={0}
      />
      <WorkflowPreviewRail height={rect.height} opacity={0.75} width={3} x={rect.width / 2} y={0} />
    </group>
  );
}

function WorkflowPreviewRail({
  height,
  opacity,
  width,
  x,
  y,
}: Readonly<{
  height: number;
  opacity: number;
  width: number;
  x: number;
  y: number;
}>) {
  return (
    <mesh position={[x, y, 2]}>
      <boxGeometry args={[width, height, 1]} />
      <meshBasicMaterial color="#c7fbff" opacity={opacity} transparent />
    </mesh>
  );
}

function WorkflowBoardOverlay({
  connections,
  context,
  pendingConnection,
  setConnections,
  setPendingConnection,
  setWorkspaceId,
  workspace,
}: Readonly<{
  connections: readonly WorkflowBoardConnection[];
  context: InfiniteCanvasOverlayRenderContext<WorkflowBoardWindowKind, WorkflowBoardAsset>;
  pendingConnection: WorkflowBoardPendingConnection;
  setConnections: Dispatch<SetStateAction<readonly WorkflowBoardConnection[]>>;
  setPendingConnection: Dispatch<SetStateAction<WorkflowBoardPendingConnection>>;
  setWorkspaceId: Dispatch<SetStateAction<WorkflowBoardWorkspaceId>>;
  workspace: WorkflowBoardWorkspace;
}>) {
  const selectedTargets = getSelectionTargets(context.state.selection);
  const visibleConnections = useMemo(
    () =>
      getWorkflowBoardVisibleConnections(
        getWorkflowBoardWindowProxies(context.state),
        context.state.activeWindowId,
        selectedTargets,
        connections,
      ),
    [connections, context.state, selectedTargets],
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-[65]">
      <WorkflowAssetTray context={context} />
      <WorkflowWorkspaceSwitcher
        setConnections={setConnections}
        setPendingConnection={setPendingConnection}
        setWorkspaceId={setWorkspaceId}
        workspace={workspace}
      />
      <WorkflowConnectionLabels
        context={context}
        selectedTargets={selectedTargets}
        visibleConnections={visibleConnections}
      />
      <WorkflowWindowPorts
        context={context}
        pendingConnection={pendingConnection}
        setConnections={setConnections}
        setPendingConnection={setPendingConnection}
      />
      <WorkflowContextBar
        connections={connections}
        context={context}
        pendingConnection={pendingConnection}
        selectedTargets={selectedTargets}
        setConnections={setConnections}
        setPendingConnection={setPendingConnection}
        visibleConnections={visibleConnections}
      />
      <WorkflowDock context={context} />
      <WorkflowDragReadout context={context} />
    </div>
  );
}

function WorkflowAssetTray({
  context,
}: Readonly<{
  context: InfiniteCanvasOverlayRenderContext<WorkflowBoardWindowKind, WorkflowBoardAsset>;
}>) {
  return (
    <div
      className="pointer-events-auto absolute border border-white/10 bg-[#05080b]/92 p-2 shadow-[0_20px_70px_-44px_rgba(142,230,240,0.82)]"
      style={{
        height: workflowAssetTrayMetrics.height,
        left: workflowAssetTrayMetrics.left,
        top: workflowAssetTrayMetrics.top,
        width: workflowAssetTrayMetrics.width,
      }}
    >
      <div className="mb-2 px-1 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/46">
        Assets
      </div>
      <div className="grid gap-2">
        {workflowBoardAssets.map((asset) => (
          <button
            className="flex items-center gap-3 border border-white/10 bg-white/[0.035] p-3 text-left transition hover:border-cyan-100/36 hover:bg-cyan-100/[0.07]"
            key={asset.id}
            onPointerDown={(event) => {
              context.startDrag({
                event,
                id: asset.id,
                payload: asset,
              });
            }}
            style={{ cursor: "grab" }}
            type="button"
          >
            <div
              className="grid h-7 w-7 shrink-0 place-items-center border bg-white/[0.035]"
              style={{ borderColor: `${asset.accent}55`, color: asset.accent }}
            >
              <WorkflowAssetIcon kind={asset.kind} />
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-medium uppercase text-white/72">{asset.label}</div>
              <div className="text-[11px] text-white/38">{asset.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function WorkflowAssetIcon({
  kind,
}: Readonly<{
  kind: WorkflowBoardWindowKind;
}>) {
  switch (kind) {
    case "decision":
      return <MapPin size={15} strokeWidth={1.7} />;
    case "output":
      return <GitBranch size={15} strokeWidth={1.7} />;
    case "image":
      return <Image size={15} strokeWidth={1.7} />;
    case "note":
      return <StickyNote size={15} strokeWidth={1.7} />;
  }
}

function WorkflowWorkspaceSwitcher({
  setConnections,
  setPendingConnection,
  setWorkspaceId,
  workspace,
}: Readonly<{
  setConnections: Dispatch<SetStateAction<readonly WorkflowBoardConnection[]>>;
  setPendingConnection: Dispatch<SetStateAction<WorkflowBoardPendingConnection>>;
  setWorkspaceId: Dispatch<SetStateAction<WorkflowBoardWorkspaceId>>;
  workspace: WorkflowBoardWorkspace;
}>) {
  return (
    <div className="pointer-events-auto absolute right-4 top-24 flex border border-white/10 bg-[#05080b]/90 p-1">
      {Object.values(workflowBoardWorkspaces).map((candidate) => (
        <button
          className={[
            "px-3 py-2 text-[10px] font-medium uppercase tracking-[0.1em] transition",
            candidate.id === workspace.id
              ? "bg-cyan-100/[0.12] text-cyan-50"
              : "text-white/42 hover:bg-white/[0.05] hover:text-white/70",
          ].join(" ")}
          key={candidate.id}
          onClick={() => {
            setPendingConnection(null);
            setConnections(candidate.connections);
            setWorkspaceId(candidate.id);
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          type="button"
        >
          {candidate.label}
        </button>
      ))}
    </div>
  );
}

function WorkflowConnectionLabels({
  context,
  selectedTargets,
  visibleConnections,
}: Readonly<{
  context: InfiniteCanvasOverlayRenderContext<WorkflowBoardWindowKind, WorkflowBoardAsset>;
  selectedTargets: readonly InfiniteCanvasSelectionTarget[];
  visibleConnections: readonly WorkflowBoardVisibleConnection[];
}>) {
  return (
    <>
      {visibleConnections.map(({ connection, isActive, worldPath }) => {
        const labelPoint = getInfiniteCanvasWorldPathPointAtProgress(worldPath, 0.5);
        const isLabelOccluded = isWorkflowBoardConnectionLabelOccluded(context.state, labelPoint);

        if (isLabelOccluded) {
          return null;
        }

        const screenPoint = worldPointToScreenPoint(
          context.state.camera,
          context.state.viewport,
          labelPoint,
        );
        const isSelected = isSelectionTargetActive(selectedTargets, connection.id);

        return (
          <button
            aria-pressed={isSelected}
            className={[
              "pointer-events-auto absolute inline-flex items-center gap-1.5 border bg-[#061014]/92 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] shadow-[0_12px_36px_-24px_rgba(142,230,240,0.8)] transition",
              isSelected
                ? "border-cyan-50/70 text-cyan-50"
                : isActive
                  ? "border-cyan-100/34 text-cyan-50"
                  : "border-cyan-100/16 text-cyan-100/48 hover:border-cyan-100/36 hover:text-cyan-50/82",
            ].join(" ")}
            key={connection.id}
            onClick={() => {
              context.actions.selectTarget(getWorkflowBoardConnectionTarget(connection));
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            style={{
              left: screenPoint.x,
              top: screenPoint.y,
              transform: "translate(-50%, -50%)",
            }}
            type="button"
          >
            <Link2 size={11} strokeWidth={1.8} />
            {connection.label}
          </button>
        );
      })}
    </>
  );
}

function isWorkflowBoardConnectionLabelOccluded(
  state: InfiniteCanvasState<WorkflowBoardWindowKind>,
  labelPoint: InfiniteCanvasPoint,
) {
  return state.windows
    .filter((window) => window.mode !== "minimized")
    .some((window) => rectContainsPoint(inflateRect(window.rect, 10), labelPoint));
}

function WorkflowWindowPorts({
  context,
  pendingConnection,
  setConnections,
  setPendingConnection,
}: Readonly<{
  context: InfiniteCanvasOverlayRenderContext<WorkflowBoardWindowKind, WorkflowBoardAsset>;
  pendingConnection: WorkflowBoardPendingConnection;
  setConnections: Dispatch<SetStateAction<readonly WorkflowBoardConnection[]>>;
  setPendingConnection: Dispatch<SetStateAction<WorkflowBoardPendingConnection>>;
}>) {
  const proxies = getWorkflowBoardWindowProxies(context.state);

  return (
    <>
      {proxies.map((proxy) => {
        const portPoint = worldPointToScreenPoint(context.state.camera, context.state.viewport, {
          x: proxy.rect.x + proxy.rect.width,
          y: proxy.rect.y + proxy.rect.height / 2,
        });
        const isPendingSource =
          pendingConnection?.type === "create" && pendingConnection.fromWindowId === proxy.id;

        return (
          <button
            aria-label={`Connect ${proxy.title}`}
            className={[
              "pointer-events-auto absolute grid h-6 w-6 place-items-center rounded-full border bg-[#061014]/92 shadow-[0_10px_30px_-16px_rgba(142,230,240,0.85)] transition",
              isPendingSource
                ? "border-cyan-50 text-cyan-50"
                : "border-cyan-100/22 text-cyan-100/54 hover:border-cyan-100/55 hover:text-cyan-50",
            ].join(" ")}
            key={proxy.id}
            onClick={() => {
              handleWorkflowPortClick({
                context,
                pendingConnection,
                setConnections,
                setPendingConnection,
                windowId: proxy.id,
              });
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            style={{
              left: portPoint.x,
              top: portPoint.y,
              transform: "translate(-50%, -50%)",
            }}
            type="button"
          >
            <Plus size={12} strokeWidth={1.8} />
          </button>
        );
      })}
    </>
  );
}

function handleWorkflowPortClick({
  context,
  pendingConnection,
  setConnections,
  setPendingConnection,
  windowId,
}: Readonly<{
  context: InfiniteCanvasOverlayRenderContext<WorkflowBoardWindowKind, WorkflowBoardAsset>;
  pendingConnection: WorkflowBoardPendingConnection;
  setConnections: Dispatch<SetStateAction<readonly WorkflowBoardConnection[]>>;
  setPendingConnection: Dispatch<SetStateAction<WorkflowBoardPendingConnection>>;
  windowId: string;
}>) {
  if (pendingConnection === null) {
    setPendingConnection({
      fromWindowId: windowId,
      type: "create",
    });
    context.actions.selectWindow(windowId);

    return;
  }

  switch (pendingConnection.type) {
    case "create":
      setConnections((connections) =>
        pendingConnection.fromWindowId === windowId
          ? connections
          : appendConnectionIfMissing(
              connections,
              createWorkflowBoardConnection(pendingConnection.fromWindowId, windowId, connections),
            ),
      );
      setPendingConnection(null);
      return;
    case "reconnect-from":
      setConnections((connections) =>
        connections.map((connection) =>
          connection.id === pendingConnection.connectionId
            ? {
                ...connection,
                from: windowId,
              }
            : connection,
        ),
      );
      setPendingConnection(null);
      return;
    case "reconnect-to":
      setConnections((connections) =>
        connections.map((connection) =>
          connection.id === pendingConnection.connectionId
            ? {
                ...connection,
                to: windowId,
              }
            : connection,
        ),
      );
      setPendingConnection(null);
      return;
  }
}

function WorkflowContextBar({
  connections,
  context,
  pendingConnection,
  selectedTargets,
  setConnections,
  setPendingConnection,
  visibleConnections,
}: Readonly<{
  connections: readonly WorkflowBoardConnection[];
  context: InfiniteCanvasOverlayRenderContext<WorkflowBoardWindowKind, WorkflowBoardAsset>;
  pendingConnection: WorkflowBoardPendingConnection;
  selectedTargets: readonly InfiniteCanvasSelectionTarget[];
  setConnections: Dispatch<SetStateAction<readonly WorkflowBoardConnection[]>>;
  setPendingConnection: Dispatch<SetStateAction<WorkflowBoardPendingConnection>>;
  visibleConnections: readonly WorkflowBoardVisibleConnection[];
}>) {
  const activeWindow =
    context.state.windows.find((window) => window.id === context.state.activeWindowId) ?? null;
  const selectedTarget = selectedTargets.at(0) ?? null;
  const selectedConnection =
    selectedTarget?.type === "edge"
      ? (connections.find((connection) => connection.id === selectedTarget.id) ?? null)
      : null;
  const selectedConnectionPath =
    selectedConnection === null
      ? null
      : (visibleConnections.find(({ connection }) => connection.id === selectedConnection.id)
          ?.worldPath ?? null);
  const selectedConnectionBounds = selectedConnectionPath?.bounds ?? null;
  const pendingLabel = getPendingConnectionLabel(pendingConnection, connections);

  return (
    <div className="pointer-events-auto absolute bottom-24 left-4 max-w-[min(760px,calc(100%-2rem))] border border-white/10 bg-[#05080b]/92 p-2 shadow-[0_20px_80px_-50px_rgba(142,230,240,0.85)]">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-2 flex items-center gap-2 border border-white/8 bg-white/[0.035] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/48">
          <MousePointer2 size={13} strokeWidth={1.8} />
          {pendingLabel ?? selectedConnection?.label ?? activeWindow?.title ?? "Canvas"}
        </div>
        <WorkflowActionButton
          icon={<ScanSearch size={14} strokeWidth={1.8} />}
          label="Fit Board"
          onClick={() => {
            context.actions.navigateToRect({
              behavior: {
                maxZoom: 0.9,
                paddingPx: 92,
                type: "fit",
              },
              rect: getWorkflowBoardBounds(context.state),
            });
          }}
        />
        {selectedConnection === null ? null : (
          <>
            <WorkflowActionButton
              icon={<Trash2 size={14} strokeWidth={1.8} />}
              label="Delete Link"
              onClick={() => {
                setConnections((currentConnections) =>
                  removeConnectionById(currentConnections, selectedConnection.id),
                );
                context.actions.executeCommand({
                  type: "selection.clear",
                });
              }}
            />
            <WorkflowActionButton
              label="Reconnect From"
              onClick={() => {
                setPendingConnection({
                  connectionId: selectedConnection.id,
                  type: "reconnect-from",
                });
              }}
            />
            <WorkflowActionButton
              label="Reconnect To"
              onClick={() => {
                setPendingConnection({
                  connectionId: selectedConnection.id,
                  type: "reconnect-to",
                });
              }}
            />
          </>
        )}
        {selectedConnectionBounds === null ? null : (
          <WorkflowActionButton
            label="Fit Link"
            onClick={() => {
              context.actions.navigateToRect({
                behavior: {
                  maxZoom: 1.1,
                  paddingPx: 140,
                  type: "fit",
                },
                rect: inflateRect(selectedConnectionBounds, 60),
              });
            }}
          />
        )}
        {activeWindow === null ? null : (
          <>
            <WorkflowActionButton
              icon={<GitBranch size={14} strokeWidth={1.8} />}
              label="Start Link"
              onClick={() => {
                setPendingConnection({
                  fromWindowId: activeWindow.id,
                  type: "create",
                });
              }}
            />
            <WorkflowActionButton
              icon={<Minus size={14} strokeWidth={1.8} />}
              label="Minimize"
              onClick={() => {
                context.actions.minimizeWindow(activeWindow.id);
              }}
            />
          </>
        )}
        {selectedTargets.length > 0 || context.state.selection.windowIds.length > 0 ? (
          <WorkflowActionButton
            label="Clear Selection"
            onClick={() => {
              context.actions.executeCommand({
                type: "selection.clear",
              });
              setPendingConnection(null);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function getPendingConnectionLabel(
  pendingConnection: WorkflowBoardPendingConnection,
  connections: readonly WorkflowBoardConnection[],
) {
  if (pendingConnection === null) {
    return null;
  }

  switch (pendingConnection.type) {
    case "create":
      return "Click a card port";
    case "reconnect-from":
    case "reconnect-to":
      return (
        connections.find((connection) => connection.id === pendingConnection.connectionId)?.label ??
        "Reconnect"
      );
  }
}

function WorkflowActionButton({
  icon,
  label,
  onClick,
}: Readonly<{
  icon?: ReactNode;
  label: string;
  onClick: () => void;
}>) {
  return (
    <button
      className="inline-flex h-9 items-center gap-2 border border-white/10 bg-white/[0.035] px-3 text-[10px] font-medium uppercase tracking-[0.1em] text-white/52 transition hover:border-cyan-100/34 hover:bg-cyan-100/[0.07] hover:text-cyan-50"
      onClick={onClick}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function WorkflowDock({
  context,
}: Readonly<{
  context: InfiniteCanvasOverlayRenderContext<WorkflowBoardWindowKind, WorkflowBoardAsset>;
}>) {
  const presence = getInfiniteCanvasWindowPresence(context.state);
  const dockItems = [...presence.pinned, ...presence.minimized].filter(
    (item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index,
  );

  return dockItems.length === 0 ? null : (
    <div className="pointer-events-auto absolute bottom-24 right-4 flex max-w-[34rem] gap-2 overflow-hidden border border-white/10 bg-[#05080b]/92 p-2">
      {dockItems.map((item) => (
        <button
          className={[
            "max-w-40 truncate border px-3 py-2 text-left text-[10px] font-medium uppercase tracking-[0.1em] transition",
            item.mode === "minimized"
              ? "border-white/10 text-white/44 hover:border-cyan-100/32 hover:text-cyan-50"
              : "border-cyan-100/20 bg-cyan-100/[0.06] text-cyan-50/72",
          ].join(" ")}
          key={item.id}
          onClick={() => {
            if (item.mode === "minimized") {
              context.actions.restoreWindow(item.id);
            } else {
              context.actions.focusWindow(item.id);
            }
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          type="button"
        >
          {item.title}
        </button>
      ))}
    </div>
  );
}

function WorkflowDragReadout({
  context,
}: Readonly<{
  context: InfiniteCanvasOverlayRenderContext<WorkflowBoardWindowKind, WorkflowBoardAsset>;
}>) {
  if (context.drag.status !== "dragging" || !isWorkflowBoardAsset(context.drag.payload)) {
    return null;
  }

  const targetLabel =
    context.drag.dropTarget.target === null
      ? "outside canvas"
      : getWorkflowBoardTargetLabel(context.drag.dropTarget.target);

  return (
    <div
      className={[
        "pointer-events-none absolute border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] shadow-[0_16px_44px_-30px_rgba(142,230,240,0.9)]",
        context.drag.dropTarget.status === "valid"
          ? "border-cyan-100/38 bg-[#061014]/92 text-cyan-50/78"
          : "border-rose-200/36 bg-[#15080a]/92 text-rose-100/76",
      ].join(" ")}
      style={{
        left: context.drag.viewportPoint.x + 18,
        top: context.drag.viewportPoint.y + 18,
      }}
    >
      {context.drag.payload.label} / {targetLabel}
    </div>
  );
}

function createWorkflowBoardDropPolicy(
  connections: readonly WorkflowBoardConnection[],
  setConnections: Dispatch<SetStateAction<readonly WorkflowBoardConnection[]>>,
) {
  return {
    canDrop: ({ payload, target }) => {
      if (!isWorkflowBoardAsset(payload)) {
        return {
          accepted: false,
          reason: "Unknown asset",
        };
      }

      return target.type === "overlay"
        ? {
            accepted: false,
            reason: "Drop on canvas",
          }
        : true;
    },
    onDrop: ({ actions, payload, state, target, worldPoint }) => {
      if (!isWorkflowBoardAsset(payload)) {
        return;
      }

      const nextDropOrdinal = getWorkflowBoardDropOrdinal(payload, state);
      const nextWindowId = createWorkflowBoardDropWindowId(payload, state);
      const nextWindow = createWorkflowBoardWindow({
        accent: payload.accent,
        eyebrow: payload.label,
        id: nextWindowId,
        kind: payload.kind,
        recordId: `drop:${payload.kind}:${state.windows.length + 1}`,
        rect: getWorkflowBoardDropPlacementRect({
          size: getWorkflowBoardAssetSize(payload.kind),
          state,
          target,
          worldPoint,
        }),
        rows: getWorkflowBoardDropRows(target),
        title: `${payload.label} ${String(nextDropOrdinal).padStart(2, "0")}`,
        zIndex: state.windows.length + 1,
      });
      const targetConnection = getConnectionFromTarget(target, connections);

      actions.openWindow(nextWindow);

      if (target.type === "window") {
        setConnections((currentConnections) =>
          appendConnectionIfMissing(
            currentConnections,
            createWorkflowBoardConnection(target.windowId, nextWindowId, currentConnections),
          ),
        );

        return;
      }

      if (targetConnection !== null) {
        setConnections((currentConnections) => [
          ...removeConnectionById(currentConnections, targetConnection.id),
          {
            ...targetConnection,
            id: createWorkflowBoardConnectionId(
              targetConnection.from,
              nextWindowId,
              currentConnections,
            ),
            to: nextWindowId,
          },
          {
            from: nextWindowId,
            id: createWorkflowBoardConnectionId(
              nextWindowId,
              targetConnection.to,
              currentConnections,
            ),
            label: targetConnection.label,
            to: targetConnection.to,
          },
        ]);
      }
    },
  } satisfies InfiniteCanvasDropPolicy<WorkflowBoardWindowKind, WorkflowBoardAsset>;
}

function InfiniteCanvasWorkflowBoardShowcase() {
  const [workspaceId, setWorkspaceId] = useState<WorkflowBoardWorkspaceId>("launch");
  const workspace = workflowBoardWorkspaces[workspaceId];
  const [connections, setConnections] = useState<readonly WorkflowBoardConnection[]>(
    workflowBoardWorkspaces.launch.connections,
  );
  const [pendingConnection, setPendingConnection] = useState<WorkflowBoardPendingConnection>(null);
  const sceneLayers = useMemo(
    () =>
      [
        {
          frameloop: "demand",
          id: "workflow-board-connections",
          render: (context) => renderWorkflowBoardConnectionsLayer(context, connections),
        },
        {
          frameloop: "demand",
          id: "workflow-board-drop-preview",
          placement: "overlay",
          render: renderWorkflowBoardDropPreviewLayer,
        },
      ] satisfies readonly InfiniteCanvasSceneLayer<WorkflowBoardWindowKind, WorkflowBoardAsset>[],
    [connections],
  );
  const spatialTargetResolvers = useMemo(
    () =>
      [
        createInfiniteCanvasOverlayTargetResolver<WorkflowBoardWindowKind>({
          id: "workflow-board-overlay-targets",
          targets: () => [
            {
              data: {
                label: "Asset tray",
              },
              id: "asset-tray",
              kind: "asset-tray",
              rect: {
                height: workflowAssetTrayMetrics.height,
                width: workflowAssetTrayMetrics.width,
                x: workflowAssetTrayMetrics.left,
                y: workflowAssetTrayMetrics.top,
              },
            },
          ],
        }),
        createInfiniteCanvasEdgeTargetResolver<WorkflowBoardWindowKind>({
          id: "workflow-board-connectors",
          targets: (context) => getWorkflowBoardEdgeTargets(context.state, connections),
        }),
      ] as const,
    [connections],
  );
  const dropPolicy = useMemo(
    () => createWorkflowBoardDropPolicy(connections, setConnections),
    [connections],
  );

  return (
    <InfiniteCanvasDesktop
      documentKey={`workflow-board-${workspace.id}`}
      dropPolicy={dropPolicy}
      initialState={workspace.state}
      renderOverlay={(context) => (
        <WorkflowBoardOverlay
          connections={connections}
          context={context}
          pendingConnection={pendingConnection}
          setConnections={setConnections}
          setPendingConnection={setPendingConnection}
          setWorkspaceId={setWorkspaceId}
          workspace={workspace}
        />
      )}
      sceneLayers={sceneLayers}
      spatialTargetResolvers={spatialTargetResolvers}
      subtitle="Move cards, create/delete/reconnect links, split links by dropping assets, and switch scoped workspaces."
      title="Infinite Canvas Workflow Board"
      windowDefinitions={workflowBoardRegistry}
    />
  );
}

export { InfiniteCanvasWorkflowBoardShowcase };
