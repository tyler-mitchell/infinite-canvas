import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { expect, test } from "vite-plus/test";
import { rewrite } from "./url-rewrite";

test.each([
  ["https://tyler.featuretype.com", "/", "/tyler", "/"],
  ["https://tyler.featuretype.com", "/editor", "/editor", "/editor"],
  ["https://featuretype.com", "/", "/", "/"],
  ["https://featuretype.com", "/tyler", "/tyler", "/tyler"],
])("routes %s%s without a public path redirect", async (origin, path, internal, external) => {
  const root = createRootRoute();
  const router = createRouter({
    origin,
    rewrite,
    history: createMemoryHistory({ initialEntries: [`${path}#projects`] }),
    routeTree: root.addChildren(
      ["/", "/tyler", "/editor"].map((path) => createRoute({ getParentRoute: () => root, path })),
    ),
  });
  await router.load();
  expect(router.state.location.pathname).toBe(internal);
  expect(router.state.location.publicHref).toBe(`${external}#projects`);
  expect(router.history.location.href).toBe(`${path}#projects`);
  expect(router.buildLocation({ to: internal, hash: "experience" }).publicHref).toBe(
    `${external}#experience`,
  );
});
