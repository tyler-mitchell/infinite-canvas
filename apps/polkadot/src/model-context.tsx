import { useInfiniteCanvasActions, useInfiniteCanvasStore } from "@hyphened/infinite-canvas";
import { useLoaderData } from "@tanstack/react-router";
import { useEffect } from "react";

import { getAppTools } from "./app-tools";
import type { WindowKind } from "./canvas/window-registry";
import { useGoToCanvas } from "./workspace/use-go-to-canvas";
import { useRefreshRoute } from "./workspace/use-refresh-route";

/**
 * Registers `getAppTools` with WebMCP. Adds no capability of its own.
 *
 * `document.modelContext` is the current home; `navigator.modelContext` is the pre-150 name. On
 * Chrome 152 the API needs `--enable-blink-features=WebMCP`, not the `--enable-features` flag the
 * tooling documents.
 */

/** The spec's `content` array, and only the part of it used here. */
type ToolResult = Readonly<{ content: readonly Readonly<{ text: string; type: "text" }>[] }>;

type ModelContextTool = Readonly<{
  description: string;
  execute: (input?: unknown) => Promise<ToolResult>;
  inputSchema: object;
  name: string;
}>;

/**
 * The slice of `document.modelContext` this app is a provider for.
 *
 * `registerTool` returns a promise resolving to nothing — **not** a disposer, which this file
 * assumed until the explainer was read. Unregistering is the `AbortSignal`'s job, which is why the
 * options argument is not optional here even though it is in the IDL: forgetting it is exactly the
 * mistake that left the old cleanup loop dead.
 */
type ModelContextRegistry = Readonly<{
  registerTool: (
    tool: ModelContextTool,
    options: Readonly<{ signal: AbortSignal }>,
  ) => Promise<void>;
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
  // The route already names the canvas, so nothing here holds a second copy of which one it is.
  const canvas = useLoaderData({ from: "/canvas/$canvasId" });
  /*
   * The one act a verb cannot reach through `actions`, because a different canvas is a different
   * route and a different store. Stable by construction — see the hook, which owns that specifically
   * because this effect registers a hundred-odd tools and would otherwise redo it every render.
   */
  const goToCanvas = useGoToCanvas();
  // Stable for the same reason, and it is in this effect's dependencies below.
  const refreshRoute = useRefreshRoute();

  useEffect(() => {
    const registry = getModelContext();

    if (registry === null) {
      return;
    }

    // The spec's unregistration mechanism. `registerTool` resolves to `undefined`, not a disposer.
    const controller = new AbortController();
    const tools: ModelContextTool[] = getAppTools({
      // The environment is this file's to know. `getAppTools` holds the rule about what it gates.
      development: import.meta.env.DEV,
      createContext: () => ({
        actions,
        canvasId: canvas.id,
        canvasTitle: canvas.title,
        goToCanvas,
        projectId,
        refreshRoute,
        state: store.state$.peek(),
      }),
      projectId,
    }).map((tool) => ({
      description: tool.description,
      execute: async (input?: unknown) => ({
        content: [{ text: await tool.execute(input), type: "text" as const }],
      }),
      inputSchema: tool.inputSchema,
      name: tool.name,
    }));

    // Awaited: a `tools` permissions policy that is off rejects with `NotAllowedError`, which
    // dropped would leave a page silently offering nothing. Aborting is ordinary teardown.
    void Promise.allSettled(
      tools.map((tool) => registry.registerTool(tool, { signal: controller.signal })),
    ).then((settled) => {
      const failures = settled.filter((outcome) => outcome.status === "rejected");

      if (failures.length > 0 && !controller.signal.aborted) {
        console.error(
          `WebMCP: ${String(failures.length)} of ${String(tools.length)} tools did not register.`,
          failures[0]?.reason,
        );
      }
    });

    return () => {
      controller.abort();
    };
  }, [actions, canvas, goToCanvas, projectId, refreshRoute, store]);

  return null;
}

export { ModelContextTools };
