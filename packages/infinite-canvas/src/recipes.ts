import { unionRects } from "./geometry";
import { reconcileInfiniteCanvasGroups } from "./group-state";
import { getInfiniteCanvasGroupWindowIds } from "./group-tree";
import { getSelectableWindowIds } from "./selection";
import type {
  InfiniteCanvasGroup,
  InfiniteCanvasPoint,
  InfiniteCanvasRecipe,
  InfiniteCanvasRecipePlacement,
  InfiniteCanvasRecipeWindow,
  InfiniteCanvasRect,
  InfiniteCanvasState,
} from "./types";

/** Captures and applies relative window arrangements without resizing windows. */
const INFINITE_CANVAS_RECIPE_VERSION = 1;

function translateRect(rect: InfiniteCanvasRect, by: InfiniteCanvasPoint): InfiniteCanvasRect {
  return { height: rect.height, width: rect.width, x: rect.x + by.x, y: rect.y + by.y };
}

/** Uses explicit IDs, then the selection, then all selectable windows. */
function getInfiniteCanvasRecipeWindowIds<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowIds: readonly string[] | undefined,
): readonly string[] {
  const selectable = new Set(getSelectableWindowIds(state));
  const requested =
    windowIds ??
    (state.selection.windowIds.length > 0 ? state.selection.windowIds : [...selectable]);

  return requested.filter((windowId) => selectable.has(windowId));
}

/** Captures a group only when all members are present. */
function getCapturableGroups(
  groups: readonly InfiniteCanvasGroup[],
  capturedWindowIds: ReadonlySet<string>,
): readonly InfiniteCanvasGroup[] {
  return groups.filter((group) =>
    getInfiniteCanvasGroupWindowIds(group.tree).every((windowId) =>
      capturedWindowIds.has(windowId),
    ),
  );
}

function captureInfiniteCanvasRecipe<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{ name: string; recipeId: string; windowIds?: readonly string[] }>,
): InfiniteCanvasRecipe | null {
  const capturedWindowIds = new Set(getInfiniteCanvasRecipeWindowIds(state, input.windowIds));
  const windows = state.windows.filter((window) => capturedWindowIds.has(window.id));

  if (windows.length === 0) {
    return null;
  }

  const groups = getCapturableGroups(state.groups, capturedWindowIds);
  const bounds = unionRects([
    ...windows.map((window) => window.rect),
    ...groups.map((group) => group.rect),
  ]);

  if (bounds === null) {
    return null;
  }

  const toOrigin = { x: -bounds.x, y: -bounds.y };

  return {
    groups: groups.map((group) => ({
      groupId: group.id,
      rect: translateRect(group.rect, toOrigin),
      title: group.title,
      tree: group.tree,
      zIndex: group.zIndex,
    })),
    id: input.recipeId,
    name: input.name,
    size: { height: bounds.height, width: bounds.width },
    version: INFINITE_CANVAS_RECIPE_VERSION,
    windows: windows.map((window): InfiniteCanvasRecipeWindow => ({
      isPinned: window.isPinned,
      mode: window.mode,
      rect: translateRect(window.rect, toOrigin),
      windowId: window.id,
      zIndex: window.zIndex,
    })),
  };
}

/** Places the recipe at an origin or centers it in a rect. */
function getInfiniteCanvasRecipeOrigin(
  recipe: InfiniteCanvasRecipe,
  placement: InfiniteCanvasRecipePlacement,
): InfiniteCanvasPoint {
  if ("origin" in placement) {
    return placement.origin;
  }

  const { rect } = placement;

  return {
    x: rect.x + (rect.width - recipe.size.width) / 2,
    y: rect.y + (rect.height - recipe.size.height) / 2,
  };
}

/** Applies a recipe to live windows and removes conflicting groups first. */
function applyInfiniteCanvasRecipe<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  recipe: InfiniteCanvasRecipe,
  placement: InfiniteCanvasRecipePlacement,
): InfiniteCanvasState<Kind> {
  const liveWindowIds = new Set(state.windows.map((window) => window.id));
  const members = recipe.windows.filter((window) => liveWindowIds.has(window.windowId));

  if (members.length === 0) {
    return state;
  }

  const origin = getInfiniteCanvasRecipeOrigin(recipe, placement);
  const memberById = new Map(members.map((member) => [member.windowId, member]));
  const restoredGroupIds = new Set(recipe.groups.map((group) => group.groupId));
  const surviving = state.groups.filter(
    (group) =>
      !restoredGroupIds.has(group.id) &&
      !getInfiniteCanvasGroupWindowIds(group.tree).some((windowId) => memberById.has(windowId)),
  );
  const restored: InfiniteCanvasGroup[] = recipe.groups.map((group) => ({
    id: group.groupId,
    rect: translateRect(group.rect, origin),
    title: group.title,
    tree: group.tree,
    zIndex: group.zIndex,
  }));

  return reconcileInfiniteCanvasGroups({
    ...state,
    groups: [...surviving, ...restored],
    windows: state.windows.map((window) => {
      const member = memberById.get(window.id);

      return member === undefined
        ? window
        : {
            ...window,
            isPinned: member.isPinned,
            mode: member.mode,
            rect: translateRect(member.rect, origin),
            zIndex: member.zIndex,
          };
    }),
  });
}

export {
  INFINITE_CANVAS_RECIPE_VERSION,
  applyInfiniteCanvasRecipe,
  captureInfiniteCanvasRecipe,
  getInfiniteCanvasRecipeOrigin,
};
