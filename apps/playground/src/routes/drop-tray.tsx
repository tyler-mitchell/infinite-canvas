import { createFileRoute } from "@tanstack/react-router";
import {
  createInfiniteCanvasOverlayTargetResolver,
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
  getInfiniteCanvasDropPlacement,
  InfiniteCanvasDesktop,
  worldRectToScreenRect,
  type InfiniteCanvasDropPolicy,
  type InfiniteCanvasOverlayRenderContext,
  type InfiniteCanvasRect,
  type InfiniteCanvasSceneLayer,
  type InfiniteCanvasSize,
  type InfiniteCanvasWindow,
} from "infinite-canvas";
import { useMemo, useRef } from "react";
import { exposeCanvasDevHandle } from "../showcases/dev-handle.ts";

export const Route = createFileRoute("/drop-tray")({
  component: DropTrayShowcase,
  staticData: {
    showcase: {
      description: "Typed drag/drop: palette assets onto canvas or cards.",
      order: 3,
      title: "Drop tray",
    },
  },
});

type CardKind = "idea" | "task";

type CardAsset = Readonly<{
  accent: string;
  id: string;
  kind: CardKind;
  label: string;
}>;

type CardData = Readonly<{ accent: string; lines: readonly string[] }>;

const trayRect = { height: 150, width: 200, x: 16, y: 110 } as const;

const assets: readonly CardAsset[] = [
  { accent: "#7dd3fc", id: "asset-idea", kind: "idea", label: "Idea" },
  { accent: "#fcd34d", id: "asset-task", kind: "task", label: "Task" },
];

const cardSize: InfiniteCanvasSize = { height: 180, width: 280 };

function makeCard(input: {
  accent: string;
  id: string;
  kind: CardKind;
  lines: readonly string[];
  rect: InfiniteCanvasRect;
  title: string;
  zIndex: number;
}) {
  const { accent, lines, ...window } = input;
  return createInfiniteCanvasWindow<CardKind, CardData>({
    ...window,
    data: { accent, lines },
  });
}

const initialState = createInfiniteCanvasState<CardKind>({
  camera: { center: { x: 420, y: 240 }, zoom: 0.9 },
  windows: [
    makeCard({
      accent: "#7dd3fc",
      id: "seed-idea",
      kind: "idea",
      lines: [
        "Drag an asset from the tray.",
        "Drop on empty canvas or on a card body.",
        "The tray itself rejects drops.",
      ],
      rect: { height: 200, width: 300, x: 280, y: 140 },
      title: "How this works",
      zIndex: 1,
    }),
  ],
});

function cardData(window: InfiniteCanvasWindow<CardKind>): CardData {
  return typeof window.data === "object" && window.data !== null && "lines" in window.data
    ? (window.data as CardData)
    : { accent: "#7dd3fc", lines: [] };
}

const registry = defineInfiniteCanvasWindowRegistry<CardKind>({
  idea: {
    kind: "idea",
    overflowY: "auto",
    renderBody: ({ window }) => <CardBody window={window} />,
    textSelection: "none",
  },
  task: {
    kind: "task",
    overflowY: "auto",
    renderBody: ({ window }) => <CardBody window={window} />,
    textSelection: "none",
  },
});

function CardBody({ window }: { window: InfiniteCanvasWindow<CardKind> }) {
  const data = cardData(window);
  return (
    <div className="grid content-start gap-2 p-4 text-xs leading-relaxed text-white/60">
      <div
        className="text-[10px] font-medium uppercase tracking-wider"
        style={{ color: data.accent }}
      >
        {window.kind}
      </div>
      {data.lines.map((line) => (
        <div
          className="border-l-2 bg-white/[0.03] px-3 py-1.5"
          key={line}
          style={{ borderColor: `${data.accent}66` }}
        >
          {line}
        </div>
      ))}
    </div>
  );
}

function isCardAsset(payload: unknown): payload is CardAsset {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "id" in payload &&
    assets.some((asset) => asset.id === payload.id)
  );
}

