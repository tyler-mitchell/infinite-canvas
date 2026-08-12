/**
 * The compound path: mounting the canvas without `InfiniteCanvasDesktop`.
 *
 * `docs/API.md` has described `InfiniteCanvasViewport` and `InfiniteCanvasWindowLayer` as
 * "internals, exported for custom shells" since they were first exported. That claim was
 * untested and, until 2026-08-12, false in practice: nine of `Viewport`'s props were required in
 * their already-resolved form while every default and every `resolve*` call lived inside
 * `Desktop`, so a custom shell had to re-implement `Desktop` to satisfy the component `Desktop`
 * renders.
 *
 * These tests are the claim's evidence. If a required prop is ever added back without a default,
 * they stop compiling — which is the only way "exported for custom shells" stays true rather
 * than aspirational.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
} from "./factory";
import { InfiniteCanvas, InfiniteCanvasViewport } from "./infinite-canvas";
import { InfiniteCanvasProvider } from "./store";

type Kind = "note";

const registry = defineInfiniteCanvasWindowRegistry<Kind>({
  note: { kind: "note", renderBody: ({ window }) => <p>{window.title}</p> },
});

const state = createInfiniteCanvasState<Kind>({
  viewport: { height: 600, width: 900 },
  windows: [
    createInfiniteCanvasWindow<Kind>({
      id: "note-1",
      kind: "note",
      rect: { height: 200, width: 320, x: 0, y: 0 },
      title: "Composed",
    }),
  ],
});

test("a viewport mounts inside a provider with only a window registry", () => {
  // The whole claim in one expression. Everything else — chrome, diagnostics, input policy,
  // zoom policy, scene layers, spatial resolvers, title, subtitle — now defaults.
  const markup = renderToStaticMarkup(
    <InfiniteCanvasProvider initialState={state}>
      <InfiniteCanvasViewport<Kind> windowDefinitions={registry} />
    </InfiniteCanvasProvider>,
  );

  expect(markup).toContain('data-slot="viewport"');
});

test("the composed canvas renders its windows and their bodies", () => {
  // Mounting is not the same as working: a viewport that rendered an empty shell would satisfy
  // the test above and still be useless to the custom shell it claims to serve.
  const markup = renderToStaticMarkup(
    <InfiniteCanvasProvider initialState={state}>
      <InfiniteCanvasViewport<Kind> windowDefinitions={registry} />
    </InfiniteCanvasProvider>,
  );

  expect(markup).toContain('data-slot="window"');
  expect(markup).toContain("Composed");
});

test("the namespace object exposes the same parts", () => {
  // `InfiniteCanvas.Provider` / `.Viewport` is the documented compound spelling; it must be the
  // same components, not a parallel set that could drift.
  expect(InfiniteCanvas.Viewport).toBe(InfiniteCanvasViewport);
  expect(InfiniteCanvas.Provider).toBe(InfiniteCanvasProvider);
});
