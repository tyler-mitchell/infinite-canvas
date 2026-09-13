import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  findInfiniteCanvasGroup,
  parseInfiniteCanvasStateJson,
  type InfiniteCanvasCommands,
  type InfiniteCanvasGroupWindowNode,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas";

import type { PortfolioDocument, Widget } from "../content/model.ts";
import { componentInstance } from "../content/model.ts";
import { type } from "arktype";
import { BOARD_GROUP_ID, LATTICE, ROW_HEIGHT, TRACKS, WIDTH } from "./layout.ts";

export type BoardState = InfiniteCanvasState<"widget">;
export type BoardCommands = InfiniteCanvasCommands<"widget">;

export function widgetTitle(widget: Widget): string {
  switch (widget.kind) {
    case "profile":
      return widget.name;
    case "experience":
      return `${widget.role} · ${widget.organization}`;
    case "education":
      return widget.degree;
    default:
      return widget.title;
  }
}

function createWindow(widget: Widget) {
  return createInfiniteCanvasWindow<"widget">({
    id: widget.id,
    kind: "widget",
    title: widgetTitle(widget),
    data: {
      id: widget.id,
      kind: "component",
      revision: 0,
      component: { id: widget.kind, contractVersion: 1 },
      slots: {},
      props: {
        content: {
          kind: "binding",
          source: {
            kind: "record",
            record: { recordId: widget.id, model: { id: widget.kind, contractVersion: 1 } },
          },
          path: [],
        },
        expanded: { kind: "literal", value: false },
        rim: { kind: "literal", value: widget.kind === "profile" },
      },
    },
    rect: { x: 0, y: 0, width: (WIDTH * widget.span) / TRACKS, height: 1 },
    capabilities: { maximizable: false, minimizable: false },
    heightMode: "content",
  });
}

export function createBoardState(content: PortfolioDocument, rowHeight = ROW_HEIGHT): BoardState {
  const children = content.widgets.reduce<InfiniteCanvasGroupWindowNode[]>((placed, widget) => {
    const previous = placed.at(-1);
    const nextX = (previous?.x ?? 0) + (previous?.span ?? 0);
    const fits = nextX + widget.span <= TRACKS;
    const x = fits ? nextX : 0;
    const y = (previous?.y ?? 0) + (fits ? 0 : 1);
    return [
      ...placed,
      { id: widget.id, kind: "window", weight: 1, span: widget.span, rows: 1, x, y },
    ];
  }, []);

  return createInfiniteCanvasState<"widget">({
    camera: { center: { x: WIDTH / 2, y: 400 }, zoom: 0.85 },
    groups: [
      {
        id: BOARD_GROUP_ID,
        title: "",
        rect: { x: 0, y: 0, width: WIDTH, height: 1 },
        zIndex: 0,
        tree: {
          id: BOARD_GROUP_ID,
          kind: "container",
          layout: "masonry",
          axis: "horizontal",
          activeChildId: null,
          weight: 1,
          masonry: { ...LATTICE, rowHeight },
          children,
        },
      },
    ],
    windows: content.widgets.map(createWindow),
  });
}

export function loadBoardState(
  board: string | undefined,
  content: PortfolioDocument,
  rowHeight = ROW_HEIGHT,
): BoardState {
  const fresh = createBoardState(content, rowHeight);
  if (board === undefined) return fresh;
  return parseInfiniteCanvasStateJson<"widget">(board, fresh) ?? fresh;
}

/** Content owns membership; the canvas owns existing positions and detached windows. */
export function reconcileBoard({
  commands,
  state,
  content,
}: Readonly<{
  commands: BoardCommands;
  state: BoardState;
  content: PortfolioDocument;
}>) {
  const ids = new Set(content.widgets.map((widget) => widget.id));
  const windows = state.windows.filter((window) => {
    const node = componentInstance(window.data);
    if (node instanceof type.errors) return true;
    const property = node.props.content;
    return property?.kind !== "binding" || ids.has(property.source.record.recordId);
  });

  const present = new Set(windows.map((window) => window.id));
  for (const window of state.windows) {
    if (!present.has(window.id)) commands.closeWindow(window.id);
  }
  const added = content.widgets.filter((widget) => !present.has(widget.id));
  if (added.length > 0 && findInfiniteCanvasGroup(state, BOARD_GROUP_ID) === null) {
    const fresh = createBoardState({ widgets: added });
    commands.hydrate({
      ...state,
      groups: [...state.groups, ...fresh.groups],
      windows: [...windows, ...fresh.windows],
    });
    return;
  }

  for (const widget of added) {
    commands.openWindow(createWindow(widget));
    commands.dockWindow({
      containerId: BOARD_GROUP_ID,
      edge: "center",
      groupId: BOARD_GROUP_ID,
      targetId: BOARD_GROUP_ID,
      windowId: widget.id,
    });
  }
  commands.setGroupChildLayouts({
    groupId: BOARD_GROUP_ID,
    layouts: Object.fromEntries(
      content.widgets
        .filter(
          (widget) =>
            state.windows.find((window) => window.id === widget.id)?.heightMode !== "manual",
        )
        .map((widget) => [widget.id, { span: widget.span }]),
    ),
  });
  for (const widget of content.widgets) {
    commands.setWindowTitle({ windowId: widget.id, title: widgetTitle(widget) });
  }
}