function DropTrayShowcase() {
  const sequenceRef = useRef(0);

  const dropPolicy = useMemo(
    () =>
      ({
        canDrop: ({ payload, target }) => {
          if (!isCardAsset(payload)) {
            return { accepted: false, reason: "Unknown payload." };
          }
          if (target.type === "overlay") {
            return { accepted: false, reason: "That's the tray — drop on the canvas." };
          }
          return (
            target.type === "empty-world" ||
            (target.type === "window" && target.area === "body") || {
              accepted: false,
              reason: "Drop on open canvas or a card body.",
            }
          );
        },
        onDrop: ({ actions, payload, state, target, worldPoint }) => {
          if (!isCardAsset(payload)) {
            return;
          }
          sequenceRef.current += 1;
          const ordinal = sequenceRef.current;
          // Same placement call as the drag preview: the card commits exactly
          // where the preview showed it, snapped like a window move.
          const placement = getInfiniteCanvasDropPlacement({
            size: cardSize,
            state,
            worldPoint,
          });
          actions.openWindow(
            makeCard({
              accent: payload.accent,
              id: `drop-${payload.kind}-${ordinal}`,
              kind: payload.kind,
              lines:
                target.type === "window"
                  ? [`Related to “${target.window.title}”.`]
                  : ["Placed at the drop point."],
              rect: placement.rect,
              title: `${payload.label} ${String(ordinal).padStart(2, "0")}`,
              zIndex: state.windows.length + 1,
            }),
          );
        },
      }) satisfies InfiniteCanvasDropPolicy<CardKind, CardAsset>,
    [],
  );

  const sceneLayers = useMemo(
    () =>
      [
        {
          frameloop: "demand",
          id: "drop-preview",
          placement: "overlay",
          render: (context) => {
            const { drop } = context;
            if (
              drop.status !== "dragging" ||
              !drop.isOverViewport ||
              !isCardAsset(drop.payload) ||
              drop.dropTarget.target === null
            ) {
              return null;
            }
            const placement = getInfiniteCanvasDropPlacement({
              size: cardSize,
              state: context.state,
              worldPoint: drop.worldPoint,
            });
            const { rect } = placement;
            const valid = drop.dropTarget.status === "valid";
            const visible = context.visibleWorldRect;
            return (
              <group>
                <group position={[rect.x + rect.width / 2, -(rect.y + rect.height / 2), 10]}>
                  <mesh>
                    <boxGeometry args={[rect.width, rect.height, 1]} />
                    <meshBasicMaterial
                      color={valid ? drop.payload.accent : "#f87171"}
                      opacity={valid ? 0.16 : 0.08}
                      transparent
                    />
                  </mesh>
                </group>
                {placement.preview?.guides.map((guide) => (
                  <mesh
                    key={guide.id}
                    position={
                      guide.axis === "x"
                        ? [guide.position, -(visible.y + visible.height / 2), 11]
                        : [visible.x + visible.width / 2, -guide.position, 11]
                    }
                  >
                    <boxGeometry
                      args={
                        guide.axis === "x"
                          ? [1.5 / context.camera.zoom, visible.height, 1]
                          : [visible.width, 1.5 / context.camera.zoom, 1]
                      }
                    />
                    <meshBasicMaterial color="#7dd3fc" opacity={0.6} transparent />
                  </mesh>
                ))}
              </group>
            );
          },
        },
      ] satisfies readonly InfiniteCanvasSceneLayer<CardKind, CardAsset>[],
    [],
  );

  const spatialTargetResolvers = useMemo(
    () =>
      [
        createInfiniteCanvasOverlayTargetResolver<CardKind>({
          id: "drop-tray",
          targets: [{ id: "tray", kind: "asset-tray", rect: { ...trayRect } }],
        }),
      ] as const,
    [],
  );

  return (
    <div className="absolute inset-0">
      <InfiniteCanvasDesktop<CardKind, CardAsset>
        dropPolicy={dropPolicy}
        initialState={initialState}
        renderOverlay={(context) => <TrayOverlay context={context} />}
        sceneLayers={sceneLayers}
        spatialTargetResolvers={spatialTargetResolvers}
        subtitle="Typed payloads, validated targets, R3F placement preview, framework-committed drops."
        title="Drop Tray"
        windowDefinitions={registry}
      />
    </div>
  );
}

function TrayOverlay({
  context,
}: {
  context: InfiniteCanvasOverlayRenderContext<CardKind, CardAsset>;
}) {
  exposeCanvasDevHandle(context);
  const { drag } = context;
  const draggingId = drag.status === "dragging" ? drag.id : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[65]">
      <BodyDropOutline context={context} />
      <div
        className="pointer-events-auto absolute grid content-start gap-2 rounded-lg border border-border bg-popover/90 p-2 backdrop-blur"
        data-testid="asset-tray"
        style={{
          height: trayRect.height,
          left: trayRect.x,
          top: trayRect.y,
          width: trayRect.width,
        }}
      >
        <div className="px-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Assets
        </div>
        {assets.map((asset) => (
          <button
            className={[
              "rounded-md border px-3 py-2 text-left text-xs font-medium transition-colors",
              draggingId === asset.id
                ? "border-ring bg-accent text-accent-foreground"
                : "border-border bg-card text-foreground/75 hover:bg-accent",
            ].join(" ")}
            draggable={false}
            key={asset.id}
            onPointerDown={(event) => {
              context.startDrag({ event, id: asset.id, payload: asset });
            }}
            style={{ cursor: "grab" }}
            type="button"
          >
            <span style={{ color: asset.accent }}>● </span>
            {asset.label}
          </button>
        ))}
      </div>
      <DragReadout context={context} />
    </div>
  );
}

function BodyDropOutline({
  context,
}: {
  context: InfiniteCanvasOverlayRenderContext<CardKind, CardAsset>;
}) {
  const target =
    context.drag.status === "dragging" && context.drag.dropTarget.target?.type === "window"
      ? context.drag.dropTarget.target
      : null;
  if (target === null || target.area !== "body") {
    return null;
  }
  const rect = worldRectToScreenRect(
    context.state.camera,
    context.state.viewport,
    target.window.rect,
  );
  return (
    <div
      aria-hidden="true"
      className="absolute rounded-sm border border-sky-300/60 bg-sky-300/[0.05]"
      style={{ height: rect.height, left: rect.left, top: rect.top, width: rect.width }}
    />
  );
}

function DragReadout({
  context,
}: {
  context: InfiniteCanvasOverlayRenderContext<CardKind, CardAsset>;
}) {
  const { drag } = context;
  if (drag.status !== "dragging" || !isCardAsset(drag.payload)) {
    return null;
  }
  const valid = drag.dropTarget.status === "valid";
  const label =
    drag.dropTarget.status === "outside"
      ? "outside canvas"
      : drag.dropTarget.status === "invalid"
        ? (drag.dropTarget.reason ?? "blocked")
        : drag.dropTarget.target.type === "window"
          ? `beside ${drag.dropTarget.target.window.title}`
          : "place here";

  return (
    <div
      className={[
        "absolute rounded-md border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider",
        valid
          ? "border-sky-300/40 bg-popover/90 text-sky-100"
          : "border-red-300/40 bg-popover/90 text-red-200",
      ].join(" ")}
      data-testid="drag-readout"
      style={{ left: drag.viewportPoint.x + 16, top: drag.viewportPoint.y + 16 }}
    >
      {drag.payload.label} → {label}
    </div>
  );
}
