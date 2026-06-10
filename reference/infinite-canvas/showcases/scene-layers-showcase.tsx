"use client";

import {
  InfiniteCanvasDesktop,
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
  getInfiniteCanvasWindowConnectorPath,
  getInfiniteCanvasWindowProxy,
  getSelectionTargets,
  getInfiniteCanvasWorldPathPointAtProgress,
  getInfiniteCanvasWorldPathSceneTransforms,
  type InfiniteCanvasOverlayRenderContext,
  type InfiniteCanvasPoint,
  type InfiniteCanvasSceneLayer,
  type InfiniteCanvasSceneLayerRenderContext,
  type InfiniteCanvasSelectionTarget,
  type InfiniteCanvasWindowProxy,
  type InfiniteCanvasWorldPath,
} from "#/experiments/infinite-canvas";
import { worldPointToScreenPoint } from "#/experiments/infinite-canvas/geometry";

type SceneLayerWindowKind = "brief" | "prototype" | "research";

type DiagramLink = Readonly<{
  from: string;
  id: string;
  label: string;
  to: string;
}>;

type VisibleDiagramLink = Readonly<{
  from: InfiniteCanvasWindowProxy<SceneLayerWindowKind>;
  isActive: boolean;
  link: DiagramLink;
  path: InfiniteCanvasWorldPath;
  to: InfiniteCanvasWindowProxy<SceneLayerWindowKind>;
}>;

const sceneLayerState = createInfiniteCanvasState<SceneLayerWindowKind>({
  activeWindowId: "prototype-card",
  camera: {
    center: {
      x: 620,
      y: 480,
    },
    zoom: 0.62,
  },
  selection: ["prototype-card"],
  windows: [
    createInfiniteCanvasWindow({
      id: "brief-card",
      kind: "brief",
      rect: {
        height: 210,
        width: 270,
        x: 55,
        y: 245,
      },
      title: "Brief",
      zIndex: 3,
    }),
    createInfiniteCanvasWindow({
      id: "research-card",
      kind: "research",
      rect: {
        height: 230,
        width: 300,
        x: 430,
        y: 120,
      },
      title: "Research",
      zIndex: 2,
    }),
    createInfiniteCanvasWindow({
      id: "prototype-card",
      kind: "prototype",
      rect: {
        height: 245,
        width: 310,
        x: 420,
        y: 425,
      },
      title: "Prototype",
      zIndex: 4,
    }),
  ],
});

const diagramLinks = [
  {
    from: "brief-card",
    id: "brief-to-research",
    label: "context",
    to: "research-card",
  },
  {
    from: "brief-card",
    id: "brief-to-prototype",
    label: "requirements",
    to: "prototype-card",
  },
  {
    from: "research-card",
    id: "research-to-prototype",
    label: "evidence",
    to: "prototype-card",
  },
] satisfies readonly DiagramLink[];

const sceneLayerRegistry = defineInfiniteCanvasWindowRegistry<SceneLayerWindowKind>({
  brief: {
    frameChrome: "host",
    kind: "brief",
    overflowY: "auto",
    renderBody: () => (
      <BoardCardBody
        eyebrow="Starting Point"
        rows={[
          "The brief is normal live DOM.",
          "The connector graph behind it is R3F world geometry.",
          "Moving this card keeps the graph in the same canvas coordinate system.",
        ]}
      />
    ),
    textSelection: "none",
  },
  prototype: {
    frameChrome: "host",
    kind: "prototype",
    overflowY: "auto",
    renderBody: () => (
      <BoardCardBody
        eyebrow="Selected Card"
        rows={[
          "Selection stays in the DOM/window layer.",
          "The scene layer can react with stronger connected-edge emphasis.",
          "No duplicate frame or independent scene proxy is needed.",
        ]}
      />
    ),
    textSelection: "none",
  },
  research: {
    frameChrome: "host",
    kind: "research",
    overflowY: "auto",
    renderBody: () => (
      <BoardCardBody
        eyebrow="Source Material"
        rows={[
          "Cards can remain full React components.",
          "Diagram rails, halos, fields, and effects can render behind them.",
          "This is the common whiteboard / mind-map / board pattern.",
        ]}
      />
    ),
    textSelection: "none",
  },
});

