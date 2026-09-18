import { APP_ACTIONS, isAppActionEnabled, type AppActionContext } from "./app-actions";
import type { InfiniteCanvasContextualCommand } from "@hyphened/infinite-canvas";
import { describeCanvas } from "./canvas/describe-canvas";
import { describeProjectContent } from "./content/describe-content";
import { projectContent$ } from "./content/project-content";
import { canvases, content, projects } from "./database/operations";
import { getPublishedCanvasCommands } from "./published-commands";
import { getLoadedRelations } from "./relations/relation-store";
import { getSavedViews, loadSavedViews, savedViews$ } from "./views/saved-views";

type AppTool = Readonly<{
  description: string;
  execute: (input?: unknown) => Promise<string>;
  /** Empty JSON Schema properties mean that the tool takes no argument. */
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

const getReportingTools = (
  input: Readonly<{
    getContextualCommands: () => readonly InfiniteCanvasContextualCommand[];
    createContext: () => AppActionContext;
    projectId: string;
  }>,
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
        listing: projectContent$[input.projectId].peek(),
        projectId: input.projectId,
        relations: getLoadedRelations(input.projectId),
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
  report(
    "List the framings saved on this canvas, with the ids view.open, view.reframe and view.remove take.",
    "view.list",
    async () => {
      const context = input.createContext();

      await loadSavedViews(context.canvasId);

      const views = getSavedViews(savedViews$[context.canvasId].peek(), context.canvasId) ?? [];

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
  input: Readonly<{
    getContextualCommands: () => readonly InfiniteCanvasContextualCommand[];
    createContext: () => AppActionContext;
    projectId: string;
  }>,
) => {
  const context = input.createContext();

  return getPublishedCanvasCommands({
    commands: input.getContextualCommands(),
    dispatch: context.dispatch,
    projectId: input.projectId,
    state: context.state,
  });
};

const getCanvasCommandTools = (
  input: Readonly<{
    getContextualCommands: () => readonly InfiniteCanvasContextualCommand[];
    createContext: () => AppActionContext;
    projectId: string;
  }>,
): readonly AppTool[] =>
  published(input).map((entry) => ({
    description: entry.description,
    execute: async () => {
      const live = published(input).find((candidate) => candidate.id === entry.id);

      if (live === undefined || !live.enabled) {
        return `${entry.label} is not available right now.`;
      }

      await live.run();

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

      return (await action.run(context, raw)) ?? `${action.label} done.`;
    },
    inputSchema: action.input?.toJsonSchema() ?? NO_INPUT,
    name: action.id,
  }));

const getAvailabilityTool = (
  input: Readonly<{
    getContextualCommands: () => readonly InfiniteCanvasContextualCommand[];
    createContext: () => AppActionContext;
    projectId: string;
  }>,
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

// Development tools are excluded from production builds.
const getDevelopmentTools = (): readonly AppTool[] => {
  const connect = async () => {
    const [{ createSurrealInspectorHandle }, { localDatabaseSources }] = await Promise.all([
      import("surreal-inspector"),
      import("./database/inspector-handle"),
    ]);

    return createSurrealInspectorHandle(localDatabaseSources);
  };

  return [
    // Development only. This query bypasses schemas and revision guards.
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

function getAppTools(
  input: Readonly<{
    getContextualCommands: () => readonly InfiniteCanvasContextualCommand[];

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
