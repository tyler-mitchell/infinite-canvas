import { renderToString } from "react-dom/server";
import { expect, test } from "vite-plus/test";
import { PortfolioBoard } from "../portfolio/board.tsx";
import { createCanvas } from "../portfolio/canvas.ts";
import documentSource from "../portfolio/document.json?raw";

test("public portfolio content is readable without browser APIs", () => {
  const canvas = createCanvas(JSON.parse(documentSource));
  const html = renderToString(<PortfolioBoard canvas={canvas} mode="read" />);

  expect(html).toContain("Tyler Davis Mitchell");
  expect(html).toContain("full-stack engineer");
  expect(html).toContain("Federato");
  expect(html).toContain("PayPal");
  expect(html).toContain("UTSA");
  expect(html).toContain("gitdrops-monorepo");
  expect(html).toContain("https://github.com/tyler-mitchell/infinite-canvas");
  expect(html).not.toContain("NaN");
  expect(html).not.toContain("<canvas");
});
