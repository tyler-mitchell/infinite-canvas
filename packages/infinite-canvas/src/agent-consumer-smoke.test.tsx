import { expect, test, vi } from "vite-plus/test";
import { isValidElement, type CSSProperties, type ReactNode } from "react";

import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
  type InfiniteCanvasCommands,
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
    renderBody: ({ actions, window }) => {
      actions.selectWindow(window.id);
      actions.navigateToWindow({
        behavior: {
          type: "centerAtZoom",
          zoom: 1.2,
        },
        windowId: window.id,
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
    renderBody: ({ actions, window }) => {
      actions.openWindow(
        createInfiniteCanvasWindow<ConsumerWindowKind>({
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
      );
      actions.executeCommand({
        type: "view.fitAll",
      });

      return `opened from ${window.title}`;
    },
  },
});

/**
 * Every command, spied. A hand-written literal here has to be extended every time
 * the framework grows a command, and it broke on `closeGroup`, `redo`, `undo` and
 * nine others the moment groups and history landed. A proxy mints one `vi.fn()`
 * per property on first access and caches it, so `actions.focusWindow` is still a
 * stable spy and the mock never needs touching again.
 */
function createActionSpyCommands(): InfiniteCanvasCommands<ConsumerWindowKind> {
  const spies = new Map<string, ReturnType<typeof vi.fn>>();

  return new Proxy({} as InfiniteCanvasCommands<ConsumerWindowKind>, {
    get: (_target, property: string) => {
      const existing = spies.get(property);

      if (existing !== undefined) {
        return existing;
      }

      const spy = vi.fn();
      spies.set(property, spy);

      return spy;
    },
  });
}

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
  actions: InfiniteCanvasCommands<ConsumerWindowKind>,
): InfiniteCanvasWindowRenderContext<ConsumerWindowKind> {
  return {
    actions,
    isActive: state.activeWindowId === window.id,
    isSelected: state.selection.windowIds.includes(window.id),
    state,
    window,
  };
}

function createFrameRenderContext(
  window: InfiniteCanvasWindow<ConsumerWindowKind>,
  actions: InfiniteCanvasCommands<ConsumerWindowKind>,
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
    ...createRenderContext(window, actions),
    chrome: {
      borderWidth: 1,
      cornerSize: 8,
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
      selectionBounds: "#ffffff",
    },
  };
}

test("public infinite-canvas barrel supports a typed two-window consumer registry", () => {
  const actions = createActionSpyCommands();
  const noteBody = windowRegistry["agent-note"].renderBody?.(
    createRenderContext(getWindowById(state, noteWindow.id), actions),
  );
  const noteFrame = windowRegistry["agent-note"].renderFrame?.(
    createFrameRenderContext(getWindowById(state, noteWindow.id), actions),
  );
  const toolsBody = windowRegistry["agent-tools"].renderBody?.(
    createRenderContext(getWindowById(state, toolsWindow.id), actions),
  );

  expect(state.windows.map((window) => window.kind)).toEqual(["agent-note", "agent-tools"]);
  expect(state.selection).toEqual({
    anchorWindowId: noteWindow.id,
    windowIds: [noteWindow.id],
  });
  expect(noteBody).toBe("selected Agent note");
  expect(isValidElement(noteFrame)).toBe(true);
  expect(toolsBody).toBe("opened from Agent tools");
  expect(actions.selectWindow).toHaveBeenCalledWith(noteWindow.id);
  expect(actions.navigateToWindow).toHaveBeenCalledWith({
    behavior: {
      type: "centerAtZoom",
      zoom: 1.2,
    },
    windowId: noteWindow.id,
  });
  expect(actions.openWindow).toHaveBeenCalledWith(
    expect.objectContaining({
      id: "agent-note-2",
      kind: "agent-note",
      title: "Follow-up note",
    }),
  );
  expect(actions.executeCommand).toHaveBeenCalledWith({
    type: "view.fitAll",
  });
});
