import { argminN, axes, eqDelta, type Axis } from "@hyphened/math/cpu";
import { ScrollArea } from "@base-ui/react/scroll-area";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { observer } from "@legendapp/state/react";
import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { getCameraTrack, type CameraTrack, type PlacedSection } from "../route";
import type { Canvas } from "../state.types";

type ScrollContextValue = {
  canvas: Canvas;
  sections: readonly PlacedSection[];
  current: readonly string[];
  attached: boolean;
  axis: Axis;
  scrollTo: (id: string) => void;
};

const ScrollContext = createContext<ScrollContextValue | null>(null);

export function useCanvasScroll() {
  const context = useContext(ScrollContext);
  if (context === null) throw new Error("This component requires CanvasScroll.");
  return context;
}

export function useCanvasScrollMode(): "read" | "explore" | undefined {
  const context = useContext(ScrollContext);
  return context === null ? undefined : context.attached ? "read" : "explore";
}

export function useCanvasScrollAxis(): Axis | undefined {
  return useContext(ScrollContext)?.axis;
}

const sectionsAt = (sections: readonly PlacedSection[], offset: number): string[] => {
  const reached = sections.filter((section) => section.offset <= offset + 1);
  const active = (reached.at(-1) ?? sections[0])?.offset;
  return active === undefined
    ? []
    : sections.filter((section) => section.offset === active).map((section) => section.id);
};

