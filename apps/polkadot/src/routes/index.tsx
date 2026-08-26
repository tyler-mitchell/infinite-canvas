import { createFileRoute } from "@tanstack/react-router";

import { WorkspaceCanvas } from "../workspace/workspace-canvas";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <WorkspaceCanvas />;
}
