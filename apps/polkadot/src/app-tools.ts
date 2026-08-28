import { APP_ACTIONS, isAppActionEnabled, type AppActionContext } from "./app-actions";
import { describeCanvas } from "./canvas/describe-canvas";
import { describeProjectContent } from "./content/describe-content";
import { projectContent$ } from "./content/project-content";
import { canvases, content, projects } from "./database/operations";
import { getPublishedCanvasCommands } from "./published-commands";
import { relations$ } from "./relations/relation-store";
import { getSavedViews, loadSavedViews, savedViews$ } from "./views/saved-views";

/**
 * Everything a caller can do or ask, by name.
 *
 * One list rather than one per surface. WebMCP registers it and the dev handle exposes it, so a
 * verb reachable by an agent is reachable from a console without being declared twice.
 */
type AppTool = Readonly<{
  description: string;
  execute: (input?: unknown) => Promise<string>;
  /** JSON Schema. Empty properties means the tool takes no argument. */
  inputSchema: object;
  name: string;
}>;

const NO_INPUT = { properties: {}, type: "object" } as const;

const report = (description: string, name: string, execute: () => Promise<string>): AppTool => ({
  description,
  execute,
  inputSchema: NO_INPUT,
  name,
});

/** Reporters, because a verb-only vocabulary is half a vocabulary for anything that cannot see. */
const getReportingTools = (
  input: Readonly<{ createContext: () => AppActionContext; projectId: string }>,
): readonly AppTool[] => [
  report(
    "Describe what is on the canvas: zoom, the open windows and their kinds, groups, and the selection.",
    "canvas.describe",
    async () => describeCanvas(input.createContext().state),
  ),
  report(
    "List everything this project holds and how it is connected, saying which items are already open on the canvas.",
    "content.list",
    async () =>
      describeProjectContent({
        listing: projectContent$.peek(),
        projectId: input.projectId,
        relations: relations$.peek(),
        state: input.createContext().state,
      }),
  ),
  report(
    "List the items archived out of this project, with the ids content.restore takes.",
    "content.listArchived",
    async () => {
      const items = await content.listArchived({ projectId: input.projectId });

      return items.length === 0
        ? "Nothing is archived in this project."
        : `${String(items.length)} archived: ${items
            .map((item) => `${item.kind} "${item.title}" [${item.id}]`)
            .join("; ")}.`;
    },
  ),
  report(
    "List the canvases in this project, with the ids canvas.open takes, marking the open one.",
    "canvas.list",
    async () => {
      const records = await canvases.list(input.projectId);
      const openId = input.createContext().canvasId;

      return records.length === 0
        ? "This project holds no canvases."
        : records
            .map(
              (record) =>
                `"${record.title}" [${record.id}]${record.id === openId ? " — open" : ""}`,
            )
            .join("; ");
    },
  ),
  /*
   * Loaded rather than peeked, unlike `content.list`.
   *
   * This is the entry point the other four `view.*` verbs send a caller to, and they resolve
   * synchronously against `savedViews$`. Reading through `loadSavedViews` means calling this warms
   * the cache they depend on, so the documented flow — list, then act on an id — works from cold
   * rather than only after the views menu has been opened by a person.
   */
  report(
    "List the framings saved on this canvas, with the ids view.open, view.reframe and view.remove take.",
    "view.list",
    async () => {
      const context = input.createContext();

      await loadSavedViews(context.canvasId);

      const views = getSavedViews(savedViews$.peek(), context.canvasId) ?? [];

      return views.length === 0
        ? "No views are saved on this canvas."
        : views.map((view) => `"${view.title}" [${view.id}]`).join("; ");
    },
  ),
  report(
    "List the canvases archived out of this project, with the ids canvas.restore takes.",
    "canvas.listArchived",
    async () => {
      const records = await canvases.listArchived(input.projectId);

      return records.length === 0
        ? "No canvases are archived in this project."
        : records.map((record) => `"${record.title}" [${record.id}]`).join("; ");
    },
  ),
  report(
    "List the projects archived in this browser, with the ids project.restore takes.",
    "project.listArchived",
    async () => {
      const records = await projects.listArchived();

      return records.length === 0
        ? "No projects are archived."
        : records.map((record) => `"${record.title}" [${record.id}]`).join("; ");
    },
  ),
  report(
    "List the projects in this browser, with the ids project.open takes, marking the open one.",
    "project.list",
    async () => {
      const records = await projects.list();

      return records.length === 0
        ? "There are no projects."
        : records
            .map(
              (record) =>
                `"${record.title}" [${record.id}]${record.id === input.projectId ? " — open" : ""}`,
            )
            .join("; ");
    },
  ),
];

const published = (
  input: Readonly<{ createContext: () => AppActionContext; projectId: string }>,
) => {
  const context = input.createContext();

  return getPublishedCanvasCommands({
    actions: context.actions,
    projectId: input.projectId,
    state: context.state,
  });
};

/** Enablement is re-derived at call time: a list is built once and the canvas changes under it. */
const getCanvasCommandTools = (
  input: Readonly<{ createContext: () => AppActionContext; projectId: string }>,
): readonly AppTool[] =>
  published(input).map((entry) => ({
    description: entry.description,
    execute: async () => {
      const live = published(input).find((candidate) => candidate.id === entry.id);

      if (live === undefined || !live.enabled) {
        return `${entry.label} is not available right now.`;
      }

      live.run();

      return `${entry.label} done.`;
    },
    inputSchema: NO_INPUT,
    name: entry.id,
  }));

