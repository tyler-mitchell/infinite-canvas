import {
  getSelectedWindowBounds,
  type InfiniteCanvasCommands,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas";

import type { WindowKind } from "./canvas/window-registry";
import { LISTABLE_KINDS } from "./collections/listable-kinds";
import { openNewCollection } from "./collections/open-collection";
import { openNewNote } from "./notes/open-note";

/**
 * What this app can do, as a vocabulary rather than a set of click handlers.
 *
 * The framework publishes its own through `getContextualCommands` — label, description and live
 * enablement per command — and everything Polkadot adds on top used to live inside an `onClick`.
 * That is a capability only a pointer can reach: it cannot be listed, described, enabled, or
 * invoked by anything else, which fails the WebMCP requirement in `AGENTS.md`.
 *
 * One entry per argument value rather than one entry taking an argument — `collection.create.link`
 * instead of a create-collection action with a kind. That is the framework's own shape
 * (`view.pan.right`, `group.setLayout.tabs`), and it means every entry is callable with no input
 * schema at all.
 */

type AppActionContext = Readonly<{
  actions: InfiniteCanvasCommands<WindowKind>;
  projectId: string;
  state: InfiniteCanvasState<WindowKind>;
}>;

type AppAction = Readonly<{
  description: string;
  id: string;
  /** Absent means always available. Read against live state, like the framework's own. */
  isEnabled?: (context: AppActionContext) => boolean;
  label: string;
  run: (context: AppActionContext) => void;
}>;

const APP_ACTIONS: readonly AppAction[] = [
  {
    description: "Put a new, empty note on the canvas.",
    id: "note.create",
    label: "New note",
    run: ({ actions, projectId, state }) => {
      void openNewNote({ actions, projectId, state });
    },
  },
  ...LISTABLE_KINDS.map((kind) => ({
    description: `Open a window listing every ${kind.label.toLowerCase().replace(/s$/, "")} in this project.`,
    id: `collection.create.${kind.kind}`,
    label: `Collection of ${kind.label.toLowerCase()}`,
    run: ({ actions, projectId, state }: AppActionContext) => {
      void openNewCollection({
        actions,
        projectId,
        question: { listsKind: kind.kind },
        state,
        title: kind.label,
      });
    },
  })),
  {
    description: "Dock the selected windows together into one group.",
    id: "group.createFromSelection",
    // Two is where a group means anything, and the framework refuses fewer.
    isEnabled: ({ state }) => state.selection.windowIds.length >= 2,
    label: "Group selected",
    run: ({ actions, state }) => {
      const rect = getSelectedWindowBounds(state);

      if (rect === null) {
        return;
      }

      actions.createGroup({
        groupId: globalThis.crypto.randomUUID(),
        rect,
        windowIds: state.selection.windowIds,
      });
      /*
       * Then look at it. Grouping does not move the windows — where they are is the whole point of
       * choosing them — so the shell is the union of wherever they happened to be, which can be
       * most of a screen away from the middle. Watched: two selected windows produced a shell whose
       * bottom edge sat at screen y=1021 in a 900-tall viewport, 289px below anything visible and
       * the rest of it behind the HUD. The verb had worked and looked like it had not.
       *
       * `fit` rather than `center`, because a shell is usually larger than either member and
       * centring one that does not fit shows you its middle.
       */
      actions.navigateToRect({ behavior: { paddingPx: 64, type: "fit" }, rect });
    },
  },
];

const getAppAction = (id: string) => APP_ACTIONS.find((action) => action.id === id);

/** Enablement resolved against live state, so a caller never has to know an action's rule. */
const isAppActionEnabled = (action: AppAction, context: AppActionContext) =>
  action.isEnabled?.(context) ?? true;

export { APP_ACTIONS, getAppAction, isAppActionEnabled };
export type { AppAction, AppActionContext };
