"use client";

import { observable, type Observable } from "@legendapp/state";
import { useSelector } from "@legendapp/state/react";
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";

type InfiniteCanvasRasterCachePolicy = "auto" | "disabled" | "full" | "soft";

type InfiniteCanvasRasterAdapter = "snapdom";

type InfiniteCanvasRasterMode = "inactive-windows";

type InfiniteCanvasRasterFormat = "png" | "svg" | "webp";

type InfiniteCanvasRasterCaptureScheduling = "idle" | "immediate";

type InfiniteCanvasRasterizationPolicy = Readonly<{
  adapter: InfiniteCanvasRasterAdapter;
  cache: InfiniteCanvasRasterCachePolicy;
  captureDelayMs: number;
  captureScheduling: InfiniteCanvasRasterCaptureScheduling;
  captureStaggerMs: number;
  debug: boolean;
  dpr: number;
  enabled: boolean;
  format: InfiniteCanvasRasterFormat;
  maxConcurrentCaptures: number;
  maxPendingCaptures: number;
  mode: InfiniteCanvasRasterMode;
  viewportMarginPx: number;
}>;

type InfiniteCanvasRasterizationPolicyInput = Partial<InfiniteCanvasRasterizationPolicy>;

type InfiniteCanvasRasterSnapshotStatus = "capturing" | "failed" | "queued" | "ready";

type InfiniteCanvasRasterDisplayMode = "live" | "snapshot";

type InfiniteCanvasRasterSnapshot = Readonly<{
  captureMs: number | null;
  capturedAt: number | null;
  error: string | null;
  height: number;
  signature: string;
  src: string | null;
  status: InfiniteCanvasRasterSnapshotStatus;
  width: number;
}>;

type InfiniteCanvasRasterRuntimeState = Readonly<{
  activeCaptures: number;
  latestCaptureMs: number | null;
  latestError: string | null;
  latestEvent: string | null;
  paused: boolean;
  queuedCaptures: number;
  totalCaptureMs: number;
  totalFailed: number;
  totalQueued: number;
  totalReady: number;
  totalStarted: number;
  updatedAt: number | null;
}>;

type InfiniteCanvasRasterRuntimePatch = Partial<
  Omit<InfiniteCanvasRasterRuntimeState, "updatedAt">
>;

type InfiniteCanvasRasterStoreState = Readonly<{
  displays: Readonly<Record<string, InfiniteCanvasRasterDisplayMode>>;
  revision: number;
  runtime: InfiniteCanvasRasterRuntimeState;
  snapshots: Readonly<Record<string, InfiniteCanvasRasterSnapshot>>;
}>;

type InfiniteCanvasRasterCaptureRequest = Readonly<{
  element: HTMLElement;
  height: number;
  signature: string;
  width: number;
  windowId: string;
}>;

type InfiniteCanvasRasterSummary = Readonly<{
  activeCaptures: number;
  averageCaptureMs: number | null;
  capturing: number;
  displayed: number;
  failed: number;
  latestCaptureMs: number | null;
  latestError: string | null;
  latestEvent: string | null;
  live: number;
  paused: boolean;
  queued: number;
  queuedCaptures: number;
  ready: number;
  snapshot: number;
  totalFailed: number;
  totalQueued: number;
  totalReady: number;
  totalStarted: number;
  updatedAt: number | null;
}>;

type InfiniteCanvasRasterContextValue = Readonly<{
  policy: InfiniteCanvasRasterizationPolicy;
  /**
   * `false` when the request was refused: the queue is at `maxPendingCaptures`.
   *
   * The caller must not record the request as made. A refused capture that the
   * caller believes it made is a window that waits forever for a snapshot nobody
   * is taking — and the only symptom is that one window stays live while its
   * neighbours rasterize.
   */
  queueCapture: (request: InfiniteCanvasRasterCaptureRequest) => boolean;
  setPaused: (paused: boolean) => void;
  setDisplayMode: (windowId: string, mode: InfiniteCanvasRasterDisplayMode) => void;
  state$: Observable<InfiniteCanvasRasterStoreState>;
}>;

type InfiniteCanvasRasterWritableObservable = Observable<InfiniteCanvasRasterStoreState> &
  Readonly<{
    peek: () => InfiniteCanvasRasterStoreState;
    set: (state: InfiniteCanvasRasterStoreState) => void;
  }>;

/**
 * @experimental Rasterization is partial: the policy, scheduler, and snapshot
 * capture exist and are off by default, but the capture lane is slated to be
 * rebuilt on `html-in-canvas` (P7), and semantic level-of-detail — the half of
 * far-zoom readability that snapshots cannot solve — is unbuilt. The policy
 * shape will change.
 */