const getAppActionTools = (createContext: () => AppActionContext): readonly AppTool[] =>
  APP_ACTIONS.map((action) => ({
    description: action.description,
    execute: async (raw?: unknown) => {
      const context = createContext();

      if (!isAppActionEnabled(action, context)) {
        return `${action.label} is not available right now.`;
      }

      // Unchecked here: the verb narrows with the same type this schema came from. Awaited so a
      // write verb's "done" means written — a caller reading back has no second source.
      return (await action.run(context, raw)) ?? `${action.label} done.`;
    },
    inputSchema: action.input?.toJsonSchema() ?? NO_INPUT,
    name: action.id,
  }));

/**
 * What is available right now, which the tool list itself cannot say.
 *
 * WebMCP publishes a fixed set of tools and carries no enablement, so a caller holding a hundred
 * names has no way to tell which apply to this canvas and this selection. Without this it has to
 * invoke one and read "is not available right now" — discovery by failed attempt.
 *
 * Enablement is already computed for every entry, by the framework for its own verbs and by
 * `isAppActionEnabled` for this app's. This reports it rather than deriving it a second way.
 */
const getAvailabilityTool = (
  input: Readonly<{ createContext: () => AppActionContext; projectId: string }>,
): AppTool =>
  report(
    "List the verbs that can run right now, given what is open and selected. Names are the tool names.",
    "command.list",
    async () => {
      const context = input.createContext();
      const live = [
        ...published(input).map((entry) => ({ enabled: entry.enabled, name: entry.id })),
        ...APP_ACTIONS.map((action) => ({
          enabled: isAppActionEnabled(action, context),
          name: action.id,
        })),
      ];
      const available = live.filter((entry) => entry.enabled).map((entry) => entry.name);
      const blocked = live.filter((entry) => !entry.enabled).map((entry) => entry.name);

      return `Available now: ${available.join(", ")}. Not available right now: ${
        blocked.length === 0 ? "nothing" : blocked.join(", ")
      }.`;
    },
  );

/**
 * Reading the database directly, which no published verb does or should.
 *
 * Every verb answers from the app's own state and returns once its write lands. That is the right
 * contract and it is not enough to *check* one: confirming a write means asking the database what
 * it holds, and the only thing that could was `window.__surreal` — a console affordance an agent
 * driving WebMCP cannot reach.
 *
 * Development only, and this is the reason the tier exists. `query` runs arbitrary SurQL, so it
 * bypasses every schema, refusal and revision guard the vocabulary enforces. Shipping it would make
 * those guards optional for anything that could reach this list.
 *
 * Imported inside `execute` rather than at module scope, the same way `inspector-handle` defers
 * `database.client`: the branch below is eliminated from a production build, a top-level import
 * would not be, and the inspector pulls the engine in behind it.
 */
const getDevelopmentTools = (): readonly AppTool[] => {
  const connect = async () => {
    const [{ createSurrealInspectorHandle }, { localDatabaseSources }] = await Promise.all([
      import("surreal-inspector"),
      import("./database/inspector-handle"),
    ]);

    return createSurrealInspectorHandle(localDatabaseSources);
  };

  return [
    {
      description:
        "Development only. Run SurQL against the local database and return its rows. Use it to confirm what a verb actually wrote.",
      execute: async (raw?: unknown) => {
        const statement = (raw as Readonly<{ statement?: unknown }> | undefined)?.statement;

        if (typeof statement !== "string" || statement.trim() === "") {
          return "Refused: statement must be a non-empty string of SurQL.";
        }

        const outcome = await (await connect()).query(statement);

        return outcome.error === null
          ? JSON.stringify(outcome.results)
          : `Refused: ${outcome.error}`;
      },
      inputSchema: {
        properties: { statement: { type: "string" } },
        required: ["statement"],
        type: "object",
      },
      name: "database.query",
    },
    report(
      "Development only. Report the local database: its tables, their row counts, and whether the installed schema matches the source.",
      "database.report",
      async () => JSON.stringify(await (await connect()).report()),
    ),
  ];
};

/**
 * One interface for every caller, with availability a property of a tool rather than of a door.
 *
 * The verbs below already reach production through WebMCP. A second transport for the same list —
 * a `window` global — would be reachable by any script on a page that renders third-party content,
 * where WebMCP is mediated by an agent and gated by a permissions policy. So the development-only
 * half is registered here, on the same interface, rather than exposed beside it.
 *
 * `development` is passed in rather than read from `import.meta.env` here. A gate this module
 * decided for itself could not be exercised from a test — `DEV` is true under `vp test`, so an
 * assertion would pass whether or not the gate existed. The caller holds the environment; this
 * holds the rule.
 */
function getAppTools(
  input: Readonly<{
    createContext: () => AppActionContext;
    development: boolean;
    projectId: string;
  }>,
): readonly AppTool[] {
  return [
    ...getReportingTools(input),
    getAvailabilityTool(input),
    ...getCanvasCommandTools(input),
    ...getAppActionTools(input.createContext),
    ...(input.development ? getDevelopmentTools() : []),
  ];
}

export { getAppTools };
export type { AppTool };
