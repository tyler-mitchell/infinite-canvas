import {
  isInfiniteCanvasCommandEnabled,
  useInfiniteCanvasActions,
  useInfiniteCanvasStore,
} from "@hyphened/infinite-canvas";
import { useEffect } from "react";

import { APP_ACTIONS, isAppActionEnabled } from "./app-actions";
import { describeCanvas } from "./canvas/describe-canvas";
import type { WindowKind } from "./canvas/window-registry";
import { describeProjectContent } from "./content/describe-content";
import { projectContent$ } from "./content/project-content";
import { getPublishedCanvasCommands } from "./published-commands";
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
 * The framework's own verbs are published alongside them — see `published-commands.ts` for which
 * and why. That is most of what a caller can do: this app contributes sixteen verbs and the canvas
 * contributes seventy-five, and for a while only the sixteen were offered.
 *
 * DRIVEN, on 2026-08-27, against Chrome 152 with `--enable-blink-features=WebMCP`, reached through
 * `chrome-devtools-mcp --categoryExperimentalWebmcp`. This said for a while that none of the
 * `registerTool` calls below had ever run, which was true and is no longer: the effect registers
 * **97 tools** — seventy-five framework verbs, twenty app verbs and the two reporters — and calls
 * against them were executed and their effects read back. `canvas.describe` on an empty canvas,
 * `note.create`, then `canvas.describe` again naming the window that appeared, with `content.list`
 * agreeing about the record behind it.
 *
 * Two corrections that the first real run produced, recorded because both were invisible until then:
 *
 * - `--enable-features=WebMCP` is what the tooling documents and it does **not** expose the API.
 *   `--enable-blink-features=WebMCP` does. Measured on 152; both are passed, since the cost is
 *   nothing and the two disagree.
 * - Every argument-taking verb reported success when it had refused. That was this file's doing —
 *   it said `${action.label} done.` unconditionally — and the fix is `AppAction.run` returning the
 *   refusal, which is read below.
 *
 * `document.modelContext` is the current home; `navigator.modelContext` is the pre-150 name, kept
 * because it is what a 146 flag build exposes. Confirmed absent under the `navigator` name on 152.
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
    /*
     * The canvas's own vocabulary, which was registered nowhere and reachable by nothing.
     *
     * This file offered the app's verbs and stopped there, so an agent could make a note and could
     * not fit the view, undo, clear a selection, nudge a window, or move between desktops — eighty
     * verbs the palette lists for a person and nothing offered to a caller. `AGENTS.md` says a
     * capability has to exist somewhere an agent can call; these existed only behind a keystroke.
     *
     * Nothing is invented here. `getInfiniteCanvasContextualCommands` already returns, per verb, an
     * id, a description, live enablement and the command to run — which is a tool registry in all
     * but name — so this is a loop over it rather than a hand-written list that would need keeping
     * in step with the framework's.
     *
     * **The five verbs whose command is a template are left out.** `workspace.create`,
     * `workspace.enter`, `workspace.close`, `workspace.moveActiveWindow` and `window.reveal` carry
     * an empty-string id in their descriptor, waiting for a caller to fill in; dispatching one as
     * published would act on a workspace called "". They need an argument, which means an
     * `AppAction` with an `input` — `window.reveal` already is one, which is also why excluding
     * them avoids registering two different tools under that one name. The four `workspace.*` verbs
     * are the gap this leaves, and it is a named one rather than an oversight.
     */
    const canvasVerbs = getPublishedCanvasCommands(store.state$.peek()).map((descriptor) =>
      registry.registerTool({
        description: descriptor.description,
        execute: async () => {
          /*
           * Enablement is asked at call time, not at registration. A tool list is built once and
           * a canvas changes under it, so what was offerable when this mounted says nothing about
           * now — the same reason the app verbs check rather than trust.
           */
          if (!isInfiniteCanvasCommandEnabled(store.state$.peek(), descriptor.command)) {
            return {
              content: [
                { text: `${descriptor.label} is not available right now.`, type: "text" as const },
              ],
            };
          }

          actions.executeCommand(descriptor.command);

          return { content: [{ text: `${descriptor.label} done.`, type: "text" as const }] };
        },
        inputSchema: NO_INPUT,
        name: descriptor.id,
      }),
    );
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
          const refusal = action.run(context, input);

          /*
           * The verb's own answer, because it is the only thing that knows why.
           *
           * This said "done" unconditionally, and driving it through WebMCP is what exposed the
           * cost: `content.open` with an id naming nothing, and `window.reveal` with an id naming
           * nothing, both reported success. A caller with no way to look at the screen then acts
           * against a window that was never opened, and the first visible symptom is several calls
           * downstream of the mistake.
           */
          return {
            content: [{ text: refusal ?? `${action.label} done.`, type: "text" as const }],
          };
        },
        // The verb's own declaration, so what a caller is offered and what the verb accepts are
        // one thing rather than two that have to be kept in step.
        inputSchema: action.input?.toJsonSchema() ?? NO_INPUT,
        name: action.id,
      }),
    );

    return () => {
      // The spec's disposal shape is one of the things this has never run to find out.
      for (const disposer of [describe, list, ...canvasVerbs, ...disposers]) {
        if (typeof disposer === "function") {
          (disposer as () => void)();
        }
      }
    };
  }, [actions, projectId, store]);

  return null;
}

export { ModelContextTools };
