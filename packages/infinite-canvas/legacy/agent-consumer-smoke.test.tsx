import { getSelectedWindowIds } from "./selection";
import { expect, test, vi } from "vite-plus/test";
import { isValidElement, type CSSProperties, type ReactNode } from "react";

import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
  type InfiniteCanvasDispatch,
  type InfiniteCanvasWindowFrameRenderContext,
  type InfiniteCanvasState,
  type InfiniteCanvasWindow,
  type InfiniteCanvasWindowRenderContext,
} from "./index";

type ConsumerWindowKind = "agent-note" | "agent-tools";

const noteWindow = createInfiniteCanvasWindow<ConsumerWindowKind>({
  id: "agent-note-1",
  kind: "agent-note",
  rect: {
    height: 180,
    width: 260,
    x: 24,
    y: 32,
  },
  title: "Agent note",
});

const toolsWindow = createInfiniteCanvasWindow<ConsumerWindowKind>({
  id: "agent-tools-1",
  kind: "agent-tools",
  rect: {
    height: 220,
    width: 300,
    x: 340,
    y: 48,
  },
  title: "Agent tools",
});

const state = createInfiniteCanvasState<ConsumerWindowKind>({
  selection: [noteWindow.id],
  windows: [noteWindow, toolsWindow],
});

const windowRegistry = defineInfiniteCanvasWindowRegistry<ConsumerWindowKind>({
  "agent-note": {
    kind: "agent-note",
    renderBody: ({ dispatch, window }) => {
      dispatch({
        type: "selection.replace",
        targets: [{ type: "window" as const, id: window.id }],
      });
      dispatch({
        type: "camera.navigate",
        request: {
          behavior: {
            type: "centerAtZoom",
            zoom: 1.2,
          },
          target: { type: "window", windowId: window.id },
        },
      });

      return `selected ${window.title}`;
    },
    renderFrame: ({ frame }) => {
      const { Body, Header, Surface, Title } = frame;

      return (
        <Surface>
          <Header>
            <Title />
          </Header>
          <Body />
        </Surface>
      );
    },
  },
  "agent-tools": {
    kind: "agent-tools",
    renderBody: ({ dispatch, window }) => {
      dispatch({
        type: "window.open",
        window: createInfiniteCanvasWindow<ConsumerWindowKind>({
          id: "agent-note-2",
          kind: "agent-note",
          rect: {
            height: 180,
            width: 260,
            x: window.rect.x + 24,
            y: window.rect.y + 24,
          },
          title: "Follow-up note",
        }),
      });
      dispatch({ type: "view.fitAll" });

      return `opened from ${window.title}`;
    },
  },
});

function getWindowById(
  candidateState: InfiniteCanvasState<ConsumerWindowKind>,
  windowId: string,
): InfiniteCanvasWindow<ConsumerWindowKind> {
  const window = candidateState.windows.find((candidate) => candidate.id === windowId);

  if (window === undefined) {
    throw new Error(`Missing test window: ${windowId}`);
  }

  return window;
}

function createRenderContext(
  window: InfiniteCanvasWindow<ConsumerWindowKind>,
  dispatch: InfiniteCanvasDispatch<ConsumerWindowKind>,
): InfiniteCanvasWindowRenderContext<ConsumerWindowKind> {
  return {
    dispatch,
    // The canvas supplies this to a real renderer. Any size stands in for it here.
    bodySize: { height: window.rect.height, width: window.rect.width },
    isActive: state.activeWindowId === window.id,
    isSelected: getSelectedWindowIds(state.selection).includes(window.id),
    rect: window.rect,
    state,
    window,
  };
}

function createFrameRenderContext(
  window: InfiniteCanvasWindow<ConsumerWindowKind>,
  dispatch: InfiniteCanvasDispatch<ConsumerWindowKind>,
): InfiniteCanvasWindowFrameRenderContext<ConsumerWindowKind> {
  const Slot = ({
    children,
    className,
    style,
  }: Readonly<{ children?: ReactNode; className?: string; style?: CSSProperties }>) => (
    <div className={className} style={style}>
      {children}
    </div>
  );

  return {
    ...createRenderContext(window, dispatch),
    chrome: {
      borderWidth: 1,
      cornerSize: 8,
      groupLabelSize: 16,
      headerAccentHeight: 1,
      headerHeight: 28,
      resizeHandleSize: 12,
    },
    frame: {
      ActiveCorners: Slot,
      Body: Slot,
      Controls: Slot,
      Header: Slot,
      Surface: Slot,
      Title: Slot,
    },
    renderDefaultFrame: () => <Slot />,
    theme: {
      activeAccent: "#ffffff",
      activeBorder: "#ffffff",
      background: "#000000",
      bodyBackground: "#000000",
      gridMajor: "#111111",
      gridMinor: "#080808",
      headerActive: "#111111",
      headerIdle: "#080808",
      idleBorder: "#222222",
      selectionBorder: "#ffffff",
      revealedChange: "#ffffff",
      selectionBounds: "#ffffff",
    },
  };
}

test("public infinite-canvas barrel supports a typed two-window consumer registry", () => {
  const dispatch = vi.fn<InfiniteCanvasDispatch<ConsumerWindowKind>>();
  const noteBody = windowRegistry["agent-note"].renderBody?.(
    createRenderContext(getWindowById(state, noteWindow.id), dispatch),
  );
  const noteFrame = windowRegistry["agent-note"].renderFrame?.(
    createFrameRenderContext(getWindowById(state, noteWindow.id), dispatch),
  );
  const toolsBody = windowRegistry["agent-tools"].renderBody?.(
    createRenderContext(getWindowById(state, toolsWindow.id), dispatch),
  );

  expect(state.windows.map((window) => window.kind)).toEqual(["agent-note", "agent-tools"]);
  expect(state.selection).toEqual({
    anchorTarget: noteWindow.id === null ? null : { type: "window" as const, id: noteWindow.id! },
    targets: [{ type: "window" as const, id: noteWindow.id }],
  });
  expect(noteBody).toBe("selected Agent note");
  expect(isValidElement(noteFrame)).toBe(true);
  expect(toolsBody).toBe("opened from Agent tools");
  expect(dispatch).toHaveBeenCalledWith({
    type: "selection.replace",
    targets: [{ type: "window" as const, id: noteWindow.id }],
  });
  expect(dispatch).toHaveBeenCalledWith({
    type: "camera.navigate",
    request: {
      behavior: {
        type: "centerAtZoom",
        zoom: 1.2,
      },
      target: { type: "window", windowId: noteWindow.id },
    },
  });
  expect(dispatch).toHaveBeenCalledWith({
    type: "window.open",
    window: expect.objectContaining({
      id: "agent-note-2",
      kind: "agent-note",
      title: "Follow-up note",
    }),
  });
  expect(dispatch).toHaveBeenCalledWith({ type: "view.fitAll" });
});
