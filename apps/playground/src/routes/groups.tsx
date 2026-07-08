import { createFileRoute } from "@tanstack/react-router";
import {
  captureInfiniteCanvasRecipe,
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
  getInfiniteCanvasGroupWindowIds,
  InfiniteCanvasDesktop,
  parseInfiniteCanvasRecipe,
  unionRects,
  useInfiniteCanvasActions,
  useInfiniteCanvasSelector,
  useInfiniteCanvasStore,
  type InfiniteCanvasRecipe,
} from "@infinite-canvas/react";
import { useRef } from "react";
import { Button } from "ui";
import { CommandPalette } from "../showcases/command-palette.tsx";
import { exposeCanvasDevHandle } from "../showcases/dev-handle.ts";

export const Route = createFileRoute("/groups")({
  component: GroupsShowcase,
  staticData: {
    showcase: {
      description: "Windows compose into a movable local layout region.",
      order: 7,
      title: "Groups",
    },
  },
});

type Kind = "pane";

const GROUP_ID = "workbench";
const GROUP_RECT = { height: 360, width: 720, x: 0, y: 0 };

const registry = defineInfiniteCanvasWindowRegistry<Kind>({
  pane: {
    kind: "pane",
    overflowY: "auto",
    renderBody: ({ window }) => (
      <div className="grid content-start gap-2 p-4 text-xs leading-relaxed text-white/60">
        <div className="font-mono text-[10px] tracking-wider text-white/40 uppercase">
          {window.id}
        </div>
        <p>
          A grouped window has no rect of its own. The group&apos;s tree owns its placement, and the
          reducer projects the solved rect back onto <code>window.rect</code>.
        </p>
        <p className="text-white/40">
          Drag this header to move the whole shell, or the shell&apos;s outer edge to resize it.
          Drag the seam between panes to reweight them. Hold <kbd>Alt</kbd> while dragging a
          floating window over another — the pointer has to be over the target, not just the windows
          overlapping — to dock it.
        </p>
        <p className="text-white/40">
          In <code>tabs</code> mode, drag a tab along its strip to reorder it, or out of the strip
          to tear the window free. <kbd>Arrow</kbd> with a pane selected moves the whole shell,
          because a member has no rect to nudge. <kbd>Mod</kbd>+<kbd>Shift</kbd>+<kbd>Arrow</kbd>{" "}
          tiles the active <em>floating</em> window into a half of the view; a grouped one is
          refused, for the same reason.
        </p>
        <p className="text-white/40">
          <em>Float over shell</em> drops a window centred on the group. Its centre is inside the
          shell, so the group becomes its <em>contextual parent</em>: <kbd>Alt</kbd>+
          <kbd>Arrow</kbd> from it searches the group&apos;s members before the rest of the canvas,
          and a floating window never needs a keyboard model of its own.
        </p>
      </div>
    ),
  },
});

/**
 * `left` and `right` start as free-floating windows, and `New window` adds more.
 * `Group them` docks every floating window into one split shell; from there the layout
 * mode can be swapped, and the shell moved or resized by its edge, and the windows follow
 * because their rects are derived from the shell, never stored.
 */
const initialState = createInfiniteCanvasState<Kind>({
  camera: { center: { x: 360, y: 180 }, zoom: 0.9 },
  windows: [
    createInfiniteCanvasWindow({
      id: "left",
      kind: "pane",
      rect: { height: 260, width: 320, x: -80, y: -40 },
      title: "Left",
    }),
    createInfiniteCanvasWindow({
      id: "right",
      kind: "pane",
      rect: { height: 260, width: 320, x: 420, y: 120 },
      title: "Right",
    }),
  ],
});

const RECIPE_STORAGE_KEY = "playground.groups.recipe.v1";

/**
 * Recipes are values the consumer owns: the framework captures and applies them,
 * and never decides where they live. Here that is `localStorage`, parsed
 * structurally on the way back in — a recipe crossing storage is untrusted input
 * exactly like persisted canvas state.
 */
function readStoredRecipe(): InfiniteCanvasRecipe | null {
  const raw = globalThis.localStorage.getItem(RECIPE_STORAGE_KEY);

  if (raw === null) {
    return null;
  }

  try {
    return parseInfiniteCanvasRecipe(JSON.parse(raw));
  } catch {
    return null;
  }
}

function RecipeControls() {
  const actions = useInfiniteCanvasActions();
  const store = useInfiniteCanvasStore();

  return (
    <>
      <Button
        onClick={() => {
          const recipe = captureInfiniteCanvasRecipe(store.state$.peek(), {
            name: "Workbench layout",
            recipeId: "workbench",
          });

          if (recipe !== null) {
            globalThis.localStorage.setItem(RECIPE_STORAGE_KEY, JSON.stringify(recipe));
          }
        }}
        size="xs"
        variant="ghost"
      >
        Save recipe
      </Button>
      <Button
        onClick={() => {
          const recipe = readStoredRecipe();

          if (recipe !== null) {
            // Centred in the region, at its natural size: recipes translate, never scale.
            actions.applyRecipe({
              placement: { rect: { height: 600, width: 900, x: -100, y: -100 } },
              recipe,
            });
          }
        }}
        size="xs"
        variant="ghost"
      >
        Apply recipe
      </Button>
    </>
  );
}

const NEW_WINDOW_SIZE = { height: 260, width: 320 } as const;

/**
 * Opens a floating window at the camera's centre, so it lands where you are looking
 * however far you have panned. Consecutive windows cascade rather than stacking exactly.
 *
 * `openWindow` assigns the z-index and focus itself, so neither is passed here.
 */
