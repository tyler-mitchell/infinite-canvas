type ModelContextToolResult = Readonly<{
  content: readonly Readonly<{ text: string; type: "text" }>[];
}>;

type ModelContextTool = Readonly<{
  description: string;
  execute: (input?: unknown) => Promise<ModelContextToolResult>;
  /** JSON Schema for `input`. Empty `properties` means the tool takes no argument. */
  inputSchema: object;
  name: string;
}>;

type ModelContextRegistry = Readonly<{
  registerTool: (
    tool: ModelContextTool,
    options: Readonly<{ signal: AbortSignal }>,
  ) => Promise<void>;
}>;

/** JSON Schema for a tool that takes nothing. */
const NO_INPUT_SCHEMA = { properties: {}, type: "object" } as const;

/** Returns at most 4,000 characters with an explicit continuation offset. */
function textPage({ text, offset = 0 }: Readonly<{ text: string; offset?: number }>): string {
  const end = offset + 4000;
  return JSON.stringify({
    offset,
    text: text.slice(offset, end),
    nextOffset: end < text.length ? end : null,
  });
}

/** A tool whose whole answer is one string, which is most of them. */
function defineTextTool(
  tool: Readonly<{
    description: string;
    execute: (input?: unknown) => Promise<string>;
    inputSchema?: object;
    name: string;
  }>,
): ModelContextTool {
  return {
    description: tool.description,
    execute: async (input?: unknown) => ({
      content: [{ text: await tool.execute(input), type: "text" }],
    }),
    inputSchema: tool.inputSchema ?? NO_INPUT_SCHEMA,
    name: tool.name,
  };
}

/** `null` where the browser offers no model context, which is every browser without WebMCP. */
function getModelContext(): ModelContextRegistry | null {
  if (typeof document === "undefined") {
    return null;
  }

  const candidate =
    (document as unknown as Readonly<{ modelContext?: ModelContextRegistry }>).modelContext ??
    (navigator as unknown as Readonly<{ modelContext?: ModelContextRegistry }>).modelContext;

  return typeof candidate?.registerTool === "function" ? candidate : null;
}

type ModelContextRegistration = Readonly<{
  /** Registration errors, in tool order. Empty when every tool registered or no registry exists. */
  failures: readonly Readonly<{ reason: unknown; tool: ModelContextTool }>[];
  registered: boolean;
}>;

/** Registers the tools until `signal` aborts. A browser without a registry registers nothing. */
async function registerModelContextTools(
  tools: readonly ModelContextTool[],
  options: Readonly<{ signal: AbortSignal }>,
): Promise<ModelContextRegistration> {
  const registry = getModelContext();

  if (registry === null) {
    return { failures: [], registered: false };
  }

  const settled = await Promise.allSettled(
    tools.map(async (tool) => registry.registerTool(tool, { signal: options.signal })),
  );

  return {
    failures: settled.flatMap((outcome, index) =>
      outcome.status === "rejected" ? [{ reason: outcome.reason, tool: tools[index]! }] : [],
    ),
    registered: true,
  };
}

export { NO_INPUT_SCHEMA, defineTextTool, getModelContext, registerModelContextTools, textPage };
export type {
  ModelContextRegistration,
  ModelContextRegistry,
  ModelContextTool,
  ModelContextToolResult,
};
