import { fromEntries } from "@ark/util";
import { linked } from "@legendapp/state";
import { type } from "arktype";
import { compareByKey } from "@thi.ng/compare";
import {
  areaOfRect,
  clamp,
  containsPoint,
  intersectsRect,
  outsetRectBy,
  rectFromCorners,
  rectWithCentroid,
  resizeRect,
  screenToWorld,
  translateRect,
  unionRects,
  visibleWorldRect,
  type Rect,
  type Size,
} from "@hyphened/math/cpu";
import type { WindowState } from "./document.types";
import type { WindowDefinition } from "./state.types";
import { getDockArrangement, type DockDrop } from "./layout/dock";
import type { SizeLimits } from "./layout/arrange";
import { getSelection, type SelectionTarget, type TargetKey } from "./selection";
import { arrangeWindows, getLimitedSizes, getWindowSize } from "./layout/arrange";
import type { Operation } from "./layout/kinds";
import {
  getDescendants,
  getDockEdge,
  getParents,
  getReorderedChildren,
  getUndockChange,
  type Tree,
  type TreeChange,
} from "./layout/tree";
import { combineInsets, insetsOfOccluder, type ViewportInsets } from "./camera";
import { getRoute, type Section } from "./route";
import { containerDefinition } from "./state.schema";
import type { stateModel } from "./state";
import { alignRect, type AlignmentGuide } from "./alignment";

export function getWindowTree(
  windows: Readonly<
    Record<string, Pick<WindowState, "id" | "kind" | "layout" | "children" | "item">>
  >,
): Tree {
  return fromEntries(
    Object.values(windows).map(({ id, kind, layout, children, item }) => [
      id,
      structuredClone({
        ...(kind === undefined ? {} : { kind }),
        ...(layout === undefined ? {} : { layout }),
        ...(children === undefined ? {} : { children }),
        ...(item === undefined ? {} : { item }),
      }),
    ]),
  );
}

export function getOwnSize({
  window,
  definition,
  measured,
}: {
  window: WindowState | undefined;
  definition: Pick<WindowDefinition, "minSize" | "maxSize" | "size" | "aspectRatio">;
  measured: Size | undefined;
}): SizeLimits {
  if (window === undefined)
    return {
      min: { width: 0, height: 0 },
      max: { width: Infinity, height: Infinity },
      ideal: { ...definition.size },
      ...(definition.aspectRatio === undefined ? {} : { aspect: definition.aspectRatio }),
    };
  const aspect = window.aspectRatio ?? definition.aspectRatio;
  return {
    min:
      window.kind === undefined
        ? { width: 0, height: 0 }
        : { ...(window.minSize ?? definition.minSize) },
    max: {
      width: window.maxSize?.width ?? definition.maxSize?.width ?? Infinity,
      height: window.maxSize?.height ?? definition.maxSize?.height ?? Infinity,
    },
    ideal: { width: window.rect.width, height: window.rect.height },
    ...(aspect === undefined ? {} : { aspect }),
    ...(window.heightMode === "content" && measured !== undefined
      ? { measured: { ...measured } }
      : {}),
  };
}

export type { DockDrop };

