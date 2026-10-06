import { createCanvasState } from "@hyphened/infinite-canvas";

const canvas = createCanvasState({
  windowDefinitions: { note: {} },
  viewport: { width: 800, height: 600 },
});
canvas.actions.openWindow.run({
  id: "note-1",
  kind: "note",
  title: "First note",
  rect: { x: 0, y: 0, width: 320, height: 220 },
});

if (canvas.state.document.content.windows["note-1"].id.get() !== "note-1") {
  throw new Error("The installed package did not open a window.");
}
