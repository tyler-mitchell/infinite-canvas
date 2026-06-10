"use client";

import { Image, MapPin, StickyNote } from "lucide-react";
import { useMemo, useRef, type PointerEventHandler } from "react";

import { rectsIntersect, worldRectToScreenRect } from "#/experiments/infinite-canvas/geometry";
import {
  InfiniteCanvasDesktop,
  createInfiniteCanvasOverlayTargetResolver,
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
  type InfiniteCanvasDropPolicy,
  type InfiniteCanvasOverlayRenderContext,
  type InfiniteCanvasPoint,
  type InfiniteCanvasRect,
  type InfiniteCanvasSceneLayer,
  type InfiniteCanvasSceneLayerRenderContext,
  type InfiniteCanvasSize,
  type InfiniteCanvasSpatialTarget,
  type InfiniteCanvasState,
  type InfiniteCanvasWindow,
} from "#/experiments/infinite-canvas";

type DropTrayWindowKind = "decision" | "image" | "note";

type DropTrayAsset = Readonly<{
  accent: string;
  description: string;
  id: string;
  kind: DropTrayWindowKind;
  label: string;
}>;

type DropTrayWindowData = Readonly<{
  accent: string;
  eyebrow: string;
  rows: readonly string[];
  source: string;
}>;

const dropTrayMetrics = {
  height: 214,
  left: 16,
  top: 124,
  width: 218,
} as const;

const dropTrayAssets = [
  {
    accent: "#baf7ff",
    description: "Quick note card",
    id: "asset-note",
    kind: "note",
    label: "Note",
  },
  {
    accent: "#9bd8ff",
    description: "Reference image",
    id: "asset-image",
    kind: "image",
    label: "Reference",
  },
  {
    accent: "#d7d1ff",
    description: "Decision card",
    id: "asset-decision",
    kind: "decision",
    label: "Decision",
  },
] satisfies readonly DropTrayAsset[];

const dropTrayInitialState = createInfiniteCanvasState<DropTrayWindowKind>({
  activeWindowId: "research-note",
  camera: {
    center: {
      x: 680,
      y: 430,
    },
    zoom: 0.76,
  },
  selection: ["research-note"],
  windows: [
    createDropTrayWindow({
      accent: "#baf7ff",
      eyebrow: "Note",
      id: "research-note",
      kind: "note",
      rect: {
        height: 220,
        width: 310,
        x: 430,
        y: 430,
      },
      rows: [
        "Live DOM card selected from the board.",
        "Drag assets from the tray onto canvas space.",
        "Drop onto a card body to place a related card beside it.",
      ],
      source: "seed:note",
      title: "Research Note",
      zIndex: 2,
    }),
    createDropTrayWindow({
      accent: "#9bd8ff",
      eyebrow: "Reference",
      id: "mood-reference",
      kind: "image",
      rect: {
        height: 250,
        width: 340,
        x: 805,
        y: 335,
      },
      rows: ["Moodboard crop", "Contrast reference", "Visual direction"],
      source: "seed:image",
      title: "Mood Reference",
      zIndex: 1,
    }),
  ],
});

const dropTrayRegistry = defineInfiniteCanvasWindowRegistry<DropTrayWindowKind>({
  decision: {
    kind: "decision",
    overflowY: "auto",
    renderBody: ({ window }) => <DropTrayCardBody window={window} />,
    textSelection: "none",
  },
  image: {
    kind: "image",
    overflowY: "auto",
    renderBody: ({ window }) => <DropTrayCardBody window={window} />,
    textSelection: "none",
  },
  note: {
    kind: "note",
    overflowY: "auto",
    renderBody: ({ window }) => <DropTrayCardBody window={window} />,
    textSelection: "none",
  },
});

const dropTraySceneLayers = [
  {
    frameloop: "demand",
    id: "drop-preview",
    placement: "overlay",
    render: renderDropPreviewLayer,
  },
] satisfies readonly InfiniteCanvasSceneLayer<DropTrayWindowKind, DropTrayAsset>[];

