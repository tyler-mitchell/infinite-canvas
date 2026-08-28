import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

/**
 * Go to a canvas, by id.
 *
 * Where a canvas lives was written out at eight call sites across seven files — the palette, three
 * HUD surfaces, both switchers, the conflict notice and the tool registry — each spelling
 * `{ params: { canvasId }, to: "/canvas/$canvasId" }` for itself. Nothing held them together, and
 * the route is the one thing every one of them has to get exactly right.
 *
 * Half of those copies were added the same day, supplying `goToCanvas` to the four sites that build
 * an `AppActionContext`. The vocabulary needed a destination and each context builder wrote the
 * navigation again — solving the verb's problem by multiplying the caller's.
 *
 * A hook rather than a module function, because navigating is the router's affordance and
 * `useNavigate` is how a component asks for it. Nothing here needs to navigate from outside a
 * component: the context carries `goToCanvas`, so the vocabulary is handed a callback instead of
 * reaching for a router — which is why the exported-router-instance this was once scoped as is not
 * needed and was never built.
 *
 * Returns the router's promise rather than swallowing it. Navigation is asynchronous and one caller
 * genuinely awaits it — the conflict notice, which must land on the recovered canvas before it lets
 * the old one go.
 *
 * **Stable across renders, and that is load-bearing rather than hygiene.** `model-context` puts this
 * in an effect's dependencies and registers a hundred-odd WebMCP tools in that effect; a fresh
 * identity per render would tear down and re-register the lot whenever anything above it re-rendered.
 * That file had said so in a comment and kept its own copy inline to avoid the problem — which is
 * the note that made this a `useCallback` instead of leaving each caller to discover it.
 */
const useGoToCanvas = () => {
  const navigate = useNavigate();

  return useCallback(
    (canvasId: string) => navigate({ params: { canvasId }, to: "/canvas/$canvasId" }),
    [navigate],
  );
};

export { useGoToCanvas };
