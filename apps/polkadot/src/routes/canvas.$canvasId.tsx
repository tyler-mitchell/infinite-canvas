import { createFileRoute, useRouter } from "@tanstack/react-router";

import { hydrateCanvasLayout } from "../canvas/canvas-document";
import { CanvasFailure, CanvasLoading } from "../workspace/canvas-states";
import { WorkspaceCanvas } from "../workspace/workspace-canvas";

// The loader hydrates the layout before the route component renders.
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

    return {
      hydration: hydrateCanvasLayout(record.layout),
      id: record.id,
      projectId: record.projectId,
      projectTitle: record.projectTitle,
      revision: record.revision,
      title: record.title,
    };
  },
  pendingComponent: CanvasLoading,
  pendingMinMs: 400,
  pendingMs: 200,
});

function CanvasRoute() {
  const canvas = Route.useLoaderData();
  const router = useRouter();

  // Unreadable layout data does not affect separate content records.
  if (canvas.hydration.status === "unreadable") {
    return (
      <CanvasFailure
        detail="The stored arrangement for this canvas cannot be read. Your notes are separate records and are unaffected — only the positions are unreadable."
        onRetry={() => {
          void router.invalidate();
        }}
        title="This canvas layout is damaged"
      />
    );
  }

  return (
    <WorkspaceCanvas
      canvas={{
        droppedKinds:
          canvas.hydration.status === "recovered" ? canvas.hydration.droppedKinds : undefined,
        id: canvas.id,
        projectId: canvas.projectId,
        projectTitle: canvas.projectTitle,
        revision: canvas.revision,
        state: canvas.hydration.state,
        title: canvas.title,
      }}
      // A new canvas id creates a new store subtree.
      key={canvas.id}
    />
  );
}

function CanvasRouteFailure({ error }: Readonly<{ error: Error }>) {
  const router = useRouter();
  const isMissing = error.name === "CanvasNotFoundError";

  return (
    <CanvasFailure
      detail={
        isMissing
          ? "This link points at a canvas that is not in this browser. Canvases live locally, so one created elsewhere will not be here."
          : error.message
      }
      onRetry={() => {
        void router.invalidate();
      }}
      title={isMissing ? "That canvas is not here" : "This canvas did not open"}
    />
  );
}
