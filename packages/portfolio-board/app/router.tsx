import { createRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";

import { routeTree } from "./routeTree.gen";
import { rewrite } from "./url-rewrite";

export function getRouter() {
  return createRouter({
    routeTree,
    rewrite,
    context: { queryClient: new QueryClient() },
    scrollRestoration: true,
    defaultPreload: "intent",
  });
}
