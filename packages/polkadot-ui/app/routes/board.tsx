import { createFileRoute } from "@tanstack/react-router";

import { PortfolioBoard } from "../../portfolio/board/board.tsx";

/** The incubator mount. Everything the portfolio is lives in `portfolio/`, ready to move out. */
export const Route = createFileRoute("/board")({
  component: PortfolioBoard,
});
