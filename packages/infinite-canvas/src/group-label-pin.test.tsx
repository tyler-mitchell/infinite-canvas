import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { InfiniteCanvasGroupLayer } from "./group-layer";
import { InfiniteCanvasProvider } from "./store";
import type { InfiniteCanvasGroup, InfiniteCanvasRect } from "./types";

/**
 * A group's name stays in view while its group is, rather than riding the shell out of the top.
 *
 * The label is drawn *above* the shell's top edge — outside it, so it reserves nothing from the
 * layout solver and can never sit over a pane. The cost is that it leaves the viewport before the
 * group does: measured at 100% zoom on 2026-08-27, a shell 16px from the top of the window put its
 * label at y = -18.5 while the group it names filled most of the screen. A legend you cannot read
 * when you are looking straight at the thing it labels is the same defect as one too small to
 * read, one step along.
 *
 * So it pins, the way a sticky header or a map label does. Two bounds, and both are the point:
 * it stops at what the consumer's chrome leaves rather than the raw viewport edge, and it never
 * slides past its own shell's bottom, because a name outliving its group's footprint has stopped
 * labelling anything.
 *
 * Asserted on the `bottom` the shell writes rather than a measured pixel, for the reason the label
 * sizing tests give: the shell is drawn under a world→screen scale, so the whole mechanism is
 * arithmetic in world units, and a rendered position would only restate it.
 *
 * Both bounds were then watched in the incubator, which the commit that landed this could not say
 * because the app was throwing on another session's in-flight work at the time. With the shell's
 * top edge 433 pixels above the viewport and the shell still on screen, the label held at y = 57 —
 * one pixel below the app's 56-pixel header, where unpinned it would have been at -461. Panning
 * until the shell left entirely (bottom edge at -4) took the label with it to -23, rather than
 * leaving a name at the top of the screen labelling nothing.
 */

type Kind = "note";

const windows = ["note-1", "note-2"].map((id) =>
  createInfiniteCanvasWindow<Kind>({
    id,
    kind: "note",
    rect: { height: 200, width: 320, x: 0, y: 0 },
    title: id,
  }),
);

const tree: InfiniteCanvasGroup["tree"] = {
  activeChildId: null,
  axis: "horizontal",
  children: [
    { id: "note-1", kind: "window", weight: 1 },
    { id: "note-2", kind: "window", weight: 1 },
  ],
  id: "container-1",
  kind: "container",
  layout: "split",
  weight: 1,
};

const LABEL_SIZE = 20;
const HANDLE_SIZE = 8;

/**
 * `viewport` is 1200×800 and the camera sits at the origin, so world y and screen y differ by 400:
 * a shell at world y = -400 has its top edge exactly on the viewport's top edge.
 */
const render = (
  rect: InfiniteCanvasRect,
  insets: Readonly<{ bottom: number; left: number; right: number; top: number }> = {
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  },
) =>
  renderToStaticMarkup(
    <InfiniteCanvasProvider
      initialState={createInfiniteCanvasState<Kind>({
        groups: [{ id: "group-1", rect, title: "Reading list", tree, zIndex: 0 }],
        viewport: { height: 800, width: 1200 },
        viewportInsets: insets,
        windows,
      })}
    >
      <InfiniteCanvasGroupLayer
        canvasInstanceId="test-canvas"
        devicePixelRatio={1}
        labelSize={LABEL_SIZE}
        resizeHandleSize={HANDLE_SIZE}
        zIndex={0}
      />
    </InfiniteCanvasProvider>,
  );

/** The world length the shell subtracts from the label's natural position to hold it in view. */
const getPinOffset = (markup: string): number =>
  Number(
    /calc\(100% \+ var\(--icx-resize-handle-size\) - ([\d.]+)px\)/.exec(markup)?.[1] ?? Number.NaN,
  );

test("a group with room above it does not pin at all", () => {
  // World y = 0 is screen y = 400, far below the top: the natural position is already in view.
  expect(getPinOffset(render({ height: 300, width: 600, x: 0, y: 0 }))).toBe(0);
});

test("a group whose top has scrolled off holds its name at the viewport edge", () => {
  // Top edge at screen y = 0, so the label's natural top is -28 and it must come down by 28.
  expect(getPinOffset(render({ height: 300, width: 600, x: 0, y: -400 }))).toBe(28);
});

test("the pin stops at the consumer's chrome, not the raw viewport edge", () => {
  // Same shell, but a 56px header. Pinning under it would trade an invisible label for one behind
  // a panel, which is the failure `viewportInsets` exists to prevent everywhere else.
  const offset = getPinOffset(
    render({ height: 300, width: 600, x: 0, y: -400 }, { bottom: 0, left: 0, right: 0, top: 56 }),
  );

  expect(offset).toBe(84);
});

test("a shell scrolled fully off the top takes its label with it", () => {
  /*
   * The other bound. Without it the name of a group nobody can see would sit at the top of the
   * viewport claiming to label something — worse than absent, because it is wrong rather than
   * missing.
   *
   * A 300-tall shell at world y = -1200 has its bottom edge at screen y = -500, so the furthest
   * the label may come down is 500 + 300 - 20 short of… — stated as arithmetic: the pin never
   * exceeds `shellBottom - labelSize - naturalTop`, which here is less than the distance to the
   * viewport edge, so the shell's own bottom is what limits it.
   */
  const offset = getPinOffset(render({ height: 300, width: 600, x: 0, y: -1200 }));

  // Natural top: screen -800 - 8 - 20 = -828. Shell bottom - label: -500 - 20 = -520.
  expect(offset).toBe(308);
});

test("the pin is a world length, so it holds the same screen position at any zoom", () => {
  // The shell is drawn scaled; a pin written in screen pixels would be wrong by the zoom factor
  // everywhere except 1, which is the bug every other measurement in this layer has already had.
  const markup = renderToStaticMarkup(
    <InfiniteCanvasProvider
      initialState={createInfiniteCanvasState<Kind>({
        camera: { center: { x: 0, y: 0 }, zoom: 2 },
        groups: [
          {
            id: "group-1",
            rect: { height: 300, width: 600, x: 0, y: -400 },
            title: "R",
            tree,
            zIndex: 0,
          },
        ],
        viewport: { height: 800, width: 1200 },
        windows,
      })}
    >
      <InfiniteCanvasGroupLayer
        canvasInstanceId="test-canvas"
        devicePixelRatio={1}
        labelSize={LABEL_SIZE}
        resizeHandleSize={HANDLE_SIZE}
        zIndex={0}
      />
    </InfiniteCanvasProvider>,
  );
  // At zoom 2 the shell's top is at screen 400 - 800 = -400, so the label must travel 428 screen
  // pixels — written as 214 world units, because the shell scales it back up.
  expect(getPinOffset(markup)).toBe(214);
});
