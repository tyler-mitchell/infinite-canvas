import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { parseInfiniteCanvasState, serializeInfiniteCanvasState } from "./persistence";
import { reduceInfiniteCanvasState } from "./reducer";
import type { InfiniteCanvasState } from "./types";

/** Classifies every state field as persisted, derived, measured, or session-only. */
type Kind = "note";

type NotPersisted = "derived" | "measured" | "session";

const PERSISTENCE: Readonly<Record<keyof InfiniteCanvasState<Kind>, NotPersisted | "persisted">> = {
  activeWindowId: "persisted",
  activeWorkspaceId: "persisted",
  camera: "persisted",
  // Measured consumer chrome.
  groupMetrics: "measured",
  groups: "persisted",
  // Reloads start a new edit session.
  history: "session",
  // A pointer interaction cannot cross a reload.
  interaction: "session",
  // Answers "what did that undo just do", which a reload has already forgotten.
  revealedChange: "session",
  selection: "persisted",
  // Derived from the current interaction.
  snapPreview: "derived",
  // Measured from the mounted element.
  viewport: "measured",
  // Measured consumer chrome.
  viewportInsets: "measured",
  // Measured screen-space chrome.
  viewportOccluders: "measured",
  windows: "persisted",
  workspaces: "persisted",
};

const distinctive = (): InfiniteCanvasState<Kind> => {
  const base = createInfiniteCanvasState<Kind>({
    windows: [
      createInfiniteCanvasWindow<Kind>({
        capabilities: { closable: false },
        id: "note-1",
        kind: "note",
        rect: { height: 200, width: 300, x: 40, y: 60 },
        title: "Draft",
      }),
      createInfiniteCanvasWindow<Kind>({
        id: "note-2",
        kind: "note",
        rect: { height: 200, width: 300, x: 400, y: 60 },
        title: "Notes",
      }),
    ],
  });
  const grouped = reduceInfiniteCanvasState(
    { ...base, activeWindowId: "note-1", viewport: { height: 800, width: 1200 } },
    { command: { direction: "right", type: "window.dockDirection" }, type: "command.execute" },
  );
  const withWorkspace = reduceInfiniteCanvasState(grouped, {
    title: "Research",
    type: "workspace.create",
    windowIds: ["note-1"],
    workspaceId: "research",
  });

  return {
    ...reduceInfiniteCanvasState(withWorkspace, {
      type: "workspace.activate",
      workspaceId: "research",
    }),
    camera: { center: { x: 123, y: -45 }, zoom: 2.5 },
  };
};

test("every field is classified as persisted or explicitly not", () => {
  expect(
    Object.values(PERSISTENCE).filter((value) => value === "persisted").length,
  ).toBeGreaterThan(5);
});

test("every field marked persisted survives a round trip", () => {
  const source = distinctive();
  const restored = parseInfiniteCanvasState<Kind>(
    serializeInfiniteCanvasState(source),
    createInfiniteCanvasState<Kind>({ windows: [] }),
  );

  expect(restored).not.toBeNull();

  const missing = Object.entries(PERSISTENCE)
    .filter(([, value]) => value === "persisted")
    .map(([field]) => field as keyof InfiniteCanvasState<Kind>)
    .filter((field) => JSON.stringify(restored?.[field]) !== JSON.stringify(source[field]));

  expect(missing).toEqual([]);
});

test("a field marked not-persisted is genuinely absent from the document", () => {
  const serialized = serializeInfiniteCanvasState(distinctive()) as unknown as Record<
    string,
    unknown
  >;
  const leaked = Object.entries(PERSISTENCE)
    .filter(([, value]) => value !== "persisted")
    .map(([field]) => field)
    .filter((field) => serialized[field] !== undefined);

  expect(leaked).toEqual([]);
});
