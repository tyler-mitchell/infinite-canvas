"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

type SnapshotId = "snapdom-dpr-1" | "snapdom-dpr-3";
type SnapshotStatus = "capturing" | "failed" | "ready";

type SnapshotSpec = Readonly<{
  dpr: number;
  id: SnapshotId;
  title: string;
}>;

type SnapshotState = Readonly<{
  error: string | null;
  src: string | null;
  status: SnapshotStatus;
}>;

const sourceRect = {
  height: 220,
  width: 420,
} as const;

const snapshotSpecs: readonly SnapshotSpec[] = [
  {
    dpr: 1,
    id: "snapdom-dpr-1",
    title: "snapDOM PNG, dpr 1",
  },
  {
    dpr: 3,
    id: "snapdom-dpr-3",
    title: "snapDOM PNG, dpr 3",
  },
];

const zoomStops = [0.12, 0.18, 0.25, 0.38, 0.5, 0.77, 1] as const;

const initialSnapshots: Record<SnapshotId, SnapshotState> = {
  "snapdom-dpr-1": {
    error: null,
    src: null,
    status: "capturing",
  },
  "snapdom-dpr-3": {
    error: null,
    src: null,
    status: "capturing",
  },
};

const codeSnippets = {
  raster: [
    "const image = await snapdom.toPng(windowElement, {",
    "  dpr: 3,",
    "  fast: true,",
    "  scale: 1,",
    "})",
    "",
    "return <img src={image.src} style={projectedFrame} />",
  ].join("\n"),
  transform: [
    "return (",
    "  <WindowBody",
    "    style={{",
    "      width: rect.width,",
    "      height: rect.height,",
    "      transform: `scale(${camera.zoom})`,",
    "      transformOrigin: 'top left',",
    "    }}",
    "  />",
    ")",
  ].join("\n"),
} as const;

const getZoomLabel = (zoom: number): string => `${Math.round(zoom * 100)}%`;

const getEffectiveSize = (
  zoom: number,
): Readonly<{
  height: number;
  width: number;
}> => ({
  height: Math.round(sourceRect.height * zoom),
  width: Math.round(sourceRect.width * zoom),
});

const getProjectedFrameStyle = (zoom: number): CSSProperties => {
  const size = getEffectiveSize(zoom);

  return {
    height: size.height,
    width: size.width,
  };
};

const getScaledContentStyle = (zoom: number): CSSProperties => ({
  height: sourceRect.height,
  transform: `scale(${zoom})`,
  transformOrigin: "top left",
  width: sourceRect.width,
});

const getCssZoomContentStyle = (zoom: number): CSSProperties =>
  ({
    height: sourceRect.height,
    width: sourceRect.width,
    zoom,
  }) as CSSProperties;

const readSnapshotError = (error: unknown): string =>
  error instanceof Error ? error.message : "Snapshot capture failed";

