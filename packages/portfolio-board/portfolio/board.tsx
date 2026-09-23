// @refresh reset
import {
  type Canvas,
  type WindowState,
} from "@hyphened/infinite-canvas/next";
import {
  CanvasScroll,
  CanvasTools,
  CanvasViewport,
  ComponentView,
  Palette,
  useCanvasOccluder,
  useCanvasScroll,
  useCanvasViewport,
  WindowContent,
  WindowDragHandle,
} from "@hyphened/infinite-canvas/next/react";
import { observer } from "@legendapp/state/react";
import type { Observable } from "@legendapp/state";
import { useState, type ReactNode } from "react";
import { Lock, LockOpen, Pencil } from "lucide-react";
import {
  Button,
  CanvasInspector,
  CanvasLauncher,
  CanvasPresentation,
  CanvasSectionRail,
  CanvasSelectionToolbar,
  CanvasSettings,
  Label,
  Row,
  Surface,
  ScrollAreaScrollbar,
  Toggle,
  tv,
  type SurfaceProps,
} from "portfolio-board";
import { components } from "./components.tsx";
import { careerEntry } from "./career.tsx";
import "./board.css";

const styles = tv({
  slots: {
    page: "relative h-dvh overflow-hidden bg-pk-ground text-pk-text",
    topBand: "pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start gap-2 p-4",
    launcher: "pointer-events-auto",
    presentControls: "pointer-events-auto ml-auto",
    viewportHost: "h-[calc(100%-176px)] min-[641px]:h-full min-[641px]:w-[calc(100%-240px)]",
    viewport: "text-pk-ink",
    card: "h-full cursor-grab",
    window:
      "relative h-full in-data-selected:outline-2 in-data-selected:outline-pk-accent in-data-selected:-outline-offset-2",
    container: "absolute -top-8 left-0 flex h-8 cursor-grab items-center text-xs",
    palette:
      "fixed right-0 bottom-0 z-30 h-44 w-full overflow-auto border-pk-line bg-pk-surface p-3 min-[641px]:top-0 min-[641px]:h-auto min-[641px]:w-[240px] min-[641px]:border-l",
    paletteHeading: "mb-3",
    paletteDescription: "text-xs opacity-60",
    paletteList: "flex gap-2 min-[641px]:grid",
    paletteItem:
      "flex shrink-0 touch-none cursor-grab justify-between gap-3 rounded-lg border border-pk-line px-3 py-3 text-left text-xs capitalize hover:border-pk-accent data-highlighted:border-pk-accent data-dragging:border-pk-accent",
    paletteInput:
      "mb-3 w-full rounded border border-pk-line bg-transparent px-3 py-2 text-xs outline-none focus:border-pk-accent",
    paletteEmpty: "text-xs opacity-60",
    error: "text-xs",
  },
  variants: {
    mode: {
      edit: {},
      read: {
        viewportHost: "h-full w-full min-[641px]:w-full",
      },
    },
  },
});

const tones: Readonly<Record<string, SurfaceProps["tone"]>> = {
  profile: "rim",
  "icon-square": "bare",
};

const BoardWindow = observer(function BoardWindow({ window }: { window: Observable<WindowState> }) {
  const { canvas, mode } = useCanvasViewport();
  const id = window.id.get();
  const kind = window.kind.get();
  const data = window.data.get();
  const hasDetails = kind === "career" && careerEntry.allows(data) && data.sections.length > 0;
  if (kind === undefined)
    return mode === "edit" && canvas.computed.windowParent[id].get() === undefined ? (
      <WindowDragHandle className={styles().container()}>
        {window.title.get() || "Group"}
      </WindowDragHandle>
    ) : null;
  return (
    <WindowDragHandle className={styles().card()}>
      <Surface container padding="none" tone={hasDetails ? "rim" : tones[kind] ?? "card"}
        rim={kind === "profile" ? "iridescent" : undefined} className={styles().window()}>
        <WindowContent nativeScroll={kind === "career-detail"}>
          <ComponentView canvas={canvas} window={window} components={components} />
        </WindowContent>
      </Surface>
    </WindowDragHandle>
  );
});

