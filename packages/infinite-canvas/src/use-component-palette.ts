import { type } from "arktype";
import { useValue } from "@legendapp/state/react";
import { useCallback, useMemo, useState, type HTMLAttributes } from "react";
import type { InfiniteCanvasStore } from "./store";
import { createComponentWindow, DEFAULT_COMPONENT_SIZE, insertComponent } from "./component";
import { canvasModel } from "./schema";
import { resolveComponentPlacement } from "./component-placement";
import type {
  InfiniteCanvasDropInteraction,
  InfiniteCanvasDropPolicy,
  InfiniteCanvasOverlayRenderContext,
  InfiniteCanvasPoint,
  InfiniteCanvasSize,
} from "./types";

export type ComponentPalettePayload = Readonly<{ componentId: string; windowId: string }>;
const payloadType = type({ componentId: "string", windowId: "string" });
const emptyProps = Object.freeze({});
type Measurement = Readonly<{ windowId: string; contentSize: InfiniteCanvasSize }>;

export function useComponentPalette<Kind extends string>({
  store,
  size = DEFAULT_COMPONENT_SIZE,
}: Readonly<{
  store: InfiniteCanvasStore<Kind>;
  size?: InfiniteCanvasSize;
}>) {
  const components = useValue(() => store.windowDefinitions$.get());
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const items = useMemo(
    () => Object.values(components).filter(({ schema }) => schema?.allows({}) === true),
    [components],
  );
  const insert = useCallback(
    ({
      componentId,
      windowId = crypto.randomUUID(),
      worldPoint,
    }: Readonly<{
      componentId: string;
      windowId?: string;
      worldPoint?: InfiniteCanvasPoint;
    }>) => {
      const placement = resolveComponentPlacement({
        state: store.getState(),
        components,
        componentId,
        windowId,
        worldPoint,
        size,
      });
      if (placement instanceof type.errors || placement instanceof Error) {
        setError(placement instanceof type.errors ? placement.summary : placement.message);
        return;
      }
      const result = insertComponent({ store, input: placement.input });
      if (result instanceof type.errors) setError(result.summary);
      else setError(result instanceof Error ? result.message : null);
    },
    [components, size, store],
  );

  const dropPolicy = useMemo<InfiniteCanvasDropPolicy<Kind, unknown>>(
    () => ({
      canDrop: ({ state, payload, worldPoint }) => {
        if (!payloadType.allows(payload)) return false;
        const placement = resolveComponentPlacement({
          state,
          components,
          ...payload,
          contentSize:
            measurement?.windowId === payload.windowId ? measurement.contentSize : undefined,
          worldPoint,
          size,
        });
        if (placement instanceof type.errors) return { accepted: false, reason: placement.summary };
        if (placement instanceof Error) return { accepted: false, reason: placement.message };
        return true;
      },
      placement: ({ state, payload, worldPoint }) => {
        if (!payloadType.allows(payload)) return null;
        const placement = resolveComponentPlacement({
          state,
          components,
          ...payload,
          contentSize:
            measurement?.windowId === payload.windowId ? measurement.contentSize : undefined,
          worldPoint,
          size,
        });
        if (placement instanceof type.errors || placement instanceof Error) return null;
        const bounds = placement.rect;
        return {
          anchor: {
            x: (worldPoint.x - bounds.x) / bounds.width,
            y: (worldPoint.y - bounds.y) / bounds.height,
          },
          size: { width: bounds.width, height: bounds.height },
          groupInsertion: placement.input.target,
          contentSize: placement.input.contentSize,
          snapPolicy: placement.input.target === undefined ? undefined : false,
        };
      },
      onDrop: ({ payload, placement }) => {
        if (!payloadType.allows(payload) || placement === null) return;
        const result = insertComponent({
          store,
          input: {
            ...payload,
            props: {},
            rect: placement.rect,
            ...(placement.contentSize === undefined ? {} : { contentSize: placement.contentSize }),
            ...(placement.groupInsertion === undefined ? {} : { target: placement.groupInsertion }),
          },
        });
        if (result instanceof type.errors) setError(result.summary);
        else setError(result instanceof Error ? result.message : null);
      },
    }),
    [components, size, store, measurement],
  );

  return {
    measure: (measurement: Measurement) => {
      if (!canvasModel.Size.allows(measurement.contentSize)) return;
      setMeasurement((current) =>
        current?.windowId === measurement.windowId &&
        current.contentSize.width === measurement.contentSize.width &&
        current.contentSize.height === measurement.contentSize.height
          ? current
          : measurement,
      );
    },
    getPreview(drag: InfiniteCanvasDropInteraction<unknown, Kind>) {
      if (drag.status !== "dragging" || !payloadType.allows(drag.payload)) return null;
      const definition = components[drag.payload.componentId];
      if (definition?.schema === undefined) return null;
      const rect = drag.placement?.rect ?? { ...(definition.size ?? size), x: 0, y: 0 };
      const window = createComponentWindow({
        id: drag.payload.windowId,
        definition: {
          kind: definition.kind,
          schema: definition.schema,
          minSize: definition.minSize,
          aspectRatio: definition.aspectRatio,
        },
        props: emptyProps,
        rect,
      });
      return window instanceof type.errors ? null : { window, rect };
    },
    items,
    error,
    dropPolicy,
    getItemProps({
      componentId,
      context,
    }: Readonly<{
      componentId: string;
      context: Pick<InfiniteCanvasOverlayRenderContext<Kind, unknown>, "drag" | "startDrag">;
    }>) {
      const control = {
        onPointerDown: (event) => {
          setError(null);
          context.startDrag({
            event,
            id: componentId,
            payload: { componentId, windowId: crypto.randomUUID() },
            onActivate: () => insert({ componentId }),
          });
        },
        onClick: (event) => {
          if (event.detail === 0) insert({ componentId });
        },
      } satisfies HTMLAttributes<HTMLElement>;
      return {
        ...control,
        isDragging:
          context.drag.status === "dragging" &&
          payloadType.allows(context.drag.payload) &&
          context.drag.payload.componentId === componentId,
      };
    },
  };
}
