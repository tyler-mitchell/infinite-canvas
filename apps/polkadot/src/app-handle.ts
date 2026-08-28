import { useInfiniteCanvasActions, useInfiniteCanvasStore } from "@hyphened/infinite-canvas";
import { useLoaderData } from "@tanstack/react-router";
import { useEffect } from "react";

import type { AppActionContext } from "./app-actions";
import { getAppTools, type AppTool } from "./app-tools";
import type { WindowKind } from "./canvas/window-registry";
import { useGoToCanvas } from "./workspace/use-go-to-canvas";
import { useRefreshRoute } from "./workspace/use-refresh-route";

/**
 * This app's vocabulary, drivable from a console in development.
 *
 * `window.__canvas` answers for the framework and `window.__surreal` for the database. Polkadot's
 * own verbs were reachable only through WebMCP, which needs a Chrome flag — so nothing in an
 * ordinary browser could ask what this app does, and checking one meant clicking a DOM row.
 *
 * The same list WebMCP registers, so a verb cannot be offered to an agent and missing here.
 */
type AppHandle = Readonly<{
  /** Every verb and reporter: name, description, whether it takes an argument. */
  list: () => readonly Readonly<{ description: string; name: string; takesInput: boolean }>[];
  /** Invoke by name. Returns the verb's own answer, including its refusal. */
  run: (name: string, input?: unknown) => Promise<string>;
  /** The JSON Schema a named verb accepts, or `null` when it takes nothing. */
  schema: (name: string) => object | null;
}>;

declare global {
  interface Window {
    /** Set in development builds only. See `useAppHandle`. */
    __app?: AppHandle;
  }
}

const takesInput = (tool: AppTool) =>
  Object.keys((tool.inputSchema as Readonly<{ properties?: object }>).properties ?? {}).length > 0;

function createAppHandle(
  input: Readonly<{ createContext: () => AppActionContext; projectId: string }>,
): AppHandle {
  // Rebuilt per call: enablement and the published set both move with the canvas.
  const tools = () => getAppTools(input);
  const find = (name: string) => tools().find((tool) => tool.name === name);

  return {
    list: () =>
      tools().map((tool) => ({
        description: tool.description,
        name: tool.name,
        takesInput: takesInput(tool),
      })),
    run: async (name, raw) => {
      const tool = find(name);

      return tool === undefined
        ? `No verb is called "${name}". \`window.__app.list()\` names them.`
        : tool.execute(raw);
    },
    schema: (name) => {
      const tool = find(name);

      return tool === undefined || !takesInput(tool) ? null : tool.inputSchema;
    },
  };
}

/** Installs `window.__app` for the life of the canvas. Development only. */
function useAppHandle(projectId: string) {
  const actions = useInfiniteCanvasActions<WindowKind>();
  const store = useInfiniteCanvasStore<WindowKind>();
  const canvas = useLoaderData({ from: "/canvas/$canvasId" });
  const goToCanvas = useGoToCanvas();
  const refreshRoute = useRefreshRoute();

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    window.__app = createAppHandle({
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
    });

    return () => {
      delete window.__app;
    };
  }, [actions, canvas, goToCanvas, projectId, refreshRoute, store]);
}

export { createAppHandle, useAppHandle };
export type { AppHandle };
