import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./reducer";
import { cloneInfiniteCanvasState } from "./state";
import { createInfiniteCanvasStore } from "./store";
import type { InfiniteCanvasState } from "./types";

type Kind = "note";

const seed = (): InfiniteCanvasState<Kind> =>
  reduceInfiniteCanvasState(
    createInfiniteCanvasState<Kind>({
      windows: [
        createInfiniteCanvasWindow<Kind>({
          id: "note-1",
          kind: "note",
          rect: { height: 200, width: 300, x: 0, y: 0 },
          title: "Draft",
        }),
      ],
    }),
    { title: "Research", type: "workspace.create", windowIds: ["note-1"], workspaceId: "research" },
  );

test("a clone shares no mutable object with its source", () => {
  const source = seed();
  const clone = cloneInfiniteCanvasState(source);

  expect(clone.camera).not.toBe(source.camera);
  expect(clone.viewport).not.toBe(source.viewport);
  expect(clone.selection).not.toBe(source.selection);
  expect(clone.windows).not.toBe(source.windows);
  expect(clone.windows[0]).not.toBe(source.windows[0]);
  expect(clone.windows[0]?.rect).not.toBe(source.windows[0]?.rect);
  expect(clone.workspaces).not.toBe(source.workspaces);
  expect(clone.workspaces[0]).not.toBe(source.workspaces[0]);
  expect(clone.workspaces[0]?.camera).not.toBe(source.workspaces[0]?.camera);
  expect(clone.workspaces[0]?.selection).not.toBe(source.workspaces[0]?.selection);
});

test("mutating the source after cloning does not reach the clone", () => {
  const source = seed();
  const clone = cloneInfiniteCanvasState(source);

  const sourceWindow = source.windows[0];
  const sourceWorkspace = source.workspaces[0];

  expect(sourceWindow).toBeDefined();
  expect(sourceWorkspace).toBeDefined();

  (source.camera as { zoom: number }).zoom = 99;
  (sourceWindow!.rect as { x: number }).x = 99;
  (sourceWorkspace!.camera as { zoom: number }).zoom = 99;
  (sourceWorkspace as { title: string } | undefined)!.title = "Tampered";

  expect(clone.camera.zoom).toBe(1);
  expect(clone.windows[0]?.rect.x).toBe(0);
  expect(clone.workspaces[0]?.camera.zoom).toBe(1);
  expect(clone.workspaces[0]?.title).toBe("Research");
});

test("a store cannot be reached through the state its caller handed over", () => {
  const initialState = seed();
  const store = createInfiniteCanvasStore(initialState);

  (initialState.workspaces[0] as { title: string }).title = "Tampered";
  (initialState.windows[0] as { title: string }).title = "Tampered";

  const live = store.state$.peek();

  expect(live.workspaces[0]?.title).toBe("Research");
  expect(live.windows[0]?.title).toBe("Draft");
});

const DELIBERATELY_SHARED = [
  /^groups\[\d+\]\.tree/,
  /^windows\[\d+\]\.data/,
  /^workspaces\[\d+\]\.windowIds/,
  /^history/,
];

const findSharedReferences = (source: unknown, clone: unknown, path: string): readonly string[] => {
  if (source === null || typeof source !== "object") {
    return [];
  }

  if (DELIBERATELY_SHARED.some((allowed) => allowed.test(path))) {
    return [];
  }

  if (source === clone) {
    return [path];
  }

  return Object.keys(source).flatMap((key) =>
    findSharedReferences(
      (source as Record<string, unknown>)[key],
      (clone as Record<string, unknown>)[key],
      Array.isArray(source) ? `${path}[${key}]` : path === "" ? key : `${path}.${key}`,
    ),
  );
};

test("no reference is shared between a state and its clone except by declaration", () => {
  const source = seed();

  expect(findSharedReferences(source, cloneInfiniteCanvasState(source), "")).toEqual([]);
});

test("a clone is equal to its source, so isolation is not achieved by losing data", () => {
  const source = seed();

  expect(cloneInfiniteCanvasState(source)).toEqual(source);
});
