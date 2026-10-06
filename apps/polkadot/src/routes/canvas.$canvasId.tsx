import { createFileRoute, useRouter, type ErrorComponentProps } from "@tanstack/react-router";

import { CanvasFailure, CanvasLoading } from "../workspace/canvas-states";
import { WorkspaceCanvas } from "../workspace/workspace-canvas";

class CanvasNotFoundError extends Error {
  override readonly name = "CanvasNotFoundError";

  constructor(canvasId: string) {
    super(`Canvas ${canvasId} is not in this browser`);
  }
}

export const Route = createFileRoute("/canvas/$canvasId")({
  component: CanvasRoute,
  errorComponent: CanvasRouteFailure,
  loader: async ({ params }) => {
    const database = await import("../database/database.client");
    const record = await database.openCanvas(params.canvasId);

    if (record === null) {
      throw new CanvasNotFoundError(params.canvasId);
    }

    return record;
  },
  pendingComponent: CanvasLoading,
  pendingMinMs: 400,
  pendingMs: 200,
});
function CanvasRoute() {
  const canvas = Route.useLoaderData();
  return <WorkspaceCanvas canvas={canvas} key={canvas.id} />;
}

function CanvasRouteFailure({ error }: ErrorComponentProps) {
  const router = useRouter();
  const isMissing = error instanceof CanvasNotFoundError;

  return (
    <CanvasFailure
      detail={
        isMissing
          ? "This link points at a canvas that is not in this browser. Canvases live locally, so one created elsewhere will not be here."
          : String(error instanceof Error ? error.message : error)
      }
      onRetry={() => {
        void router.invalidate();
      }}
      title={isMissing ? "That canvas is not here" : "This canvas did not open"}
    />
  );
}