const sceneLayerShowcaseLayers = [
  {
    id: "diagram-world-underlay",
    render: renderDiagramWorldUnderlay,
  },
] satisfies readonly InfiniteCanvasSceneLayer<SceneLayerWindowKind>[];

function BoardCardBody({
  eyebrow,
  rows,
}: Readonly<{
  eyebrow: string;
  rows: readonly string[];
}>) {
  return (
    <div className="grid h-full content-start gap-3 p-4 text-[12px] leading-relaxed text-white/58">
      <div className="text-[10px] font-medium uppercase text-cyan-100/70">{eyebrow}</div>
      {rows.map((row) => (
        <div className="border-l border-cyan-100/16 bg-white/[0.035] px-3 py-2" key={row}>
          {row}
        </div>
      ))}
    </div>
  );
}

function renderDiagramWorldUnderlay(
  context: InfiniteCanvasSceneLayerRenderContext<SceneLayerWindowKind>,
) {
  const visibleLinks = getVisibleDiagramLinks(
    context.visibleWindows,
    context.state.activeWindowId,
    getSelectionTargets(context.state.selection),
  );

  return (
    <group>
      {visibleLinks.map(({ isActive, link, path }) => (
        <DiagramConnector isActive={isActive} key={link.id} path={path} />
      ))}
    </group>
  );
}

function getVisibleDiagramLinks(
  windows: readonly InfiniteCanvasWindowProxy<SceneLayerWindowKind>[],
  activeWindowId: string | null,
  selectedTargets: readonly InfiniteCanvasSelectionTarget[] = [],
): readonly VisibleDiagramLink[] {
  const windowById = new Map(windows.map((window) => [window.id, window]));

  return diagramLinks
    .map((link) => ({
      from: windowById.get(link.from),
      link,
      to: windowById.get(link.to),
    }))
    .filter(hasVisibleDiagramEndpoints)
    .map(({ from, link, to }) => ({
      from,
      isActive:
        from.id === activeWindowId ||
        to.id === activeWindowId ||
        isDiagramLinkSelected(selectedTargets, link),
      link,
      path: getInfiniteCanvasWindowConnectorPath(from, to, {
        padding: 12,
        route: "orthogonal",
      }),
      to,
    }));
}

function hasVisibleDiagramEndpoints(
  candidate: Readonly<{
    from: InfiniteCanvasWindowProxy<SceneLayerWindowKind> | undefined;
    link: DiagramLink;
    to: InfiniteCanvasWindowProxy<SceneLayerWindowKind> | undefined;
  }>,
): candidate is Readonly<{
  from: InfiniteCanvasWindowProxy<SceneLayerWindowKind>;
  link: DiagramLink;
  to: InfiniteCanvasWindowProxy<SceneLayerWindowKind>;
}> {
  return candidate.from !== undefined && candidate.to !== undefined;
}

function getDiagramLinkSelectionTarget(link: DiagramLink): InfiniteCanvasSelectionTarget {
  return {
    data: {
      from: link.from,
      label: link.label,
      to: link.to,
    },
    id: link.id,
    kind: "diagram-link",
    type: "edge",
  };
}

function isDiagramLinkSelected(
  selectedTargets: readonly InfiniteCanvasSelectionTarget[],
  link: DiagramLink,
) {
  return selectedTargets.some((target) => target.type === "edge" && target.id === link.id);
}

function DiagramConnector({
  isActive,
  path,
}: Readonly<{
  isActive: boolean;
  path: InfiniteCanvasWorldPath;
}>) {
  const transforms = getInfiniteCanvasWorldPathSceneTransforms(path, -6);
  const firstPoint = path.points.at(0);
  const lastPoint = path.points.at(-1);

  return (
    <group>
      {transforms.map((transform, index) => (
        <group
          key={`${transform.position.join(":")}-${index}`}
          position={transform.position}
          rotation={transform.rotation}
        >
          <mesh>
            <boxGeometry args={[transform.length, isActive ? 5 : 3, 2]} />
            <meshBasicMaterial
              color={isActive ? "#cdfbff" : "#67d3e0"}
              opacity={isActive ? 0.34 : 0.16}
              transparent
            />
          </mesh>
          <mesh position={[0, 0, 2]}>
            <boxGeometry args={[transform.length, 1.5, 2]} />
            <meshBasicMaterial color="#e7feff" opacity={isActive ? 0.28 : 0.08} transparent />
          </mesh>
        </group>
      ))}
      {firstPoint === undefined ? null : (
        <ConnectorEndpoint point={firstPoint} isActive={isActive} />
      )}
      {lastPoint === undefined ? null : <ConnectorEndpoint point={lastPoint} isActive={isActive} />}
    </group>
  );
}