function NewWindowButton() {
  const actions = useInfiniteCanvasActions<Kind>();
  const store = useInfiniteCanvasStore<Kind>();
  const sequenceRef = useRef(0);

  return (
    <Button
      onClick={() => {
        // Peek, don't subscribe: this needs the camera once, on click, and a subscription
        // would re-render these controls on every pan frame.
        const { camera } = store.state$.peek();
        sequenceRef.current += 1;
        const ordinal = sequenceRef.current;
        const cascade = (ordinal % 5) * 28;

        actions.openWindow(
          createInfiniteCanvasWindow<Kind>({
            id: `pane-${ordinal}`,
            kind: "pane",
            rect: {
              ...NEW_WINDOW_SIZE,
              x: camera.center.x - NEW_WINDOW_SIZE.width / 2 + cascade,
              y: camera.center.y - NEW_WINDOW_SIZE.height / 2 + cascade,
            },
            title: `Pane ${ordinal}`,
          }),
        );
      }}
      size="xs"
      variant="ghost"
    >
      New window
    </Button>
  );
}

function GroupControls() {
  const actions = useInfiniteCanvasActions<Kind>();
  const groups = useInfiniteCanvasSelector((state) => state.groups);
  const windows = useInfiniteCanvasSelector((state) => state.windows);
  const floatingSequenceRef = useRef(0);
  const group = groups.find((candidate) => candidate.id === GROUP_ID) ?? null;

  if (group === null) {
    // Whatever is floating right now, not a hardcoded pair. `New window` would otherwise
    // be ignored by the one button you'd reach for immediately after pressing it.
    const groupedIds = new Set(
      groups.flatMap((candidate) => getInfiniteCanvasGroupWindowIds(candidate.tree)),
    );
    const members = windows.filter(
      (window) => window.mode !== "minimized" && !groupedIds.has(window.id),
    );
    // The shell lands over the windows it swallows, rather than at a fixed rect far from
    // wherever you happen to be looking. The solver re-projects them into it either way.
    const rect = unionRects(members.map((window) => window.rect)) ?? GROUP_RECT;

    return (
      <Button
        disabled={members.length < 2}
        onClick={() => {
          actions.createGroup({
            groupId: GROUP_ID,
            rect,
            title: "Workbench",
            windowIds: members.map((window) => window.id),
          });
        }}
        size="xs"
        variant="ghost"
      >
        Group them ({members.length})
      </Button>
    );
  }

  return (
    <>
      {(["split", "tabs", "accordion"] as const).map((layout) => (
        <Button
          key={layout}
          onClick={() => {
            actions.setGroupLayoutMode({ containerId: GROUP_ID, groupId: GROUP_ID, layout });
          }}
          size="xs"
          variant="ghost"
        >
          {layout}
        </Button>
      ))}
      <Button
        onClick={() => {
          actions.setGroupRect({
            groupId: GROUP_ID,
            rect: { ...group.rect, x: group.rect.x + 40 },
          });
        }}
        size="xs"
        variant="ghost"
      >
        Nudge shell
      </Button>
      <Button
        onClick={() => {
          // The last member, not a hardcoded `"right"` that may not be in the tree at all
          // once the group is built from whatever was floating.
          const lastMemberId = getInfiniteCanvasGroupWindowIds(group.tree).at(-1);

          if (lastMemberId !== undefined) {
            actions.undockWindow({
              rect: { ...NEW_WINDOW_SIZE, x: group.rect.x, y: group.rect.y + 400 },
              windowId: lastMemberId,
            });
          }
        }}
        size="xs"
        variant="ghost"
      >
        Tear out last
      </Button>
      <Button
        onClick={() => {
          // Centred on the shell, which is exactly the FOCUS-002 setup: a floating window
          // whose centre lies inside a group's rect takes that group as its contextual
          // parent, so `Alt+Arrow` from it searches the group's members before the canvas.
          floatingSequenceRef.current += 1;
          const ordinal = floatingSequenceRef.current;

          actions.openWindow(
            createInfiniteCanvasWindow<Kind>({
              id: `floating-${ordinal}`,
              kind: "pane",
              rect: {
                ...NEW_WINDOW_SIZE,
                x: group.rect.x + (group.rect.width - NEW_WINDOW_SIZE.width) / 2,
                y: group.rect.y + (group.rect.height - NEW_WINDOW_SIZE.height) / 2,
              },
              title: `Floating ${ordinal}`,
            }),
          );
        }}
        size="xs"
        variant="ghost"
      >
        Float over shell
      </Button>
      <Button
        onClick={() => {
          actions.closeGroup(GROUP_ID);
        }}
        size="xs"
        variant="ghost"
      >
        Dissolve
      </Button>
    </>
  );
}

function GroupsShowcase() {
  return (
    <div className="absolute inset-0">
      <InfiniteCanvasDesktop
        initialState={initialState}
        renderOverlay={(context) => {
          exposeCanvasDevHandle(context);
          return (
            <>
              {/* Mod+K. Built entirely on `getInfiniteCanvasContextualCommands`, which has been
                  public since the agent handle landed and which nothing consumed until now. */}
              <CommandPalette />
              <div className="pointer-events-auto absolute bottom-4 left-4 flex items-center gap-1.5 rounded-lg border border-border bg-popover/90 p-1.5 backdrop-blur">
                <NewWindowButton />
                <span className="mx-1 h-4 w-px bg-border" />
                <GroupControls />
                <span className="mx-1 h-4 w-px bg-border" />
                <RecipeControls />
              </div>
            </>
          );
        }}
        subtitle="Mod+K for every command. Alt+drag to dock, drag a shell edge to resize, a tab along its strip to reorder. Mod+Shift+Arrow tiles a floating window. Mod+Z undoes everything."
        title="Groups"
        windowDefinitions={registry}
      />
    </div>
  );
}
