import { queryOptions } from "@tanstack/react-query";

export const portfolioQuery = queryOptions({
  queryKey: ["portfolio", "local"],
  queryFn: async () => (await import("./portfolio.ts")).openPortfolio(),
});
