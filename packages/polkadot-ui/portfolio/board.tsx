// @refresh reset
import {
  createCanvasState,
  documentTransform,
  type Canvas,
  type WindowState,
} from "@hyphened/infinite-canvas/next";
import {
  CanvasScroll,
  CanvasTools,
  CanvasViewport,
  ComponentView,
  Palette,
  WindowContent,
  WindowDragHandle,
} from "@hyphened/infinite-canvas/next/react";
import { observer } from "@legendapp/state/react";
import { syncState, type Observable } from "@legendapp/state";
import { ObservablePersistLocalStorage } from "@legendapp/state/persist-plugins/local-storage";
import { syncObservable } from "@legendapp/state/sync";
import { useState } from "react";
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import {
  Badge,
  Button,
  CanvasInspector,
  CanvasLauncher,
  CanvasSectionRail,
  CanvasSelectionToolbar,
  Label,
  Row,
  Surface,
  scrollAreaVariants,
  tv,
} from "polkadot-ui";
import { components } from "./components.tsx";
import documentSource from "./document.json?raw";
import "./board.css";

const styles = tv({
  slots: {
    page: "relative h-dvh overflow-hidden bg-pk-ground text-pk-text",
    launcher: "absolute top-4 left-4 z-20",
    presentControls: "absolute top-4 right-4 z-20 min-[641px]:right-[212px]",
    viewportHost: "h-[calc(100%-176px)] min-[641px]:h-full min-[641px]:w-[calc(100%-196px)]",
    viewport: "text-pk-ink",
    card: "h-full cursor-grab",
    position:
      "pointer-events-none absolute -top-2 -left-2 z-10 size-5 justify-center rounded-full bg-pk-surface p-0 tabular-nums",
    window:
      "relative h-full in-data-selected:outline-2 in-data-selected:outline-pk-accent in-data-selected:-outline-offset-2 has-[[data-slot=language-icon]]:border-0 has-[[data-slot=language-icon]]:rounded-none has-[[data-slot=language-icon]]:bg-transparent has-[[data-slot=language-icon]]:shadow-none",
    container: "absolute -top-8 left-0 flex h-8 cursor-grab items-center text-xs",
    palette:
      "fixed right-0 bottom-0 z-30 h-44 w-full overflow-auto border-pk-line bg-pk-surface p-3 min-[641px]:top-0 min-[641px]:h-auto min-[641px]:w-[196px] min-[641px]:border-l",
    paletteHeading: "mb-3",
    paletteDescription: "text-xs opacity-60",
    paletteList: "flex gap-2 min-[641px]:grid",
    paletteItem:
      "flex shrink-0 touch-none cursor-grab justify-between gap-3 rounded-lg border border-pk-line px-3 py-3 text-left text-xs capitalize hover:border-pk-accent data-highlighted:border-pk-accent data-dragging:border-pk-accent",
    paletteInput:
      "mb-3 w-full rounded border border-pk-line bg-transparent px-3 py-2 text-xs outline-none focus:border-pk-accent",
    paletteEmpty: "text-xs opacity-60",
    error: "text-xs",
    rail: "absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 flex-row gap-2 min-[641px]:top-1/2 min-[641px]:right-4 min-[641px]:bottom-auto min-[641px]:left-auto min-[641px]:translate-x-0 min-[641px]:-translate-y-1/2 min-[641px]:flex-col min-[641px]:items-end min-[641px]:gap-1",
    railLabel: "hidden min-[641px]:block",
  },
  variants: {
    mode: {
      edit: {},
      read: {
        viewportHost: "h-full w-full min-[641px]:w-full",
        palette: "hidden",
        presentControls: "min-[641px]:right-4",
      },
    },
  },
});

const BoardWindow = observer(function BoardWindow({
  canvas,
  window,
  mode,
}: {
  canvas: Canvas;
  window: Observable<WindowState>;
  mode: BoardMode;
}) {
  const id = window.id.get();
  if (window.kind.get() === undefined)
    return canvas.computed.windowParent[id].get() === undefined ? (
      <WindowDragHandle className={styles().container()}>
        {window.title.get() || "Group"}
      </WindowDragHandle>
    ) : null;
  const position =
    mode === "edit"
      ? canvas.computed.route.vertical.get().findIndex((section) => section.id === id)
      : -1;
  return (
    <WindowDragHandle className={styles().card()}>
      <Surface container padding="none" tone="card" className={styles().window()}>
        {position >= 0 && (
          <Badge className={styles().position()} tone="outline">
            {position + 1}
          </Badge>
        )}
        <WindowContent>
          <ComponentView canvas={canvas} window={window} components={components} />
        </WindowContent>
      </Surface>
    </WindowDragHandle>
  );
});