const dropTraySpatialTargetResolvers = [
  createInfiniteCanvasOverlayTargetResolver<DropTrayWindowKind>({
    id: "drop-tray-overlay",
    targets: [
      {
        data: {
          label: "Asset tray",
        },
        id: "asset-tray",
        kind: "asset-tray",
        rect: {
          height: dropTrayMetrics.height,
          width: dropTrayMetrics.width,
          x: dropTrayMetrics.left,
          y: dropTrayMetrics.top,
        },
      },
    ],
  }),
] as const;

function createDropTrayWindow({
  accent,
  eyebrow,
  rows,
  source,
  ...input
}: Readonly<{
  accent: string;
  eyebrow: string;
  id: string;
  kind: DropTrayWindowKind;
  rect: InfiniteCanvasRect;
  rows: readonly string[];
  source: string;
  title: string;
  zIndex: number;
}>) {
  return createInfiniteCanvasWindow<DropTrayWindowKind, DropTrayWindowData>({
    ...input,
    data: {
      accent,
      eyebrow,
      rows,
      source,
    },
  });
}

function getDropTrayWindowData(window: InfiniteCanvasWindow<DropTrayWindowKind>) {
  return typeof window.data === "object" && window.data !== null && "rows" in window.data
    ? (window.data as DropTrayWindowData)
    : {
        accent: "#baf7ff",
        eyebrow: window.kind,
        rows: [],
        source: window.id,
      };
}

