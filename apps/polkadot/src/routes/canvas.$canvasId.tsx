import { createFileRoute, useRouter } from "@tanstack/react-router";

import { hydrateCanvasLayout } from "../canvas/canvas-document";
import { CanvasFailure, CanvasLoading } from "../workspace/canvas-states";
import { WorkspaceCanvas } from "../workspace/workspace-canvas";

/**
 * One canvas document, addressed by record id.
 *
 * The loader does the reading *and* the hydration, so the component is handed state that is
 * already valid. Nothing renders an empty canvas that fills in a moment later, and the store is
 * never corrected after it exists — which is also what makes disposal simple, because the store's
 * whole life is the life of one route match.
 */

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

  // Structurally not a canvas layout. Opening anything here would be inventing a workspace, and
  // the notes are separate records, so they are untouched and still readable.
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
      // A different canvas is a different store. Keying the subtree makes that structural rather
      // than something the runtime has to detect and tear down.
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