const BoardControls = observer(function BoardControls({
  canvas,
  mode,
  onModeChange,
  exploring,
  onExploringChange,
}: {
  canvas: Canvas;
  mode: BoardMode;
  onModeChange: (mode: BoardMode) => void;
  exploring: boolean;
  onExploringChange: (exploring: boolean) => void;
}) {
  const error = syncState(canvas.state.document).error.get();
  const classes = styles({ mode });
  if (mode === "read")
    return (
      <Row className={classes.presentControls()} role="group" aria-label="Presentation">
        <Button aria-pressed={exploring} onClick={() => onExploringChange(!exploring)}>
          {exploring ? "Back to reading" : "Explore"}
        </Button>
        <Button onClick={() => onModeChange("edit")}>Exit</Button>
      </Row>
    );
  return (
    <>
      <CanvasLauncher canvas={canvas} className={classes.launcher()} />
      <Row className={classes.presentControls()} role="group" aria-label="Presentation">
        <Button onClick={() => onModeChange("read")}>Present</Button>
      </Row>
      {error != null && (
        <p role="alert" className={classes.error()}>
          Board save failed: {String(error)}
        </p>
      )}
    </>
  );
});

const Rail = () => (
  <CanvasSectionRail className={styles().rail()} classNames={{ label: styles().railLabel() }} />
);

export type BoardMode = "edit" | "read";

export function PortfolioBoard({
  mode,
  onModeChange,
  section,
  onSectionChange,
}: {
  mode: BoardMode;
  onModeChange: (mode: BoardMode) => void;
  section?: string;
  onSectionChange?: (section: string) => void;
}) {
  const [canvas] = useState(() => {
    const canvas = createCanvasState({
      document: JSON.parse(documentSource),
      windowDefinitions: components,
      grouping: { type: "grid", rowHeight: 40, compact: true },
      cameraMotion: { transition: { type: "spring", visualDuration: 0.8, bounce: 0 } },
    });
    syncObservable(canvas.state.document, {
      persist: {
        name: "board.v6",
        plugin: ObservablePersistLocalStorage,
        transform: documentTransform(canvas),
      },
      onError: (error) => console.warn("Board persistence failed.", error),
    });
    return canvas;
  });
  const [exploring, setExploring] = useState(false);
  const classes = styles({ mode });
  const viewport = (
    <CanvasViewport
      canvas={canvas}
      className={classes.viewport()}
      emptyCanvasDrag="marquee"
      renderWindow={(window) => <BoardWindow canvas={canvas} window={window} mode={mode} />}
    >
      <CanvasTools canvas={canvas} />
      {mode === "edit" && <CanvasSelectionToolbar canvas={canvas} />}
      <Palette.Root portal aria-label="Components" className={classes.palette()}>
        <CanvasInspector canvas={canvas} />
        <header className={styles().paletteHeading()}>
          <Row justify="between">
            <Label>Components</Label>
            <Button
              size="sm"
              tone="ghost"
              onClick={() => void canvas.commands.restoreDocument.run(JSON.parse(documentSource))}
            >
              Reset
            </Button>
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
      </Palette.Root>
    </CanvasViewport>
  );
  return (
    <main className={classes.page()}>
      <BoardControls
        canvas={canvas}
        mode={mode}
        onModeChange={onModeChange}
        exploring={exploring}
        onExploringChange={setExploring}
      />
      <div className={classes.viewportHost()}>
        {mode === "read" ? (
          <CanvasScroll
            canvas={canvas}
            maxZoom={1}
            attached={!exploring}
            section={section}
            onSectionChange={onSectionChange}
            scrollbar={
              <ScrollAreaPrimitive.Scrollbar className={scrollAreaVariants().scrollbar()}>
                <ScrollAreaPrimitive.Thumb className={scrollAreaVariants().thumb()} />
              </ScrollAreaPrimitive.Scrollbar>
            }
          >
            {viewport}
            <Rail />
          </CanvasScroll>
        ) : (
          viewport
        )}
      </div>
    </main>
  );
}
