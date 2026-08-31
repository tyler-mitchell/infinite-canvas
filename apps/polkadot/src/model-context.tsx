import { useInfiniteCanvasActions, useInfiniteCanvasStore } from "@hyphened/infinite-canvas";
import { useLoaderData } from "@tanstack/react-router";
import { useEffect } from "react";

import { getAppTools } from "./app-tools";
import type { WindowKind } from "./canvas/window-registry";
import { useGoToCanvas } from "./workspace/use-go-to-canvas";
import { useRefreshRoute } from "./workspace/use-refresh-route";

type ToolResult = Readonly<{ content: readonly Readonly<{ text: string; type: "text" }>[] }>;

type ModelContextTool = Readonly<{
  description: string;
  execute: (input?: unknown) => Promise<ToolResult>;
  inputSchema: object;
  name: string;
}>;

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

function ModelContextTools({ projectId }: Readonly<{ projectId: string }>) {
  const actions = useInfiniteCanvasActions<WindowKind>();
  const store = useInfiniteCanvasStore<WindowKind>();
  const canvas = useLoaderData({ from: "/canvas/$canvasId" });
  const goToCanvas = useGoToCanvas();
  const refreshRoute = useRefreshRoute();

  useEffect(() => {
    const registry = getModelContext();

    if (registry === null) {
      return;
    }

    // AbortSignal unregisters tools because registerTool returns no disposer.
    const controller = new AbortController();
    const tools: ModelContextTool[] = getAppTools({
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
