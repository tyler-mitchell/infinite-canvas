import {
  getSelectedWindowBounds,
  type InfiniteCanvasCommands,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas";
import { type, type Type } from "arktype";

import { openItemWindow } from "./canvas/open-item";
import type { WindowKind } from "./canvas/window-registry";
import { LISTABLE_KINDS } from "./collections/listable-kinds";
import { getProjectContent, projectContent$ } from "./content/project-content";
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
 * (`view.pan.right`, `group.setLayout.tabs`), and it is right wherever the values can be listed.
 *
 * `input` is for the arguments that cannot: a title, an id, anything drawn from the document rather
 * than from a fixed set. One ArkType declaration serves both halves — `toJsonSchema()` is what a
 * tool caller is offered, and the same type validates what comes back — so the shape a caller is
 * promised and the shape the verb accepts cannot drift apart. An entry with `input` is deliberately
 * not a palette row: a row has no way to supply an argument.
 */

type AppActionContext = Readonly<{
  actions: InfiniteCanvasCommands<WindowKind>;
  projectId: string;
  state: InfiniteCanvasState<WindowKind>;
}>;

type AppAction = Readonly<{
  description: string;
  id: string;
  /** Absent means the verb takes no argument, which is most of them. */
  input?: Type<object>;
  /** Absent means always available. Read against live state, like the framework's own. */
  isEnabled?: (context: AppActionContext) => boolean;
  label: string;
  /**
   * `input` arrives unvalidated and the verb narrows it with its own `input` type.
   *
   * One validation site rather than two: a caller that checked first and handed over a trusted
   * object would need a cast here, and a cast is where the schema and the code start disagreeing
   * silently. Verbs with no `input` ignore the parameter.
   */
  run: (context: AppActionContext, input?: unknown) => void;
}>;

/**
 * A window is addressed by its title, because that is the handle a caller actually holds.
 *
 * `describeCanvas` reports titles; window ids are uuids that appear nowhere a caller can read.
 * Offering an id would be offering a key nothing has.
 */
const REVEAL_INPUT = type({ title: "string" });

/**
 * A stored item is addressed by id, and the difference from `window.reveal` is the point.
 *
 * A caller revealing a window is pointing at something it can see, and titles are what it sees. A
 * caller opening a stored record is pointing into a listing where titles are not distinguishing —
 * a project holds five "Untitled" notes without complaint, and first-match would open an arbitrary
 * one. `content.list` reports the id for exactly this reason.
 */
const OPEN_INPUT = type({ itemId: "string" });

const APP_ACTIONS: readonly AppAction[] = [
  {
    description:
      "Open a stored item on the canvas by its id, as listed by content.list. Reveals it if a window already shows it.",
    id: "content.open",
    input: OPEN_INPUT,
    label: "Open an item by id",
    run: ({ actions, projectId, state }, input) => {
      const parsed = OPEN_INPUT(input);

      if (parsed instanceof type.errors) {
        return;
      }

      /*
       * Resolved against the same cache `content.list` reads, rather than re-queried. That is not
       * an optimisation — it is what makes the pair coherent: what a caller can list and what it
       * can open are one set, and an id that listed a moment ago cannot fail here for having come
       * from a different read.
       */
      const item = getProjectContent(projectContent$.peek(), projectId)?.find(
        (candidate) => candidate.id === parsed.itemId,
      );

      if (item !== undefined) {
        // Already handles the record being open: `openContentWindow` reveals the existing window
        // rather than binding a second one to it, which is the rule the library rail learned first.
        openItemWindow({ actions, item, state });
      }
    },
  },
  {
    description: "Bring the window with this title into view and make it the active one.",
    id: "window.reveal",
    input: REVEAL_INPUT,
    label: "Reveal a window by title",
    run: ({ actions, state }, input) => {
      const parsed = REVEAL_INPUT(input);

      if (parsed instanceof type.errors) {
        return;
      }

      /*
       * Titles are not unique — two untitled notes are both "Untitled". The first match is the
       * honest answer to an ambiguous question, and the alternative, refusing whenever a title
       * repeats, would make the verb useless on exactly the canvases where it is most needed.
       */
      const target = state.windows.find((window) => window.title === parsed.title);

      if (target !== undefined) {
        // `window.reveal` rather than `focusWindow`: the framework's verb already handles a window
        // that is minimized, behind a tab, or on another desktop. Focusing alone reaches none of those.
        actions.executeCommand({ type: "window.reveal", windowId: target.id });
      }
    },
  },
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
