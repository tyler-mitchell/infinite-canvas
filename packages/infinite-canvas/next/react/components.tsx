import { intrinsicSize } from "@hyphened/math/cpu";
import type { Observable } from "@legendapp/state";
import { observer } from "@legendapp/state/react";
import { type, type Type } from "arktype";
import { useResizeObserver } from "use-resize-observer";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { Canvas, WindowDefinitionInput } from "../state.types";
import type { WindowState } from "../document.types";
import type { CameraController } from "../camera";
import { bindComponentActions, type ComponentAction } from "../components";
import { report } from "../input";
import { useCanvasWindow } from "./context";

const ContentHeightContext = createContext<((height: number) => void) | undefined>(undefined);
const exact = (value: number) => value;

export function WindowContent({
  children,
  className,
  style,
  overflow = "auto",
  nativeScroll = false,
}: {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  overflow?: CSSProperties["overflow"];
  nativeScroll?: boolean;
}) {
  const { canvas, window, element } = useCanvasWindow();
  const host = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const windowId = window.id.peek();
  const [reported, setReported] = useState<number | undefined>(undefined);
  const frame = useResizeObserver({ ref: element, box: "border-box", round: exact });
  const viewport = useResizeObserver({ ref: host, box: "border-box", round: exact });
  const body = useResizeObserver({ ref: content, box: "border-box", round: exact });
  const height = reported ?? body.height;
  useEffect(() => {
    if (
      frame.width === undefined ||
      frame.height === undefined ||
      viewport.height === undefined ||
      height === undefined ||
      height <= 0 ||
      frame.width <= 0
    )
      return;
    report(
      canvas.actions.setContentSize.run({
        windowId,
        size: intrinsicSize({
          frame: { width: frame.width, height: frame.height },
          viewport: { height: viewport.height },
          content: { height },
        }),
      }),
    );
  }, [canvas, windowId, frame.width, frame.height, viewport.height, height]);
  useEffect(
    () => () => {
      if (canvas.state.document.content.windows[windowId].peek() === undefined)
        canvas.state.input.contentSizes[windowId].delete();
    },
    [canvas, windowId],
  );
  return (
    <div
      ref={host}
      className={className}
      data-slot="canvas-content"
      data-canvas-scroll={nativeScroll ? "native" : undefined}
      style={{ flex: "1 1 auto", minHeight: 0, overflow, ...style }}
    >
      <ContentHeightContext.Provider value={setReported}>
        <div
          ref={content}
          style={{
            display: "flex",
            flexDirection: "column",
            height: reported === undefined ? undefined : "100%",
          }}
        >
          {children}
        </div>
      </ContentHeightContext.Provider>
    </div>
  );
}

export type ComponentRenderContext = {
  camera: CameraController;
  windowId: string;
  onPropsChange: (props: Record<string, unknown>) => void;
  onContentHeightChange?: (height: number) => void;
};

type ComponentProps = { canvas: Canvas; window: Observable<WindowState> };
type ComponentOptions = Omit<WindowDefinitionInput, "schema" | "actions">;

export function defineComponent<Schema extends Type>({
  schema,
  render,
  actions = {},
  ...options
}: ComponentOptions & {
  schema: Schema;
  actions?: Readonly<Record<string, ComponentAction<Schema["infer"]>>>;
  render: (props: Schema["infer"], context: ComponentRenderContext) => ReactNode;
}) {
  const View = observer(function Component({ canvas, window }: ComponentProps) {
    const onContentHeightChange = useContext(ContentHeightContext);
    const props = schema.out(window.data.get());
    if (props instanceof type.errors) return <p role="alert">{props.summary}</p>;
    return render(props, {
      camera: canvas.camera,
      windowId: window.id.get(),
      onContentHeightChange,
      onPropsChange: (patch) => {
        const current = window.data.peek();
        if (current === null || typeof current !== "object" || Array.isArray(current)) {
          console.warn("Component properties must be an object.", { windowId: window.id.peek() });
          return;
        }
        const result = canvas.actions.setWindowData.run({
          window: window.id.peek(),
          data: { ...current, ...patch },
        });
        if (result !== undefined) console.warn("Component update failed.", result);
      },
    });
  });
  return { ...options, schema, actions: bindComponentActions({ schema, actions }), View };
}

export function defineComponents<const Schemas extends Readonly<Record<string, Type>>>({
  components,
  window = {},
}: {
  window?: ComponentOptions;
  components: {
    [Id in keyof Schemas]: ComponentOptions & {
      schema: Schemas[Id];
      actions?: Readonly<Record<string, ComponentAction<Schemas[Id]["infer"]>>>;
      render: (props: Schemas[Id]["infer"], context: ComponentRenderContext) => ReactNode;
    };
  };
}) {
  return Object.fromEntries(
    Object.entries(components).map(([kind, definition]) => [
      kind,
      defineComponent({ ...window, ...definition }),
    ]),
  ) as {
    [Id in keyof Schemas]: ReturnType<typeof defineComponent<Schemas[Id]>>;
  };
}

export const ComponentView = observer(function ComponentView({
  canvas,
  window,
  components,
}: ComponentProps & {
  components: Readonly<Record<string, { View: ComponentType<ComponentProps> }>>;
}) {
  const kind = window.kind.get();
  if (kind === undefined) return null;
  const View = components[kind]?.View;
  return View === undefined ? (
    <p role="alert">Component unavailable: {kind}</p>
  ) : (
    <View canvas={canvas} window={window} />
  );
});