function RasterizationLab() {
  const [zoom, setZoom] = useState(0.25);
  const [snapshots, setSnapshots] = useState<Record<SnapshotId, SnapshotState>>(initialSnapshots);
  const sourceRef = useRef<HTMLDivElement | null>(null);
  const zoomLabel = getZoomLabel(zoom);
  const size = getEffectiveSize(zoom);

  useEffect(() => {
    let isLive = true;

    const captureSnapshots = async () => {
      const source = sourceRef.current;

      if (source === null) {
        setSnapshots({
          "snapdom-dpr-1": {
            error: "Source element was not mounted",
            src: null,
            status: "failed",
          },
          "snapdom-dpr-3": {
            error: "Source element was not mounted",
            src: null,
            status: "failed",
          },
        });
        return;
      }

      await document.fonts.ready;

      const { snapdom } = await import("@zumer/snapdom");
      const entries = await Promise.all(
        snapshotSpecs.map(async (spec) => {
          try {
            const image = await snapdom.toPng(source, {
              dpr: spec.dpr,
              fast: true,
              scale: 1,
            });

            return [
              spec.id,
              {
                error: null,
                src: image.src,
                status: "ready",
              },
            ] as const;
          } catch (error) {
            return [
              spec.id,
              {
                error: readSnapshotError(error),
                src: null,
                status: "failed",
              },
            ] as const;
          }
        }),
      );

      if (isLive) {
        setSnapshots(Object.fromEntries(entries) as Record<SnapshotId, SnapshotState>);
      }
    };

    const frame = requestAnimationFrame(() => {
      void captureSnapshots();
    });

    return () => {
      isLive = false;
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#05070a] p-6 text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed left-[-10000px] top-0 h-[220px] w-[420px]"
        ref={sourceRef}
      >
        <FullWindow zoomLabel="100%" />
      </div>

      <section className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/70">
            Infinite canvas raster lab
          </div>
          <h1 className="mt-2 text-2xl font-semibold">Does rasterization improve zoom clarity?</h1>
        </div>
        <label className="grid gap-2 text-[12px] uppercase tracking-[0.16em] text-white/58">
          Zoom {zoomLabel}
          <input
            className="w-[320px]"
            max={1}
            min={0.12}
            onChange={(event) => {
              setZoom(Number(event.currentTarget.value));
            }}
            step={0.01}
            type="range"
            value={zoom}
          />
        </label>
      </section>

      <section className="mb-5 flex flex-wrap gap-2">
        {zoomStops.map((nextZoom) => (
          <button
            className="border border-white/12 bg-white/[0.04] px-3 py-2 text-[11px] uppercase text-white/62 hover:border-cyan-200/50 hover:text-white"
            key={nextZoom}
            onClick={() => {
              setZoom(nextZoom);
            }}
            type="button"
          >
            {Math.round(nextZoom * 100)}%
          </button>
        ))}
      </section>

      <section className="mb-6 text-[12px] leading-relaxed text-white/58">
        Every panel below uses the same projected footprint: {size.width}px x {size.height}px. This
        is intentionally only about clarity from scaling/rasterization, not summary or LOD.
      </section>

      <section className="mb-6 overflow-x-auto pb-2">
        <div className="flex w-max items-start gap-4">
          <ExamplePanel
            caption={`${size.width}px x ${size.height}px`}
            description="Live DOM content scaled with transform."
            title="transform: scale"
          >
            <TransformPreview zoom={zoom} zoomLabel={zoomLabel} />
          </ExamplePanel>

          <ExamplePanel
            caption={`${size.width}px x ${size.height}px`}
            description="Live DOM content rendered with CSS zoom."
            title="CSS zoom"
          >
            <CssZoomPreview zoom={zoom} zoomLabel={zoomLabel} />
          </ExamplePanel>

          {snapshotSpecs.map((spec) => (
            <ExamplePanel
              caption={`${size.width}px x ${size.height}px`}
              description="Real PNG capture of the source DOM, then drawn into the same on-screen size."
              key={spec.id}
              title={spec.title}
            >
              <SnapshotPreview snapshot={snapshots[spec.id]} zoom={zoom} />
            </ExamplePanel>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <CodePanel code={codeSnippets.transform} label="Scaled DOM code" />
        <CodePanel code={codeSnippets.raster} label="Raster snapshot code" />
      </section>
    </main>
  );
}

function ExamplePanel({
  caption,
  children,
  description,
  title,
}: Readonly<{
  caption: string;
  children: ReactNode;
  description: string;
  title: string;
}>) {
  return (
    <article className="w-[470px] shrink-0">
      <div className="mb-3 min-h-[74px]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/82">
          {title}
        </div>
        <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-cyan-100/48">
          {caption}
        </div>
        <p className="mt-2 max-w-[430px] text-[12px] leading-relaxed text-white/52">
          {description}
        </p>
      </div>
      <div className="relative h-[280px] overflow-hidden border border-white/10 bg-[#020406]">
        <GridBackground />
        {children}
      </div>
    </article>
  );
}

function TransformPreview({
  zoom,
  zoomLabel,
}: Readonly<{
  zoom: number;
  zoomLabel: string;
}>) {
  return (
    <div className="absolute left-5 top-5" style={getScaledContentStyle(zoom)}>
      <FullWindow zoomLabel={zoomLabel} />
    </div>
  );
}

function CssZoomPreview({
  zoom,
  zoomLabel,
}: Readonly<{
  zoom: number;
  zoomLabel: string;
}>) {
  return (
    <div className="absolute left-5 top-5" style={getCssZoomContentStyle(zoom)}>
      <FullWindow zoomLabel={zoomLabel} />
    </div>
  );
}

function SnapshotPreview({
  snapshot,
  zoom,
}: Readonly<{
  snapshot: SnapshotState;
  zoom: number;
}>) {
  return (
    <div className="absolute left-5 top-5 overflow-hidden" style={getProjectedFrameStyle(zoom)}>
      {snapshot.status === "ready" && snapshot.src !== null ? (
        <img
          alt="snapDOM rasterized window capture"
          className="h-full w-full border border-cyan-100/50 object-fill"
          src={snapshot.src}
        />
      ) : (
        <div className="grid h-full place-items-center border border-cyan-100/40 bg-[#080b10] p-2 text-center text-[9px] uppercase tracking-[0.12em] text-white/48">
          {snapshot.status === "failed" ? snapshot.error : "capturing"}
        </div>
      )}
    </div>
  );
}

function FullWindow({ zoomLabel }: Readonly<{ zoomLabel: string }>) {
  return (
    <div className="h-full border border-cyan-100/50 bg-[#080b10] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
      <div className="flex h-9 items-center justify-between border-b border-cyan-100/20 bg-cyan-100/[0.08] px-3">
        <div className="truncate text-[11px] font-medium uppercase text-cyan-100/72">
          runtime.controls
        </div>
        <div className="text-[10px] text-white/38">{zoomLabel}</div>
      </div>
      <div className="grid gap-3 p-4 text-[12px] leading-relaxed text-white/62">
        <div className="text-[10px] uppercase text-[#ffd27a]/80">Composable runtime</div>
        <p>
          This is the ordinary React body. It looks fine at native size, but it becomes hard to read
          when the whole body is scaled down.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="border border-white/10 bg-white/[0.04] p-2">Unpin</div>
          <div className="border border-white/10 bg-white/[0.04] p-2">Focus log</div>
          <div className="border border-white/10 bg-white/[0.04] p-2">Fit all</div>
          <div className="border border-white/10 bg-white/[0.04] p-2">Open note</div>
        </div>
      </div>
    </div>
  );
}

function GridBackground() {
  return (
    <>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(110,231,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(110,231,255,0.1)_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(110,231,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(110,231,255,0.18)_1px,transparent_1px)] bg-[size:96px_96px]" />
    </>
  );
}

function CodePanel({ code, label }: Readonly<{ code: string; label: string }>) {
  return (
    <section className="border border-white/10 bg-white/[0.025] p-4">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/64">
        {label}
      </div>
      <pre className="overflow-auto border border-white/10 bg-black/32 p-3 text-[11px] leading-relaxed text-white/66">
        <code>{code}</code>
      </pre>
    </section>
  );
}

export { RasterizationLab };
