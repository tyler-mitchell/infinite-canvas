import { editPortfolio, type WidgetChange } from "./portfolio.ts";
import { portfolioQuery } from "./queries.ts";
import { queryClient } from "./query-client.ts";
import { type } from "arktype";

export async function changePortfolio(change: WidgetChange) {
  const result = await editPortfolio(change);
  if (result instanceof Error || result instanceof type.errors) return result;
  queryClient.setQueryData(portfolioQuery.queryKey, (current) => {
    if (current === undefined) return undefined;
    return { ...current, content: result };
  });
  return result;
}
