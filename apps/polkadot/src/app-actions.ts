import {
  findInfiniteCanvasGroup,
  getSelectedWindowBounds,
  isInfiniteCanvasGroupContainer,
  type InfiniteCanvasCommands,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas";
import { type, type Type } from "arktype";

import { GROUP_LAYOUT_MODES } from "./canvas/group-layout-modes";
import { openItemWindow } from "./canvas/open-item";
import type { WindowKind } from "./canvas/window-registry";
import { LISTABLE_KINDS } from "./collections/listable-kinds";
import { getProjectContent, projectContent$ } from "./content/project-content";
import { openNewCollection } from "./collections/open-collection";
import { openNewNote } from "./notes/open-note";
import {
  connectItems,
  disconnectItems,
  findRelation,
  relations$,
  RELATION_KINDS,
  setRelationKind,
  setRelationLabel,
} from "./relations/relation-store";

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
 * A window is addressed by its id, for the same reason a stored item is.
 *
 * This took a title, arguing that ids were "a key nothing has" because `describeCanvas` reported
 * only titles. The premise was true and the conclusion was backwards: the fix is to report the id,
 * not to address by something that does not identify. Titles do not identify a window — measured,
 * two on one canvas both titled "Links" — so first-match revealed an arbitrary one of them, and a
 * caller reading the description had no way to say which it meant.
 *
 * `describeCanvas` now reports `[id]` per window, exactly as `content.list` does, so the handle is
 * one a caller holds by the time it can want it.
 */
const REVEAL_INPUT = type({ windowId: "string" });

/**
 * A stored item is addressed by id, and the difference from `window.reveal` is the point.
 *
 * A caller revealing a window is pointing at something it can see, and titles are what it sees. A
 * caller opening a stored record is pointing into a listing where titles are not distinguishing —
 * a project holds five "Untitled" notes without complaint, and first-match would open an arbitrary
 * one. `content.list` reports the id for exactly this reason.
 */
const OPEN_INPUT = type({ itemId: "string" });

/**
 * The question the one-entry-per-value shape could not ask.
 *
 * `collection.create.note` enumerates a kind, and there are four kinds. "Connected to *this* item"
 * enumerates nothing — the subject is whatever the caller is looking at — so this capability lived
 * only inside a palette row's `onClick`, reachable by a pointer and by nothing else. It is the case
 * `input` was added for.
 */
const CONNECTED_INPUT = type({ itemId: "string" });

/**
 * Joining two items, and the one place the entry-per-value rule is deliberately not applied.
 *
 * That rule — `collection.create.link` rather than a create verb taking a kind — exists to remove an
 * argument, so it pays wherever the values are the *only* argument. Here they are not: the endpoints
 * cannot be enumerated, so this verb takes input whichever way `kind` is expressed, and splitting it
 * five ways would publish five tools differing by one word while still requiring input. The enum
 * carries the same information in one place, and `toJsonSchema()` puts the five values in front of a
 * caller exactly as five entries would.
 *
 * Both ends are item ids, not window ids: an edge joins records, and the pair need not be open.
 */
const CONNECT_INPUT = type({
  "kind?": type.enumerated(...RELATION_KINDS),
  sourceItemId: "string",
  targetItemId: "string",
});

/** No kind, because disconnecting does not need to know what the edge claimed. */
const DISCONNECT_INPUT = type({ sourceItemId: "string", targetItemId: "string" });

/**
 * Changing what an existing edge says, named by its ends rather than by its id.
 *
 * `setRelationKind` takes a relation id because a person clicked a specific connector — "there is
 * nothing to resolve", as its own comment puts it. A caller that cannot see the canvas has clicked
 * nothing; it holds the item ids `content.list` gave it, and `findRelation` already turns a pair
 * into the edge between them. Addressing by pair also keeps the report honest: publishing a relation
 * id would be adding a handle purely so a verb could take it, when the handles already published
 * answer the question.
 *
 * `kind` is required here, unlike on `relation.connect`. Connecting without saying what it means is
 * a real intent — that is what the drag does — but re-typing an edge to nothing is not.
 */
const SET_KIND_INPUT = type({
  kind: type.enumerated(...RELATION_KINDS),
  sourceItemId: "string",
  targetItemId: "string",
});

/** Empty clears the label rather than storing `""`, which is the store's own rule, not a new one. */
const SET_LABEL_INPUT = type({
  label: "string",
  sourceItemId: "string",
  targetItemId: "string",
});

/**
 * The edge between two items, or `null` when they are not joined.
 *
 * Refusing rather than creating one is the whole distinction from `relation.connect`: a caller
 * asking what a connection means has asserted that it exists, and quietly inventing it would turn a
 * mistaken belief into a stored fact.
 */
const resolveRelation = (
  projectId: string,
  ends: Readonly<{ sourceItemId: string; targetItemId: string }>,
) => {
  const resolved = resolveEndpoints(projectId, ends);

  return resolved === null
    ? null
    : (findRelation(relations$.peek(), resolved.source, resolved.target) ?? null);
};

/**
 * Both ends resolved against the same cache `content.list` reads, so what a caller can list is what
 * it can join — the coherence `content.open` already keeps.
 *
 * An item joined to itself is refused rather than stored. The gesture cannot express it, because a
 * drag starts on one window and ends on another, so it has never been reachable; a verb that can
 * express it should not be the way a self-edge first enters the database.
 */
const resolveEndpoints = (
  projectId: string,
  ends: Readonly<{ sourceItemId: string; targetItemId: string }>,
) => {
  const items = getProjectContent(projectContent$.peek(), projectId);
  const source = items?.find((candidate) => candidate.id === ends.sourceItemId);
  const target = items?.find((candidate) => candidate.id === ends.targetItemId);

  return source === undefined || target === undefined || source.id === target.id
    ? null
    : { source: source.id, target: target.id };
};

/**
 * Naming a container, which the framework supports and its contextual commands do not expose.
 *
 * `group.setLayout.tabs` and its siblings act on *the active window's container* — the right shape
 * for a keyboard, where "the group" means the one you are in. A caller that cannot see the screen is
 * not in one, and had to reveal a member window first and hope it landed in the container it meant.
 *
 * The framework's own facade takes explicit ids — `setGroupLayoutMode({ containerId, groupId,
 * layout })`, `setGroupTitle`, `closeGroup` — so nothing here is a gap it needed to fill. What the
 * app adds is only the resolution: a caller holds the group id the canvas description publishes, and
 * the container id is a fact about that group's tree rather than something a caller should carry.
 */
const GROUP_LAYOUT_INPUT = type({
  groupId: "string",
  layout: type.enumerated(...GROUP_LAYOUT_MODES),
});

const GROUP_RENAME_INPUT = type({ groupId: "string", title: "string" });

const GROUP_INPUT = type({ groupId: "string" });

/**
 * The container a layout verb acts on, or `null` when the group has no shape to set.
 *
 * A group holding one window is a leaf rather than a container, and arranging one pane is not a
 * thing — the framework already reports every layout verb as unavailable there, measured on a live
 * canvas. Refusing here rather than reaching for `tree.id` regardless keeps the verb's answer the
 * same as the framework's.
 */
const resolveGroupContainer = (state: InfiniteCanvasState<WindowKind>, groupId: string) => {
  const group = findInfiniteCanvasGroup(state, groupId);

  return group === null || !isInfiniteCanvasGroupContainer(group.tree)
    ? null
    : { containerId: group.tree.id, groupId: group.id };
};

const APP_ACTIONS: readonly AppAction[] = [
  {
    description:
      "Arrange a group's panes side by side, folded, or as tabs. The group id comes from the canvas description.",
    id: "group.setLayout",
    input: GROUP_LAYOUT_INPUT,
    label: "Arrange a group",
    run: ({ actions, state }, input) => {
      const parsed = GROUP_LAYOUT_INPUT(input);

      if (parsed instanceof type.errors) {
        return;
      }

      const target = resolveGroupContainer(state, parsed.groupId);

      if (target !== null) {
        actions.setGroupLayoutMode({ ...target, layout: parsed.layout });
      }
    },
  },
  {
    description: "Rename a group. An empty title returns it to being named after what it holds.",
    id: "group.rename",
    input: GROUP_RENAME_INPUT,
    label: "Rename a group",
    run: ({ actions, state }, input) => {
      const parsed = GROUP_RENAME_INPUT(input);

      if (parsed instanceof type.errors) {
        return;
      }

      /*
       * Checked against state rather than dispatched blind, so an id naming no group does nothing
       * instead of writing a title into a record that is not there.
       */
      if (findInfiniteCanvasGroup(state, parsed.groupId) !== null) {
        actions.setGroupTitle({ groupId: parsed.groupId, title: parsed.title });
      }
    },
  },
  {
    description: "Ungroup a container, leaving its windows on the canvas where they were.",
    id: "group.dissolve",
    input: GROUP_INPUT,
    label: "Ungroup",
    run: ({ actions, state }, input) => {
      const parsed = GROUP_INPUT(input);

      if (parsed instanceof type.errors) {
        return;
      }

      if (findInfiniteCanvasGroup(state, parsed.groupId) !== null) {
        actions.closeGroup(parsed.groupId);
      }
    },
  },
  {
    description:
      "Connect two items, optionally saying what the connection means. Ids come from content.list.",
    id: "relation.connect",
    input: CONNECT_INPUT,
    label: "Connect two items",
    run: ({ projectId }, input) => {
      const parsed = CONNECT_INPUT(input);

      if (parsed instanceof type.errors) {
        return;
      }

      const ends = resolveEndpoints(projectId, parsed);

      if (ends !== null) {
        void connectItems({ kind: parsed.kind, projectId, ...ends });
      }
    },
  },
  {
    description:
      "Say what an existing connection between two items means. Refuses if they are not connected.",
    id: "relation.setKind",
    input: SET_KIND_INPUT,
    label: "Set what a connection means",
    run: ({ projectId }, input) => {
      const parsed = SET_KIND_INPUT(input);

      if (parsed instanceof type.errors) {
        return;
      }

      const relation = resolveRelation(projectId, parsed);

      if (relation !== null) {
        void setRelationKind({ kind: parsed.kind, projectId, relationId: relation.id });
      }
    },
  },
  {
    description:
      "Write a label on an existing connection between two items. An empty label clears it.",
    id: "relation.setLabel",
    input: SET_LABEL_INPUT,
    label: "Label a connection",
    run: ({ projectId }, input) => {
      const parsed = SET_LABEL_INPUT(input);

      if (parsed instanceof type.errors) {
        return;
      }

      const relation = resolveRelation(projectId, parsed);

      if (relation !== null) {
        void setRelationLabel({ label: parsed.label, projectId, relationId: relation.id });
      }
    },
  },
  {
    description: "Remove the connection between two items, if they are connected.",
    id: "relation.disconnect",
    input: DISCONNECT_INPUT,
    label: "Disconnect two items",
    run: ({ projectId }, input) => {
      const parsed = DISCONNECT_INPUT(input);

      if (parsed instanceof type.errors) {
        return;
      }

      const ends = resolveEndpoints(projectId, parsed);

      /*
       * Undirected, matching `findRelation`: a caller naming the pair in the other order means the
       * same edge. `database.relations.disconnect` removes the pair however it was stored, so the
       * order a caller happens to say is not a way to fail.
       */
      if (ends !== null) {
        void disconnectItems({ projectId, ...ends });
      }
    },
  },
  {
    description:
      "Open a window listing everything connected to the item with this id, as listed by content.list.",
    id: "collection.create.connectedTo",
    input: CONNECTED_INPUT,
    label: "Collection of what an item connects to",
    run: ({ actions, projectId, state }, input) => {
      const parsed = CONNECTED_INPUT(input);

      if (parsed instanceof type.errors) {
        return;
      }

      const item = getProjectContent(projectContent$.peek(), projectId)?.find(
        (candidate) => candidate.id === parsed.itemId,
      );

      if (item === undefined) {
        return;
      }

      // The title comes from the record, not from the caller. A collection named for a subject the
      // caller merely asserted could disagree with the subject it actually lists.
      void openNewCollection({
        actions,
        projectId,
        question: { connectedTo: item.id },
        state,
        title: `Connected to ${item.title}`,
      });
    },
  },
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
    description:
      "Bring the window with this id into view and make it the active one. Ids are reported by the canvas description.",
    id: "window.reveal",
    input: REVEAL_INPUT,
    label: "Reveal a window by id",
    run: ({ actions, state }, input) => {
      const parsed = REVEAL_INPUT(input);

      if (parsed instanceof type.errors) {
        return;
      }

      /*
       * Resolved against the state the description was built from, so what a caller can read and
       * what it can reveal are one set — the same coherence `content.open` keeps with `content.list`.
       * An id naming no window does nothing, rather than revealing something else.
       */
      const target = state.windows.find((window) => window.id === parsed.windowId);

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