const DEFAULT_INFINITE_CANVAS_RASTERIZATION: InfiniteCanvasRasterizationPolicy = {
  adapter: "snapdom",
  cache: "full",
  captureDelayMs: 80,
  captureScheduling: "idle",
  captureStaggerMs: 4,
  debug: false,
  dpr: 2,
  enabled: false,
  format: "svg",
  maxConcurrentCaptures: 1,
  maxPendingCaptures: Number.POSITIVE_INFINITY,
  mode: "inactive-windows",
  viewportMarginPx: Number.POSITIVE_INFINITY,
};

const createInitialRasterRuntimeState = (): InfiniteCanvasRasterRuntimeState => ({
  activeCaptures: 0,
  latestCaptureMs: null,
  latestError: null,
  latestEvent: null,
  paused: false,
  queuedCaptures: 0,
  totalCaptureMs: 0,
  totalFailed: 0,
  totalQueued: 0,
  totalReady: 0,
  totalStarted: 0,
  updatedAt: null,
});

const createInitialRasterState = (): InfiniteCanvasRasterStoreState => ({
  displays: {},
  revision: 0,
  runtime: createInitialRasterRuntimeState(),
  snapshots: {},
});

const disabledRasterState$ = observable<InfiniteCanvasRasterStoreState>(createInitialRasterState());
const DISABLED_INFINITE_CANVAS_RASTER_CONTEXT: InfiniteCanvasRasterContextValue = {
  policy: DEFAULT_INFINITE_CANVAS_RASTERIZATION,
  // Refused, not satisfied. Nothing is going to capture anything here.
  queueCapture: () => false,
  setPaused: () => {},
  setDisplayMode: () => {},
  state$: disabledRasterState$,
};
const InfiniteCanvasRasterContext = createContext<InfiniteCanvasRasterContextValue>(
  DISABLED_INFINITE_CANVAS_RASTER_CONTEXT,
);

function resolveInfiniteCanvasRasterizationPolicy(
  input?: InfiniteCanvasRasterizationPolicyInput | boolean,
): InfiniteCanvasRasterizationPolicy {
  if (input === undefined) {
    return DEFAULT_INFINITE_CANVAS_RASTERIZATION;
  }

  if (typeof input === "boolean") {
    return {
      ...DEFAULT_INFINITE_CANVAS_RASTERIZATION,
      enabled: input,
    };
  }

  return {
    ...DEFAULT_INFINITE_CANVAS_RASTERIZATION,
    ...input,
  };
}

const createQueuedSnapshot = (
  request: InfiniteCanvasRasterCaptureRequest,
): InfiniteCanvasRasterSnapshot => ({
  captureMs: null,
  capturedAt: null,
  error: null,
  height: request.height,
  signature: request.signature,
  src: null,
  status: "queued",
  width: request.width,
});

const createCapturingSnapshot = (
  request: InfiniteCanvasRasterCaptureRequest,
): InfiniteCanvasRasterSnapshot => ({
  ...createQueuedSnapshot(request),
  status: "capturing",
});

const createFailedSnapshot = (
  request: InfiniteCanvasRasterCaptureRequest,
  error: unknown,
): InfiniteCanvasRasterSnapshot => ({
  captureMs: null,
  capturedAt: Date.now(),
  error: getRasterErrorMessage(error),
  height: request.height,
  signature: request.signature,
  src: null,
  status: "failed",
  width: request.width,
});

const getRasterErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Snapshot capture failed";

const applyRasterRuntimePatch = (
  runtime: InfiniteCanvasRasterRuntimeState,
  patch: InfiniteCanvasRasterRuntimePatch,
): InfiniteCanvasRasterRuntimeState => ({
  ...runtime,
  ...patch,
  updatedAt: Date.now(),
});

const createSnapdomCaptureOptions = (policy: InfiniteCanvasRasterizationPolicy) => ({
  cache: policy.cache,
  fast: true,
  outerShadows: false,
  scale: 1,
});

const createReadySnapshot = (
  request: InfiniteCanvasRasterCaptureRequest,
  src: string,
  captureMs: number,
): InfiniteCanvasRasterSnapshot => ({
  captureMs,
  capturedAt: Date.now(),
  error: null,
  height: request.height,
  signature: request.signature,
  src,
  status: "ready",
  width: request.width,
});

