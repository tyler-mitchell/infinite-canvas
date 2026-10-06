import {
  batch,
  linked,
  observable,
  observablePrimitive,
  ObservableHint,
  type Observable,
  type OpaqueObject,
} from "@legendapp/state";
import { undoRedo } from "@legendapp/state/helpers/undoRedo";
import { syncObservable, type SyncedOptions } from "@legendapp/state/sync";
import { ObservablePersistLocalStorage } from "@legendapp/state/persist-plugins/local-storage";
import { canvasModel } from "./schema";
import { createCameraRig, type CameraRig, type CameraRigOptions } from "./camera-rig";
import { resolveInfiniteCanvasZoomPolicy } from "./constants";
import { createInfiniteCanvasState, type InfiniteCanvasStateInput } from "./factory";
import { reduceInfiniteCanvasState } from "./operations";
import { getCanvasLayout, type CanvasLayout } from "./layout";
import {
  DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS,
  getInfiniteCanvasContextualCommands,
  getInfiniteCanvasHotkeyBindings,
  isInfiniteCanvasCommandEnabled,
} from "./operations";
import { getInfiniteCanvasSelectionBounds } from "./spatial-target";
import type {
  InfiniteCanvasDispatch,
  InfiniteCanvasCommand,
  InfiniteCanvasCamera,
  DocumentContent,
  InfiniteCanvasCommandDescriptor,
  InfiniteCanvasContextualCommand,
  InfiniteCanvasHotkeyBinding,
  InfiniteCanvasDocument,
  InfiniteCanvasRect,
  InfiniteCanvasSnapPolicy,
  InfiniteCanvasSpatialTargetResolver,
  InfiniteCanvasState,
  InfiniteCanvasWindowProximity,
  InfiniteCanvasWindowRegistry,
  InfiniteCanvasZoomPolicyInput,
} from "./types";

type InfiniteCanvasSignals = Readonly<{
  proximity: Readonly<Record<string, InfiniteCanvasWindowProximity>> | null;
}>;

type InfiniteCanvasStore<Kind extends string = string> = Readonly<{
  camera: CameraRig;
  windowDefinitions: InfiniteCanvasWindowRegistry<Kind>;
  windowDefinitions$: ReturnType<
    typeof observablePrimitive<OpaqueObject<InfiniteCanvasWindowRegistry<Kind>>>
  >;
  getState: () => InfiniteCanvasState<Kind>;
  isCommandEnabled: (command: InfiniteCanvasCommand) => boolean;
  hotkeyBindings: readonly InfiniteCanvasHotkeyBinding[];
  snapshot: () => InfiniteCanvasDocument<Kind>;
  getContextualCommands: (
    options?: Readonly<{ includeDisabled?: boolean }>,
  ) => readonly InfiniteCanvasContextualCommand[];
  document$: Observable<InfiniteCanvasDocument<Kind>>;
  history: ReturnType<typeof undoRedo<DocumentContent<Kind>>>;
  layout$: Observable<CanvasLayout>;
  dispatch: InfiniteCanvasDispatch<Kind>;
  getSelectionBounds: (state: InfiniteCanvasState<Kind>) => InfiniteCanvasRect | null;
  initialState: InfiniteCanvasState<Kind>;
  setSpatialTargetResolvers: (
    resolvers: readonly InfiniteCanvasSpatialTargetResolver<Kind>[],
  ) => void;
  signals$: Observable<InfiniteCanvasSignals>;
  state$: Observable<InfiniteCanvasState<Kind>>;
}>;

type InfiniteCanvasStoreOptions<Kind extends string = string> = Readonly<{
  camera?: CameraRigOptions;
  windowDefinitions?: InfiniteCanvasWindowRegistry<Kind>;
  history?: Parameters<typeof undoRedo>[1];
  sync?: SyncedOptions<InfiniteCanvasDocument<Kind>>;
  storageKey?: string;
  commandDescriptors?: readonly InfiniteCanvasCommandDescriptor[];
  getSelectionBounds?: (state: InfiniteCanvasState<Kind>) => InfiniteCanvasRect | null;
  snapPolicy?: InfiniteCanvasSnapPolicy;
  zoomPolicy?: InfiniteCanvasZoomPolicyInput;
}> &
  (
    | Readonly<{ document: unknown; initialState?: never }>
    | Readonly<{ document?: never; initialState: InfiniteCanvasStateInput<Kind> }>
  );

