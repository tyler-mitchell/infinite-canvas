import type { CameraNavigation } from "./camera";
import type { Rect, Size } from "./geometry";

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
  mode: "normal" | "minimized" | "maximized";
  isPinned: boolean;
  rect: Rect;
  restoreRect?: Rect;
  minSize?: Size;
  maxSize?: Size;
  aspectRatio?: number;
  capabilities?: Partial<WindowCapabilities>;
  heightMode: "content" | "manual";
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

export type CameraStop = { id: string; title?: string; navigation: CameraNavigation };

export type DocumentState = {
  cameraStops: CameraStop[];
  windows: Record<string, WindowState>;
  connections: Record<string, ConnectionState>;
  workspaces: Record<string, WorkspaceState>;
  workspaceOrder: string[];
};