const BoardControls = observer(function BoardControls({
  onModeChange,
  onExploringChange,
  children,
}: {
  onModeChange?: (mode: BoardMode) => void;
  onExploringChange: (exploring: boolean) => void;
  children?: ReactNode;
}) {
  const { canvas, mode } = useCanvasViewport();
  const { attached, following, scrollTo } = useCanvasScroll();
  return (
    <div
      ref={useCanvasOccluder<HTMLDivElement>()}
      data-canvas-control
      className={styles().topBand()}
    >
      {mode === "edit" && <CanvasLauncher canvas={canvas} className={styles().launcher()} />}
      <Row className={styles().presentControls()} role="group" aria-label="Presentation">
        {children}
        {attached && (
          <Button tone="ghost" disabled={following.get()} onClick={() => scrollTo()}>
            Back to portfolio
          </Button>
        )}
        <Toggle
          look="action"
          aria-label="Lock navigation"
          title="Lock navigation"
          pressed={attached}
          onPressedChange={(locked) => onExploringChange(!locked)}
        >
          {attached ? <Lock aria-hidden /> : <LockOpen aria-hidden />}
        </Toggle>
        {onModeChange && (
          <Toggle
            look="action"
            aria-label="Edit portfolio"
            title="Edit portfolio"
            pressed={mode === "edit"}
            onPressedChange={(editing) => onModeChange(editing ? "edit" : "read")}
          >
            <Pencil aria-hidden />
          </Toggle>
        )}
      </Row>
    </div>
  );
});

const PaletteHost = ({ children }: { children: ReactNode }) => {
  const ref = useCanvasOccluder<HTMLElement>();
  return useCanvasViewport().mode !== "edit" ? null : (
    <Palette.Root portal ref={ref} aria-label="Components" className={styles().palette()}>
      {children}
    </Palette.Root>
  );
};

export type BoardMode = "edit" | "read";

export function PortfolioBoard({
  canvas,
  mode,
  onModeChange,
  onReset,
  section,
  onSectionChange,
  controls,
}: {
  canvas: Canvas;
  mode: BoardMode;
  onModeChange?: (mode: BoardMode) => void;
  onReset?: () => void;
  section?: string;
  onSectionChange?: (section: string) => void;
  controls?: ReactNode;
}) {
  const [exploring, setExploring] = useState(false);
  const classes = styles({ mode });
  const viewport = (
    <CanvasViewport
      canvas={canvas}
      mode={mode === "edit" ? "edit" : undefined}
      className={classes.viewport()}
      emptyCanvasDrag="marquee"
      renderWindow={(window) => <BoardWindow window={window} />}
    >
      {onModeChange && <CanvasTools canvas={canvas} />}
      <BoardControls onModeChange={onModeChange} onExploringChange={setExploring}>
        {controls}
      </BoardControls>
      <CanvasSelectionToolbar canvas={canvas} />
      {mode === "read" && <CanvasSectionRail />}
      <PaletteHost>
        <CanvasInspector canvas={canvas} />
        <CanvasPresentation canvas={canvas} />
        <CanvasSettings canvas={canvas} />
        <header className={styles().paletteHeading()}>
          <Row justify="between">
            <Label>Components</Label>
            {onReset && <Button
              size="sm"
              tone="ghost"
              onClick={onReset}
            >
              Reset
            </Button>}
          </Row>
          <p className={styles().paletteDescription()}>Add or drag onto the canvas.</p>
        </header>
        <Palette.Input
          className={styles().paletteInput()}
          aria-label="Search components"
          placeholder="Search components…"
        />
        <Palette.Error className={styles().error()} />
        <Palette.List className={styles().paletteList()}>
          {(kind: string) => (
            <Palette.Item key={kind} kind={kind} className={styles().paletteItem()}>
              {canvas.configuration.components[kind].label ?? kind}
              <span aria-hidden="true">⠿</span>
            </Palette.Item>
          )}
        </Palette.List>
        <Palette.Empty className={styles().paletteEmpty()}>No matching components.</Palette.Empty>
      </PaletteHost>
    </CanvasViewport>
  );
  return (
    <main className={classes.page()}>
      <div className={classes.viewportHost()}>
        <CanvasScroll
          canvas={canvas}
          attached={!exploring}
          section={section}
          onSectionChange={onSectionChange}
          scrollbar={mode === "read" ? <ScrollAreaScrollbar /> : undefined}
        >
          {viewport}
        </CanvasScroll>
      </div>
    </main>
  );
}