export const CanvasScroll = observer(function CanvasScroll({
  canvas,
  maxZoom = 1,
  axis = "vertical",
  attached = true,
  section,
  onSectionChange,
  className,
  style,
  scrollbar,
  children,
}: {
  canvas: Canvas;
  maxZoom?: number;
  axis?: Axis;
  attached?: boolean;
  section?: string;
  onSectionChange?: (section: string) => void;
  className?: string;
  style?: CSSProperties;
  scrollbar?: ReactNode;
  children: ReactNode;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const wasAttached = useRef<boolean | null>(null);
  const [current, setCurrent] = useState<readonly string[]>([]);
  const track = getCameraTrack({
    axis,
    sections: canvas.computed.route[axis].get(),
    viewport: canvas.state.input.viewport.get(),
    insets: canvas.state.input.viewportInsets.get(),
    limits: canvas.state.config.camera.get(),
    maxZoom,
  });
  const visit = useEffectEvent((sections: readonly PlacedSection[], offset: number) => {
    const next = sectionsAt(sections, offset);
    if (next.join() === current.join()) return;
    setCurrent(next);
    if (next[0] !== undefined && next[0] !== section) onSectionChange?.(next[0]);
  });
  const follow = useEffectEvent((offset: number, settled: boolean) => {
    if (track === null || !attached) return;
    canvas.actions[settled ? "setCamera" : "previewCamera"].run(track.at(offset));
    visit(track.sections, offset);
  });
  const offsetOf = (element: HTMLElement) =>
    axis === "vertical" ? element.scrollTop : element.scrollLeft;
  const place = useEffectEvent(() => {
    const element = viewport.current;
    if (track === null || element === null) return;
    const camera = canvas.computed.view.camera.peek();
    const offset = track.offsetAt(camera);
    const requested = started.current
      ? undefined
      : track.sections.find((placed) => placed.id === section)?.offset;
    started.current = true;
    const top = requested ?? track.stops[argminN(offset, track.stops)] ?? offset;
    const pose = track.at(top);
    const settle = () => {
      element[axis === "vertical" ? "scrollTop" : "scrollLeft"] = top;
      visit(track.sections, top);
    };
    if (
      requested !== undefined ||
      (eqDelta(camera.zoom, pose.zoom) &&
        eqDelta(camera.center.x, pose.center.x) &&
        eqDelta(camera.center.y, pose.center.y))
    ) {
      settle();
      return;
    }
    const navigation = canvas.actions.navigateCamera.run({
      target: { type: "point", point: pose.center },
      behavior: { type: "centerAtZoom", zoom: pose.zoom },
    });
    if (navigation instanceof Promise) void navigation.then(settle);
  });
  const shape =
    track === null
      ? ""
      : `${track.zoom}/${track.length}/${track.sections.map((placed) => `${placed.id}@${placed.offset}`).join()}`;
  useEffect(() => {
    if (shape === "") return;
    const toggled = wasAttached.current !== attached;
    wasAttached.current = attached;
    if (!attached) {
      canvas.actions.setCamera.run(canvas.computed.camera.peek());
      return;
    }
    const element = viewport.current;
    if (toggled || !started.current) place();
    else if (element !== null) follow(offsetOf(element), true);
  }, [shape, attached]);
  const latest = useRef<CameraTrack | null>(track);
  latest.current = track;
  const scrollTo = useEffectEvent((id: string) => {
    const offset = latest.current?.sections.find((placed) => placed.id === id)?.offset;
    if (offset === undefined) return;
    viewport.current?.scrollTo({
      ...(axis === "vertical" ? { top: offset } : { left: offset }),
      behavior: "smooth",
    });
  });
  const requested = useRef(section);
  useEffect(() => {
    const asked = requested.current !== section;
    requested.current = section;
    if (!asked || section === undefined || !started.current || !attached) return;
    if (!current.includes(section)) scrollTo(section);
  }, [section, attached]);
  const context = useMemo<ScrollContextValue>(
    () => ({ canvas, sections: latest.current?.sections ?? [], current, attached, axis, scrollTo }),
    [canvas, shape, current, attached, axis, scrollTo],
  );
  return (
    <ScrollContext.Provider value={context}>
      <ScrollArea.Root
        data-slot="canvas-scroll"
        className={className}
        style={{ position: "relative", height: "100%", ...style }}
      >
        <ScrollArea.Viewport
          ref={viewport}
          onScroll={(event) => follow(offsetOf(event.currentTarget), false)}
          onScrollEnd={(event) => follow(offsetOf(event.currentTarget), true)}
          style={{
            position: "relative",
            height: "100%",
            [`overflow${axis === "vertical" ? "X" : "Y"}`]: "hidden",
            scrollSnapType: `${axes[axis].mainPosition} proximity`,
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              [axes[axis].cross]: 1,
              [axes[axis].main]: `calc(100% + ${track?.length ?? 0}px)`,
              pointerEvents: "none",
            }}
          >
            {(track?.stops ?? []).map((offset) => (
              <div
                key={offset}
                style={{
                  position: "absolute",
                  [axes[axis].mainPosition === "y" ? "top" : "left"]: offset,
                  [axes[axis].main]: 1,
                  scrollSnapAlign: "start",
                }}
              />
            ))}
          </div>
          <div style={{ position: "sticky", top: 0, left: 0, height: "100%" }}>{children}</div>
        </ScrollArea.Viewport>
        {scrollbar}
      </ScrollArea.Root>
    </ScrollContext.Provider>
  );
});

export type SectionEntry = PlacedSection & { title: string; current: boolean };

const SectionsRoot = observer(function SectionsRoot({
  children,
  render,
  ref,
  ...props
}: Omit<ComponentPropsWithRef<"nav">, "children"> & {
  render?: useRender.RenderProp;
  children: (section: SectionEntry) => ReactNode;
}) {
  const { canvas, sections, current } = useCanvasScroll();
  const entries = sections.map((section) => ({
    ...section,
    title: canvas.state.document.content.windows[section.id].title.get() || section.id,
    current: current.includes(section.id),
  }));
  return useRender({
    defaultTagName: "nav",
    render,
    ref,
    props: {
      "aria-label": "Sections",
      ...props,
      "data-slot": "canvas-sections",
      "data-canvas-control": "",
      children: entries.map(children),
    },
  });
});

const SectionItem = observer(function SectionItem({
  section,
  children,
  render,
  ref,
  ...props
}: ComponentPropsWithRef<"button"> & { render?: useRender.RenderProp; section: string }) {
  const { canvas, current, scrollTo } = useCanvasScroll();
  const title = canvas.state.document.content.windows[section].title.get() || section;
  return useRender({
    defaultTagName: "button",
    render,
    ref,
    props: {
      ...mergeProps<"button">(
        { type: "button", "aria-label": title, onClick: () => scrollTo(section) },
        props,
      ),
      "aria-current": current.includes(section) || undefined,
      "data-slot": "canvas-section",
      "data-canvas-control": "",
      children: children ?? title,
    },
  });
});

export const Sections = { Root: SectionsRoot, Item: SectionItem };
