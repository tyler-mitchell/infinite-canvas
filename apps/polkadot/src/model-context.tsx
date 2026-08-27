import { useInfiniteCanvasActions, useInfiniteCanvasStore } from "@hyphened/infinite-canvas";
import { useEffect } from "react";

import { APP_ACTIONS, isAppActionEnabled } from "./app-actions";
import { describeCanvas } from "./canvas/describe-canvas";
import type { WindowKind } from "./canvas/window-registry";
import { describeProjectContent } from "./content/describe-content";
import { projectContent$ } from "./content/project-content";
import { relations$ } from "./relations/relation-store";

/**
 * The app's vocabulary, offered to an agent running in the browser.
 *
 * WebMCP is the page half of MCP: a document registers named tools and an agent in the browser
 * calls them, instead of driving the DOM and guessing what a click did. `AGENTS.md` records why
 * that shapes the architecture rather than decorating it — a capability lives in the command
 * vocabulary first and a control calls it, so the pointer, the palette and an agent all reach the
 * same verb. This file is the third caller, and it adds no capability of its own.
 *
 * Most entries take no argument, because the vocabulary uses one entry per argument value the way
 * the framework's own commands do (`view.pan.right`, `group.setLayout.tabs`). The ones whose
 * argument cannot be enumerated carry an ArkType `input`, and its `toJsonSchema()` is what a caller
 * is offered — the same declaration the verb narrows with, so the promised shape and the accepted
 * shape are one thing.
 *
 * `canvas.describe` is registered here too and is not an `AppAction`: it reports rather than acts,
 * and `APP_ACTIONS` is rendered as palette rows where a row that only returns text does nothing.
 *
 * UNVERIFIED, and deliberately shipped that way. WebMCP is behind `enable-webmcp-testing` in
 * Chrome 146 and in an origin trial from 149; the browser this was written against is 148, where
 * the API is absent under both names. So this has never executed — it is feature-detected and
 * inert, and the first person with the flag on should treat it as a draft that typechecks rather
 * than as working code. `document.modelContext` is the current home; `navigator.modelContext` is
 * the pre-150 name, kept because it is what a 146 flag build exposes.
 */

type ModelContextRegistry = Readonly<{
  registerTool: (tool: {
    description: string;
    execute: (
      input?: unknown,
    ) => Promise<Readonly<{ content: readonly Readonly<{ text: string; type: "text" }>[] }>>;
    inputSchema: object;
    name: string;
  }) => unknown;
}>;

/** A verb that takes nothing still has to say so; an absent schema is not the same as an empty one. */
const NO_INPUT = { properties: {}, type: "object" } as const;

const getModelContext = (): ModelContextRegistry | null => {
  if (typeof document === "undefined") {
    return null;
  }

  const candidate =
    (document as unknown as Readonly<{ modelContext?: ModelContextRegistry }>).modelContext ??
    (navigator as unknown as Readonly<{ modelContext?: ModelContextRegistry }>).modelContext;

  return typeof candidate?.registerTool === "function" ? candidate : null;
};

/**
 * Renders nothing. It exists to own the registration's lifetime, which is the canvas's.
 *
 * Inside the provider rather than above it, because an action reads live state: `peek` rather than
 * a selector, for the same reason the selection rail peeks — a tool call needs the state at call
 * time, and subscribing would re-run this on every camera tick.
 */
function ModelContextTools({ projectId }: Readonly<{ projectId: string }>) {
  const actions = useInfiniteCanvasActions<WindowKind>();
  const store = useInfiniteCanvasStore<WindowKind>();

  useEffect(() => {
    const registry = getModelContext();

    if (registry === null) {
      return;
    }

    // The one tool that reports rather than acts, so a caller can find out what it is looking at.
    const describe = registry.registerTool({
      description:
        "Describe what is on the canvas: zoom, the open windows and their kinds, groups, and the selection.",
      execute: async () => ({
        content: [{ text: describeCanvas(store.state$.peek()), type: "text" as const }],
      }),
      inputSchema: NO_INPUT,
      name: "canvas.describe",
    });
    // The companion question: what exists that the canvas is not showing. Closing a window does
    // not delete the record, so without this everything not open is invisible to a caller.
    const list = registry.registerTool({
      description:
        "List everything this project holds and how it is connected, saying which items are already open on the canvas.",
      execute: async () => ({
        content: [
          {
            text: describeProjectContent({
              listing: projectContent$.peek(),
              projectId,
              // Peeked like the rest: a tool call wants the edges as they are at call time.
              relations: relations$.peek(),
              state: store.state$.peek(),
            }),
            type: "text" as const,
          },
        ],
      }),
      inputSchema: NO_INPUT,
      name: "content.list",
    });
    const disposers = APP_ACTIONS.map((action) =>
      registry.registerTool({
        description: action.description,
        execute: async (input) => {
          const context = { actions, projectId, state: store.state$.peek() };

          if (!isAppActionEnabled(action, context)) {
            return {
              content: [
                { text: `${action.label} is not available right now.`, type: "text" as const },
              ],
            };
          }

          // Passed through unchecked: the verb narrows with the same type this schema came from,
          // so checking here as well would be two places to disagree about one shape.
          action.run(context, input);

          return { content: [{ text: `${action.label} done.`, type: "text" as const }] };
        },
        // The verb's own declaration, so what a caller is offered and what the verb accepts are
        // one thing rather than two that have to be kept in step.
        inputSchema: action.input?.toJsonSchema() ?? NO_INPUT,
        name: action.id,
      }),
    );

    return () => {
      // The spec's disposal shape is one of the things this has never run to find out.
      for (const disposer of [describe, list, ...disposers]) {
        if (typeof disposer === "function") {
          (disposer as () => void)();
        }
      }
    };
  }, [actions, projectId, store]);

  return null;
}

export { ModelContextTools };
