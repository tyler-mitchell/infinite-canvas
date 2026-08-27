/**
 * A group's title has somewhere to be seen.
 *
 * It was modelled, persisted, settable through `setGroupTitle`, and drawn nowhere: the only render
 * sites were the shell's `aria-label` and a *fallback* tab label for a nested split. Measured in a
 * browser on 2026-08-26, a two-member split named "Reading list" rendered that string zero times.
 * Naming a group was write-only, and nothing in a typecheck or a green suite said so.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { InfiniteCanvasGroupLayer } from "./group-layer";
import { InfiniteCanvasProvider } from "./store";
import type { InfiniteCanvasGroup, InfiniteCanvasWindow } from "./types";

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

const group = (title: string): InfiniteCanvasGroup => ({
  id: "group-1",
  rect: { height: 400, width: 600, x: 0, y: 0 },
  title,
  tree,
  zIndex: 0,
});

const renderLayerFor = (
  title: string,
  labelSize = 20,
  zoom = 1,
  groupLabel?: (
    context: Readonly<{ group: InfiniteCanvasGroup; windows: readonly InfiniteCanvasWindow[] }>,
  ) => string,
) => {
  const state = createInfiniteCanvasState<Kind>({
    camera: { center: { x: 0, y: 0 }, zoom },
    groups: [group(title)],
    viewport: { height: 800, width: 1200 },
    windows,
  });

  return renderToStaticMarkup(
    <InfiniteCanvasProvider initialState={state}>
      <InfiniteCanvasGroupLayer
        canvasInstanceId="test-canvas"
        devicePixelRatio={1}
        groupLabel={groupLabel}
        labelSize={labelSize}
        resizeHandleSize={8}
        zIndex={0}
      />
    </InfiniteCanvasProvider>,
  );
};

/** The world length written into `--icx-group-label-size`, which is what the band renders at. */
const getLabelWorldSize = (markup: string): number =>
  Number(/--icx-group-label-size:\s*([\d.]+)px/.exec(markup)?.[1] ?? Number.NaN);

test("a split group draws its title, where no tab strip exists to carry it", () => {
  const markup = renderLayerFor("Reading list");

  expect(markup).toContain('data-slot="group-label"');
  expect(markup).toContain("Reading list");
});

/**
 * The frame's label policy is the consumer's, which it was not.
 *
 * `groupTabLabel` let a consumer replace what a *tab* says while the frame's own text stayed
 * `getInfiniteCanvasGroupTitle` and nothing else. The two are not always the same question: over a
 * tab strip the default repeats the strip verbatim, because an unnamed group is named after its
 * members and the strip already lists exactly those names. A consumer could see that and not say it.
 */
test("a consumer replaces what the frame label says", () => {
  const markup = renderLayerFor("Reading list", 20, 1, ({ group: labelled }) => `#${labelled.id}`);

  expect(markup).toContain("#group-1");
  expect(markup).not.toContain("Reading list");
});

test("the label is handed the group and the windows, so it can name one after its members", () => {
  const markup = renderLayerFor(
    "Reading list",
    20,
    1,
    ({ windows: members }) => `${String(members.length)} panes`,
  );

  expect(markup).toContain(`${String(windows.length)} panes`);
});

test("an empty string draws no label, which is how one group opts out", () => {
  // `labelSize` turns every label off at once. A policy returning "" is the per-group answer, and
  // it must not leave an empty band behind — the band is what reserves the space above the shell.
  const markup = renderLayerFor("Reading list", 20, 1, () => "");

  expect(markup).not.toContain('data-slot="group-label"');
});

test("without a policy the default still names the group, so nothing changed for consumers", () => {
  const markup = renderLayerFor("Reading list");

  expect(markup).toContain("Reading list");
});

test("a group with no title draws no label rather than an empty band", () => {
  expect(renderLayerFor("")).not.toContain('data-slot="group-label"');
});

/**
 * The label holds a constant *screen* size — the fix this file's second half exists for.
 *
 * It was sized from `metrics.tabStripSize`, a world unit, so it shrank with the group. Measured in
 * a browser at 28% zoom on 2026-08-26: a 30-unit band rendered 8.4px tall carrying 4.5px text, on
 * a shell whose panes had already dropped to summary detail. The name was the only thing left that
 * could say what the cluster was, and it was the first thing to go.
 *
 * Asserted on the world length the shell writes rather than on a measured pixel, because that is
 * the whole mechanism: the shell is drawn under a world→screen scale, so a band that must be N
 * screen pixels has to be written as `N / scale` world units. Multiply back and the product is
 * flat across zoom — which is the claim, stated as arithmetic that fails if the division is
 * dropped, inverted, or replaced with a constant.
 */
test("the label's world size scales inversely with zoom, so its screen size never changes", () => {
  const screenSizes = [0.25, 0.5, 1, 2, 4].map(
    (zoom) => getLabelWorldSize(renderLayerFor("Reading list", 20, zoom)) * zoom,
  );

  expect(screenSizes).toStrictEqual([20, 20, 20, 20, 20]);
});

test("the world size grows as the camera pulls back — the arithmetic that keeps it readable", () => {
  const far = getLabelWorldSize(renderLayerFor("Reading list", 20, 0.25));
  const near = getLabelWorldSize(renderLayerFor("Reading list", 20, 4));

  // Fails if the band is ever written as a plain world constant: then these are equal.
  expect(far).toBeGreaterThan(near);
  expect(far).toBe(80);
  expect(near).toBe(5);
});

test("the band is configurable, and its size is the one the consumer named", () => {
  expect(getLabelWorldSize(renderLayerFor("Reading list", 44, 1))).toBe(44);
});

test("a zero band draws no label, so a consumer can turn the legend off outright", () => {
  expect(renderLayerFor("Reading list", 0)).not.toContain('data-slot="group-label"');
});

/**
 * The regression this replaced, stated directly: the label must not read the tab strip's size.
 *
 * Two unrelated numbers were one, so retuning the strip silently resized every label — including
 * on split groups, which have no strip at all. The default strip is 30 and the default label 20;
 * if the two are ever reconnected, the world size at zoom 1 comes back as 30.
 */
test("the label does not borrow the tab strip's size", () => {
  expect(getLabelWorldSize(renderLayerFor("Reading list", 20, 1))).not.toBe(30);
});
