import { RouterProvider, createRouter } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { installLocalDatabaseHandle } from "./database/inspector-handle";
import { routeTree } from "./routeTree.gen";
import "./styles.css";

const router = createRouter({
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  routeTree,
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// This handle is available only in development builds.
installLocalDatabaseHandle();

const root = document.getElementById("root");

if (!root) {
  throw new Error("Polkadot root element missing");
}

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
