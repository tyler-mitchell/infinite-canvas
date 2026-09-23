import { createRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";

import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    context: { queryClient: new QueryClient() },
    scrollRestoration: true,
    defaultPreload: "intent",
  });
}