function ConnectorEndpoint({
  isActive,
  point,
}: Readonly<{
  isActive: boolean;
  point: InfiniteCanvasPoint;
}>) {
  return (
    <mesh position={[point.x, -point.y, -3]}>
      <circleGeometry args={[isActive ? 5 : 4, 18]} />
      <meshBasicMaterial
        color={isActive ? "#e2fdff" : "#74d5e2"}
        opacity={isActive ? 0.45 : 0.2}
        transparent
      />
    </mesh>
  );
}

function renderDiagramLabelOverlay(
  context: InfiniteCanvasOverlayRenderContext<SceneLayerWindowKind>,
) {
  const selectedTargets = getSelectionTargets(context.state.selection);
  const selectedEdge = selectedTargets.find((target) => target.type === "edge") ?? null;
  const availableSelectionCommands = context.contextualCommands.filter(
    (command) =>
      command.enabled && (command.id === "desktop.cancel" || command.id === "selection.clear"),
  );
  const windowProxies = context.state.windows
    .filter((window) => window.mode !== "minimized")
    .map((window) => getInfiniteCanvasWindowProxy(context.state, window));
  const visibleLinks = getVisibleDiagramLinks(
    windowProxies,
    context.state.activeWindowId,
    selectedTargets,
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-[65]">
      {selectedEdge === null ? null : (
        <div className="pointer-events-auto absolute right-4 top-4 w-56 border border-cyan-100/18 bg-[#05090c]/88 p-3 font-mono text-[9px] uppercase tracking-[0.14em] text-cyan-100/58 shadow-[0_18px_60px_-36px_rgba(142,230,240,0.75)]">
          <div className="mb-2 text-cyan-50/80">Selected Edge</div>
          <div className="mb-3 truncate text-cyan-100/46">{selectedEdge.id}</div>
          <div className="flex gap-2">
            {availableSelectionCommands.map((command) => (
              <button
                className="border border-cyan-100/16 px-2 py-1 text-cyan-50/72 transition-colors hover:border-cyan-100/36 hover:text-cyan-50"
                key={command.id}
                onClick={() => {
                  context.actions.executeCommand(command.command);
                }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                type="button"
              >
                {command.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {visibleLinks.map(({ isActive, link, path }) => {
        const labelPoint = getInfiniteCanvasWorldPathPointAtProgress(path, 0.5);
        const screenPoint = worldPointToScreenPoint(
          context.state.camera,
          context.state.viewport,
          labelPoint,
        );
        const isSelected = isDiagramLinkSelected(selectedTargets, link);

        return (
          <button
            aria-pressed={isSelected}
            className={[
              "pointer-events-auto absolute border bg-[#061014]/92 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] shadow-[0_12px_36px_-24px_rgba(142,230,240,0.8)] transition-colors",
              isSelected
                ? "border-cyan-50/70 text-cyan-50"
                : isActive
                  ? "border-cyan-100/34 text-cyan-50"
                  : "border-cyan-100/16 text-cyan-100/48",
            ].join(" ")}
            key={link.id}
            onClick={() => {
              context.actions.selectTarget(getDiagramLinkSelectionTarget(link));
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
            {link.label}
          </button>
        );
      })}
    </div>
  );
}

function InfiniteCanvasSceneLayersShowcase() {
  return (
    <InfiniteCanvasDesktop
      documentKey="scene-layers-v3"
      initialState={sceneLayerState}
      renderOverlay={renderDiagramLabelOverlay}
      sceneLayers={sceneLayerShowcaseLayers}
      subtitle="Live DOM cards with R3F world-space diagram edges."
      title="Infinite Canvas Scene Layers"
      windowDefinitions={sceneLayerRegistry}
    />
  );
}

export { InfiniteCanvasSceneLayersShowcase };
