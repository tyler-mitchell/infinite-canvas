import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./shell/app.tsx";
import "./style.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("playground root element missing");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