const shouldSkipQueuedCapture = (
  snapshot: InfiniteCanvasRasterSnapshot | undefined,
  signature: string,
): boolean =>
  snapshot !== undefined &&
  snapshot.signature === signature &&
  (snapshot.status === "queued" || snapshot.status === "capturing" || snapshot.status === "ready");

const hasPendingCaptureCapacity = (
  policy: InfiniteCanvasRasterizationPolicy,
  queueSize: number,
  activeCaptureCount: number,
) =>
  !Number.isFinite(policy.maxPendingCaptures) ||
  queueSize + activeCaptureCount < policy.maxPendingCaptures;

const getRasterSummary = (state: InfiniteCanvasRasterStoreState): InfiniteCanvasRasterSummary => {
  const snapshots = Object.values(state.snapshots);
  const displays = Object.values(state.displays);
  const averageCaptureMs =
    state.runtime.totalReady === 0
      ? null
      : Math.round(state.runtime.totalCaptureMs / state.runtime.totalReady);

  return {
    activeCaptures: state.runtime.activeCaptures,
    averageCaptureMs,
    capturing: snapshots.filter((snapshot) => snapshot.status === "capturing").length,
    displayed: displays.length,
    failed: snapshots.filter((snapshot) => snapshot.status === "failed").length,
    latestCaptureMs: state.runtime.latestCaptureMs,
    latestError: state.runtime.latestError,
    latestEvent: state.runtime.latestEvent,
    live: displays.filter((display) => display === "live").length,
    paused: state.runtime.paused,
    queued: snapshots.filter((snapshot) => snapshot.status === "queued").length,
    queuedCaptures: state.runtime.queuedCaptures,
    ready: snapshots.filter((snapshot) => snapshot.status === "ready").length,
    snapshot: displays.filter((display) => display === "snapshot").length,
    totalFailed: state.runtime.totalFailed,
    totalQueued: state.runtime.totalQueued,
    totalReady: state.runtime.totalReady,
    totalStarted: state.runtime.totalStarted,
    updatedAt: state.runtime.updatedAt,
  };
};

function updateRasterState(
  state$: Observable<InfiniteCanvasRasterStoreState>,
  updater: (state: InfiniteCanvasRasterStoreState) => InfiniteCanvasRasterStoreState,
) {
  const writableState$ = state$ as InfiniteCanvasRasterWritableObservable;
  const currentState = writableState$.peek() as InfiniteCanvasRasterStoreState;
  const nextState = updater(currentState);

  if (nextState !== currentState) {
    writableState$.set({
      ...nextState,
      revision: currentState.revision + 1,
    });
  }
}

type RasterScheduledTask =
  | Readonly<{
      handle: number;
      kind: "idle";
    }>
  | Readonly<{
      handle: ReturnType<typeof setTimeout>;
      kind: "timeout";
    }>;

const scheduleRasterTask = (
  policy: InfiniteCanvasRasterizationPolicy,
  callback: () => void,
): RasterScheduledTask => {
  if (policy.captureScheduling === "idle" && typeof globalThis.requestIdleCallback === "function") {
    return {
      handle: globalThis.requestIdleCallback(callback, {
        timeout: 500,
      }),
      kind: "idle",
    };
  }

  return {
    handle: globalThis.setTimeout(callback, 0),
    kind: "timeout",
  };
};

const cancelRasterTask = (task: RasterScheduledTask | null) => {
  if (task === null) {
    return;
  }

  if (task.kind === "idle" && typeof globalThis.cancelIdleCallback === "function") {
    globalThis.cancelIdleCallback(task.handle);

    return;
  }

  if (task.kind === "timeout") {
    globalThis.clearTimeout(task.handle);
  }
};

