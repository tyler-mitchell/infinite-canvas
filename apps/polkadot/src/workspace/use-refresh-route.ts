import { useRouter } from "@tanstack/react-router";
import { useCallback } from "react";

/**
 * Re-read what the route loaded.
 *
 * The canvas route's loader holds the canvas's title and its project's, so renaming either leaves
 * the switchers showing the old name until something asks again. Both switchers already do this
 * after their own inline rename; a verb cannot, because `router.invalidate` needs a router and the
 * vocabulary is deliberately not given one.
 *
 * Narrower than it looks: this is not "reload the app". `invalidate` re-runs the active route's
 * loader, which re-reads one canvas record — the same read that put the title on screen.
 *
 * Stable across renders for the reason `useGoToCanvas` is: `model-context` lists the context's
 * callbacks in the dependencies of the effect that registers a hundred-odd WebMCP tools, and a
 * fresh identity per render would tear those down and rebuild them on every render above it.
 */
const useRefreshRoute = () => {
  const router = useRouter();

  return useCallback(() => {
    void router.invalidate();
  }, [router]);
};

export { useRefreshRoute };
