import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PortfolioBoard } from "../../portfolio/board.tsx";
import { createCanvas } from "../../portfolio/canvas.ts";
import { getPublishedPortfolio } from "../../server/portfolio.functions.ts";

export const Route = createFileRoute("/p/$id")({
  ssr: false,
  loader: ({ params }) => getPublishedPortfolio({ data: { id: params.id } }),
  remountDeps: ({ params }) => params.id,
  component: PublishedPortfolio,
});

function PublishedPortfolio() {
  const document = Route.useLoaderData();
  const [canvas] = useState(() => createCanvas(document));
  return <PortfolioBoard canvas={canvas} mode="read" />;
}
