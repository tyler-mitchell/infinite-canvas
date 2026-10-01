import {
  createFileRoute,
  redirect,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";

import { initialLayout } from "../canvas/canvas-document";
import { CanvasFailure, CanvasLoading } from "../workspace/canvas-states";

// The root opens the latest canvas or creates the first one.
export const Route = createFileRoute("/")({
  errorComponent: RootFailure,
  loader: async () => {
    const database = await import("../database/database.client");
    const existing = await database.readMostRecentCanvas();
    const canvas = existing ?? (await database.bootstrapCanvas(initialLayout));

    throw redirect({ params: { canvasId: canvas.id }, to: "/canvas/$canvasId" });
  },
  pendingComponent: CanvasLoading,
  pendingMinMs: 400,
  pendingMs: 200,
});

// Remove terminal punctuation before the message continues.
const asClause = (message: string) => message.replace(/[\s.!?]+$/u, "");

function RootFailure({ error }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <CanvasFailure
      detail={`${asClause(String(error instanceof Error ? error.message : error))}. Your work is stored in this browser, so it is still here — the engine that reads it did not start.`}
      onRetry={() => {
        void router.invalidate();
      }}
      title="The local database did not open"
    />
  );
}
