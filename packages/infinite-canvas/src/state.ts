import { type } from "arktype";
import { flatMorph, pick } from "@ark/util";
import { linked, ObservableHint, type Observable, type ObservableObject } from "@legendapp/state";
import type { undoRedo } from "@legendapp/state/helpers/undoRedo";
import { batch, model, type Model } from "./model";
import {
  centroidOfRect,
  clamp,
  containsPoint,
  containsRect,
  dist2,
  getAdjacentRect,
  getPlacementRect,
  getVacantRect,
  insetRectBy,
  panCamera,
  rectWithCentroid,
  resizeRect,
  screenToWorld,
  translateRect,
  unionRects,
  zoomCameraAbout,
  type Rect,
} from "@hyphened/math/cpu";
import { getDirectionalTarget } from "./geometry";
import { getSelection, type SelectionTarget, type TargetKey } from "./selection";
import type { WindowState } from "./document.types";
import { arrangeWindows, bindLayout, type BoundLayout } from "./layout/arrange";
import { builtinLayouts, defaultGrouping, defaultWrappers } from "./layout/builtin";
import type { Changes } from "./layout/kinds";
import {
  getDescendants,
  getDockChange,
  getParents,
  getReorderedChildren,
  getUndockChange,
  type Tree,
  type TreeChange,
} from "./layout/tree";
import { cameraNavigation } from "./camera";
import {
  componentInsertion,
  getComponentPlacement,
  placementRegion,
  windowCreation,
} from "./components";
import {
  canvasSnapshot,
  canvasStateSchema,
  containerDefinition,
  pointerInput,
  resizeHandle,
  screenRect,
  viewState,
} from "./state.schema";
import { getOwnSize, getRootRect, getWindowTree, withComputed } from "./state.computed";
import type {
  CanvasConfiguration,
  CanvasOptions,
  CanvasSnapshot,
  CanvasState,
} from "./state.types";

function decodeWindowData({
  document,
  components,
}: {
  document: CanvasSnapshot;
  components: CanvasOptions["windowDefinitions"];
}): CanvasSnapshot {
  const windows = flatMorph(document.content.windows, (id, window) => {
    const data =
      (window.kind === undefined
        ? undefined
        : components[window.kind]?.schema?.(window.data ?? {})) ?? window.data;
    if (!(data instanceof type.errors)) return [id, { ...window, data }];
    console.warn("Window data does not match its component.", {
      windowId: id,
      error: data.summary,
    });
    return [id, window];
  });
  return { ...document, content: { ...document.content, windows } };
}

type Document = Observable<CanvasSnapshot>;

const manualAxes = ({ from, to }: { from: Rect; to: Rect }) => ({
  ...(to.width === from.width ? {} : { widthMode: "manual" as const }),
  ...(to.height === from.height ? {} : { heightMode: "manual" as const }),
});

function applyChanges({
  document,
  container,
  changes,
}: {
  document: Document;
  container: string;
  changes: Changes;
}) {
  const windows = document.content.windows;
  if (changes.layout !== undefined) windows[container].layout.assign(changes.layout);
  if (changes.children !== undefined) windows[container].children.set(changes.children);
  Object.entries(changes.items ?? {}).forEach(([id, item]) => windows[id].item.assign(item));
}

function replaceTopLevel({
  document,
  from,
  to,
}: {
  document: Document;
  from: string;
  to: string | null;
}) {
  const swap = <Key extends string>(keys: readonly Key[], key: Key, next: Key | null) => {
    const replacement = next === null || keys.includes(next) ? [] : [next];
    return keys.flatMap((current) => {
      if (current !== key) return [current];
      return replacement;
    });
  };
  [document.canvasView, ...Object.values(document.workspaceViews)].forEach((view) => {
    const order = view.stackingOrder.peek();
    if (order.includes(`window:${from}`))
      view.stackingOrder.set(swap(order, `window:${from}`, to === null ? null : `window:${to}`));
  });
  Object.values(document.content.workspaces).forEach((workspace) => {
    const members = workspace.windowIds.peek();
    if (members.includes(from)) workspace.windowIds.set(swap(members, from, to));
  });
}

function applyTree({
  document,
  before,
  change,
}: {
  document: Document;
  before: Tree;
  change: TreeChange;
}) {
  const windows = document.content.windows;
  const parents = getParents(before);
  Object.entries(change.windows).forEach(([id, node]) => {
    if (node === before[id]) return;
    const window = windows[id];
    if (node.layout === undefined) window.layout.delete();
    else window.layout.set(node.layout);
    if (node.children === undefined) window.children.delete();
    else window.children.set([...node.children]);
    if (node.item === undefined) window.item.delete();
    else window.item.set(node.item);
  });
  change.dissolved.forEach(({ id, into }) => {
    if (parents[id] === undefined) {
      if (into !== null) windows[into].rect.set({ ...windows[id].rect.peek() });
      replaceTopLevel({ document, from: id, to: into });
    }
    windows[id].delete();
  });
  const next = getParents(change.windows);
  Object.keys(next).forEach((id) => {
    if (parents[id] === undefined) replaceTopLevel({ document, from: id, to: null });
  });
  const rootOf = (id: string): string => (parents[id] === undefined ? id : rootOf(parents[id]));
  Object.keys(parents)
    .filter((id) => next[id] === undefined && change.windows[id] !== undefined)
    .forEach((id) =>
      Object.values(document.content.workspaces).forEach((workspace) => {
        const members = workspace.windowIds.peek();
        if (members.includes(rootOf(id)) && !members.includes(id)) workspace.windowIds.push(id);
      }),
    );
}

export const stateModel: Model<
  CanvasOptions,
  {
    state: Observable<CanvasState>;
    computed: ObservableObject<{}>;
    actions: {};
    configuration: CanvasConfiguration;
    history: ReturnType<typeof undoRedo>;
  }
> = model({
  state: canvasStateSchema,
  initial: (options: CanvasOptions) => {
    const document = canvasSnapshot(options.document ?? {});
    return {
      config: pick(options, {
        windowDefinitions: 1,
        historyLimit: 1,
        dropThreshold: 1,
        nudge: 1,
        camera: 1,
        placement: 1,
        docking: 1,
        snapping: 1,
      }),
      input: pick(options, { viewport: 1, viewportInsets: 1, viewportOccluders: 1 }),
      document:
        document instanceof type.errors
          ? options.document
          : decodeWindowData({ document, components: options.windowDefinitions }),
    };
  },
})
  .configuration(({ windowDefinitions, cameraMotion, layouts = {}, wrappers, grouping }) => {
    const bound: Record<string, BoundLayout> = {
      ...builtinLayouts,
      ...flatMorph(layouts, (type, layout) => [type, bindLayout(layout)]),
    };
    return {
      components: windowDefinitions,
      cameraMotion,
      layouts: bound,
      wrappers: { ...defaultWrappers, ...wrappers },
      grouping: grouping ?? defaultGrouping,
    };
  })
  .history(({ state }) => ({
    state: state.document.content,
    limit: state.config.historyLimit.peek(),
  }));

