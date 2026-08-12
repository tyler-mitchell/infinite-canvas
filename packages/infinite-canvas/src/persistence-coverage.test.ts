import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { parseInfiniteCanvasState, serializeInfiniteCanvasState } from "./persistence";
import { reduceInfiniteCanvasState } from "./reducer";
import type { InfiniteCanvasState } from "./types";

/**
 * Which state survives a reload, decided at compile time rather than remembered.
 *
 * `serializeInfiniteCanvasState` enumerates the fields it writes and
 * `parseInfiniteCanvasState` enumerates the ones it reads back, so a new field is absent from
 * both by default and nothing says so. That is not hypothetical: `capabilities` was dropped on
 * every reload the day it landed, and `workspaces` was dropped twice on the way in — once by
 * the envelope and once by the state builder — each found only because a test happened to look.
 *
 * The map below is typed as a `Record` over the state's own keys, so **adding a field to
 * `InfiniteCanvasState` fails the typecheck until it is classified**: it either survives a
 * round trip, or it declares why it must not. The same inversion `command-coverage.test.ts`
 * applies to actions and `clone.test.ts` to shared references — the omission that used to be
 * silent now cannot compile.
 */

type Kind = "note";

/** Why a field is deliberately absent from a persisted document. */
type NotPersisted = "derived" | "measured" | "session";

const PERSISTENCE: Readonly<Record<keyof InfiniteCanvasState<Kind>, NotPersisted | "persisted">> = {
  activeWindowId: "persisted",
  activeWorkspaceId: "persisted",
  camera: "persisted",
  groups: "persisted",
  // "A layout is a document, not its edit log." Undoing across a reload would step into a
  // document the user never edited in this session.
  history: "session",
  // A drag cannot survive a reload; there is no pointer on the other side of one.
  interaction: "session",
  selection: "persisted",
  // Derived from an interaction, and dies with it.
  snapPreview: "derived",
  // Measured from the DOM on mount. Restoring the old one would fight the first resize
  // observation and could hydrate a canvas sized for someone else's monitor.
  viewport: "measured",
  windows: "persisted",
  workspaces: "persisted",
};

/** Every persisted field set to something a default would not produce. */
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
  // The type does the work; this asserts the map is not empty of the interesting half, so a
  // future edit that classified everything as `session` would not pass silently.
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
  // The other direction. A field declared `session` that quietly serialized would mean the
  // declaration was decoration, and an undo stack crossing a reload is a real surprise rather
  // than a harmless extra.
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