export const withComputed = (model: typeof stateModel) =>
  model
    .computed(({ state }) => ({
      viewportInsets: (): ViewportInsets => {
        const viewport = state.input.viewport.get();
        return combineInsets(
          Object.values(state.input.viewportOccluders.get()).map((rect) =>
            insetsOfOccluder({ rect, viewport }),
          ),
          state.input.viewportInsets.get(),
        );
      },
      windows: () => Object.values(state.document.content.windows),
      documentTree: (): Tree =>
        getWindowTree(
          fromEntries(
            Object.values(state.document.content.windows).map((window) => {
              const id = window.id.get();
              return [
                id,
                {
                  id,
                  kind: window.kind.get(),
                  layout: window.layout.get(),
                  children: window.children.get(),
                  item: window.item.get(),
                },
              ];
            }),
          ),
        ),
      connections: () => Object.values(state.document.content.connections),
      workspaces: () =>
        Object.values(state.document.content.workspaces).sort(
          (left, right) =>
            state.document.content.workspaceOrder.indexOf(left.id.get()) -
            state.document.content.workspaceOrder.indexOf(right.id.get()),
        ),
      view: () => {
        const id = state.document.activeWorkspaceId.get();
        return id === null || state.document.content.workspaces[id].id.get() === undefined
          ? state.document.canvasView
          : state.document.workspaceViews[id];
      },
      views: () => [state.document.canvasView, ...Object.values(state.document.workspaceViews)],
      capturedPointerId: linked({
        get: () =>
          state.session.press.pointerId.get() ??
          state.session.pan.pointerId.get() ??
          state.session.marquee.pointerId.get() ??
          state.session.drag.pointerId.get() ??
          state.session.drop.pointerId.get() ??
          state.session.tabDrag.pointerId.get() ??
          null,
        initial: null,
      }),
      windowDrag: linked({
        get: () => {
          const drag = state.session.drag.get();
          return drag !== null && (drag.kind === "move" || drag.kind === "resize") ? drag : null;
        },
        initial: null,
      }),
      windowDefinition: (windowId: string) => {
        const kind = state.document.content.windows[windowId].kind.get();
        return (
          (kind === undefined ? undefined : state.config.windowDefinitions[kind].get()) ??
          containerDefinition
        );
      },
    }))
    .computed(({ state, computed }) => ({
      parents: () => getParents(computed.documentTree.get()),
      windowCapabilities: (windowId: string) => ({
        ...computed.windowDefinition[windowId].capabilities.get(),
        ...state.document.content.windows[windowId].capabilities.get(),
      }),
      windowSection: (windowId: string): boolean =>
        state.document.content.windows[windowId].section.get() ??
        computed.windowDefinition[windowId].section.get(),
      workspaceWindows: () => {
        const id = state.document.activeWorkspaceId.get();
        const members = id === null ? null : state.document.content.workspaces[id].windowIds.get();
        if (members === undefined) return [];
        const tree = computed.documentTree.get();
        const shown =
          members === null
            ? null
            : new Set(
                members.flatMap((member) => [
                  member,
                  ...getDescendants({ windows: tree, id: member }),
                ]),
              );
        return computed.windows.filter((window) => shown === null || shown.has(window.id.get()));
      },
      camera: () => {
        const pan = state.session.pan.get();
        const pointer = state.input.pointer.get();
        if (pan === null || pointer?.pointerId !== pan.pointerId) {
          const motion = state.session.camera.get();
          return motion !== null && motion.workspaceId === state.document.activeWorkspaceId.get()
            ? motion.camera
            : computed.view.camera.get();
        }
        return {
          zoom: pan.camera.zoom,
          center: {
            x: pan.camera.center.x - (pointer.point.x - pan.point.x) / pan.camera.zoom,
            y: pan.camera.center.y - (pointer.point.y - pan.point.y) / pan.camera.zoom,
          },
        };
      },
      activeWindow: linked({
        get: () => {
          const id = computed.view.activeWindowId.get();
          return id === null ? null : state.document.content.windows[id];
        },
        initial: null,
      }),
      dragStartRects: () => computed.windowDrag.get()?.startRects ?? {},
      dragContainers: () => computed.windowDrag.get()?.containers ?? {},
      detachedRects: () => {
        const drag = computed.windowDrag.get();
        return drag?.kind === "move" ? drag.detached : {};
      },
      zIndex: (targetKey: TargetKey) => computed.view.stackingOrder.indexOf(targetKey) + 1,
    }))
    .computed(({ state, computed, configuration }) => ({
      windowParent: (windowId: string) => computed.parents[windowId].get(),
      parentLayoutType: (windowId: string): string | undefined => {
        const parent = computed.parents[windowId].get();
        const type =
          parent === undefined
            ? undefined
            : state.document.content.windows[parent].layout.type.get();
        return type !== undefined && type in configuration.layouts ? type : undefined;
      },
      baseTree: (): TreeChange => {
        const detached = Object.keys(computed.detachedRects.get()).reduce<TreeChange>(
          (change, id) => {
            const next = getUndockChange({
              windows: change.windows,
              layouts: configuration.layouts,
              window: id,
            });
            return { windows: next.windows, dissolved: [...change.dissolved, ...next.dissolved] };
          },
          { windows: computed.documentTree.get(), dissolved: [] },
        );
        const tab = state.session.tabDrag.get();
        const container =
          tab === null || tab.target === null ? undefined : detached.windows[tab.container];
        if (tab === null || tab.target === null || container?.children === undefined)
          return detached;
        return {
          ...detached,
          windows: {
            ...detached.windows,
            [tab.container]: {
              ...container,
              children: getReorderedChildren({
                children: container.children,
                child: tab.child,
                target: tab.target,
                after: tab.after,
              }),
            },
          },
        };
      },
      pointerWorld: linked({
        get: () => {
          const point = state.input.pointer.point.get();
          return point == null
            ? null
            : screenToWorld({
                point,
                camera: computed.camera.get(),
                viewport: state.input.viewport.get(),
              });
        },
        initial: null,
      }),
      viewportWidth: () => {
        const insets = computed.viewportInsets.get();
        return Math.max(1, state.input.viewport.width.get() - insets.left - insets.right);
      },
      viewportRect: () =>
        visibleWorldRect({
          camera: computed.camera.get(),
          viewport: state.input.viewport.get(),
          insets: computed.viewportInsets.get(),
        }),
      draggedWindows: () =>
        Object.keys(computed.dragStartRects)
          .map((id) => state.document.content.windows[id])
          .filter((window) => window.id.get() !== undefined),
    }))
    .computed(({ state, computed }) => ({
      previewParents: () => getParents(computed.baseTree.windows.get()),
      rectSources: () =>
        fromEntries(
          computed.baseTree.dissolved
            .get()
            .flatMap(({ id, into }) => (into === null ? [] : [[into, id] as const])),
        ),
      ownSize: (windowId: string) =>
        getOwnSize({
          window: state.document.content.windows[windowId].get(),
          definition: computed.windowDefinition[windowId].get(),
          measured: state.input.contentSizes[windowId].get(),
        }),
    }))
    .computed(({ computed }) => ({
      windowRoot: (windowId: string): string => {
        const parents = computed.previewParents.get();
        const rootOf = (id: string): string =>
          parents[id] === undefined ? id : rootOf(parents[id]);
        return rootOf(windowId);
      },
      windowDepth: (windowId: string): number => {
        const parents = computed.previewParents.get();
        const depthOf = (id: string): number =>
          parents[id] === undefined ? 0 : depthOf(parents[id]) + 1;
        return depthOf(windowId);
      },
      rectSource: (windowId: string): string => {
        const sources = computed.rectSources.get();
        const sourceOf = (id: string): string =>
          sources[id] === undefined ? id : sourceOf(sources[id]);
        return sourceOf(windowId);
      },
    }))
    .computed(({ computed }) => ({
      subtree: (rootId: string) => {
        const windows = computed.baseTree.windows.get();
        const ids = [rootId, ...getDescendants({ windows, id: rootId })];
        return {
          windows,
          ids,
          limits: fromEntries(ids.map((id) => [id, computed.ownSize[id].get()])),
        };
      },
      workspaceRoots: () =>
        computed.workspaceWindows.filter(
          (window) =>
            computed.baseTree.windows[window.id.get()].get() !== undefined &&
            computed.previewParents[window.id.get()].get() === undefined,
        ),
      overlayZIndex: () =>
        (computed.view.stackingOrder.length * 2 + computed.windows.length + 1) * 32,
    }))
    .computed(({ state, computed, configuration }) => ({
      windowZIndex: (windowId: string) => {
        if (computed.dragStartRects[windowId].get() !== undefined)
          return computed.overlayZIndex.get();
        const root = computed.rectSource[computed.windowRoot[windowId].get()].get();
        const pinned = state.document.content.windows[root].isPinned.get();
        const base =
          computed.zIndex[`window:${root}`].get() +
          (pinned ? computed.view.stackingOrder.length : 0);
        return base * 32 + clamp(computed.windowDepth[windowId].get(), 0, 31);
      },
      minSize: (windowId: string) => {
        const { windows, limits } = computed.subtree[computed.windowRoot[windowId].get()].get();
        return getWindowSize({
          id: windowId,
          nodes: windows,
          layouts: configuration.layouts,
          sizes: getLimitedSizes({
            ...limits,
            [windowId]: limits[windowId] ?? computed.ownSize[windowId].get(),
          }),
        })({ width: 0, height: 0 });
      },
    }))
    .computed(({ state, computed }) => ({
      dragAlignment: linked({
        get: () => {
          const startPoint = state.session.drag.startPoint.get();
          const point = computed.pointerWorld.get();
          if (
            startPoint == null ||
            point === null ||
            state.input.pointer.pointerId.get() !== state.session.drag.pointerId.get()
          )
            return null;
          const delta = { x: point.x - startPoint.x, y: point.y - startPoint.y };
          const drag = state.session.drag.get();
          const snapping = state.config.snapping.get();
          const unchanged = { delta, guides: [] as AlignmentGuide[] };
          if (drag?.kind !== "move" || !snapping.enabled) return unchanged;
          const rect = unionRects(Object.values(drag.startRects));
          return rect === null
            ? unchanged
            : alignRect({
                rect,
                delta,
                targets: drag.alignmentTargets,
                threshold: snapping.threshold / computed.camera.zoom.get(),
                edges: snapping.edges,
                centers: snapping.centers,
              });
        },
        initial: null,
      }),
      marqueeRect: linked({
        get: () => {
          const marquee = state.session.marquee.get();
          const point = computed.pointerWorld.get();
          if (marquee === null || point === null) return null;
          return rectFromCorners(marquee.startPoint, point);
        },
        initial: null,
      }),
    }))
    .computed(({ computed }) => ({
      dragDisplacement: linked({
        get: () => computed.dragAlignment.get()?.delta ?? null,
        initial: null,
      }),
      alignmentGuides: linked({
        get: () => computed.dragAlignment.get()?.guides ?? [],
        initial: [],
      }),
    }))
    .computed(({ state, computed }) => ({
      dragRect: (windowId: string) => {
        const drag = computed.windowDrag.get();
        const rect = drag?.startRects[windowId];
        const delta = computed.dragDisplacement.get();
        if (drag === null || rect === undefined || delta === null) return undefined;
        if (drag.kind === "move") return translateRect(rect, delta);
        const window = state.document.content.windows[windowId];
        return resizeRect({
          rect,
          delta,
          handle: drag.handle,
          limits: {
            min: computed.minSize[windowId].get(),
            max: computed.ownSize[windowId].max.get(),
          },
          aspectRatio:
            window.aspectRatio.get() ?? computed.windowDefinition[windowId].aspectRatio.get(),
        });
      },
    }))
    .computed(({ state, computed }) => ({
      rootRect: (rootId: string) => {
        const source = computed.rectSource[rootId].get();
        const rect =
          computed.dragRect[source].get() ?? state.document.content.windows[source].rect.get();
        return rect === undefined ||
          state.document.content.windows[source].widthMode.get() !== "viewport"
          ? rect
          : { ...rect, width: computed.viewportWidth.get() };
      },
      operations: (rootId: string): Record<string, Operation> => {
        const drag = state.session.drag.get();
        const delta = computed.dragDisplacement.get();
        if (drag === null || delta === null) return {};
        if (drag.kind === "sash")
          return computed.windowRoot[drag.container].get() !== rootId
            ? {}
            : {
                [drag.container]: {
                  type: "sash",
                  index: drag.index,
                  sizes: drag.sizes,
                  delta: drag.axis === "horizontal" ? delta.x : delta.y,
                },
              };
        const members = Object.entries(drag.containers).filter(
          ([id, container]) =>
            computed.windowRoot[container].get() === rootId &&
            computed.detachedRects[id].get() === undefined,
        );
        return fromEntries(
          [...new Set(members.map(([, container]) => container))].flatMap((container) => {
            const moved = members
              .filter(([, candidate]) => candidate === container)
              .map(([id]) => id);
            const operation: Operation =
              drag.kind === "move"
                ? {
                    type: "move",
                    rects: fromEntries(moved.map((id) => [id, computed.dragRect[id].get()!])),
                  }
                : {
                    type: "resize",
                    child: moved[0],
                    rect: computed.dragRect[moved[0]].get()!,
                    handle: drag.handle,
                  };
            return [[container, operation] as const];
          }),
        );
      },
    }))
    .computed(({ computed, configuration }) => ({
      baseArrangement: (rootId: string) => {
        const rect = computed.rootRect[rootId].get();
        if (rect === undefined) return undefined;
        const { windows, limits } = computed.subtree[rootId].get();
        return arrangeWindows({
          id: rootId,
          rect,
          nodes: windows,
          layouts: configuration.layouts,
          sizes: getLimitedSizes(limits),
          active: computed.view.activeChildren.get(),
          operations: computed.operations[rootId].get(),
        });
      },
    }))
    .computed(({ state, computed }) => ({
      dockDrop: linked({
        get: (): DockDrop | null => {
          const source = (() => {
            const drop = state.session.drop.get();
            if (drop?.phase === "drag") {
              const preferred = state.config.windowDefinitions[drop.insertion.kind].size.get();
              if (preferred === undefined) return null;
              const measured = state.input.contentSizes[drop.insertion.id].get();
              const size =
                drop.insertion.size ?? (measured?.width === preferred.width ? measured : preferred);
              const point = screenToWorld({
                point: drop.point,
                camera: computed.camera.get(),
                viewport: state.input.viewport.get(),
              });
              return {
                window: drop.insertion.id,
                kind: drop.insertion.kind,
                point,
                rect: rectWithCentroid(point, size),
              };
            }
            const drag = computed.windowDrag.get();
            const point = computed.pointerWorld.get();
            if (
              drag?.kind !== "move" ||
              point === null ||
              Object.keys(drag.startRects).length !== 1
            )
              return null;
            const window = drag.target;
            if (computed.previewParents[window].get() !== undefined) return null;
            const rect = computed.dragRect[window].get();
            return rect === undefined ? null : { window, point, rect };
          })();
          if (source === null) return null;
          const tree = computed.baseTree.windows.get();
          const moving = new Set([
            source.window,
            ...getDescendants({ windows: tree, id: source.window }),
          ]);
          const hit = computed.workspaceRoots
            .filter(
              (root) => !moving.has(root.id.get()) && tree[root.id.get()]?.layout !== undefined,
            )
            .toSorted(
              (left, right) =>
                computed.windowZIndex[right.id.get()].get() -
                computed.windowZIndex[left.id.get()].get(),
            )
            .flatMap((root) => {
              const arrangement = computed.baseArrangement[root.id.get()].get();
              return arrangement === undefined
                ? []
                : Object.entries(arrangement.rects)
                    .filter(
                      ([id, rect]) => arrangement.visible[id] && containsPoint(rect, source.point),
                    )
                    .toSorted(compareByKey(([, rect]) => areaOfRect(rect)))
                    .slice(0, 1);
            })[0];
          if (hit === undefined) return null;
          const [target, rect] = hit;
          return {
            window: source.window,
            kind: source.kind,
            rect: source.rect,
            target,
            edge: getDockEdge({
              rect,
              point: source.point,
              zone: state.config.docking.edgeZone.get(),
            }),
          };
        },
        initial: null,
      }),
    }))
    .computed(({ state, computed, configuration }) => ({
      arrangement: (rootId: string) => {
        const drop = computed.dockDrop.get();
        const base = computed.baseArrangement[rootId].get();
        if (drop === null || computed.windowRoot[drop.target].get() !== rootId) return base;
        const rect = computed.rootRect[rootId].get();
        if (rect === undefined) return base;
        const { windows, limits } = computed.subtree[rootId].get();
        return getDockArrangement({
          rootId,
          rect,
          windows,
          drop,
          layouts: configuration.layouts,
          wrappers: configuration.wrappers,
          active: computed.view.activeChildren.get(),
          operations: computed.operations[rootId].get(),
          measured: state.input.contentSizes[drop.window].get(),
          minSize:
            drop.kind === undefined
              ? { width: 0, height: 0 }
              : state.config.windowDefinitions[drop.kind].minSize.get(),
          limits: {
            ...limits,
            ...fromEntries(
              getDescendants({ windows, id: drop.window })
                .concat(windows[drop.window] === undefined ? [] : [drop.window])
                .map((id) => [id, computed.ownSize[id].get()]),
            ),
          },
        });
      },
    }))
    .computed(({ state, computed }) => ({
      windowVisible: (windowId: string) => {
        const window = state.document.content.windows[windowId];
        if (window.get() === undefined || window.mode.get() === "minimized") return false;
        if (computed.baseTree.windows[windowId].get() === undefined) return false;
        const root = computed.windowRoot[windowId].get();
        if (root === windowId) return true;
        return (
          state.document.content.windows[computed.rectSource[root].get()].mode.get() !==
            "minimized" && computed.arrangement[root].visible[windowId].get() !== false
        );
      },
      tabDragInside: linked({
        get: () => {
          const drag = state.session.tabDrag.get();
          const point = computed.pointerWorld.get();
          if (drag === null || point === null) return null;
          const strip = computed.arrangement[computed.windowRoot[drag.container].get()].controls[
            drag.container
          ]
            .get()
            ?.find((control) => control.type === "tabs");
          return strip === undefined
            ? null
            : containsPoint(
                outsetRectBy(strip.rect, drag.threshold / computed.camera.zoom.get()),
                point,
              );
        },
        initial: null,
      }),
    }))
    .computed(({ state, computed }) => ({
      windowRect: (windowId: string): Rect | undefined => {
        const window = state.document.content.windows[windowId];
        const saved = window.rect.get();
        const root = computed.windowRoot[windowId].get();
        const drop = computed.dockDrop.get();
        const docking =
          drop?.window === windowId
            ? computed.arrangement[computed.windowRoot[drop.target].get()].rects[windowId].get()
            : undefined;
        const container = computed.baseTree.windows[windowId].layout.get() !== undefined;
        const dragged = computed.dragRect[windowId].get();
        if (dragged !== undefined && !container) return dragged;
        if (docking !== undefined && dragged === undefined) return docking;
        if (root !== windowId || container || computed.rectSource[windowId].get() !== windowId)
          return computed.arrangement[root].rects[windowId].get() ?? dragged ?? saved;
        if (saved === undefined) return undefined;
        const placed = computed.detachedRects[windowId].get() ?? saved;
        const source =
          window.widthMode.get() === "viewport"
            ? {
                ...placed,
                width: Math.min(
                  computed.viewportWidth.get(),
                  computed.ownSize[windowId].max.width.get(),
                ),
              }
            : placed;
        const size = state.input.contentSizes[windowId].get();
        return window.heightMode.get() === "content" && size?.width === source.width
          ? {
              ...source,
              height: Math.max(size.height, computed.ownSize[windowId].min.height.get()),
            }
          : source;
      },
    }))
    .computed(({ state, computed }) => ({
      contentBounds: linked({
        get: () =>
          unionRects(
            computed.workspaceWindows
              .filter((window) => computed.windowVisible[window.id.get()].get())
              .map((window) => computed.windowRect[window.id.get()].get()!),
          ),
        initial: null,
      }),
      contentRects: () =>
        fromEntries(
          computed.workspaceRoots
            .filter((window) => computed.windowVisible[window.id.get()].get())
            .map(
              (window) =>
                [`window:${window.id.get()}`, computed.windowRect[window.id.get()].get()!] as const,
            ),
        ),
      route: (): Section[] => {
        const windows = computed.baseTree.windows.get();
        const ids = Object.keys(windows);
        return getRoute({
          axis: state.document.content.presentation.axis.get(),
          windows,
          rects: fromEntries(ids.map((id) => [id, computed.windowRect[id].get()])),
          sections: fromEntries(ids.map((id) => [id, computed.windowSection[id].get()])),
          roots: computed.workspaceRoots.map((window) => window.id.get()),
        });
      },
      places: (): Section[] => {
        const windows = computed.baseTree.windows.get();
        const ids = Object.keys(windows);
        return getRoute({
          axis: state.document.content.presentation.axis.get(),
          windows,
          rects: fromEntries(ids.map((id) => [id, computed.windowRect[id].get()])),
          roots: computed.workspaceRoots.map((window) => window.id.get()),
        });
      },
      selection: () => {
        const marquee = state.session.marquee.get();
        const rect = computed.marqueeRect.get();
        if (marquee === null || rect === null) return computed.view.selection.get();
        const targets: SelectionTarget[] = computed.workspaceRoots
          .filter(
            (window) =>
              computed.windowVisible[window.id.get()].get() &&
              intersectsRect(rect, computed.windowRect[window.id.get()].get()!),
          )
          .map((window) => ({ type: "window", id: window.id.get() }));
        return getSelection({ selection: marquee.selection, targets, mode: marquee.mode });
      },
    }))
    .computed(({ state, computed }) => ({
      selectionTargets: () => Object.values(computed.selection.targets),
      outline: (): (Section & { reading: boolean })[] => {
        const reading = new Set(computed.route.get().map((section) => section.id));
        return computed.places
          .get()
          .map((section) => ({ ...section, reading: reading.has(section.id) }));
      },
      occupiedRects: (): Record<string, Rect> => {
        const camera = computed.camera.get();
        const viewport = state.input.viewport.get();
        return {
          ...computed.contentRects.get(),
          ...fromEntries(
            Object.entries(state.input.viewportOccluders.get()).map(([key, rect]) => {
              const origin = screenToWorld({ point: rect, camera, viewport });
              return [
                `occluder:${key}`,
                {
                  x: origin.x,
                  y: origin.y,
                  width: rect.width / camera.zoom,
                  height: rect.height / camera.zoom,
                },
              ] as const;
            }),
          ),
        };
      },
    }))
    .computed(({ state, computed }) => ({
      selectedWindows: () =>
        computed.selectionTargets
          .filter((target) => target.type.get() === "window")
          .map((target) => state.document.content.windows[target.id.get()])
          .filter((window) => window.id.get() !== undefined && window.mode.get() !== "minimized"),
    }))
    .computed(({ computed, configuration }) => ({
      selectionBounds: (): Rect | null =>
        unionRects(
          computed.selectedWindows.flatMap((window) => {
            const id = window.id.get();
            const rect = computed.windowRect[id].get();
            return rect === undefined || !computed.windowVisible[id].get() ? [] : [rect];
          }),
        ),
      selectionActions: () => {
        const windows = computed.selectedWindows;
        const kinds = new Set(windows.map((window) => window.kind.get()));
        const kind = kinds.size === 1 ? kinds.values().next().value : undefined;
        if (kind === undefined) return [];
        const ids = windows.map((window) => window.id.get());
        return Object.entries(configuration.components[kind]?.actions ?? {})
          .filter(
            ([, action]) =>
              (ids.length === 1 || action.multiple) &&
              windows.every((window) => {
                const data = action.apply(window.data.get());
                return !(data instanceof Error || data instanceof type.errors);
              }),
          )
          .map(([action, definition]) => ({
            label: definition.label,
            icon: definition.icon,
            input: { action, windows: ids },
          }));
      },
    }));

export type ComputedContext = ReturnType<ReturnType<typeof withComputed>["create"]>;
