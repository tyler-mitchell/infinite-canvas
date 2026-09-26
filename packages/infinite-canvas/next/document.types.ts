import type { Rect, Size } from "@hyphened/math/cpu";

export type WindowCapabilities = {
  closable: boolean;
  maximizable: boolean;
  minimizable: boolean;
  movable: boolean;
  resizable: boolean;
};

export type WindowLayout = { type: string } & Record<string, unknown>;

export type WindowState = {
  id: string;
  kind?: string;
  title: string;
  data?: unknown;
  layout?: WindowLayout;
  children?: string[];
  item?: Record<string, unknown>;
  navigable?: boolean;
  mode: "normal" | "minimized" | "maximized";
  isPinned: boolean;
  rect: Rect;
  restoreRect?: Rect;
  minSize?: Size;
  maxSize?: { width?: number; height?: number };
  aspectRatio?: number;
  capabilities?: Partial<WindowCapabilities>;
  heightMode: "content" | "manual";
  widthMode: "viewport" | "manual";
};

export type ConnectionState = {
  id: string;
  kind: string;
  from: string;
  to: string;
  data?: unknown;
};

export type WorkspaceState = {
  id: string;
  title: string;
  windowIds: string[];
};

export type Presentation = {
  axis: "horizontal" | "vertical";
  maxZoom: number;
};

export type DocumentState = {
  presentation: Presentation;
  windows: Record<string, WindowState>;
  connections: Record<string, ConnectionState>;
  workspaces: Record<string, WorkspaceState>;
  workspaceOrder: string[];
};
