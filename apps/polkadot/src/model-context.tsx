import { useInfiniteCanvasActions, useInfiniteCanvasStore } from "@hyphened/infinite-canvas";
import { useEffect } from "react";

import { APP_ACTIONS, isAppActionEnabled } from "./app-actions";
import { describeCanvas } from "./canvas/describe-canvas";
import type { WindowKind } from "./canvas/window-registry";

/**
 * The app's vocabulary, offered to an agent running in the browser.
 *
 * WebMCP is the page half of MCP: a document registers named tools and an agent in the browser
 * calls them, instead of driving the DOM and guessing what a click did. `AGENTS.md` records why
 * that shapes the architecture rather than decorating it — a capability lives in the command
 * vocabulary first and a control calls it, so the pointer, the palette and an agent all reach the
 * same verb. This file is the third caller, and it adds no capability of its own.
 *
 * Every entry in `APP_ACTIONS` takes no arguments, because the vocabulary uses one entry per
 * argument value the way the framework's own commands do (`view.pan.right`, `group.setLayout.tabs`).
 * That is what lets this register with an empty input schema. Actions whose argument is open-ended
 * — a note id, a title — have no entry yet and are the next piece of work, not an oversight.
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
    execute: () => Promise<
      Readonly<{ content: readonly Readonly<{ text: string; type: "text" }>[] }>
    >;
    inputSchema: Readonly<{ properties: Readonly<Record<string, never>>; type: "object" }>;
    name: string;
  }) => unknown;
}>;

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
      inputSchema: { properties: {}, type: "object" },
      name: "canvas.describe",
    });
    const disposers = APP_ACTIONS.map((action) =>
      registry.registerTool({
        description: action.description,
        execute: async () => {
          const context = { actions, projectId, state: store.state$.peek() };

          if (!isAppActionEnabled(action, context)) {
            return {
              content: [
                { text: `${action.label} is not available right now.`, type: "text" as const },
              ],
            };
          }

          action.run(context);

          return { content: [{ text: `${action.label} done.`, type: "text" as const }] };
        },
        inputSchema: { properties: {}, type: "object" },
        name: action.id,
      }),
    );

    return () => {
      // The spec's disposal shape is one of the things this has never run to find out.
      for (const disposer of [describe, ...disposers]) {
        if (typeof disposer === "function") {
          (disposer as () => void)();
        }
      }
    };
  }, [actions, projectId, store]);

  return null;
}

export { ModelContextTools };
