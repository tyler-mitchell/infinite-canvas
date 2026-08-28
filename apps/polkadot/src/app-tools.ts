import { APP_ACTIONS, isAppActionEnabled, type AppActionContext } from "./app-actions";
import { describeCanvas } from "./canvas/describe-canvas";
import { describeProjectContent } from "./content/describe-content";
import { projectContent$ } from "./content/project-content";
import { canvases, content, projects } from "./database/operations";
import { getPublishedCanvasCommands } from "./published-commands";
import { relations$ } from "./relations/relation-store";

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

function getAppTools(
  input: Readonly<{ createContext: () => AppActionContext; projectId: string }>,
): readonly AppTool[] {
  return [
    ...getReportingTools(input),
    ...getCanvasCommandTools(input),
    ...getAppActionTools(input.createContext),
  ];
}

export { getAppTools };
export type { AppTool };
