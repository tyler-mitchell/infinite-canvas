import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vite-plus/test";
import { Route } from "../app/routes/editor.tsx";
import { savePortfolio } from "../server/portfolio.functions.ts";

const commands = vi.hoisted(() => ({
  "portfolio.save": vi.fn(),
  "portfolio.publish": vi.fn(),
}));

vi.mock("use-webmcp-tool", () => ({
  useWebMCP: ({ name, execute }: { name: keyof typeof commands; execute: () => unknown }) => {
    commands[name].mockImplementation(execute);
  },
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("../server/portfolio.functions.ts", () => ({
  getPortfolio: vi.fn(),
  savePortfolio: vi.fn(),
}));
vi.mock("../portfolio/canvas.ts", () => ({
  createCanvas: () => ({ state: { document: { peek: () => ({}) } } }),
}));
vi.mock("../portfolio/board.tsx", () => ({
  PortfolioBoard: ({ controls }: { controls: ReactNode }) => controls,
}));
vi.mock("portfolio-board", () => ({
  Button: (props: React.ComponentProps<"button">) => <button {...props} />,
}));

test.each([
  { result: { status: "saved", id: "portfolio", revision: 1 }, id: "portfolio", revision: 1 },
  { result: { status: "conflict" }, id: null, revision: 0 },
  { result: { status: "unauthenticated" }, id: null, revision: 0 },
] as const)(
  "queued publish retains the correct revision after $result.status",
  async ({ result, id, revision }) => {
    vi.clearAllMocks();
    vi.spyOn(Route, "useLoaderData").mockReturnValue(null);
    vi.mocked(savePortfolio)
      .mockResolvedValueOnce(result)
      .mockResolvedValueOnce({ status: "published", id: "portfolio", revision: 2 });
    const client = new QueryClient();
    const host = document.createElement("div");
    const root = createRoot(host);
    const Editor = Route.options.component!;
    try {
      await act(async () => {
        root.render(
          <QueryClientProvider client={client}>
            <Editor />
          </QueryClientProvider>,
        );
      });
      await act(async () => {
        const saved = commands["portfolio.save"]();
        const published = commands["portfolio.publish"]();
        await saved;
        await published;
      });
      expect(savePortfolio).toHaveBeenNthCalledWith(1, {
        data: { id: null, revision: 0, document: "{}", publish: false },
      });
      expect(savePortfolio).toHaveBeenNthCalledWith(2, {
        data: { id, revision, document: "{}", publish: true },
      });
    } finally {
      act(() => root.unmount());
      client.clear();
      vi.restoreAllMocks();
    }
  },
);
