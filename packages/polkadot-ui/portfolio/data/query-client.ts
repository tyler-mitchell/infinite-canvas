import { QueryCache, QueryClient } from "@tanstack/react-query";

/** Tools and views share the same saved document. */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      console.warn("The portfolio could not load. Saved content is retained.", query.queryKey, error);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: Number.POSITIVE_INFINITY,
    },
  },
});