function createInfiniteCanvasStore<Kind extends string = string>(
  options: InfiniteCanvasStoreOptions<Kind>,
): InfiniteCanvasStore<Kind> {
  const windowDefinitions$ = observablePrimitive<OpaqueObject<InfiniteCanvasWindowRegistry<Kind>>>(
    ObservableHint.opaque(options.windowDefinitions ?? {}),
  );
  const document =
    options.document === undefined
      ? undefined
      : canvasModel.SerializedState.assert(options.document);
  const initialState = (options.initialState ?? document) as InfiniteCanvasStateInput<Kind>;
  const baselineState = createInfiniteCanvasState(structuredClone(initialState));
  const zoomPolicy = resolveInfiniteCanvasZoomPolicy(options.zoomPolicy);
  const registeredResolvers = {
    current: [] as readonly InfiniteCanvasSpatialTargetResolver<Kind>[],
  };
  const getSelectionBounds =
    options.getSelectionBounds ??
    ((state: InfiniteCanvasState<Kind>) =>
      getInfiniteCanvasSelectionBounds({ resolvers: registeredResolvers.current, state }));
  const document$ = observable<InfiniteCanvasDocument<Kind>>({
    ...document,
    version: 4,
    activeWindowId: baselineState.activeWindowId,
    activeWorkspaceId: baselineState.activeWorkspaceId,
    camera: baselineState.camera,
    connections: baselineState.connections,
    groups: baselineState.groups,
    selection: baselineState.selection,
    windows: baselineState.windows,
    workspaces: baselineState.workspaces,
  });
  const runtime$ = observable({
    groupMetrics: baselineState.groupMetrics,
    interaction: baselineState.interaction,
    snapPreview: baselineState.snapPreview,
    viewport: baselineState.viewport,
    viewportInsets: baselineState.viewportInsets,
    viewportOccluders: baselineState.viewportOccluders,
    revealedChange: baselineState.revealedChange,
  });
  const draft$ = observable<InfiniteCanvasDocument<Kind> | undefined>(undefined);
  const camera$ = observable<InfiniteCanvasCamera | undefined>(undefined);
  const windows$ = observable(() => {
    const windows = draft$.windows.get() ?? document$.windows.get();
    const definitions = windowDefinitions$.get();
    return windows.map((window) => {
      const aspectRatio = definitions[window.kind]?.aspectRatio;
      return aspectRatio === undefined || window.aspectRatio === aspectRatio
        ? window
        : { ...window, aspectRatio };
    });
  });
  const state$ = observable(() => {
    const { version: _version, ...document } = draft$.get() ?? document$.get();
    return {
      ...document,
      windows: windows$.get(),
      ...runtime$.get(),
      camera: camera$.get() ?? document.camera,
    } as InfiniteCanvasState<Kind>;
  });
  const layout$ = observable(() =>
    getCanvasLayout({
      activeWorkspaceId: state$.activeWorkspaceId.get(),
      groupMetrics: state$.groupMetrics.get(),
      groups: state$.groups.get(),
      interaction: state$.interaction.get(),
      viewport: state$.viewport.get(),
      windows: state$.windows.get() as InfiniteCanvasState<Kind>["windows"],
      workspaces: state$.workspaces.get(),
    }),
  );
  const content$ = observable(
    linked<DocumentContent<Kind>>({
      get: () => ({
        activeWorkspaceId: document$.activeWorkspaceId.get(),
        connections: document$.connections.get(),
        groups: document$.groups.get(),
        windows: document$.windows.get() as DocumentContent<Kind>["windows"],
        workspaces: document$.workspaces.get(),
      }),
      set: ({ value }) => {
        document$.assign(value);
      },
    }),
  );
  const history = undoRedo<DocumentContent<Kind>>(content$, options.history ?? { limit: 100 });
  const persist =
    options.storageKey === undefined
      ? undefined
      : {
          name: options.storageKey,
          plugin: ObservablePersistLocalStorage,
        };
  if (options.sync !== undefined || persist !== undefined)
    syncObservable(document$, {
      ...options.sync,
      persist: options.sync?.persist ?? persist,
    });
  const camera = createCameraRig({
    getState: () => state$.peek() as InfiniteCanvasState<Kind>,
    getSelectionBounds,
    zoomPolicy,
    options: options.camera,
    write: (camera) => camera$.set(camera),
    commit: () =>
      batch(() => {
        const camera = camera$.peek();
        if (camera !== undefined) document$.camera.set(camera);
        camera$.set(undefined);
      }),
  });
  const dispatch: InfiniteCanvasDispatch<Kind> = (action, execution = {}) => {
    if (execution.signal?.aborted) return Promise.resolve("cancelled");
    const currentState = state$.peek() as InfiniteCanvasState<Kind>;
    const nextState = reduceInfiniteCanvasState<Kind>(currentState, action, {
      windowDefinitions: windowDefinitions$.peek(),
      history,
      content: content$.peek() as DocumentContent<Kind>,
      getState: () => state$.peek() as InfiniteCanvasState<Kind>,
      get selectionBounds() {
        return getSelectionBounds(currentState);
      },
      initialState: baselineState,
      snapPolicy: options.snapPolicy,
      zoomPolicy,
    });

    if (nextState !== currentState) {
      const transition = options.camera?.transition;
      const animateCamera =
        transition !== undefined &&
        transition !== false &&
        nextState.camera !== currentState.camera &&
        currentState.interaction === null &&
        nextState.interaction === null &&
        action.type !== "camera.panBy" &&
        action.type !== "camera.zoomAt";
      if (nextState.camera !== currentState.camera || nextState.interaction !== null) camera.stop();
      const document = {
        activeWindowId: nextState.activeWindowId,
        activeWorkspaceId: nextState.activeWorkspaceId,
        camera: animateCamera ? currentState.camera : nextState.camera,
        connections: nextState.connections,
        groups: nextState.groups,
        selection: nextState.selection,
        windows: nextState.windows,
        workspaces: nextState.workspaces,
      };
      batch(() => {
        runtime$.assign({
          groupMetrics: nextState.groupMetrics,
          interaction: nextState.interaction,
          snapPreview: nextState.snapPreview,
          viewport: nextState.viewport,
          viewportInsets: nextState.viewportInsets,
          viewportOccluders: nextState.viewportOccluders,
          revealedChange: nextState.revealedChange,
        });
        if (nextState.interaction === null) {
          document$.assign(document);
          draft$.set(undefined);
        } else {
          draft$.set(() => ({ ...document$.peek(), ...document }) as InfiniteCanvasDocument<Kind>);
        }
      });
      if (animateCamera)
        return action.type === "camera.navigate"
          ? camera.navigate({ ...action.request, transition, signal: execution.signal })
          : camera.animate({ camera: nextState.camera, transition, signal: execution.signal });
      camera.refresh();
    }
  };

  const contextualCommands$ = observable(() => {
    const state = state$.get() as InfiniteCanvasState<Kind>;
    return getInfiniteCanvasContextualCommands(
      state,
      options.commandDescriptors ?? DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS,
      zoomPolicy,
      getSelectionBounds(state),
      history,
      windowDefinitions$.get(),
    );
  });

  return {
    camera,
    get windowDefinitions() {
      return windowDefinitions$.get();
    },
    windowDefinitions$,
    hotkeyBindings: getInfiniteCanvasHotkeyBindings(options.commandDescriptors),
    getState: () => state$.peek() as InfiniteCanvasState<Kind>,
    snapshot: () =>
      ({ ...document$.peek(), camera: state$.camera.peek() }) as InfiniteCanvasDocument<Kind>,
    isCommandEnabled: (command) => {
      const state = state$.get() as InfiniteCanvasState<Kind>;
      return isInfiniteCanvasCommandEnabled(
        state,
        command,
        zoomPolicy,
        getSelectionBounds(state),
        history,
        windowDefinitions$.get(),
      );
    },
    getContextualCommands: ({ includeDisabled = false } = {}) => {
      const commands = contextualCommands$.get();
      return includeDisabled ? commands : commands.filter((command) => command.enabled);
    },
    document$,
    history,
    layout$,
    dispatch,
    getSelectionBounds,
    initialState: baselineState,
    setSpatialTargetResolvers: (resolvers) => {
      registeredResolvers.current = resolvers;
    },
    signals$: observable<InfiniteCanvasSignals>({ proximity: null }),
    state$,
  };
}

export { createInfiniteCanvasStore };
export type { InfiniteCanvasSignals, InfiniteCanvasStore, InfiniteCanvasStoreOptions };
