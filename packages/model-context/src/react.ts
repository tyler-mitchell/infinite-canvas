import { useEffect } from "react";

import { registerModelContextTools, type ModelContextTool } from "./index.ts";

/** Registers tools until unmount; keep the list reference stable across renders. */
function useModelContextTools(tools: readonly ModelContextTool[]) {
  useEffect(() => {
    // AbortSignal unregisters tools because registerTool returns no disposer.
    const controller = new AbortController();

    void registerModelContextTools(tools, { signal: controller.signal }).then((registration) => {
      if (registration.failures.length > 0 && !controller.signal.aborted) {
        console.error(
          `WebMCP: ${String(registration.failures.length)} of ${String(tools.length)} tools did not register.`,
          registration.failures[0]?.reason,
        );
      }
    });

    return () => {
      controller.abort();
    };
  }, [tools]);
}

export { useModelContextTools };
