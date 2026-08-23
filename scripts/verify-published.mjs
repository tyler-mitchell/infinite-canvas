import {
  createInfiniteCanvasHandle,
  createInfiniteCanvasState,
  createInfiniteCanvasStore,
  createInfiniteCanvasWindow,
} from "@hyphened/infinite-canvas";

const window = (id) =>
  createInfiniteCanvasWindow({
    id,
    kind: "note",
    rect: { height: 200, width: 300, x: 0, y: 0 },
    title: id,
  });
const handle = createInfiniteCanvasHandle(
  createInfiniteCanvasStore(createInfiniteCanvasState({ windows: [window("a")] })),
);
handle.commands.openWindow(window("b"));
if (handle.getState().windows.length !== 2) throw new Error("The installed package did not run.");
