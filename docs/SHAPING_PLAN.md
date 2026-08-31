# Framework shaping plan

Status: adopted on 2026-06-10.

HTML-in-Canvas was a detected, Chrome-first capture path with Snapdom as fallback.
Limited browser support did not block that path.
See [research/html-in-canvas.md](research/html-in-canvas.md) and risk R12.

The headless goal moved existing style into an optional stylesheet over stable attributes.
This work covered FR-6 and enabled a separate styled distribution.

## Design decisions

| Area        | Decision                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| Parts       | Use `data-slot` for parts. Use `data-active`, `data-selected`, and `data-pinned` for Boolean state.    |
| Enums       | Use `data-action`, `data-handle`, `data-axis`, and `data-mode`.                                        |
| Behavior    | Keep the separate `data-infinite-canvas-*` contract.                                                   |
| CSS         | Export optional `infinite-canvas/theme.css` in `@layer infinite-canvas`. Prefix tokens with `--icx-*`. |
| Structure   | Keep required structure inline so the unstyled framework works.                                        |
| Grid        | Use `var(--icx-*)` in gradients calculated by JavaScript.                                              |
| Scene       | Keep the typed `InfiniteCanvasTheme` object.                                                           |
| Theme input | The `theme` prop accepts `Partial<...>` and writes `--icx-*` variables. Do not use `getComputedStyle`. |
| Icons       | Replace lucide-react with inline SVG icons. The `icons` map can replace them.                          |
| Tools       | Use inline styles for developer tools so they work without the stylesheet.                             |

The HUD input is:

`hud?: boolean | { statusCard?, minimizedDock?, pointerModeControls?,
cameraControls?, zoomControls? }`.

## Planned phases

| Phase           | Work                                                                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Records      | Update editor TypeScript configuration, risk R12, and this plan.                                                                                          |
| 1. Evidence     | Measure unflagged HTML-in-Canvas, its descendant rule, invalidation, and taint. Record `research/html-in-canvas.md`.                                      |
| 2. Modules      | Split the 2,858-line `infinite-canvas.tsx` into frame-slots, window-frame, canvas-overlays, canvas-hud, grid-backdrop, and webgpu-surface modules.        |
| 3. Attributes   | Add public selector attributes and a contract test. Use the list as the styled slots map.                                                                 |
| 4. CSS          | Add `theme.css`, unchanged tokens, source and distribution exports, and a synchronization test. Import enables the stylesheet.                            |
| 5. Baselines    | Import the theme above Tailwind. Capture all routes and scripted states.                                                                                  |
| 6. Dependencies | Remove Tailwind and Lucide in five slot groups. Compare screenshots, drive each group, and keep `pointer-events-none`.                                    |
| 7. Boundary     | Remove `@source` and Lucide. Add `headless-boundary.test.ts` for `className` literals and Lucide imports.                                                 |
| 8. API          | Add `getInfiniteCanvasWindowData`, synchronous drop attachment, experimental `createInfiniteCanvasHandle`, `hitRadius` docs, and the documentation sweep. |

Phase 2 used pure moves.
It covered NFR-2, reduced R13, and made the render path measurable.

## Separate programs

- **Performance.** Measure /stress at 20, 40, and 80 windows.
  Count window renders and snap rebuild cost.
  Compare narrower subscriptions with HTML-in-Canvas textures during camera motion.
  Restore live DOM after motion.
- **Styled distribution.** Build Tailwind Variants over the data-slot contract.
  Use the motion study for an original branded grid without copying its implementation.
