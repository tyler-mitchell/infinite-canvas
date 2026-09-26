import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useState } from "react";

import { PortfolioBoard, type BoardMode } from "../../portfolio/board.tsx";
import { createCanvas } from "../../portfolio/canvas.ts";
import documentSource from "../../portfolio/document.json?raw";

export const Route = createFileRoute("/tyler")({
  validateSearch: (search: Record<string, unknown>): { mode: BoardMode } => ({
    mode: import.meta.env.DEV && search.mode === "edit" ? "edit" : "read",
  }),
  head: () => ({
    meta: [
      { title: "Tyler Davis Mitchell — Portfolio" },
      { name: "description", content: "A portfolio laid out on an infinite canvas." },
    ],
  }),
  component: BoardRoute,
});

function BoardRoute() {
  const [canvas] = useState(() => createCanvas(JSON.parse(documentSource)));
  const { mode } = Route.useSearch();
  const hash = useLocation({ select: (location) => location.hash });
  const navigate = Route.useNavigate();
  return (
    <PortfolioBoard
      canvas={canvas}
      mode={mode}
      onReset={
        import.meta.env.DEV
          ? () => void canvas.commands.restoreDocument.run(JSON.parse(documentSource))
          : undefined
      }
      onModeChange={
        import.meta.env.DEV
          ? (mode) => void navigate({ search: { mode }, replace: true })
          : undefined
      }
      section={hash || undefined}
      onSectionChange={(section) =>
        void navigate({ hash: section, search: true, replace: true, resetScroll: false })
      }
    />
  );
}