function InfiniteCanvasRasterizationProvider({
  children,
  policy,
}: Readonly<{
  children: ReactNode;
  policy: InfiniteCanvasRasterizationPolicy;
}>) {
  const state$ = useMemo(
    () => observable<InfiniteCanvasRasterStoreState>(createInitialRasterState()),
    [],
  );
  const queueRef = useRef(new Map<string, InfiniteCanvasRasterCaptureRequest>());
  const activeCaptureCountRef = useRef(0);
  const objectUrlsRef = useRef(new Map<string, string>());
  const pausedRef = useRef(false);
  const scheduledTaskRef = useRef<RasterScheduledTask | null>(null);

  const context = useMemo<InfiniteCanvasRasterContextValue>(() => {
    const revokeWindowUrl = (windowId: string) => {
      const url = objectUrlsRef.current.get(windowId);

      if (url !== undefined) {
        URL.revokeObjectURL(url);
        objectUrlsRef.current.delete(windowId);
      }
    };

    const setSnapshot = (
      windowId: string,
      snapshot: InfiniteCanvasRasterSnapshot,
      getRuntimePatch?: (
        runtime: InfiniteCanvasRasterRuntimeState,
      ) => InfiniteCanvasRasterRuntimePatch,
    ) => {
      updateRasterState(state$, (state) => ({
        ...state,
        runtime:
          getRuntimePatch === undefined
            ? state.runtime
            : applyRasterRuntimePatch(state.runtime, getRuntimePatch(state.runtime)),
        snapshots: {
          ...state.snapshots,
          [windowId]: snapshot,
        },
      }));
    };

    const scheduleCaptureDrain = () => {
      if (
        scheduledTaskRef.current !== null ||
        !policy.enabled ||
        pausedRef.current ||
        activeCaptureCountRef.current >= policy.maxConcurrentCaptures ||
        queueRef.current.size === 0
      ) {
        return;
      }

      scheduledTaskRef.current = scheduleRasterTask(policy, () => {
        scheduledTaskRef.current = null;
        captureNext();
      });
    };

    const captureNext = () => {
      if (!policy.enabled || pausedRef.current) {
        return;
      }

      if (activeCaptureCountRef.current >= policy.maxConcurrentCaptures) {
        return;
      }

      const next = queueRef.current.entries().next();

      if (next.done === true) {
        return;
      }

      const [windowId, request] = next.value;
      queueRef.current.delete(windowId);
      activeCaptureCountRef.current += 1;
      setSnapshot(windowId, createCapturingSnapshot(request), (runtime) => ({
        activeCaptures: activeCaptureCountRef.current,
        latestEvent: `capturing ${windowId}`,
        queuedCaptures: queueRef.current.size,
        totalStarted: runtime.totalStarted + 1,
      }));

      void (async () => {
        try {
          if (!request.element.isConnected) {
            throw new Error("Window body disconnected before capture");
          }

          await document.fonts.ready;

          const startedAt = performance.now();
          const { snapdom } = await import("@zumer/snapdom");
          const capture = await snapdom(request.element, createSnapdomCaptureOptions(policy));
          const src =
            policy.format === "svg"
              ? capture.url
              : URL.createObjectURL(
                  await capture.toBlob({
                    backgroundColor: "transparent",
                    dpr: policy.dpr,
                    type: policy.format,
                  }),
                );
          const captureMs = Math.round(performance.now() - startedAt);

          revokeWindowUrl(windowId);
          if (policy.format !== "svg") {
            objectUrlsRef.current.set(windowId, src);
          }
          setSnapshot(windowId, createReadySnapshot(request, src, captureMs), (runtime) => ({
            latestCaptureMs: captureMs,
            latestError: null,
            latestEvent: `ready ${windowId}`,
            totalCaptureMs: runtime.totalCaptureMs + captureMs,
            totalReady: runtime.totalReady + 1,
          }));
        } catch (error) {
          revokeWindowUrl(windowId);
          setSnapshot(windowId, createFailedSnapshot(request, error), (runtime) => ({
            latestError: getRasterErrorMessage(error),
            latestEvent: `failed ${windowId}`,
            totalFailed: runtime.totalFailed + 1,
          }));
        } finally {
          activeCaptureCountRef.current = Math.max(0, activeCaptureCountRef.current - 1);
          updateRasterState(state$, (state) => ({
            ...state,
            runtime: applyRasterRuntimePatch(state.runtime, {
              activeCaptures: activeCaptureCountRef.current,
              latestEvent: `idle ${windowId}`,
              queuedCaptures: queueRef.current.size,
            }),
          }));
          scheduleCaptureDrain();
        }
      })();

      scheduleCaptureDrain();
    };

    return {
      policy,
      queueCapture: (request) => {
        if (!policy.enabled) {
          return false;
        }

        const state = state$.peek() as InfiniteCanvasRasterStoreState;

        // An equivalent snapshot is already queued, capturing, or ready. The
        // caller's request is satisfied, so it may record it as made.
        if (shouldSkipQueuedCapture(state.snapshots[request.windowId], request.signature)) {
          return true;
        }

        if (
          !hasPendingCaptureCapacity(policy, queueRef.current.size, activeCaptureCountRef.current)
        ) {
          return false;
        }

        queueRef.current.set(request.windowId, request);
        updateRasterState(state$, (currentState) => ({
          ...currentState,
          runtime: applyRasterRuntimePatch(currentState.runtime, {
            latestEvent: `queued ${request.windowId}`,
            queuedCaptures: queueRef.current.size,
            totalQueued: currentState.runtime.totalQueued + 1,
          }),
          snapshots: {
            ...currentState.snapshots,
            [request.windowId]: createQueuedSnapshot(request),
          },
        }));
        scheduleCaptureDrain();

        return true;
      },
      setPaused: (paused) => {
        if (pausedRef.current === paused) {
          return;
        }

        pausedRef.current = paused;

        if (paused) {
          cancelRasterTask(scheduledTaskRef.current);
          scheduledTaskRef.current = null;
        }

        updateRasterState(state$, (state) => ({
          ...state,
          runtime: applyRasterRuntimePatch(state.runtime, {
            latestEvent: paused ? "paused" : "resumed",
            paused,
            queuedCaptures: queueRef.current.size,
          }),
        }));

        if (!paused) {
          scheduleCaptureDrain();
        }
      },
      setDisplayMode: (windowId, mode) => {
        updateRasterState(state$, (state) =>
          state.displays[windowId] === mode
            ? state
            : {
                ...state,
                displays: {
                  ...state.displays,
                  [windowId]: mode,
                },
              },
        );
      },
      state$,
    };
  }, [policy]);

  useEffect(
    () => () => {
      objectUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      objectUrlsRef.current.clear();
      queueRef.current.clear();
      cancelRasterTask(scheduledTaskRef.current);
      scheduledTaskRef.current = null;
    },
    [],
  );

  return (
    <InfiniteCanvasRasterContext.Provider value={context}>
      {children}
    </InfiniteCanvasRasterContext.Provider>
  );
}