function DropTrayCardBody({
  window,
}: Readonly<{
  window: InfiniteCanvasWindow<DropTrayWindowKind>;
}>) {
  const data = getDropTrayWindowData(window);

  return (
    <div className="grid h-full content-start gap-3 p-4 text-[12px] leading-relaxed text-white/58">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-medium uppercase" style={{ color: data.accent }}>
          {data.eyebrow}
        </div>
        <div className="truncate font-mono text-[9px] uppercase tracking-[0.12em] text-white/30">
          {data.source}
        </div>
      </div>
      {window.kind === "image" ? <DropTrayImageSwatch accent={data.accent} /> : null}
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

function DropTrayImageSwatch({
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

function isDropTrayAsset(payload: unknown): payload is DropTrayAsset {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "id" in payload &&
    dropTrayAssets.some((asset) => asset.id === payload.id)
  );
}

function getDropTrayAssetSize(kind: DropTrayWindowKind): InfiniteCanvasSize {
  switch (kind) {
    case "decision":
      return {
        height: 235,
        width: 325,
      };
    case "image":
      return {
        height: 250,
        width: 340,
      };
    case "note":
      return {
        height: 220,
        width: 310,
      };
  }
}

function centerRectOnPoint(point: InfiniteCanvasPoint, size: InfiniteCanvasSize) {
  return {
    height: size.height,
    width: size.width,
    x: point.x - size.width / 2,
    y: point.y - size.height / 2,
  } satisfies InfiniteCanvasRect;
}

function getDropTrayPlacementRect({
  size,
  state,
  target,
  worldPoint,
}: Readonly<{
  size: InfiniteCanvasSize;
  state: InfiniteCanvasState<DropTrayWindowKind>;
  target: InfiniteCanvasSpatialTarget<DropTrayWindowKind>;
  worldPoint: InfiniteCanvasPoint;
}>) {
  const preferredRect =
    target.type === "window"
      ? ({
          height: size.height,
          width: size.width,
          x: target.window.rect.x + target.window.rect.width + 32,
          y: target.window.rect.y + 24,
        } satisfies InfiniteCanvasRect)
      : centerRectOnPoint(worldPoint, size);

  return getDropTrayOpenPlacementRect({
    preferredRect,
    size,
    state,
  });
}

function getDropTrayOpenPlacementRect({
  preferredRect,
  size,
  state,
}: Readonly<{
  preferredRect: InfiniteCanvasRect;
  size: InfiniteCanvasSize;
  state: InfiniteCanvasState<DropTrayWindowKind>;
}>) {
  const occupiedRects = state.windows.map((window) => inflateRect(window.rect, 24));
  const preferredCenter = {
    x: preferredRect.x + preferredRect.width / 2,
    y: preferredRect.y + preferredRect.height / 2,
  };
  const candidateRects = getDropTrayPlacementOffsets(size).map((offset) =>
    centerRectOnPoint(
      {
        x: preferredCenter.x + offset.x,
        y: preferredCenter.y + offset.y,
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

function getDropTrayPlacementOffsets(size: InfiniteCanvasSize) {
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

function inflateRect(rect: InfiniteCanvasRect, amount: number) {
  return {
    height: rect.height + amount * 2,
    width: rect.width + amount * 2,
    x: rect.x - amount,
    y: rect.y - amount,
  } satisfies InfiniteCanvasRect;
}

function getDropTrayTargetLabel(target: InfiniteCanvasSpatialTarget<DropTrayWindowKind>) {
  switch (target.type) {
    case "empty-world":
      return "Canvas";
    case "overlay":
      return "Asset tray";
    case "window":
      return target.area === "body"
        ? `${target.window.title} body`
        : `${target.window.title} chrome`;
    case "edge":
      return "Connector";
    case "scene-object":
      return "Canvas object";
  }
}

function getDropTrayRows(target: InfiniteCanvasSpatialTarget<DropTrayWindowKind>) {
  return target.type === "window"
    ? [
        `Dropped beside ${target.window.title}.`,
        "Window-body drops create related cards.",
        "The committed card remains normal live DOM.",
      ]
    : [
        "Dropped onto open canvas space.",
        "The preview matched the committed placement.",
        "The committed card remains normal live DOM.",
      ];
}

function renderDropPreviewLayer(
  context: InfiniteCanvasSceneLayerRenderContext<DropTrayWindowKind, DropTrayAsset>,
) {
  if (
    context.drop.status !== "dragging" ||
    !context.drop.isOverViewport ||
    !isDropTrayAsset(context.drop.payload) ||
    context.drop.dropTarget.target === null
  ) {
    return null;
  }

  const rect = getDropTrayPlacementRect({
    size: getDropTrayAssetSize(context.drop.payload.kind),
    state: context.state,
    target: context.drop.dropTarget.target,
    worldPoint: context.drop.worldPoint,
  });

  return (
    <DropPreviewGeometry
      accent={context.drop.dropTarget.status === "valid" ? context.drop.payload.accent : "#ff8f8f"}
      isValid={context.drop.dropTarget.status === "valid"}
      rect={rect}
    />
  );
}

function DropPreviewGeometry({
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
    <group position={[center.x, -center.y, 10]}>
      <mesh>
        <boxGeometry args={[rect.width, rect.height, 2]} />
        <meshBasicMaterial color={accent} opacity={isValid ? 0.14 : 0.07} transparent />
      </mesh>
      <DropPreviewRail
        accent={accent}
        height={3}
        opacity={0.74}
        width={rect.width}
        x={0}
        y={-rect.height / 2}
      />
      <DropPreviewRail
        accent={accent}
        height={3}
        opacity={0.74}
        width={rect.width}
        x={0}
        y={rect.height / 2}
      />
      <DropPreviewRail
        accent={accent}
        height={rect.height}
        opacity={0.74}
        width={3}
        x={-rect.width / 2}
        y={0}
      />
      <DropPreviewRail
        accent={accent}
        height={rect.height}
        opacity={0.74}
        width={3}
        x={rect.width / 2}
        y={0}
      />
    </group>
  );
}

function DropPreviewRail({
  accent,
  height,
  opacity,
  width,
  x,
  y,
}: Readonly<{
  accent: string;
  height: number;
  opacity: number;
  width: number;
  x: number;
  y: number;
}>) {
  return (
    <mesh position={[x, y, 2]}>
      <boxGeometry args={[width, height, 1]} />
      <meshBasicMaterial color={accent} opacity={opacity} transparent />
    </mesh>
  );
}

function DropTrayOverlay({
  context,
}: Readonly<{
  context: InfiniteCanvasOverlayRenderContext<DropTrayWindowKind, DropTrayAsset>;
}>) {
  const activeDragId = context.drag.status === "dragging" ? context.drag.id : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[65]">
      <DropTrayWindowDropOutline context={context} />
      <div
        className="pointer-events-auto absolute select-none border border-white/10 bg-[#07090c]/92 p-2 shadow-[0_18px_60px_-36px_rgba(0,0,0,0.85)] backdrop-blur"
        style={{
          height: dropTrayMetrics.height,
          left: dropTrayMetrics.left,
          top: dropTrayMetrics.top,
          width: dropTrayMetrics.width,
        }}
      >
        <div className="mb-2 px-1 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/46">
          Assets
        </div>
        <div className="grid gap-2">
          {dropTrayAssets.map((asset) => (
            <DropTrayAssetButton
              asset={asset}
              isDragging={activeDragId === asset.id}
              key={asset.id}
              onPointerDown={(event) => {
                context.startDrag({
                  event,
                  id: asset.id,
                  payload: asset,
                });
              }}
            />
          ))}
        </div>
      </div>
      <DropTrayTargetPanel context={context} />
      <DropTrayDragReadout context={context} />
    </div>
  );
}

function DropTrayWindowDropOutline({
  context,
}: Readonly<{
  context: InfiniteCanvasOverlayRenderContext<DropTrayWindowKind, DropTrayAsset>;
}>) {
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
      className="absolute border border-cyan-100/60 bg-cyan-100/[0.04] shadow-[0_0_36px_rgba(142,230,240,0.12)]"
      style={{
        height: rect.height,
        left: rect.left,
        top: rect.top,
        width: rect.width,
      }}
    />
  );
}

function DropTrayTargetPanel({
  context,
}: Readonly<{
  context: InfiniteCanvasOverlayRenderContext<DropTrayWindowKind, DropTrayAsset>;
}>) {
  const summary = getDropTrayTargetSummary(context);

  return (
    <div className="pointer-events-none absolute right-4 top-24 grid w-[248px] select-none gap-2 border border-white/10 bg-[#07090c]/90 p-3 text-[11px] text-white/56 shadow-[0_18px_60px_-36px_rgba(0,0,0,0.85)] backdrop-blur">
      <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-2">
        <span className="font-medium uppercase text-white/46">Drop Target</span>
        <span className={summary.toneClass}>{summary.status}</span>
      </div>
      <div className="grid gap-1">
        <div className="font-mono text-white/78">{summary.target}</div>
        <div>{summary.detail}</div>
      </div>
    </div>
  );
}

function getDropTrayTargetSummary(
  context: InfiniteCanvasOverlayRenderContext<DropTrayWindowKind, DropTrayAsset>,
) {
  if (context.drag.status !== "dragging") {
    return {
      detail: "Drag a tray asset onto open canvas space or onto a card body.",
      status: "ready",
      target: "No drag active",
      toneClass: "text-white/40",
    };
  }

  if (context.drag.dropTarget.status === "outside") {
    return {
      detail: "Pointer is outside the canvas viewport.",
      status: "outside",
      target: "Outside canvas",
      toneClass: "text-white/40",
    };
  }

  const target = context.drag.dropTarget.target;
  const valid = context.drag.dropTarget.status === "valid";

  return {
    detail:
      context.drag.dropTarget.status === "invalid"
        ? (context.drag.dropTarget.reason ?? "This target does not accept the asset.")
        : target.type === "window"
          ? "Drop creates a related card beside the target card."
          : "Drop creates a card at this canvas position.",
    status: valid ? "valid" : "blocked",
    target: getDropTrayTargetLabel(target),
    toneClass: valid ? "text-cyan-100" : "text-[#ffb3b3]",
  };
}

function DropTrayDragReadout({
  context,
}: Readonly<{
  context: InfiniteCanvasOverlayRenderContext<DropTrayWindowKind, DropTrayAsset>;
}>) {
  if (context.drag.status !== "dragging" || !isDropTrayAsset(context.drag.payload)) {
    return null;
  }

  const targetLabel =
    context.drag.dropTarget.status === "outside"
      ? "outside canvas"
      : getDropTrayTargetLabel(context.drag.dropTarget.target);

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

function DropTrayAssetButton({
  asset,
  isDragging,
  onPointerDown,
}: Readonly<{
  asset: DropTrayAsset;
  isDragging: boolean;
  onPointerDown: PointerEventHandler<HTMLElement>;
}>) {
  const Icon = getDropTrayAssetIcon(asset.kind);

  return (
    <button
      className={[
        "grid grid-cols-[28px_1fr] items-center gap-3 border p-3 text-left transition",
        isDragging
          ? "border-cyan-100/42 bg-cyan-100/[0.1] text-cyan-50"
          : "border-white/8 bg-white/[0.035] text-white/68 hover:border-white/18 hover:bg-white/[0.06]",
      ].join(" ")}
      draggable={false}
      onDragStart={(event) => {
        event.preventDefault();
      }}
      onPointerDown={onPointerDown}
      style={{
        cursor: "grab",
      }}
      type="button"
    >
      <span
        className="grid h-7 w-7 place-items-center border border-white/10 bg-white/[0.04]"
        style={{ color: asset.accent }}
      >
        <Icon size={15} strokeWidth={1.8} />
      </span>
      <span className="grid min-w-0 gap-0.5">
        <span className="truncate text-[11px] font-medium uppercase">{asset.label}</span>
        <span className="truncate text-[10px] text-white/38">{asset.description}</span>
      </span>
    </button>
  );
}

function getDropTrayAssetIcon(kind: DropTrayWindowKind) {
  switch (kind) {
    case "decision":
      return MapPin;
    case "image":
      return Image;
    case "note":
      return StickyNote;
  }
}

function createDropTrayDropPolicy(sequenceRef: { current: number }) {
  return {
    canDrop: ({ payload, target }) => {
      if (!isDropTrayAsset(payload)) {
        return {
          accepted: false,
          reason: "Unknown asset.",
        };
      }

      return target.type === "empty-world" || (target.type === "window" && target.area === "body")
        ? true
        : {
            accepted: false,
            reason:
              target.type === "overlay"
                ? "Drop onto the canvas, not back onto the tray."
                : "Drop onto open canvas space or a card body.",
          };
    },
    onDrop: ({ actions, payload, state, target, worldPoint }) => {
      if (!isDropTrayAsset(payload)) {
        return;
      }

      sequenceRef.current += 1;

      const size = getDropTrayAssetSize(payload.kind);
      const nextIndex = sequenceRef.current;
      const nextWindow = createDropTrayWindow({
        accent: payload.accent,
        eyebrow: payload.label,
        id: `dropped-${payload.kind}-${nextIndex}`,
        kind: payload.kind,
        rect: getDropTrayPlacementRect({
          size,
          state,
          target,
          worldPoint,
        }),
        rows: getDropTrayRows(target),
        source: `drop:${payload.kind}:${nextIndex}`,
        title: `${payload.label} ${String(nextIndex).padStart(2, "0")}`,
        zIndex: state.windows.length + 1,
      });

      actions.openWindow(nextWindow);
    },
  } satisfies InfiniteCanvasDropPolicy<DropTrayWindowKind, DropTrayAsset>;
}

function InfiniteCanvasDropTrayShowcase() {
  const sequenceRef = useRef(0);
  const dropPolicy = useMemo(() => createDropTrayDropPolicy(sequenceRef), []);

  return (
    <InfiniteCanvasDesktop<DropTrayWindowKind, DropTrayAsset>
      documentKey="drop-tray-v7"
      dropPolicy={dropPolicy}
      initialState={dropTrayInitialState}
      renderOverlay={(context) => <DropTrayOverlay context={context} />}
      sceneLayers={dropTraySceneLayers}
      spatialTargetResolvers={dropTraySpatialTargetResolvers}
      subtitle="Drag card assets from a palette onto open canvas space or onto another card body."
      title="Infinite Canvas Drop Tray"
      windowDefinitions={dropTrayRegistry}
    />
  );
}

export { InfiniteCanvasDropTrayShowcase };
