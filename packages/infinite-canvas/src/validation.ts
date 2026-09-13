import { type } from "arktype";

import { canvasModel } from "./schema";
import type { InfiniteCanvasGroupNode } from "./group-tree";
import type {
  InfiniteCanvasCamera,
  InfiniteCanvasConnection,
  InfiniteCanvasGroup,
  InfiniteCanvasPoint,
  InfiniteCanvasRecipe,
  InfiniteCanvasRecipeGroup,
  InfiniteCanvasRecipeWindow,
  InfiniteCanvasRect,
  InfiniteCanvasSelection,
  InfiniteCanvasSerializedState,
  InfiniteCanvasSize,
  InfiniteCanvasWindow,
  InfiniteCanvasWorkspace,
} from "./types";

function parseInfiniteCanvasPoint(value: unknown): InfiniteCanvasPoint | null {
  const result = canvasModel.Point(value);
  return result instanceof type.errors ? null : result;
}

function parseInfiniteCanvasSize(value: unknown): InfiniteCanvasSize | null {
  const result = canvasModel.Size(value);
  return result instanceof type.errors ? null : result;
}

function parseInfiniteCanvasRect(value: unknown): InfiniteCanvasRect | null {
  const result = canvasModel.Rect(value);
  return result instanceof type.errors ? null : result;
}

function parseInfiniteCanvasCamera(value: unknown): InfiniteCanvasCamera | null {
  const result = canvasModel.Camera(value);
  return result instanceof type.errors ? null : result;
}

function parseInfiniteCanvasSelection(value: unknown): InfiniteCanvasSelection | null {
  const result = canvasModel.Selection(value);
  return result instanceof type.errors ? null : result;
}

function parseInfiniteCanvasWindow<Kind extends string>(value: unknown): InfiniteCanvasWindow<Kind> | null {
  const result = canvasModel.Window(value);
  if (result instanceof type.errors) return null;

  const { capabilities, ...window } = result;
  const withheld = Object.entries(capabilities ?? {}).filter(([, flag]) => flag === false);

  return {
    ...window,
    kind: window.kind as Kind,
    ...(withheld.length === 0 ? {} : { capabilities: Object.fromEntries(withheld) }),
  };
}

const MAX_GROUP_TREE_DEPTH = 256;

/** Bound recursion before parsing each child. */
function parseInfiniteCanvasGroupNode(value: unknown, depth = 0): InfiniteCanvasGroupNode | null {
  if (depth > MAX_GROUP_TREE_DEPTH) return null;

  const window = canvasModel.GroupWindowNode(value);
  if (!(window instanceof type.errors)) return window;

  const container = canvasModel.GroupContainerHeader(value);
  if (container instanceof type.errors) return null;

  const children = container.children.map((child) => parseInfiniteCanvasGroupNode(child, depth + 1));
  if (children.some((child) => child === null)) return null;

  return { ...container, children: children.filter((child) => child !== null) };
}

function parseInfiniteCanvasGroup(value: unknown): InfiniteCanvasGroup | null {
  const result = canvasModel.GroupHeader(value);
  if (result instanceof type.errors) return null;

  const tree = parseInfiniteCanvasGroupNode(result.tree);
  return tree === null ? null : { ...result, tree };
}

function parseInfiniteCanvasWorkspace(value: unknown): InfiniteCanvasWorkspace | null {
  const result = canvasModel.Workspace(value);
  return result instanceof type.errors ? null : result;
}

function parseInfiniteCanvasConnection(value: unknown): InfiniteCanvasConnection | null {
  const result = canvasModel.Connection(value);
  return result instanceof type.errors ? null : result;
}

function parseInfiniteCanvasRecipeWindow(value: unknown): InfiniteCanvasRecipeWindow | null {
  const result = canvasModel.RecipeWindow(value);
  return result instanceof type.errors ? null : result;
}

function parseInfiniteCanvasRecipeGroup(value: unknown): InfiniteCanvasRecipeGroup | null {
  const result = canvasModel.RecipeGroupHeader(value);
  if (result instanceof type.errors) return null;

  const tree = parseInfiniteCanvasGroupNode(result.tree);
  return tree === null ? null : { ...result, tree };
}

function parseInfiniteCanvasRecipe(value: unknown): InfiniteCanvasRecipe | null {
  const result = canvasModel.RecipeEnvelope(value);
  if (result instanceof type.errors) return null;

  const windows = result.windows.map(parseInfiniteCanvasRecipeWindow);
  const groups = result.groups.map(parseInfiniteCanvasRecipeGroup);
  if (windows.some((window) => window === null) || groups.some((group) => group === null)) return null;

  return {
    ...result,
    windows: windows.filter((window) => window !== null),
    groups: groups.filter((group) => group !== null),
  };
}

function parseInfiniteCanvasSerializedState<Kind extends string>(
  value: unknown,
): InfiniteCanvasSerializedState<Kind> | null {
  const result = canvasModel.PersistenceEnvelope(value);
  if (result instanceof type.errors) return null;

  const windows = result.windows.map((window) => parseInfiniteCanvasWindow<Kind>(window));
  const groups = (result.groups ?? []).map(parseInfiniteCanvasGroup);
  if (windows.some((window) => window === null) || groups.some((group) => group === null)) return null;

  return {
    ...result,
    version: 4,
    windows: windows.filter((window) => window !== null),
    groups: groups.filter((group) => group !== null),
    connections: result.connections ?? [],
    workspaces: result.version >= 3 ? (result.workspaces ?? []) : [],
    activeWorkspaceId: result.version >= 3 ? result.activeWorkspaceId : undefined,
  };
}

export {
  parseInfiniteCanvasCamera,
  parseInfiniteCanvasConnection,
  parseInfiniteCanvasGroup,
  parseInfiniteCanvasGroupNode,
  parseInfiniteCanvasPoint,
  parseInfiniteCanvasRecipe,
  parseInfiniteCanvasRect,
  parseInfiniteCanvasSelection,
  parseInfiniteCanvasSerializedState,
  parseInfiniteCanvasSize,
  parseInfiniteCanvasWindow,
  parseInfiniteCanvasWorkspace,
};