function useInfiniteCanvasRasterContext() {
  return useContext(InfiniteCanvasRasterContext);
}

function useInfiniteCanvasRasterPolicy() {
  return useInfiniteCanvasRasterContext().policy;
}

function InfiniteCanvasRasterSchedulerGate({
  paused,
}: Readonly<{
  paused: boolean;
}>) {
  const raster = useInfiniteCanvasRasterContext();

  useEffect(() => {
    raster.setPaused(paused);
  }, [paused, raster]);

  return null;
}

/**
 * Whether the capture queue would accept another request right now.
 *
 * The reason a refused window ever tries again. Selecting a boolean rather than the
 * queue depth means a subscriber re-renders only when the queue crosses
 * full ↔ not-full, and with the default `maxPendingCaptures: Infinity` the value is
 * permanently `true`.
 *
 * Pass `isWaiting: false` when the caller has nothing queued. The selector then
 * returns before reading `state$`, so Legend records no dependency and the caller
 * does not re-render on a crossing it does not care about — which is what keeps a
 * bounded queue from waking all 160 windows every time one capture completes. The
 * subscription re-arms on the render where `isWaiting` flips back to `true`, because
 * the selector runs on every render.
 */
function useInfiniteCanvasRasterCaptureCapacity(isWaiting: boolean): boolean {
  const { policy, state$ } = useInfiniteCanvasRasterContext();

  return useSelector(() => {
    if (!isWaiting) {
      return true;
    }

    const state = state$.get() as InfiniteCanvasRasterStoreState;

    return hasPendingCaptureCapacity(
      policy,
      state.runtime.queuedCaptures,
      state.runtime.activeCaptures,
    );
  });
}

function useInfiniteCanvasRasterSnapshot(windowId: string) {
  const { state$ } = useInfiniteCanvasRasterContext();

  return useSelector(
    () =>
      (
        state$.snapshots[windowId] as unknown as {
          get: () => InfiniteCanvasRasterSnapshot | undefined;
        }
      ).get() ?? null,
  );
}

function useInfiniteCanvasRasterSummary() {
  const { state$ } = useInfiniteCanvasRasterContext();

  return useSelector(() => getRasterSummary(state$.get() as InfiniteCanvasRasterStoreState));
}

export {
  DEFAULT_INFINITE_CANVAS_RASTERIZATION,
  InfiniteCanvasRasterSchedulerGate,
  InfiniteCanvasRasterizationProvider,
  resolveInfiniteCanvasRasterizationPolicy,
  useInfiniteCanvasRasterCaptureCapacity,
  useInfiniteCanvasRasterContext,
  useInfiniteCanvasRasterPolicy,
  useInfiniteCanvasRasterSnapshot,
  useInfiniteCanvasRasterSummary,
};

export type {
  InfiniteCanvasRasterCaptureScheduling,
  InfiniteCanvasRasterDisplayMode,
  InfiniteCanvasRasterizationPolicy,
  InfiniteCanvasRasterizationPolicyInput,
  InfiniteCanvasRasterSnapshot,
  InfiniteCanvasRasterSummary,
};
