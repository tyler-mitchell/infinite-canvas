import { createFileRoute } from "@tanstack/react-router";
import {
  captureInfiniteCanvasRecipe,
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
  getInfiniteCanvasGroupWindowIds,
  InfiniteCanvasDesktop,
  canvasModel,
  unionRects,
  useInfiniteCanvasDispatch,
  useInfiniteCanvasSelector,
  useInfiniteCanvasStore,
  type InfiniteCanvasRecipe,
} from "@hyphened/infinite-canvas/legacy";
import { useRef } from "react";
import { type } from "arktype";
import { Button } from "ui";
import { CommandPalette } from "../showcases/command-palette.tsx";
import { CanvasOffscreenIndicators } from "../showcases/offscreen-indicators.tsx";
import { CanvasThemeSwitcher } from "../showcases/theme-switcher.tsx";

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
      <div className="grid content-start gap-2 p-4 icx-showcase-text text-xs leading-relaxed">
        <div className="font-mono icx-showcase-muted text-[10px] tracking-wider uppercase">
          {window.id}
        </div>
        <p>
          A grouped window has no rect of its own. The group&apos;s tree owns its placement, and the
          reducer projects the solved rect back onto <code>window.rect</code>.
        </p>
        <p className="icx-showcase-muted">
          Drag this header to move the whole shell, or the shell&apos;s outer edge to resize it.
          Drag the seam between panes to reweight them. Hold <kbd>Alt</kbd> while dragging a
          floating window over another — the pointer has to be over the target, not just the windows
          overlapping — to dock it.
        </p>
        <p className="icx-showcase-muted">
          In <code>tabs</code> mode, drag a tab along its strip to reorder it, or out of the strip
          to tear the window free. <kbd>Arrow</kbd> with a pane selected moves the whole shell,
          because a member has no rect to nudge. <kbd>Mod</kbd>+<kbd>Shift</kbd>+<kbd>Arrow</kbd>{" "}
          tiles the active <em>floating</em> window into a half of the view; a grouped one is
          refused, for the same reason.
        </p>
        <p className="icx-showcase-muted">
          <em>Float over shell</em> drops a window centred on the group. Its centre is inside the
          shell, so the group becomes its <em>contextual parent</em>: <kbd>Alt</kbd>+
          <kbd>Arrow</kbd> from it searches the group&apos;s members before the rest of the canvas,
          and a floating window never needs a keyboard model of its own.
        </p>
      </div>
    ),
  },
});

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

/** The consumer stores recipes and validates them after loading. */
function readStoredRecipe(): InfiniteCanvasRecipe | null {
  const raw = globalThis.localStorage.getItem(RECIPE_STORAGE_KEY);

  if (raw === null) {
    return null;
  }

  try {
    const recipe = canvasModel.Recipe(JSON.parse(raw));
    return recipe instanceof type.errors ? null : recipe;
  } catch {
    return null;
  }
}

function RecipeControls() {
  const dispatch = useInfiniteCanvasDispatch();
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
            // Recipes translate to the target rect without scaling.
            dispatch({
              placement: { rect: { height: 600, width: 900, x: -100, y: -100 } },
              recipe,
              type: "recipe.apply",
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

function NewWindowButton() {
  const dispatch = useInfiniteCanvasDispatch<Kind>();
  const store = useInfiniteCanvasStore<Kind>();
  const sequenceRef = useRef(0);

  return (
    <Button
      onClick={() => {
        // The one-time camera read prevents rerenders during a pan.
        const { camera } = store.state$.peek();
        sequenceRef.current += 1;
        const ordinal = sequenceRef.current;
        const cascade = (ordinal % 5) * 28;

        dispatch({
          type: "window.open",
          window: createInfiniteCanvasWindow<Kind>({
            id: `pane-${ordinal}`,
            kind: "pane",
            rect: {
              ...NEW_WINDOW_SIZE,
              x: camera.center.x - NEW_WINDOW_SIZE.width / 2 + cascade,
              y: camera.center.y - NEW_WINDOW_SIZE.height / 2 + cascade,
            },
            title: `Pane ${ordinal}`,
          }),
        });
      }}
      size="xs"
      variant="ghost"
    >
      New window
    </Button>
  );
}

function GroupControls() {
  const dispatch = useInfiniteCanvasDispatch<Kind>();
  const groups = useInfiniteCanvasSelector((state) => state.groups);
  const windows = useInfiniteCanvasSelector((state) => state.windows);
  const floatingSequenceRef = useRef(0);
  const group = groups.find((candidate) => candidate.id === GROUP_ID) ?? null;

  if (group === null) {
    const groupedIds = new Set(
      groups.flatMap((candidate) => getInfiniteCanvasGroupWindowIds(candidate.tree)),
    );
    const members = windows.filter(
      (window) => window.mode !== "minimized" && !groupedIds.has(window.id),
    );
    const rect = unionRects(members.map((window) => window.rect)) ?? GROUP_RECT;

    return (
      <Button
        disabled={members.length < 2}
        onClick={() => {
          dispatch({
            groupId: GROUP_ID,
            rect,
            title: "Workbench",
            type: "group.create",
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
            dispatch({
              containerId: GROUP_ID,
              groupId: GROUP_ID,
              layout,
              type: "group.setLayoutMode",
            });
          }}
          size="xs"
          variant="ghost"
        >
          {layout}
        </Button>
      ))}
      <Button
        onClick={() => {
          dispatch({
            groupId: GROUP_ID,
            rect: { ...group.rect, x: group.rect.x + 40 },
            type: "group.setRect",
          });
        }}
        size="xs"
        variant="ghost"
      >
        Nudge shell
      </Button>
      <Button
        onClick={() => {
          // The current group contents determine the last member.
          const lastMemberId = getInfiniteCanvasGroupWindowIds(group.tree).at(-1);

          if (lastMemberId !== undefined) {
            dispatch({
              rect: { ...NEW_WINDOW_SIZE, x: group.rect.x, y: group.rect.y + 400 },
              type: "group.undockWindow",
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
          // A centered window uses the group as its contextual parent.
          floatingSequenceRef.current += 1;
          const ordinal = floatingSequenceRef.current;

          dispatch({
            type: "window.open",
            window: createInfiniteCanvasWindow<Kind>({
              id: `floating-${ordinal}`,
              kind: "pane",
              rect: {
                ...NEW_WINDOW_SIZE,
                x: group.rect.x + (group.rect.width - NEW_WINDOW_SIZE.width) / 2,
                y: group.rect.y + (group.rect.height - NEW_WINDOW_SIZE.height) / 2,
              },
              title: `Floating ${ordinal}`,
            }),
          });
        }}
        size="xs"
        variant="ghost"
      >
        Float over shell
      </Button>
      <Button
        onClick={() => {
          dispatch({ groupId: GROUP_ID, type: "group.close" });
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
        tools
        initialState={initialState}
        renderOverlay={() => {
          return (
            <>
              <CommandPalette />
              {/* One group produces one offscreen indicator. */}
              <CanvasOffscreenIndicators />
              <div className="pointer-events-auto absolute bottom-4 left-4 flex items-center gap-1.5 rounded-lg border border-border bg-popover/90 p-1.5 backdrop-blur">
                <CanvasThemeSwitcher />
                <span className="mx-1 h-4 w-px bg-border" />
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
