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

/**
 * Layout recipes: a named arrangement you can save and put back.
 *
 * A recipe is a *relative* arrangement, stored with its origin at `(0, 0)` and a
 * `size`, so the same recipe drops into any region of an unbounded world. It
 * names windows by id rather than carrying them: applying it rearranges windows
 * that exist and silently skips ones that do not. A recipe restores where things
 * were, never what they were.
 *
 * **Recipes translate; they do not scale.** Fitting an arrangement into a smaller
 * region would shrink windows below their own `minSize`, and a recipe that
 * quietly violates a constraint the rest of the framework enforces is worse than
 * one that does not fit. An arrangement placed into a `rect` is centred in it at
 * its natural size.
 *
 * A group is captured only if *every* one of its members is. Half a group is not
 * a group: its tree would name windows the recipe never took, so those windows
 * are captured as floating instead. This is the same reason
 * `reconcileInfiniteCanvasGroups` runs on the way back in — a recipe saved before
 * a window was closed must not restore a shell laying out a ghost.
 */

const INFINITE_CANVAS_RECIPE_VERSION = 1;

function getUnionRect(rects: readonly InfiniteCanvasRect[]): InfiniteCanvasRect | null {
  const [first] = rects;

  if (first === undefined) {
    return null;
  }

  const bounds = rects.reduce(
    (union, rect) => ({
      maxX: Math.max(union.maxX, rect.x + rect.width),
      maxY: Math.max(union.maxY, rect.y + rect.height),
      minX: Math.min(union.minX, rect.x),
      minY: Math.min(union.minY, rect.y),
    }),
    { maxX: first.x + first.width, maxY: first.y + first.height, minX: first.x, minY: first.y },
  );

  return {
    height: bounds.maxY - bounds.minY,
    width: bounds.maxX - bounds.minX,
    x: bounds.minX,
    y: bounds.minY,
  };
}

function translateRect(rect: InfiniteCanvasRect, by: InfiniteCanvasPoint): InfiniteCanvasRect {
  return { height: rect.height, width: rect.width, x: rect.x + by.x, y: rect.y + by.y };
}

/**
 * Which windows a capture takes: the ones asked for, else the selection, else
 * everything on the canvas that could be selected. Minimized windows are never
 * captured — they have no arrangement to remember.
 */
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

/**
 * A group survives a capture only if the recipe took every one of its members.
 * Otherwise its tree would name a window that is not coming along.
 */
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
  const bounds = getUnionRect([
    ...windows.map((window) => window.rect),
    ...groups.map((group) => group.rect),
  ]);

  if (bounds === null) {
    return null;
  }

  // Store relative to the arrangement's own top-left, so it can be placed anywhere.
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
    windows: windows.map(
      (window): InfiniteCanvasRecipeWindow => ({
        isPinned: window.isPinned,
        mode: window.mode,
        rect: translateRect(window.rect, toOrigin),
        windowId: window.id,
        zIndex: window.zIndex,
      }),
    ),
  };
}

/** Where the arrangement's top-left lands. A `rect` centres it; an `origin` pins it. */
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

/**
 * Put an arrangement back. Windows the recipe does not name are untouched; windows
 * it names but the canvas has lost are skipped.
 *
 * Any group currently holding a recipe window is dissolved first: the recipe is
 * the authority on how its windows are arranged, and leaving a stale shell around
 * them would leave two things claiming to own the same window's rect.
 */
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