export const createCanvasState = withComputed(stateModel)
  .inputs((canvas) =>
    type.module({
      existingWindow: type("string > 0").pipe((id, ctx) => {
        const window = canvas.state.document.content.windows[id];
        return window.get() === undefined ? ctx.error("an existing window") : window;
      }),
      existingWorkspace: type("string > 0").pipe((id, ctx) => {
        const workspace = canvas.state.document.content.workspaces[id];
        return workspace.get() === undefined ? ctx.error("an existing workspace") : workspace;
      }),
      containerChild: type({ container: "string > 0", child: "string > 0" }).narrow(
        ({ container, child }, ctx) => {
          const tree = canvas.computed.documentTree.get();
          const layout = canvas.configuration.layouts[tree[container]?.layout?.type ?? ""];
          return (
            (layout?.presents === "one" &&
              tree[container].children?.includes(child) === true &&
              tree[child]?.item?.hidden !== true) ||
            ctx.reject("a visible child of a window that shows one child at a time")
          );
        },
      ),
      pointer: pointerInput.narrow((pointer, ctx) => {
        const owner = canvas.computed.capturedPointerId.get();
        return owner === null || pointer.pointerId === owner || ctx.reject("the captured pointer");
      }),
      pointerOwner: type({ pointerId: "number.integer" }).narrow(
        ({ pointerId }, ctx) =>
          canvas.computed.capturedPointerId.get() === pointerId ||
          ctx.reject("the captured pointer"),
      ),
      pendingPress: type({}).pipe((_, ctx) => {
        const press = canvas.state.session.press.get();
        if (press === null) return ctx.error("a pointer press");
        const pointer = canvas.state.input.pointer.get();
        return canvas.state.session.drag.get() === null &&
          pointer?.pointerId === press.pointerId &&
          dist2([pointer.point.x, pointer.point.y], [press.point.x, press.point.y]) >=
            press.threshold
          ? press
          : ctx.error("a press past its drag threshold");
      }),
      activeTabDrag: type({}).pipe(
        (_, ctx) => canvas.state.session.tabDrag.get() ?? ctx.error("an active tab drag"),
      ),
      tabTarget: type({ child: "string > 0", after: "boolean" }).narrow(({ child }, ctx) => {
        const drag = canvas.state.session.tabDrag.get();
        return (
          (drag !== null &&
            canvas.state.document.content.windows[drag.container].children
              .get()
              ?.includes(child) === true) ||
          ctx.reject("a sibling of the dragged tab")
        );
      }),
      componentDrop: type({
        insertion: componentInsertion,
        point: { x: "number", y: "number" },
        "pointerId?": "number.integer",
        "threshold?": "number >= 0",
      }).narrow(
        ({ insertion }, ctx) =>
          canvas.configuration.components[insertion.kind]?.schema !== undefined ||
          ctx.reject("a registered component"),
      ),
      activeDrop: type({}).pipe(
        (_, ctx) => canvas.state.session.drop.get() ?? ctx.error("an active component drop"),
      ),
      dropPoint: type({ x: "number", y: "number" }).narrow(
        (_, ctx) =>
          canvas.state.session.drop.get() !== null || ctx.reject("an active component drop"),
      ),
      contentSize: type({
        windowId: "string > 0",
        size: { width: "number > 0", height: "number > 0" },
      }).narrow(
        ({ windowId }, ctx) =>
          canvas.state.document.content.windows[windowId].get() !== undefined ||
          canvas.state.session.drop.insertion.id.get() === windowId ||
          ctx.reject("a rendered window or drop preview"),
      ),
      workspace: type({ workspaceId: "string > 0 | null" }).narrow(
        ({ workspaceId }, ctx) =>
          workspaceId === null ||
          canvas.state.document.content.workspaces[workspaceId].get() !== undefined ||
          ctx.reject({ expected: "an existing workspace", path: ["workspaceId"] }),
      ),
      canUndo: type({}).narrow(
        (_, ctx) => canvas.history.undos$.get() > 0 || ctx.reject("an undoable change"),
      ),
      canRedo: type({}).narrow(
        (_, ctx) => canvas.history.redos$.get() > 0 || ctx.reject("a redoable change"),
      ),
      newWindow: windowCreation.pipe(({ id = crypto.randomUUID(), ...creation }, ctx) => {
        const input = { ...creation, id };
        if (canvas.state.document.content.windows[input.id].get() !== undefined)
          return ctx.error({ expected: "an unused window ID", path: ["id"] });
        if (
          input.target !== undefined &&
          !canvas.computed.workspaceWindows.some(
            (candidate) => candidate.id.get() === input.target?.window,
          )
        )
          return ctx.error("an insertion target in the active workspace");
        if (canvas.state.config.windowDefinitions[input.kind].get() === undefined)
          return ctx.error({ expected: "a registered window kind", path: ["kind"] });
        const schema = canvas.configuration.components[input.kind]?.schema;
        const data = schema === undefined ? input.data : schema(input.data ?? {});
        if (data instanceof type.errors) return data;
        const definition = canvas.state.config.windowDefinitions[input.kind].get();
        const center = canvas.computed.camera.center.get();
        const preferred = input.rect ?? {
          ...rectWithCentroid(center, definition.size),
          ...definition.size,
        };
        const bounds = canvas.computed.viewportRect.get();
        if (input.placement?.relativeTo !== undefined) {
          const anchor = canvas.computed.windowRect[input.placement.relativeTo].get();
          if (
            anchor === undefined ||
            !canvas.computed.windowVisible[input.placement.relativeTo].get()
          )
            return ctx.error({
              expected: "a visible placement anchor",
              path: ["placement", "relativeTo"],
            });
          const rect = getAdjacentRect({
            anchor,
            size: {
              width: input.placement.matchWidth ? anchor.width : preferred.width,
              height: preferred.height,
            },
            side: input.placement.side,
            stack: input.placement.stack,
            gap: input.placement.gap ?? canvas.state.config.placement.gap.get(),
            occupied: Object.values(canvas.computed.contentRects.get()),
            bounds,
          });
          return { ...input, data, rect };
        }
        const rect =
          input.placement === undefined || input.target !== undefined
            ? preferred
            : getVacantRect({
                ...canvas.state.config.placement.get(),
                gap: input.placement.gap ?? canvas.state.config.placement.gap.get(),
                bounds,
                occupied: Object.values(canvas.computed.occupiedRects.get()),
                preferred: getPlacementRect({
                  bounds,
                  region: input.placement.region ?? "center",
                  size: preferred,
                  minSize: definition.minSize,
                }),
              });
        return { ...input, data, rect };
      }),
    }),
  )
  .inputs((canvas) =>
    type.module({
      // oxlint-disable-next-line typescript/no-misused-spread -- ArkType supports module export spreads.
      ...canvas.inputs,
      openWindow: "newWindow",
      normalWindow: canvas.inputs.existingWindow.pipe((window, ctx) =>
        window.mode.get() === "normal" ? window : ctx.error("a normal window"),
      ),
      floatingWindow: canvas.inputs.existingWindow.pipe((window, ctx) =>
        canvas.computed.windowParent[window.id.get()].get() === undefined
          ? window
          : ctx.error("a floating window"),
      ),
      dockedWindow: canvas.inputs.existingWindow.pipe((window, ctx) =>
        canvas.computed.windowParent[window.id.get()].get() !== undefined
          ? window
          : ctx.error("a docked window"),
      ),
      containerWindow: canvas.inputs.existingWindow.pipe((window, ctx) =>
        window.layout.get() !== undefined ? window : ctx.error("a window with a layout"),
      ),
      closableWindow: canvas.inputs.existingWindow.pipe((window, ctx) =>
        canvas.computed.windowCapabilities[window.id.get()].closable.get()
          ? window
          : ctx.error("a closable window"),
      ),
      minimizableWindow: canvas.inputs.existingWindow.pipe((window, ctx) =>
        window.mode.get() !== "minimized" &&
        canvas.computed.windowCapabilities[window.id.get()].minimizable.get()
          ? window
          : ctx.error("a minimizable window"),
      ),
      sashTarget: type({ container: "string > 0", index: "number.integer >= 0" }).pipe(
        ({ container, index }, ctx) => {
          const sash = canvas.computed.arrangement[
            canvas.computed.windowRoot[container].get()
          ].controls[container]
            .get()
            ?.find((control) => control.type === "sash" && control.index === index);
          return sash?.type === "sash" ? { container, sash } : ctx.error("an existing sash");
        },
      ),
      windowData: type({ window: canvas.inputs.existingWindow, data: "unknown" }).pipe(
        ({ window, data }) => {
          const schema = canvas.configuration.components[window.kind.get() ?? ""]?.schema;
          const parsed = schema === undefined ? data : schema.out(data);
          return parsed instanceof type.errors ? parsed : { window, data: parsed };
        },
      ),
      newWorkspace: type({
        "id?": "string > 0",
        title: ["string.trim", "|>", "string > 0"],
        "windows?": canvas.inputs.existingWindow.array(),
        "activate?": "boolean",
      }).pipe(({ id = crypto.randomUUID(), ...input }, ctx) =>
        canvas.state.document.content.workspaces[id].get() === undefined
          ? { ...input, id }
          : ctx.error("an unused workspace ID"),
      ),
      windowLayout: type({ type: "string > 0", "[string]": "unknown" }).narrow((layout, ctx) => {
        const options = canvas.configuration.layouts[layout.type]?.options(layout);
        if (options === undefined) return ctx.reject("a registered layout kind");
        return (
          !(options instanceof type.errors) ||
          ctx.reject(`valid ${layout.type} options (${options.summary})`)
        );
      }),
    }),
  )
  .inputs((canvas) =>
    type.module({
      // oxlint-disable-next-line typescript/no-misused-spread -- ArkType supports module export spreads.
      ...canvas.inputs,
      newContainer: type({
        "id?": "string > 0",
        windows: canvas.inputs.existingWindow.array(),
        "title?": "string",
        "kind?": "string > 0",
        "data?": "unknown",
        "layout?": canvas.inputs.windowLayout,
        "heightMode?": "'content' | 'manual'",
        "navigable?": "boolean",
        "rect?": { x: "number", y: "number", width: "number > 0", height: "number > 0" },
      }).pipe(({ id = crypto.randomUUID(), ...container }, ctx) => {
        const input = { ...container, id };
        if (canvas.state.document.content.windows[input.id].get() !== undefined)
          return ctx.error({ expected: "an unused window ID", path: ["id"] });
        const ids = input.windows.map((window) => window.id.get());
        const tree = canvas.computed.documentTree.get();
        const descendants = new Set(ids.flatMap((id) => getDescendants({ windows: tree, id })));
        return input.windows.length > 0 &&
          input.windows.every(
            (window, index) =>
              window.mode.get() !== "minimized" &&
              canvas.computed.workspaceWindows.some(
                (candidate) => candidate.id.get() === window.id.get(),
              ) &&
              ids.indexOf(window.id.get()) === index &&
              !descendants.has(window.id.get()),
          )
          ? input
          : ctx.error({
              expected: "distinct visible workspace windows, none inside another",
              path: ["windows"],
            });
      }),
    }),
  )
  .inputs((canvas) =>
    type.module({
      // oxlint-disable-next-line typescript/no-misused-spread -- ArkType supports module export spreads.
      ...canvas.inputs,
      movableWindow: canvas.inputs.normalWindow.pipe((window, ctx) =>
        canvas.computed.windowCapabilities[window.id.get()].movable.get()
          ? window
          : ctx.error("a movable window"),
      ),
      resizableWindow: canvas.inputs.normalWindow.pipe((window, ctx) => {
        if (!canvas.computed.windowCapabilities[window.id.get()].resizable.get())
          return ctx.error("a resizable window");
        const type = canvas.computed.parentLayoutType[window.id.get()].get();
        return type === undefined || canvas.configuration.layouts[type].accepts.includes("resize")
          ? window
          : ctx.error("a floating window or a member of a layout that resizes its items");
      }),
      maximizableWindow: canvas.inputs.floatingWindow.pipe((window, ctx) =>
        window.mode.get() !== "maximized" &&
        canvas.computed.windowCapabilities[window.id.get()].maximizable.get() &&
        canvas.state.input.viewport.width.get() > 0 &&
        canvas.state.input.viewport.height.get() > 0
          ? window
          : ctx.error("a maximizable window in a measured viewport"),
      ),
      tabPress: type({
        target: canvas.inputs.containerChild,
        pointer: canvas.inputs.pointer,
        "threshold?": "number >= 0",
      }).narrow(
        ({ target }, ctx) =>
          canvas.computed.arrangement[canvas.computed.windowRoot[target.container].get()].controls[
            target.container
          ]
            .get()
            ?.some(
              (control) => control.type === "tabs" && control.children.includes(target.child),
            ) === true || ctx.reject("a tab in a tab strip"),
      ),
      dockTarget: type({
        window: canvas.inputs.floatingWindow,
        target: canvas.inputs.existingWindow,
        "edge?": "'north' | 'south' | 'east' | 'west' | 'center'",
        "wrapperId?": "string > 0",
        "rect?": { x: "number", y: "number", width: "number > 0", height: "number > 0" },
      }).pipe(({ edge = "center", wrapperId = crypto.randomUUID(), ...input }, ctx) => {
        const id = input.window.id.get();
        const targetId = input.target.id.get();
        if (canvas.state.document.content.windows[wrapperId].get() !== undefined)
          return ctx.error({ expected: "an unused wrapper ID", path: ["wrapperId"] });
        if (
          id === targetId ||
          getDescendants({ windows: canvas.computed.documentTree.get(), id }).includes(targetId)
        )
          return ctx.error("a target outside the docked window");
        const shown = (windowId: string) =>
          canvas.computed.workspaceWindows.some((window) => window.id.get() === windowId);
        return input.window.mode.get() !== "minimized" && shown(id) && shown(targetId)
          ? { ...input, edge, wrapperId }
          : ctx.error("a visible window and target in the active workspace");
      }),
      componentAction: type({
        action: "string > 0",
        windows: canvas.inputs.existingWindow.array(),
      }).pipe(({ action, windows }, ctx) => {
        if (
          windows.length === 0 ||
          new Set(windows.map((window) => window.id.get())).size !== windows.length
        )
          return ctx.error("distinct component windows");
        const updates = windows.map((window) => {
          const operation =
            canvas.configuration.components[window.kind.get() ?? ""]?.actions?.[action];
          if (operation === undefined || (windows.length > 1 && !operation.multiple))
            return new Error("The component action is unavailable for these windows.");
          const data = operation.apply(window.data.get());
          return data instanceof Error || data instanceof type.errors ? data : { window, data };
        });
        const error = updates.find(
          (update) => update instanceof Error || update instanceof type.errors,
        );
        if (error instanceof Error) return ctx.error(error.message);
        if (error instanceof type.errors) return error;
        return updates.flatMap((update) =>
          update instanceof Error || update instanceof type.errors ? [] : [update],
        );
      }),
      activeDrag: canvas.inputs.pointerOwner.pipe(
        (_, ctx) => canvas.computed.windowDrag.get() ?? ctx.error("an active window drag"),
      ),
      activeSashDrag: canvas.inputs.pointerOwner.pipe((_, ctx) => {
        const drag = canvas.state.session.drag.get();
        return drag?.kind === "sash" ? drag : ctx.error("an active sash drag");
      }),
    }),
  )
  .inputs((canvas) =>
    type.module({
      // oxlint-disable-next-line typescript/no-misused-spread -- ArkType supports module export spreads.
      ...canvas.inputs,
      pendingDrag: canvas.inputs.pendingPress.pipe((press) => {
        const window = canvas.inputs[press.handle === null ? "movableWindow" : "resizableWindow"](
          press.windowId,
        );
        return window instanceof type.errors ? window : { ...press, window };
      }),
      nudgeSelection: type({ x: "number", y: "number", "unit?": "'step' | 'largeStep'" }).pipe(
        (input, ctx) => {
          if (canvas.computed.capturedPointerId.get() !== null)
            return ctx.error("no active gesture");
          const scale = input.unit === undefined ? 1 : canvas.state.config.nudge[input.unit].get();
          const delta = { x: input.x * scale, y: input.y * scale };
          const roots = new Set(
            Object.values(canvas.computed.view.selection.targets.get()).flatMap((target) =>
              target.type === "window" ? [canvas.computed.windowRoot[target.id].get()] : [],
            ),
          );
          const windows = [...roots].flatMap((id) => {
            const window = canvas.inputs.movableWindow(id);
            return window instanceof type.errors ? [] : [window];
          });
          return windows.length > 0 ? { delta, windows } : ctx.error("a movable selection");
        },
      ),
      selectParent: type({}).pipe((_, ctx) => {
        const id = canvas.computed.view.activeWindowId.get();
        const parent = id === null ? undefined : canvas.computed.windowParent[id].get();
        return parent === undefined ? ctx.error("an active window inside a container") : { parent };
      }),
      resizeWindow: type({
        "window?": "string > 0",
        "width?": "number > 0",
        "height?": "number > 0",
        "by?": { x: "number", y: "number", "unit?": "'step' | 'largeStep'" },
      }).pipe(({ window: id = canvas.computed.view.activeWindowId.get() ?? "", by, ...size }) => {
        const window = canvas.inputs.resizableWindow(id);
        if (window instanceof type.errors) return window;
        const rect = canvas.computed.windowRect[id].get()!;
        const scale = by?.unit === undefined ? 1 : canvas.state.config.nudge[by.unit].get();
        return {
          window,
          width: Math.max(1, (size.width ?? rect.width) + (by?.x ?? 0) * scale),
          height: Math.max(1, (size.height ?? rect.height) + (by?.y ?? 0) * scale),
        };
      }),
      placeWindow: type({
        region: placementRegion,
        "window?": "string > 0",
        "padding?": "number >= 0",
      }).pipe(({ window: id = canvas.computed.view.activeWindowId.get() ?? "", ...input }, ctx) => {
        const window = canvas.inputs.resizableWindow(id);
        if (window instanceof type.errors) return window;
        const viewport = canvas.state.input.viewport.get();
        return canvas.computed.windowParent[id].get() === undefined &&
          canvas.computed.windowCapabilities[id].movable.get() &&
          viewport.width > 0 &&
          viewport.height > 0
          ? { ...input, window }
          : ctx.error("a floating, movable window in a measured viewport");
      }),
      focusDirection: type({
        direction: "'left' | 'right' | 'up' | 'down'",
        "axisBias?": "number >= 0",
      }).pipe(({ direction, axisBias }, ctx) => {
        const activeId = canvas.computed.view.activeWindowId.get();
        const active = activeId === null ? undefined : canvas.computed.windowRect[activeId].get();
        const candidates = Object.fromEntries(
          canvas.computed.workspaceWindows.flatMap((window) => {
            const id = window.id.get();
            const rect = canvas.computed.windowRect[id].get();
            return id === activeId || rect === undefined || !canvas.computed.windowVisible[id].get()
              ? []
              : [[id, rect]];
          }),
        );
        const origin = active ?? { ...canvas.computed.camera.center.get(), width: 0, height: 0 };
        return (
          getDirectionalTarget({ origin, candidates, direction, axisBias }) ??
          ctx.error("a window in that direction")
        );
      }),
      componentInsertion: componentInsertion.pipe((insertion, ctx) => {
        const result = getComponentPlacement({ canvas, insertion });
        return result instanceof Error ? ctx.error(result.message) : result;
      }),
      setWindowItem: type({
        window: canvas.inputs.dockedWindow,
        item: { "[string]": "unknown" },
      }).pipe((input, ctx) => {
        const layout = canvas.computed.parentLayoutType[input.window.id.get()].get();
        const item =
          layout === undefined ? undefined : canvas.configuration.layouts[layout].item(input.item);
        return item === undefined || item instanceof type.errors
          ? ctx.error("item properties that the parent layout accepts")
          : input;
      }),
      reorderChild: type({
        container: canvas.inputs.containerWindow,
        child: "string > 0",
        index: "number.integer >= 0",
      }).pipe((input, ctx) => {
        const children = input.container.children.get() ?? [];
        return input.index < children.length && children.includes(input.child)
          ? input
          : ctx.error("an existing child and destination index");
      }),
      pressMove: {
        window: "movableWindow",
        pointer: "pointer",
        threshold: "number >= 0",
        "undock?": "boolean",
      },
      pressResize: {
        window: "resizableWindow",
        pointer: "pointer",
        handle: resizeHandle,
        threshold: "number >= 0",
      },
      updatePointer: "pointer",
      beginSelectionMove: {
        pointerId: "number.integer",
        startPoint: { x: "number", y: "number" },
        target: "string > 0",
        "undock?": "boolean",
      },
      commitDrag: "activeDrag",
      beginSashDrag: { target: "sashTarget", pointer: "pointer" },
      commitSashDrag: "activeSashDrag",
      releasePointer: "pointerOwner",
      cancelPointer: "pointerOwner",
      cancelDrag: {},
      selectAll: {},
      clearSelection: {},
      beginPan: "pointer",
      beginMarquee: { pointer: "pointer", mode: "'replace' | 'add' | 'toggle'" },
      panCamera: { x: "number", y: "number" },
      setCamera: { "center?": { x: "number", y: "number" }, "zoom?": "number > 0" },
      zoomCamera: { factor: "number > 0", point: { x: "number", y: "number" } },
      fitAll: {},
      fitSelection: {},
      navigateCamera: cameraNavigation,
      revealWindow: [cameraNavigation.omit("target"), "&", { window: "existingWindow" }],
      stopCamera: {},
      runComponentAction: "componentAction",
      beginDrop: "componentDrop",
      updateDrop: "dropPoint",
      commitDrop: "activeDrop",
      beginTabDrag: "tabPress",
      updateTabDrag: "activeTabDrag",
      targetTab: "tabTarget",
      commitTabDrag: "activeTabDrag",
      setContentSize: "contentSize",
      setWindowData: "windowData",
      activateChild: "containerChild",
      groupWindows: "newContainer",
      dockWindow: "dockTarget",
      ungroupWindow: { window: "containerWindow", "placement?": "'keep' | 'vacancy'" },
      setWindowLayout: { window: "existingWindow", layout: "windowLayout" },
      selectTargets: {
        targets: [
          { type: "string > 0", id: "string > 0", "kind?": "string", "data?": "unknown" },
          "[]",
        ],
        "mode?": "'replace' | 'add' | 'toggle' | 'remove'",
      },
      focusWindow: { window: "existingWindow" },
      selectWindow: { window: "existingWindow" },
      renameWindow: { window: "existingWindow", title: ["string.trim", "|>", "string > 0"] },
      setWindowSizeMode: type({
        window: canvas.inputs.existingWindow,
        "widthMode?": "'viewport' | 'manual'",
        "heightMode?": "'content' | 'manual'",
        "maxSize?": { "width?": "number > 0", "height?": "number > 0" },
      }).narrow(
        (input, ctx) =>
          input.widthMode !== undefined ||
          input.heightMode !== undefined ||
          input.maxSize !== undefined ||
          ctx.mustBe("a width mode, a height mode or a maximum size"),
      ),
      setWindowNavigable: { window: "existingWindow", "navigable?": "boolean" },
      setPresentation: type({
        "axis?": "'horizontal' | 'vertical'",
        "maxZoom?": "number > 0",
      }).narrow(
        (input, ctx) =>
          input.axis !== undefined ||
          input.maxZoom !== undefined ||
          ctx.mustBe("an axis or a maximum zoom"),
      ),
      setViewportOccluder: type({ source: "string > 0", "rect?": screenRect }),
      setSnapping: type({
        "enabled?": "boolean",
        "threshold?": "number >= 0",
        "edges?": "boolean",
        "centers?": "boolean",
      }).narrow(
        (input, ctx) =>
          Object.keys(input).length > 0 || ctx.mustBe("at least one snapping setting"),
      ),
      setCameraLimits: type({
        "minZoom?": "number > 0",
        "maxZoom?": "number > 0",
        "zoomSpeed?": "number > 0",
        "padding?": "number >= 0",
      }).pipe((input, ctx) => {
        const current = canvas.state.config.camera.get();
        const limits = { ...current, ...input };
        return Object.keys(input).length === 0
          ? ctx.error("at least one camera limit")
          : limits.minZoom <= limits.maxZoom
            ? input
            : ctx.error("ordered zoom limits");
      }),
      setViewportInsets: type({
        "top?": "number >= 0",
        "right?": "number >= 0",
        "bottom?": "number >= 0",
        "left?": "number >= 0",
      }).narrow((input, ctx) => Object.keys(input).length > 0 || ctx.mustBe("at least one edge")),
      pinWindow: { window: "floatingWindow", isPinned: "boolean" },
      restoreWindow: { window: "existingWindow" },
      minimizeWindow: { window: "minimizableWindow" },
      maximizeWindow: { window: "maximizableWindow" },
      closeWindow: { window: "closableWindow" },
      undockWindow: {
        window: "dockedWindow",
        "rect?": { x: "number", y: "number", width: "number > 0", height: "number > 0" },
      },
      clearWindowViewState: { window: "existingWindow" },
      clearInvalidViewState: {},
      activateWorkspace: "workspace",
      createWorkspace: "newWorkspace",
      closeWorkspace: { workspace: "existingWorkspace" },
      renameWorkspace: {
        workspace: "existingWorkspace",
        title: ["string.trim", "|>", "string > 0"],
      },
      setWorkspaceWindows: { workspace: "existingWorkspace", windows: "existingWindow[]" },
      moveWindowsToWorkspace: { workspace: "existingWorkspace", windows: "existingWindow[]" },
      removeWorkspaceWindows: { workspace: "existingWorkspace", windows: "existingWindow[]" },
      reorderWorkspace: { workspace: "existingWorkspace", index: "number.integer >= 0" },
      undo: "canUndo",
      redo: "canRedo",
      restoreDocument: canvasSnapshot.pipe((document) =>
        decodeWindowData({ document, components: canvas.configuration.components }),
      ),
    }),
  )
  .inputs(({ inputs }) =>
    type.module({
      // oxlint-disable-next-line typescript/no-misused-spread -- ArkType supports module export spreads.
      ...inputs,
      beginDrag: "pendingDrag",
      insertComponent: "componentInsertion",
    }),
  )
  .computed((canvas) => ({
    dropPlacement: linked({
      get: () => {
        const drop = canvas.state.session.drop.get();
        if (drop === null || drop.phase === "press") return null;
        const viewport = canvas.state.input.viewport.get();
        if (
          drop.point.x < 0 ||
          drop.point.y < 0 ||
          drop.point.x > viewport.width ||
          drop.point.y > viewport.height
        )
          return null;
        const point = screenToWorld({
          point: drop.point,
          camera: canvas.computed.camera.get(),
          viewport,
        });
        const result = getComponentPlacement({ canvas, insertion: { ...drop.insertion, point } });
        return result instanceof type.errors || result instanceof Error
          ? { data: null, error: ObservableHint.opaque(result) }
          : { data: result, error: null };
      },
      initial: null,
    }),
  }))
  .computed(({ computed }) => ({
    previewWindows: () => {
      const placement = computed.dropPlacement.data.get();
      return placement == null ? {} : { [placement.window.id]: placement.window };
    },
  }))
  .camera((canvas) => ({ canvas, motion: canvas.configuration.cameraMotion }))
  .actions((canvas) => {
    const { state, computed, inputs, camera, configuration } = canvas;
    return {
      navigateCamera: type.fn(inputs.navigateCamera)((input) => camera.navigate(input)),
      stopCamera: type.fn(inputs.stopCamera)(() => camera.stop()),
      setCamera: type.fn(inputs.setCamera)((input) =>
        batch(() => {
          camera.stop();
          const current = computed.camera.peek();
          const { minZoom, maxZoom } = state.config.camera.peek();
          computed.view.camera.set({
            zoom: clamp(input.zoom ?? current.zoom, minZoom, maxZoom),
            center: input.center ?? current.center,
          });
          state.session.camera.set(null);
          state.session.pan.set(null);
        }),
      ),
      previewCamera: type.fn(inputs.setCamera)((input) =>
        batch(() => {
          camera.stop();
          const current = computed.camera.peek();
          const { minZoom, maxZoom } = state.config.camera.peek();
          state.session.camera.set({
            workspaceId: state.document.activeWorkspaceId.peek(),
            camera: {
              zoom: clamp(input.zoom ?? current.zoom, minZoom, maxZoom),
              center: input.center ?? current.center,
            },
          });
        }),
      ),
      cancelDrag: type.fn(inputs.cancelDrag)(() =>
        batch(() => {
          state.session.tabDrag.set(null);
          state.session.drop.set(null);
          state.session.drag.set(null);
          state.session.press.set(null);
          state.session.pan.set(null);
          state.session.marquee.set(null);
        }),
      ),
      pinWindow: type.fn(inputs.pinWindow)(({ window, isPinned }) => window.isPinned.set(isPinned)),
      nudgeSelection: type.fn(inputs.nudgeSelection)(({ delta, windows }) =>
        batch(() => windows.forEach(({ rect }) => rect.assign(translateRect(rect.peek(), delta)))),
      ),
      renameWindow: type.fn(inputs.renameWindow)(({ window, title }) => window.title.set(title)),
      setWindowSizeMode: type.fn(inputs.setWindowSizeMode)(({ window, ...modes }) =>
        window.assign(modes),
      ),
      setWindowNavigable: type.fn(inputs.setWindowNavigable)(({ window, navigable }) =>
        navigable === undefined ? window.navigable.delete() : window.navigable.set(navigable),
      ),
      setPresentation: type.fn(inputs.setPresentation)((presentation) =>
        state.document.content.presentation.assign(presentation),
      ),
      setViewportInsets: type.fn(inputs.setViewportInsets)((insets) =>
        state.input.viewportInsets.assign(insets),
      ),
      setSnapping: type.fn(inputs.setSnapping)((snapping) =>
        state.config.snapping.assign(snapping),
      ),
      setCameraLimits: type.fn(inputs.setCameraLimits)((limits) =>
        state.config.camera.assign(limits),
      ),
      setViewportOccluder: type.fn(inputs.setViewportOccluder)(({ source, rect }) =>
        rect === undefined
          ? state.input.viewportOccluders[source].delete()
          : state.input.viewportOccluders[source].set(rect),
      ),
      setWindowData: type.fn(inputs.setWindowData)(({ window, data }) => window.assign({ data })),
      renameWorkspace: type.fn(inputs.renameWorkspace)(({ workspace, title }) =>
        workspace.title.set(title),
      ),
      runComponentAction: type.fn(inputs.runComponentAction)((input) =>
        batch(() => input.forEach(({ window, data }) => window.assign({ data }))),
      ),
      setContentSize: type.fn(inputs.setContentSize)(({ windowId, size }) => {
        const previous = state.input.contentSizes[windowId].peek();
        if (previous?.width !== size.width || previous.height !== size.height)
          state.input.contentSizes[windowId].set(size);
      }),
      activateChild: type.fn(inputs.activateChild)((input) =>
        computed.view.activeChildren[input.container].set(input.child),
      ),
      selectTargets: type.fn(inputs.selectTargets)((input) =>
        batch(() => {
          const selection = getSelection({
            selection: computed.view.selection.peek(),
            targets: input.targets,
            mode: input.mode ?? "replace",
          });
          computed.view.selection.set(selection);
          const activeId = computed.view.activeWindowId.peek();
          if (activeId !== null && selection.targets[`window:${activeId}`] === undefined)
            computed.view.activeWindowId.set(null);
          state.session.marquee.set(null);
        }),
      ),
      focusWindow: type.fn(inputs.focusWindow)(({ window }) =>
        batch(() => {
          const id = window.id.peek();
          const parents = getParents(getWindowTree(state.document.content.windows.peek()));
          const reveal = (child: string): string => {
            const parent = parents[child];
            if (parent === undefined) return child;
            const type = state.document.content.windows[parent].layout.type.peek();
            if (type !== undefined && configuration.layouts[type]?.presents === "one")
              computed.view.activeChildren[parent].set(child);
            return reveal(parent);
          };
          const targetKey: TargetKey = `window:${reveal(id)}`;
          const order = computed.view.stackingOrder;
          const index = order.peek().indexOf(targetKey);
          if (index >= 0) order.splice(index, 1);
          order.push(targetKey);
          computed.view.activeWindowId.set(id);
        }),
      ),
      targetTab: type.fn(inputs.targetTab)((input) => {
        const drag = state.session.tabDrag.peek()!;
        const point = state.input.pointer.point.peek();
        if (point == null || input.child === drag.child) return;
        if (
          drag.target === null &&
          dist2([point.x, point.y], [drag.startPoint.x, drag.startPoint.y]) < drag.threshold
        )
          return;
        state.session.tabDrag.assign({ target: input.child, after: input.after });
      }),
      updateDrop: type.fn(inputs.updateDrop)((input) =>
        batch(() => {
          const drop = state.session.drop.peek()!;
          state.session.drop.point.set(input);
          if (
            drop.phase === "press" &&
            dist2([input.x, input.y], [drop.startPoint.x, drop.startPoint.y]) >= drop.threshold
          )
            state.session.drop.phase.set("drag");
        }),
      ),
      commitTabDrag: type.fn(inputs.commitTabDrag)((input) =>
        batch(() => {
          state.session.tabDrag.set(null);
          const container = state.document.content.windows[input.container];
          const children = container.children.peek();
          if (input.target === null || children === undefined) return;
          container.children.set(
            getReorderedChildren({
              children,
              child: input.child,
              target: input.target,
              after: input.after,
            }),
          );
        }),
      ),
      commitSashDrag: type.fn(inputs.commitSashDrag)((input) =>
        batch(() => {
          const changes =
            computed.arrangement[computed.windowRoot[input.container].peek()].changes[
              input.container
            ].peek();
          if (changes !== undefined)
            applyChanges({ document: state.document, container: input.container, changes });
          state.session.drag.set(null);
        }),
      ),
      setWindowItem: type.fn(inputs.setWindowItem)(({ window, item }) => window.item.set(item)),
      reorderChild: type.fn(inputs.reorderChild)(({ container, child, index }) =>
        container.children.set((children = []) =>
          children.filter((id) => id !== child).toSpliced(index, 0, child),
        ),
      ),
      reorderWorkspace: type.fn(inputs.reorderWorkspace)((input) =>
        batch(() => {
          const order = state.document.content.workspaceOrder;
          const id = input.workspace.id.peek();
          const index = order.peek().indexOf(id);
          if (index >= 0) order.splice(index, 1);
          order.splice(Math.min(input.index, order.length), 0, id);
        }),
      ),
      activateWorkspace: type.fn(inputs.activateWorkspace)(({ workspaceId }) =>
        batch(() => {
          if (workspaceId !== null && !state.document.workspaceViews[workspaceId].peek())
            state.document.workspaceViews[workspaceId].set(
              viewState.from({ camera: computed.view.camera.peek() }),
            );
          state.session.drag.set(null);
          state.session.press.set(null);
          state.session.pan.set(null);
          state.document.activeWorkspaceId.set(workspaceId);
          state.session.marquee.set(null);
        }),
      ),
    };
  })
  .actions(({ state, computed, inputs, actions, configuration }) => ({
    selectWindow: type.fn(inputs.selectWindow)(({ window }) =>
      batch(() => {
        const id = window.id.peek();
        const error = actions.focusWindow.run({ window: id });
        if (error !== undefined) return error;
        if (window.mode.peek() === "minimized") {
          window.rect.set(window.restoreRect.peek() ?? window.rect.peek());
          window.restoreRect.delete();
          window.mode.set("normal");
        }
        return actions.selectTargets.run({ targets: [{ type: "window", id }] });
      }),
    ),
    selectAll: type.fn(inputs.selectAll)(() =>
      actions.selectTargets.run({
        targets: computed.workspaceRoots
          .filter((window) => computed.windowVisible[window.id.peek()].peek())
          .map((window) => ({ type: "window", id: window.id.peek() })),
      }),
    ),
    clearSelection: type.fn(inputs.clearSelection)(() =>
      actions.selectTargets.run({ targets: [] }),
    ),
    cancelPointer: type.fn(inputs.cancelPointer)(() => actions.cancelDrag.run({})),
    restoreDocument: type.fn(inputs.restoreDocument)((input) =>
      batch(() => {
        const cancelled = actions.cancelDrag.run({});
        if (cancelled !== undefined) return cancelled;
        const stopped = actions.stopCamera.run({});
        if (stopped !== undefined) return stopped;
        state.input.contentSizes.set({});
        state.document.set(input);
      }),
    ),
    beginPan: type.fn(inputs.beginPan)((input) => {
      const camera = computed.camera.peek();
      return batch(() => {
        const error = actions.cancelDrag.run({});
        if (error !== undefined) return error;
        state.input.pointer.set(input);
        state.session.pan.set({ pointerId: input.pointerId, point: input.point, camera });
      });
    }),
    beginMarquee: type.fn(inputs.beginMarquee)((input) =>
      batch(() => {
        const error = actions.cancelDrag.run({});
        if (error !== undefined) return error;
        state.input.pointer.set(input.pointer);
        state.session.marquee.set({
          pointerId: input.pointer.pointerId,
          startPoint: computed.pointerWorld.peek()!,
          mode: input.mode,
          selection: {
            targets: { ...computed.view.selection.targets.peek() },
            anchor: computed.view.selection.anchor.peek(),
          },
        });
      }),
    ),
    beginDrop: type.fn(inputs.beginDrop)((input) =>
      batch(() => {
        const cancelled = actions.cancelDrag.run({});
        if (cancelled !== undefined) return cancelled;
        const stopped = actions.stopCamera.run({});
        if (stopped !== undefined) return stopped;
        state.session.drop.set({
          insertion: input.insertion,
          pointerId: input.pointerId ?? null,
          startPoint: input.point,
          point: input.point,
          threshold: input.threshold ?? state.config.dropThreshold.peek(),
          phase: input.pointerId === undefined ? "drag" : "press",
        });
      }),
    ),
    panCamera: type.fn(inputs.panCamera)((input) =>
      actions.setCamera.run(panCamera({ camera: computed.camera.peek(), screenDelta: input })),
    ),
    zoomCamera: type.fn(inputs.zoomCamera)((input) => {
      const camera = computed.camera.peek();
      const viewport = state.input.viewport.peek();
      const { minZoom, maxZoom } = state.config.camera.peek();
      const zoom = clamp(camera.zoom * input.factor, minZoom, maxZoom);
      return actions.setCamera.run(
        zoomCameraAbout({ camera, viewport, screenPoint: input.point, zoom }),
      );
    }),
    fitAll: type.fn(inputs.fitAll)(() =>
      actions.navigateCamera.run({ target: { type: "visibleWindows" }, behavior: { type: "fit" } }),
    ),
    fitSelection: type.fn(inputs.fitSelection)(() =>
      actions.navigateCamera.run({ target: { type: "selection" }, behavior: { type: "fit" } }),
    ),
    beginSashDrag: type.fn(inputs.beginSashDrag)((input) =>
      batch(() => {
        const error = actions.cancelDrag.run({});
        if (error !== undefined) return error;
        const { container, sash } = input.target;
        state.input.pointer.set(input.pointer);
        state.session.drag.set({
          kind: "sash",
          container,
          pointerId: input.pointer.pointerId,
          startPoint: computed.pointerWorld.peek()!,
          axis: sash.axis,
          index: sash.index,
          sizes: [...sash.sizes],
        });
      }),
    ),
    clearWindowViewState: type.fn(inputs.clearWindowViewState)(({ window }) =>
      batch(() => {
        const id = window.id.peek();
        const targetKey = `window:${id}` as const;
        if (
          state.session.press.windowId.peek() === id ||
          computed.dragStartRects[id].peek() !== undefined
        ) {
          const error = actions.cancelDrag.run({});
          if (error !== undefined) return error;
        }
        computed.views.forEach((view) => {
          view.selection.targets[targetKey].delete();
          if (view.selection.anchor.peek() === targetKey) view.selection.anchor.set(null);
          if (view.activeWindowId.peek() === id) view.activeWindowId.set(null);
          const index = view.stackingOrder.peek().indexOf(targetKey);
          if (index >= 0) view.stackingOrder.splice(index, 1);
        });
      }),
    ),
    clearInvalidViewState: type.fn(inputs.clearInvalidViewState)(() =>
      batch(() => {
        const windows = state.document.content.windows.peek();
        const tree = getWindowTree(state.document.content.windows.peek());
        const members = (ids: readonly string[]) =>
          ids.flatMap((id) => [id, ...getDescendants({ windows: tree, id })]);
        const views = [
          { view: state.document.canvasView, windowIds: null },
          ...Object.entries(state.document.workspaceViews).map(([id, view]) => ({
            view,
            windowIds: members(state.document.content.workspaces[id].windowIds.peek() ?? []),
          })),
        ];
        views.forEach(({ view, windowIds }) => {
          const exists = (target: SelectionTarget) =>
            target.type !== "window" ||
            (windows[target.id] !== undefined &&
              (windowIds === null || windowIds.includes(target.id)));
          const selectable = (target: SelectionTarget) =>
            exists(target) && (target.type !== "window" || windows[target.id].mode !== "minimized");
          const activeId = view.activeWindowId.peek();
          if (activeId !== null && !selectable({ type: "window", id: activeId }))
            view.activeWindowId.set(null);
          Object.values(view.selection.targets).forEach((target) => {
            if (!selectable(target.peek())) target.delete();
          });
          const anchor = view.selection.anchor.peek();
          if (anchor !== null && view.selection.targets[anchor].peek() === undefined)
            view.selection.anchor.set(null);
          const order = view.stackingOrder.peek();
          const retained = order.filter((key) => {
            const separator = key.indexOf(":");
            return exists({ type: key.slice(0, separator), id: key.slice(separator + 1) });
          });
          if (retained.length !== order.length) view.stackingOrder.set(retained);
          Object.entries(view.activeChildren.peek()).forEach(([container, child]) => {
            if (
              tree[container]?.children?.includes(child) !== true ||
              tree[child]?.item?.hidden === true
            )
              view.activeChildren[container].delete();
          });
        });
        Object.keys(state.document.workspaceViews.peek()).forEach((id) => {
          if (state.document.content.workspaces[id].peek() === undefined)
            state.document.workspaceViews[id].delete();
        });
        const activeId = state.document.activeWorkspaceId.peek();
        if (activeId !== null && state.document.content.workspaces[activeId].peek() === undefined)
          state.document.activeWorkspaceId.set(null);
        const workspaceId = state.document.activeWorkspaceId.peek();
        const live = new Set(
          workspaceId === null
            ? Object.keys(windows)
            : members(state.document.content.workspaces[workspaceId].windowIds.peek() ?? []),
        );
        const pressedWindow = state.session.press.windowId.peek();
        const tab = state.session.tabDrag.peek();
        if (tab !== null && tree[tab.container]?.children?.includes(tab.child) !== true)
          return actions.cancelDrag.run({});
        const drag = state.session.drag.peek();
        const parents = computed.parents.peek();
        const invalidMember =
          drag !== null &&
          drag.kind !== "sash" &&
          Object.entries(drag.containers).some(
            ([id, container]) =>
              !(drag.kind === "move" && drag.detached[id] !== undefined) &&
              (parents[id] !== container ||
                configuration.layouts[tree[container]?.layout?.type ?? ""]?.accepts.includes(
                  drag.kind,
                ) !== true),
          );
        if (
          invalidMember ||
          (drag?.kind === "sash" && tree[drag.container]?.children === undefined) ||
          (pressedWindow != null && !live.has(pressedWindow)) ||
          Object.keys(computed.dragStartRects.peek()).some((id) => !live.has(id))
        )
          return actions.cancelDrag.run({});
      }),
    ),
    beginSelectionMove: type.fn(inputs.beginSelectionMove)((input) => {
      const parents = computed.parents.peek();
      const rootOf = (id: string): string => (parents[id] === undefined ? id : rootOf(parents[id]));
      const undockedId = input.undock ? input.target : undefined;
      const movesAlone = (id: string) => {
        const type =
          parents[id] === undefined
            ? undefined
            : state.document.content.windows[parents[id]].layout.type.peek();
        return (
          id === undockedId ||
          type === undefined ||
          configuration.layouts[type]?.accepts.includes("move") === true
        );
      };
      const carrier = (id: string) => (movesAlone(id) ? id : rootOf(id));
      const carriers = [
        ...new Set(
          Object.values(computed.view.selection.targets.peek())
            .filter((target) => target.type === "window")
            .map((target) => carrier(target.id)),
        ),
      ].filter((id) => !(inputs.movableWindow(id) instanceof type.errors));
      const inside = (id: string, ancestor: string): boolean =>
        parents[id] !== undefined && (parents[id] === ancestor || inside(parents[id], ancestor));
      const moving = carriers.filter(
        (id) => !carriers.some((other) => other !== id && inside(id, other)),
      );
      const startRects = Object.fromEntries(
        moving.map((id) => [id, { ...computed.windowRect[id].peek()! }]),
      );
      state.session.drag.set({
        pointerId: input.pointerId,
        startPoint: input.startPoint,
        kind: "move",
        target: carrier(input.target),
        startRects,
        containers: Object.fromEntries(
          moving.flatMap((id) => (parents[id] === undefined ? [] : [[id, parents[id]]])),
        ),
        detached:
          undockedId === undefined || startRects[undockedId] === undefined
            ? {}
            : { [undockedId]: startRects[undockedId] },
        alignmentTargets: (input.undock || parents[carrier(input.target)] === undefined
          ? computed.workspaceRoots.map((window) => window.id.peek())
          : []
        ).flatMap((id) =>
          moving.some((mover) => rootOf(mover) === id || mover === id) ||
          !computed.windowVisible[id].peek()
            ? []
            : [{ ...computed.windowRect[id].peek()! }],
        ),
      });
    }),
    resizeWindow: type.fn(inputs.resizeWindow)(({ window, width, height }) =>
      batch(() => {
        const id = window.id.peek();
        const container = computed.parents[id].peek();
        if (container !== undefined) {
          const root = computed.windowRoot[id].peek();
          const { windows, limits } = computed.subtree[root].peek();
          const changes = arrangeWindows({
            id: root,
            rect: computed.rootRect[root].peek(),
            nodes: windows,
            layouts: configuration.layouts,
            limits,
            active: computed.view.activeChildren.peek(),
            operations: {
              [container]: {
                type: "resize",
                child: id,
                handle: "south-east",
                rect: { ...computed.windowRect[id].peek()!, width, height },
              },
            },
          }).changes[container];
          if (changes === undefined) return new Error("The layout prevents this resize.");
          applyChanges({ document: state.document, container, changes });
          return;
        }
        const rect = window.rect.peek();
        const resized = resizeRect({
          rect,
          handle: "south-east",
          delta: { x: width - rect.width, y: height - rect.height },
          limits: { min: computed.minSize[id].peek(), max: computed.ownSize[id].max.peek() },
          aspectRatio:
            window.aspectRatio.peek() ?? computed.windowDefinition[id].aspectRatio.peek(),
        });
        window.assign({ rect: resized, ...manualAxes({ from: rect, to: resized }) });
      }),
    ),
  }))
  .actions(({ state, computed, inputs, actions, history, configuration }) => {
    const restoreHistory = (direction: "undo" | "redo") => {
      const cancelled = actions.cancelDrag.run({});
      if (cancelled !== undefined) return cancelled;
      history[direction]();
      const error = actions.clearInvalidViewState.run({});
      if (error !== undefined) return error;
      const id = computed.view.activeWindowId.peek();
      if (id !== null) return actions.focusWindow.run({ window: id });
    };
    const roots = (windows: readonly Observable<WindowState>[]) => {
      const parents = computed.parents.peek();
      const rootOf = (id: string): string => (parents[id] === undefined ? id : rootOf(parents[id]));
      return [...new Set(windows.map((window) => rootOf(window.id.peek())))];
    };
    const undock = ({ id, rect }: { id: string; rect: Rect }) => {
      const before = getWindowTree(state.document.content.windows.peek());
      state.document.content.windows[id].rect.set(rect);
      applyTree({
        document: state.document,
        before,
        change: getUndockChange({ windows: before, layouts: configuration.layouts, window: id }),
      });
    };
    return {
      selectParent: type.fn(inputs.selectParent)(({ parent }) =>
        actions.selectWindow.run({ window: parent }),
      ),
      revealWindow: type.fn(inputs.revealWindow)(({ window, ...navigation }) => {
        const windowId = window.id.peek();
        const error = actions.selectWindow.run({ window: windowId });
        if (error !== undefined) return error;
        const rect = computed.windowRect[windowId].peek();
        if (rect !== undefined && containsRect(computed.viewportRect.peek(), rect)) return;
        return actions.navigateCamera.run({ ...navigation, target: { type: "window", windowId } });
      }),
      placeWindow: type.fn(inputs.placeWindow)(({ window, region, padding }) =>
        batch(() => {
          const id = window.id.peek();
          const definition = computed.windowDefinition[id].peek();
          const inset = (padding ?? definition.maximizePadding) / computed.camera.zoom.peek();
          const view = computed.viewportRect.peek();
          window.assign({
            heightMode: "manual",
            widthMode: "manual",
            rect: getPlacementRect({
              region,
              size: window.rect.peek(),
              minSize: window.minSize.peek() ?? definition.minSize,
              bounds: insetRectBy(view, inset),
            }),
          });
          return actions.selectWindow.run({ window: id });
        }),
      ),
      focusDirection: type.fn(inputs.focusDirection)((windowId) => {
        const error = actions.selectWindow.run({ window: windowId });
        if (error !== undefined) return error;
        const rect = computed.windowRect[windowId].peek()!;
        const view = computed.viewportRect.peek();
        if (!containsRect(view, rect))
          return actions.navigateCamera.run({ target: { type: "window", windowId } });
      }),
      undo: type.fn(inputs.undo)(() => restoreHistory("undo")),
      redo: type.fn(inputs.redo)(() => restoreHistory("redo")),
      beginDrag: type.fn(inputs.beginDrag)((input) => {
        const id = input.window.id.peek();
        if (input.handle === null)
          return actions.beginSelectionMove.run({
            pointerId: input.pointerId,
            startPoint: input.worldPoint,
            target: id,
            undock: input.undock,
          });
        const container = computed.parents[id].peek();
        state.session.drag.set({
          pointerId: input.pointerId,
          startPoint: input.worldPoint,
          startRects: { [id]: { ...computed.windowRect[id].peek()! } },
          containers: container === undefined ? {} : { [id]: container },
          kind: "resize",
          handle: input.handle,
        });
      }),
      commitDrag: type.fn(inputs.commitDrag)((input) =>
        batch(() => {
          const roots = [
            ...new Set(
              Object.values(input.containers).map((container) =>
                computed.windowRoot[container].peek(),
              ),
            ),
          ];
          const changes = roots.flatMap((root) =>
            Object.entries(computed.baseArrangement[root].changes.peek() ?? {}),
          );
          const rectangles = Object.fromEntries(
            computed.draggedWindows.map((window) => [
              window.id.peek(),
              computed.windowRect[window.id.peek()].peek()!,
            ]),
          );
          changes.forEach(([container, change]) =>
            applyChanges({ document: state.document, container, changes: change }),
          );
          computed.draggedWindows.forEach((window) => {
            const id = window.id.peek();
            const rect = rectangles[id];
            if (input.containers[id] !== undefined) {
              if (input.kind === "resize") {
                window.assign({ rect, ...manualAxes({ from: input.startRects[id]!, to: rect }) });
                return;
              }
              if (input.kind !== "move" || input.detached[id] === undefined) return;
              const before = getWindowTree(state.document.content.windows.peek());
              applyTree({
                document: state.document,
                before,
                change: getUndockChange({
                  windows: before,
                  layouts: configuration.layouts,
                  window: id,
                }),
              });
              window.rect.set(rect);
              return;
            }
            if (input.kind === "move") window.rect.assign({ x: rect.x, y: rect.y });
            else window.assign({ rect, ...manualAxes({ from: input.startRects[id]!, to: rect }) });
          });
          state.session.drag.set(null);
          state.session.press.set(null);
          if (input.kind === "move" && input.detached[input.target] !== undefined) {
            const error = actions.focusWindow.run({ window: input.target });
            if (error !== undefined) return error;
          }
          return actions.clearInvalidViewState.run({});
        }),
      ),
      ungroupWindow: type.fn(inputs.ungroupWindow)(({ window, placement }) =>
        batch(() => {
          const id = window.id.peek();
          const children = window.children.peek() ?? [];
          const options = state.config.placement.peek();
          const occupied = Object.entries(computed.occupiedRects.peek())
            .filter(([key]) => key !== `window:${computed.windowRoot[id].peek()}`)
            .map(([, rect]) => rect);
          const bounds = computed.viewportRect.peek();
          const windows = children.map((id) => ({ id, rect: computed.windowRect[id].peek()! }));
          windows.forEach(({ id, rect: preferred }) => {
            const rect =
              (placement ?? options.dissolve) === "keep"
                ? preferred
                : getVacantRect({ ...options, bounds, preferred, occupied });
            occupied.push(rect);
            undock({ id, rect });
          });
          return actions.clearInvalidViewState.run({});
        }),
      ),
      undockWindow: type.fn(inputs.undockWindow)(({ window, rect }) =>
        batch(() => {
          const id = window.id.peek();
          const currentRect = computed.windowRect[id].peek()!;
          const options = state.config.placement.peek();
          const placed =
            options.undock === "keep"
              ? currentRect
              : getVacantRect({
                  ...options,
                  bounds: computed.viewportRect.peek(),
                  preferred: currentRect,
                  occupied: Object.entries(computed.occupiedRects.peek())
                    .filter(([key]) => key !== `window:${id}`)
                    .map(([, rect]) => rect),
                });
          undock({ id, rect: rect ?? placed });
          return actions.clearInvalidViewState.run({});
        }),
      ),
      setWindowLayout: type.fn(inputs.setWindowLayout)(({ window, layout }) =>
        batch(() => {
          window.layout.set(layout);
          if (window.children.peek() === undefined) window.children.set([]);
          return actions.clearInvalidViewState.run({});
        }),
      ),
      closeWindow: type.fn(inputs.closeWindow)(({ window }) =>
        batch(() => {
          const id = window.id.peek();
          const closing = [
            id,
            ...getDescendants({
              windows: getWindowTree(state.document.content.windows.peek()),
              id,
            }),
          ];
          const errors = closing.map((closed) =>
            actions.clearWindowViewState.run({ window: closed }),
          );
          const error = errors.find((result) => result !== undefined);
          if (error !== undefined) return error;
          if (computed.parents[id].peek() !== undefined) undock({ id, rect: window.rect.peek() });
          closing.forEach((closed) => {
            computed.connections.forEach((connection) => {
              if (connection.from.peek() === closed || connection.to.peek() === closed)
                connection.delete();
            });
            computed.workspaces.forEach((workspace) => {
              const index = workspace.windowIds.peek().indexOf(closed);
              if (index >= 0) workspace.windowIds.splice(index, 1);
            });
            state.document.content.windows[closed].delete();
            state.input.contentSizes[closed].delete();
          });
          return actions.clearInvalidViewState.run({});
        }),
      ),
      minimizeWindow: type.fn(inputs.minimizeWindow)(({ window }) =>
        batch(() => {
          const error = actions.clearWindowViewState.run({ window: window.id.peek() });
          if (error !== undefined) return error;
          window.mode.set("minimized");
        }),
      ),
      maximizeWindow: type.fn(inputs.maximizeWindow)(({ window }) =>
        batch(() => {
          const error = actions.cancelDrag.run({});
          if (error !== undefined) return error;
          const viewport = computed.viewportRect.peek();
          const definition = computed.windowDefinition[window.id.peek()].peek();
          const padding = definition.maximizePadding / computed.camera.zoom.peek();
          const minSize = window.minSize.peek() ?? definition.minSize;
          const inner = insetRectBy(viewport, padding);
          const width = Math.max(minSize.width, inner.width);
          const height = Math.max(minSize.height, inner.height);
          window.assign({
            restoreRect: window.restoreRect.peek() ?? window.rect.peek(),
            mode: "maximized",
            rect: {
              ...rectWithCentroid(centroidOfRect(viewport), { width, height }),
            },
          });
          return actions.selectWindow.run({ window: window.id.peek() });
        }),
      ),
      restoreWindow: type.fn(inputs.restoreWindow)(({ window }) =>
        batch(() => {
          window.rect.set(window.restoreRect.peek() ?? window.rect.peek());
          window.restoreRect.delete();
          window.mode.set("normal");
          return actions.selectWindow.run({ window: window.id.peek() });
        }),
      ),
      createWorkspace: type.fn(inputs.createWorkspace)((input) =>
        batch(() => {
          const windowIds = roots(input.windows ?? []);
          state.document.content.workspaces[input.id].set({
            id: input.id,
            title: input.title,
            windowIds,
          });
          state.document.content.workspaceOrder.push(input.id);
          state.document.workspaceViews[input.id].set(
            viewState.from({ camera: computed.view.camera.peek() }),
          );
          if (input.activate !== false)
            return actions.activateWorkspace.run({ workspaceId: input.id });
        }),
      ),
      closeWorkspace: type.fn(inputs.closeWorkspace)(({ workspace }) =>
        batch(() => {
          const id = workspace.id.peek();
          if (state.document.activeWorkspaceId.peek() === id) {
            const error = actions.activateWorkspace.run({ workspaceId: null });
            if (error !== undefined) return error;
          }
          state.document.workspaceViews[id].delete();
          const index = state.document.content.workspaceOrder.peek().indexOf(id);
          if (index >= 0) state.document.content.workspaceOrder.splice(index, 1);
          workspace.delete();
        }),
      ),
      setWorkspaceWindows: type.fn(inputs.setWorkspaceWindows)((input) =>
        batch(() => {
          input.workspace.windowIds.set(roots(input.windows));
          return actions.clearInvalidViewState.run({});
        }),
      ),
      moveWindowsToWorkspace: type.fn(inputs.moveWindowsToWorkspace)((input) =>
        batch(() => {
          const moving = new Set(roots(input.windows));
          const destinationId = input.workspace.id.peek();
          computed.workspaces.forEach((workspace) => {
            const current = workspace.windowIds.peek();
            if (workspace.id.peek() === destinationId) {
              const existing = new Set(current);
              const missing = [...moving].filter((id) => !existing.has(id));
              if (missing.length > 0) workspace.windowIds.push(...missing);
            } else {
              const retained = current.filter((id) => !moving.has(id));
              if (retained.length !== current.length) workspace.windowIds.set(retained);
            }
          });
          return actions.clearInvalidViewState.run({});
        }),
      ),
      removeWorkspaceWindows: type.fn(inputs.removeWorkspaceWindows)((input) =>
        batch(() => {
          const removed = new Set(roots(input.windows));
          input.workspace.windowIds.set(
            input.workspace.windowIds.peek().filter((id) => !removed.has(id)),
          );
          return actions.clearInvalidViewState.run({});
        }),
      ),
    };
  })
  .actions(({ state, computed, inputs, actions, configuration }) => {
    const container = (input: {
      id: string;
      rect: Rect;
      title?: string;
      kind?: string;
      data?: unknown;
    }): WindowState => {
      const existing = state.document.content.windows[input.id].peek();
      return {
        ...input,
        title: input.title ?? "",
        mode: "normal",
        isPinned: false,
        heightMode: existing?.heightMode ?? "manual",
        widthMode: existing?.widthMode ?? "manual",
      };
    };
    const placeByRect = ({ parent, rects }: { parent: string; rects: Record<string, Rect> }) => {
      const records = state.document.content.windows.peek();
      const nodes = getWindowTree(records);
      const parents = getParents(nodes);
      const rootOf = (id: string): string => (parents[id] === undefined ? id : rootOf(parents[id]));
      const root = rootOf(parent);
      const own = (id: string) =>
        getOwnSize({
          window: records[id],
          measured: state.input.contentSizes[id].peek(),
          definition:
            state.config.windowDefinitions[records[id].kind ?? ""].peek() ?? containerDefinition,
        });
      const limits = Object.fromEntries(
        [root, ...getDescendants({ windows: nodes, id: root })].map((id) => [id, own(id)]),
      );
      const changes = arrangeWindows({
        id: root,
        rect: getRootRect({
          rect: records[root].rect,
          widthMode: records[root].widthMode,
          dragged: undefined,
          viewportWidth: computed.viewportWidth.peek(),
          maxWidth: own(root).max.width,
        }),
        nodes,
        layouts: configuration.layouts,
        limits,
        active: computed.view.activeChildren.peek(),
        operations: { [parent]: { type: "move", rects } },
      }).changes[parent];
      if (changes !== undefined)
        applyChanges({ document: state.document, container: parent, changes });
    };
    return {
      groupWindows: type.fn(inputs.groupWindows)((input) =>
        batch(() => {
          const rects = Object.fromEntries(
            input.windows.map((window) => [
              window.id.peek(),
              { ...computed.windowRect[window.id.peek()].peek()! },
            ]),
          );
          input.windows.forEach((window) => {
            const id = window.id.peek();
            const before = getWindowTree(state.document.content.windows.peek());
            if (getParents(before)[id] !== undefined)
              applyTree({
                document: state.document,
                before,
                change: getUndockChange({
                  windows: before,
                  layouts: configuration.layouts,
                  window: id,
                }),
              });
            window.assign({ mode: "normal", rect: rects[id] });
            window.restoreRect.delete();
            window.item.delete();
          });
          const children = input.windows.map((window) => window.id.peek());
          state.document.content.windows[input.id].set({
            ...container({
              id: input.id,
              rect: input.rect ?? unionRects(Object.values(rects))!,
              title: input.title,
              ...(input.kind === undefined ? {} : { kind: input.kind, data: input.data }),
            }),
            layout: input.layout ?? configuration.grouping,
            children,
            ...(input.heightMode === undefined ? {} : { heightMode: input.heightMode }),
            ...(input.navigable === undefined ? {} : { navigable: input.navigable }),
          });
          children.forEach((child) =>
            replaceTopLevel({ document: state.document, from: child, to: input.id }),
          );
          const workspaceId = state.document.activeWorkspaceId.peek();
          const members =
            workspaceId === null
              ? undefined
              : state.document.content.workspaces[workspaceId].windowIds;
          if (members !== undefined && !members.peek().includes(input.id)) members.push(input.id);
          placeByRect({ parent: input.id, rects });
          return actions.selectWindow.run({ window: input.id });
        }),
      ),
      dockWindow: type.fn(inputs.dockWindow)(({ window, target, edge, wrapperId, rect }) =>
        batch(() => {
          const id = window.id.peek();
          const targetId = target.id.peek();
          const before = getWindowTree(state.document.content.windows.peek());
          const change = getDockChange({
            windows: before,
            layouts: configuration.layouts,
            window: id,
            target: targetId,
            edge,
            wrapper: { id: wrapperId, layout: configuration.wrappers[edge] },
          });
          const dropped = rect ?? { ...computed.windowRect[id].peek()! };
          if (change.wrapper !== undefined) {
            state.document.content.windows[wrapperId].set(
              container({ id: wrapperId, rect: { ...computed.windowRect[targetId].peek()! } }),
            );
            if (computed.parents[targetId].peek() === undefined)
              replaceTopLevel({ document: state.document, from: targetId, to: wrapperId });
          }
          applyTree({ document: state.document, before, change });
          window.mode.set("normal");
          window.restoreRect.delete();
          const parent = getParents(change.windows)[id];
          if (parent !== undefined) placeByRect({ parent, rects: { [id]: dropped } });
          return actions.selectWindow.run({ window: id });
        }),
      ),
      pressMove: type.fn(inputs.pressMove)((input) =>
        batch(() => {
          const cancelled = actions.cancelDrag.run({});
          if (cancelled !== undefined) return cancelled;
          const id = input.window.id.peek();
          const targetKey = `window:${id}` as const;
          if (input.pointer.shiftKey || input.pointer.ctrlKey || input.pointer.metaKey) {
            const selected = actions.selectTargets.run({
              targets: [{ type: "window", id }],
              mode: input.pointer.ctrlKey || input.pointer.metaKey ? "toggle" : "add",
            });
            if (selected !== undefined) return selected;
            if (computed.view.selection.targets[targetKey].peek() === undefined) return;
          }
          const select =
            computed.view.selection.targets[targetKey].peek() === undefined
              ? actions.selectWindow
              : actions.focusWindow;
          const selected = select.run({ window: id });
          if (selected !== undefined) return selected;
          state.input.pointer.set(input.pointer);
          state.session.press.set({
            undock: input.undock ?? false,
            additive: input.pointer.shiftKey || input.pointer.ctrlKey || input.pointer.metaKey,
            windowId: id,
            pointerId: input.pointer.pointerId,
            point: input.pointer.point,
            worldPoint: computed.pointerWorld.peek()!,
            threshold: input.threshold,
            handle: null,
          });
          if (actions.beginDrag.canRun({})) return actions.beginDrag.run({});
        }),
      ),
      pressResize: type.fn(inputs.pressResize)((input) =>
        batch(() => {
          const cancelled = actions.cancelDrag.run({});
          if (cancelled !== undefined) return cancelled;
          const id = input.window.id.peek();
          const selected = actions.selectWindow.run({ window: id });
          if (selected !== undefined) return selected;
          state.input.pointer.set(input.pointer);
          state.session.press.set({
            undock: false,
            additive: false,
            windowId: id,
            pointerId: input.pointer.pointerId,
            point: input.pointer.point,
            worldPoint: computed.pointerWorld.peek()!,
            threshold: input.threshold,
            handle: input.handle,
          });
          if (actions.beginDrag.canRun({})) return actions.beginDrag.run({});
        }),
      ),
      beginTabDrag: type.fn(inputs.beginTabDrag)((input) =>
        batch(() => {
          const cancelled = actions.cancelDrag.run({});
          if (cancelled !== undefined) return cancelled;
          const stopped = actions.stopCamera.run({});
          if (stopped !== undefined) return stopped;
          const activated = actions.activateChild.run(input.target);
          if (activated !== undefined) return activated;
          state.input.pointer.set(input.pointer);
          state.session.tabDrag.set({
            ...input.target,
            pointerId: input.pointer.pointerId,
            startPoint: input.pointer.point,
            threshold: input.threshold ?? state.config.dropThreshold.peek(),
            target: null,
            after: false,
          });
        }),
      ),
      updateTabDrag: type.fn(inputs.updateTabDrag)((input) =>
        batch(() => {
          const point = state.input.pointer.point.peek();
          if (
            point == null ||
            (input.target === null &&
              dist2([point.x, point.y], [input.startPoint.x, input.startPoint.y]) < input.threshold)
          )
            return;
          const inside = computed.tabDragInside.peek();
          if (inside === null) return actions.cancelDrag.run({});
          const worldPoint = computed.pointerWorld.peek();
          if (worldPoint === null || inside) return;
          if (inputs.movableWindow(input.child) instanceof type.errors) return;
          const cancelled = actions.cancelDrag.run({});
          if (cancelled !== undefined) return cancelled;
          const selected = actions.selectWindow.run({ window: input.child });
          if (selected !== undefined) return selected;
          return actions.beginSelectionMove.run({
            pointerId: input.pointerId,
            startPoint: worldPoint,
            target: input.child,
            undock: true,
          });
        }),
      ),
    };
  })
  .actions(({ state, computed, inputs, actions }) => ({
    openWindow: type.fn(inputs.openWindow)((input) =>
      batch(() => {
        state.document.content.windows[input.id].set({
          id: input.id,
          kind: input.kind,
          title: input.title,
          data: input.data,
          rect: input.rect,
          mode: "normal",
          isPinned: false,
          heightMode: input.heightMode ?? "content",
          widthMode: "manual",
        });
        const workspaceId = state.document.activeWorkspaceId.peek();
        if (workspaceId !== null)
          state.document.content.workspaces[workspaceId].windowIds.push(input.id);
        if (input.target !== undefined)
          return actions.dockWindow.run({
            window: input.id,
            target: input.target.window,
            ...(input.target.edge === undefined ? {} : { edge: input.target.edge }),
            rect: input.rect,
          });
        return actions.selectWindow.run({ window: input.id });
      }),
    ),
    updatePointer: type.fn(inputs.updatePointer)((input) => {
      state.input.pointer.set(input);
      if (state.session.tabDrag.peek() !== null) return actions.updateTabDrag.run({});
      if (state.session.drop.pointerId.peek() === input.pointerId)
        return actions.updateDrop.run(input.point);
      if (actions.beginDrag.canRun({})) {
        const error = actions.beginDrag.run({});
        if (error !== undefined) return error;
      }
      const drag = state.session.drag.peek();
      if (
        drag?.kind !== "move" ||
        drag.detached[drag.target] !== undefined ||
        drag.containers[drag.target] === undefined
      )
        return;
      const root = computed.windowRoot[drag.target].peek();
      const bounds = computed.baseArrangement[root].rects[root].peek();
      const rect = computed.dragRect[drag.target].peek();
      if (
        bounds !== undefined &&
        rect !== undefined &&
        !containsPoint(bounds, centroidOfRect(rect))
      )
        state.session.drag.assign({ detached: { ...drag.detached, [drag.target]: rect } });
    }),
  }))
  .actions(({ inputs, actions }) => ({
    insertComponent: type.fn(inputs.insertComponent)((input) =>
      actions.openWindow.run(input.input),
    ),
  }))
  .actions(({ state, computed, inputs, actions }) => ({
    commitDrop: type.fn(inputs.commitDrop)((input) =>
      batch(() => {
        const result = input.phase === "press" ? null : computed.dropPlacement.peek();
        state.session.drop.set(null);
        if (input.phase === "press") return actions.insertComponent.run(input.insertion);
        if (result === null) return;
        return result.error === null ? actions.openWindow.run(result.data.input) : result.error;
      }),
    ),
  }))
  .actions(({ state, computed, inputs, actions }) => ({
    releasePointer: type.fn(inputs.releasePointer)((input) => {
      if (state.session.tabDrag.peek() !== null) return actions.commitTabDrag.run({});
      if (state.session.drop.peek() !== null) return actions.commitDrop.run({});
      if (state.session.marquee.peek() !== null)
        return batch(() => {
          computed.view.selection.set(computed.selection.peek());
          state.session.marquee.set(null);
        });
      if (actions.commitDrag.canRun(input))
        return batch(() => {
          const drop = computed.dockDrop.peek();
          const error = actions.commitDrag.run(input);
          if (error !== undefined) return error;
          return drop === null
            ? undefined
            : actions.dockWindow.run({
                window: drop.window,
                target: drop.target,
                edge: drop.edge,
                rect: drop.rect,
              });
        });
      if (actions.commitSashDrag.canRun(input)) return actions.commitSashDrag.run(input);
      const camera = computed.camera.peek();
      const press = state.session.press.peek();
      const collapses =
        press !== null &&
        press.pointerId === input.pointerId &&
        press.handle === null &&
        !press.additive &&
        computed.selectedWindows.length > 1;
      return batch(() => {
        computed.view.camera.set(camera);
        if (collapses) {
          const selected = actions.selectWindow.run({ window: press.windowId });
          if (selected !== undefined) return selected;
        }
        return actions.cancelDrag.run({});
      });
    }),
  }))
  .commands(({ actions }) => ({
    selectAll: { action: actions.selectAll, label: "Select all", icon: "select", surface: "view" },
    clearSelection: {
      action: actions.clearSelection,
      label: "Clear selection",
      icon: "select",
      surface: "view",
    },
    restoreDocument: {
      action: actions.restoreDocument,
      label: "Restore document",
      description: "Replace every window, connection and workspace with the document given",
      icon: "reset",
      surface: "none",
    },
    insertComponent: { action: actions.insertComponent, label: "Add component", icon: "add" },
    runComponentAction: {
      action: actions.runComponentAction,
      label: "Run component action",
      icon: "edit",
    },
    navigateCamera: { action: actions.navigateCamera, label: "Navigate camera", icon: "focus" },
    stopCamera: {
      action: actions.stopCamera,
      label: "Stop camera",
      icon: "stop",
      surface: "none",
    },
    setCamera: {
      action: actions.setCamera,
      label: "Set camera",
      description: "Commit the camera to the document, where it is saved and undone",
      icon: "focus",
      surface: "none",
    },
    previewCamera: {
      action: actions.previewCamera,
      label: "Preview camera",
      description:
        "Move the camera for this session only; the next commit or scroll frame replaces it, and it never reaches the document",
      icon: "focus",
      surface: "none",
    },
    openWindow: { action: actions.openWindow, label: "Open window", icon: "add" },
    setWindowData: { action: actions.setWindowData, label: "Set window data", icon: "edit" },
    activateChild: {
      action: actions.activateChild,
      label: "Show child",
      description: "Bring one child of a tabbed or collapsed container to the front",
      icon: "focus",
      surface: "view",
    },
    groupWindows: { action: actions.groupWindows, label: "Group windows", icon: "group" },
    dockWindow: { action: actions.dockWindow, label: "Dock window", icon: "dock" },
    ungroupWindow: { action: actions.ungroupWindow, label: "Ungroup windows", icon: "ungroup" },
    setWindowLayout: {
      action: actions.setWindowLayout,
      label: "Set layout",
      description: "How the window arranges its children",
      scope: "selection",
      icon: "layout",
    },
    setWindowItem: {
      action: actions.setWindowItem,
      label: "Set placement",
      description: "Where the window sits in its container's layout",
      scope: "selection",
      icon: "resize",
    },
    reorderChild: {
      action: actions.reorderChild,
      label: "Reorder child",
      icon: "reorder",
      scope: "selection",
    },
    fitAll: { action: actions.fitAll, label: "Fit all windows", icon: "fit", surface: "view" },
    fitSelection: {
      action: actions.fitSelection,
      label: "Fit selection",
      icon: "fit",
      surface: "view",
    },
    pinWindow: { action: actions.pinWindow, label: "Pin window", icon: "pin" },
    nudgeSelection: { action: actions.nudgeSelection, label: "Nudge selection", icon: "move" },
    renameWindow: { action: actions.renameWindow, label: "Rename window", icon: "rename" },
    setWindowSizeMode: {
      action: actions.setWindowSizeMode,
      label: "Set sizing",
      description: "Follow the viewport width, grow with the content, or stop at a maximum size",
      scope: "selection",
      icon: "resize",
    },
    setWindowNavigable: {
      action: actions.setWindowNavigable,
      label: "Set navigation",
      description: "Include the window in navigation, or restore its component default",
      icon: "section",
    },
    setPresentation: {
      action: actions.setPresentation,
      label: "Set route",
      description: "Set the navigation axis and maximum zoom",
      scope: "canvas",
      icon: "section",
    },
    setSnapping: {
      action: actions.setSnapping,
      label: "Set snapping",
      description: "Whether dragging snaps to the edges and centres of other windows",
      scope: "canvas",
      icon: "move",
    },
    setCameraLimits: {
      action: actions.setCameraLimits,
      label: "Set camera limits",
      description: "How far the camera may zoom, how fast the wheel zooms, and the fit padding",
      scope: "canvas",
      icon: "fit",
    },
    focusWindow: {
      action: actions.selectWindow,
      label: "Focus window",
      icon: "focus",
      surface: "view",
    },
    selectParent: {
      action: actions.selectParent,
      label: "Select parent",
      icon: "focus",
      surface: "view",
    },
    revealWindow: {
      action: actions.revealWindow,
      label: "Reveal window",
      icon: "focus",
      surface: "view",
    },
    placeWindow: { action: actions.placeWindow, label: "Place window", icon: "layout" },
    focusDirection: {
      action: actions.focusDirection,
      label: "Focus nearest window",
      icon: "focus",
      surface: "view",
    },
    resizeWindow: { action: actions.resizeWindow, label: "Resize window", icon: "resize" },
    restoreWindow: { action: actions.restoreWindow, label: "Restore window", icon: "restore" },
    minimizeWindow: { action: actions.minimizeWindow, label: "Minimize window", icon: "minimize" },
    maximizeWindow: { action: actions.maximizeWindow, label: "Maximize window", icon: "maximize" },
    closeWindow: { action: actions.closeWindow, label: "Close window", icon: "close" },
    undockWindow: { action: actions.undockWindow, label: "Undock window", icon: "undock" },
    activateWorkspace: {
      action: actions.activateWorkspace,
      label: "Switch workspace",
      icon: "workspace",
      surface: "view",
    },
    createWorkspace: { action: actions.createWorkspace, label: "Create workspace", icon: "add" },
    closeWorkspace: { action: actions.closeWorkspace, label: "Close workspace", icon: "close" },
    renameWorkspace: { action: actions.renameWorkspace, label: "Rename workspace", icon: "rename" },
    setWorkspaceWindows: {
      action: actions.setWorkspaceWindows,
      label: "Set workspace windows",
      icon: "workspace",
    },
    moveWindowsToWorkspace: {
      action: actions.moveWindowsToWorkspace,
      label: "Move windows to workspace",
      icon: "workspace",
    },
    removeWorkspaceWindows: {
      action: actions.removeWorkspaceWindows,
      label: "Remove windows from workspace",
      icon: "remove",
    },
    reorderWorkspace: {
      action: actions.reorderWorkspace,
      label: "Reorder workspace",
      icon: "reorder",
    },
    undo: { action: actions.undo, label: "Undo", icon: "undo" },
    redo: { action: actions.redo, label: "Redo", icon: "redo" },
  }))
  .activate((canvas) => {
    ObservableHint.opaque(canvas);
    canvas.state.document.activeWorkspaceId.onChange(() => {
      const error = canvas.actions.cancelDrag.run({});
      if (error !== undefined) console.warn("Workspace gesture cancellation failed.", error);
    });
  }).create;

export function documentTransform(canvas: ReturnType<typeof createCanvasState>) {
  return {
    load: (value: unknown): CanvasSnapshot => {
      const document = canvas.inputs.restoreDocument(value);
      if (!(document instanceof type.errors)) return document;
      console.warn("The saved canvas document is invalid and was not loaded.", {
        error: document.summary,
      });
      return canvas.state.document.peek();
    },
  };
}
