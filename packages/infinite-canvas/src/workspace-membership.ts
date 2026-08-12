import type { InfiniteCanvasState } from "./types";

/**
 * Who is on this desktop — the one question several modules need and none should answer
 * twice.
 *
 * It lives apart from `workspace.ts` because `selection.ts` needs it and `workspace.ts` needs
 * `selection.ts`: importing the rule from where the verbs live would be a cycle. Splitting the
 * *reader* from the *writers* is the same move `window-capabilities.ts` made, for the same
 * reason — a rule read from four directions belongs to none of them.
 */

/** The ids the active workspace admits, or `null` when none is active — which admits all. */
function getInfiniteCanvasWorkspaceWindowIds<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): ReadonlySet<string> | null {
  const active = state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId);

  return active === undefined ? null : new Set(active.windowIds);
}

/**
 * The same question about one window, without building the set.
 *
 * The set is right for a render pass asking about every window once; it is wrong for a single
 * lookup, which is what `getSelectableWindowIds` and a consumer's own checks do. An earlier
 * draft of this delegated to the function above and allocated a `Set` per call while its
 * comment claimed it existed to avoid exactly that.
 */
function isInfiniteCanvasWindowInActiveWorkspace<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
): boolean {
  const active = state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId);

  return active === undefined || active.windowIds.includes(windowId);
}

export { getInfiniteCanvasWorkspaceWindowIds, isInfiniteCanvasWindowInActiveWorkspace };
