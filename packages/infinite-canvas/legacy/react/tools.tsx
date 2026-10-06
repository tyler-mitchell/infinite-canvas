import { memo, useEffect, useMemo } from "react";
import { useWebMCP, type WebMCPOptions } from "use-webmcp-tool";
import { createCanvasTools, type CanvasToolsOptions } from "../tools";
import { useInfiniteCanvasStore } from "./store";

const RegisteredTool = memo(function RegisteredTool({
  tool,
}: Readonly<{ tool: WebMCPOptions<unknown, unknown> }>) {
  const { error } = useWebMCP(tool);
  useEffect(() => {
    if (error !== null) console.warn("Canvas tool registration failed", { name: tool.name, error });
  }, [error, tool.name]);
  return null;
});

export function InfiniteCanvasTools<Kind extends string>({
  tools,
}: Readonly<{
  tools?: Exclude<CanvasToolsOptions<Kind>, boolean>;
}>) {
  const store = useInfiniteCanvasStore<Kind>();
  const definitions = useMemo(() => {
    if (tools !== undefined && typeof tools !== "function") return tools;
    const defaults = createCanvasTools({ store });
    return (
      tools?.({
        tools: defaults,
        camera: store.camera,
        dispatch: store.dispatch,
        getState: store.getState,
        snapshot: store.snapshot,
        getContextualCommands: store.getContextualCommands,
      }) ?? defaults
    );
  }, [store, tools]);
  return (
    <>
      {definitions.map((tool) => (
        <RegisteredTool key={tool.name} tool={tool} />
      ))}
    </>
  );
}
