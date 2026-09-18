// @refresh reset
import {
  createCanvasState,
  documentTransform,
  type Canvas,
  type WindowState,
} from "@hyphened/infinite-canvas/next";
import {
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
import { Button, CanvasCommand, Label, Row, Surface, tv } from "polkadot-ui";
import { components } from "./components.tsx";
import { Inspector } from "./inspector.tsx";
import documentSource from "./document.json?raw";
import "./board.css";

const styles = tv({
  slots: {
    page: "relative h-dvh overflow-hidden bg-pk-ground text-pk-text",
    controls: "absolute top-4 left-4 z-20 max-w-[calc(100%-2rem)] flex-wrap",
    viewportHost: "h-[calc(100%-176px)] min-[641px]:h-full min-[641px]:w-[calc(100%-196px)]",
    viewport: "text-pk-ink",
    window:
      "relative h-full data-selected:outline-2 data-selected:outline-pk-accent data-selected:-outline-offset-2 has-[[data-slot=language-icon]]:border-0 has-[[data-slot=language-icon]]:rounded-none has-[[data-slot=language-icon]]:bg-transparent has-[[data-slot=language-icon]]:shadow-none",
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
  },
});

const BoardWindow = observer(function BoardWindow({
  canvas,
  window,
}: {
  canvas: Canvas;
  window: Observable<WindowState>;
}) {
  if (window.kind.get() === undefined)
    return canvas.computed.windowParent[window.id.get()].get() === undefined ? (
      <WindowDragHandle className={styles().container()}>
        {window.title.get() || "Group"}
      </WindowDragHandle>
    ) : null;
  return (
    <WindowDragHandle className="h-full cursor-grab">
      <Surface
        container
        padding="none"
        tone="card"
        className={styles().window()}
        data-selected={
          canvas.computed.selection.targets[`window:${window.id.get()}`].get() !== undefined ||
          undefined
        }
      >
        <WindowContent>
          <ComponentView canvas={canvas} window={window} components={components} />
        </WindowContent>
      </Surface>
    </WindowDragHandle>
  );
});

const BoardControls = observer(function BoardControls({ canvas }: { canvas: Canvas }) {
  const windows = canvas.computed.selectedWindows.map((window) => window.id.get());
  const first = canvas.computed.selectedWindows[0]?.kind.get();
  const actions =
    first === undefined
      ? []
      : Object.entries(canvas.configuration.components[first]?.actions ?? {});
  const error = syncState(canvas.state.document).error.get();
  return (
    <Row className={styles().controls()} role="group" aria-label="Canvas commands">
      <CanvasCommand command={canvas.commands.undo} input={{}} />
      <CanvasCommand command={canvas.commands.redo} input={{}} />
      <CanvasCommand command={canvas.commands.fitAll} input={{}} />
      <Button onClick={() => void canvas.commands.restoreDocument.run(JSON.parse(documentSource))}>
        Reset
      </Button>
      <CanvasCommand
        command={canvas.commands.groupWindows}
        input={{ windows, layout: { type: "grid", rowHeight: 40, compact: true } }}
      >
        Group selected
      </CanvasCommand>
      {actions
        .filter(([action]) => canvas.commands.runComponentAction.canRun({ action, windows }))
        .map(([action, definition]) => (
          <CanvasCommand
            key={action}
            command={canvas.commands.runComponentAction}
            input={{ action, windows }}
          >
            {definition.label}
          </CanvasCommand>
        ))}
      {error != null && <p role="alert">Board save failed: {String(error)}</p>}
    </Row>
  );
});

export function PortfolioBoard() {
  const [canvas] = useState(() => {
    const canvas = createCanvasState({
      document: JSON.parse(documentSource),
      windowDefinitions: components,
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
  return (
    <main className={styles().page()}>
      <BoardControls canvas={canvas} />
      <div className={styles().viewportHost()}>
        <CanvasViewport
          canvas={canvas}
          className={styles().viewport()}
          emptyCanvasDrag="marquee"
          renderWindow={(window) => <BoardWindow canvas={canvas} window={window} />}
        >
          <CanvasTools canvas={canvas} />
          <Palette.Root portal aria-label="Components" className={styles().palette()}>
            <Inspector canvas={canvas} />
            <header className={styles().paletteHeading()}>
              <Label>Components</Label>
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
            <Palette.Empty className={styles().paletteEmpty()}>
              No matching components.
            </Palette.Empty>
          </Palette.Root>
        </CanvasViewport>
      </div>
    </main>
  );
}
