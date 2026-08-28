import { RouterProvider, createRouter } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { installLocalDatabaseHandle } from "./database/inspector-handle";
import { routeTree } from "./routeTree.gen";
import "./styles.css";

/**
 * Polkadot is a single-page application, deliberately.
 *
 * Its entire data layer is client-only: the SurrealDB engine is WebAssembly and its storage is
 * IndexedDB, so there is no state a server could usefully render ahead of the browser. Running
 * TanStack Start here would add a server, SSR, and server functions in front of a database the
 * server cannot reach — and it did not work regardless, because `vite` in this workspace is
 * aliased to `vite-plus-core`, whose version does not satisfy Start's `vite: >=7` peer range, so
 * its dev middleware never mounted and every route answered `Cannot GET /`.
 *
 * The playground already proves this shape on this toolchain.
 */
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

// Dev only, and before render: an agent asking the database a question should not have to navigate.
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
