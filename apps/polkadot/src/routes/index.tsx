import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";

import { initialLayout } from "../canvas/canvas-document";
import { CanvasFailure, CanvasLoading } from "../workspace/canvas-states";

/**
 * `/` is a destination, not a page.
 *
 * A canvas application has no meaningful "home" distinct from a canvas, so the root resolves which
 * document to open and hands the URL over. That keeps one rule for what is on screen — the route
 * names the canvas — instead of a root that renders a canvas anonymously and a second route that
 * renders the same canvas by name.
 *
 * An empty database is a first run rather than a failure, so it bootstraps and redirects too.
 */
export const Route = createFileRoute("/")({
  errorComponent: RootFailure,
  loader: async () => {
    const database = await import("../database/database.client");
    const existing = await database.readMostRecentCanvas();
    const canvas = existing ?? (await database.openDefaultCanvas(initialLayout));

    throw redirect({ params: { canvasId: canvas.id }, to: "/canvas/$canvasId" });
  },
  pendingComponent: CanvasLoading,
  pendingMinMs: 400,
  pendingMs: 200,
});

function RootFailure({ error }: Readonly<{ error: Error }>) {
  const router = useRouter();

  return (
    <CanvasFailure
      detail={`${error.message}. Your work is stored in this browser, so it is still here — the engine that reads it did not start.`}
      onRetry={() => {
        void router.invalidate();
      }}
      title="The local database did not open"
    />
  );
}
