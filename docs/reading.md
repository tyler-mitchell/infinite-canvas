# Reading: the canvas is the page

Written 2026-09-17. This replaces "camera stops" (stored camera positions stepped like slides),
which the owner rejected the same day. Do not rebuild an authored-camera-position model.

## The experience

A visitor scrolls. Scrolling moves the camera along a route through the layout, so the neighbours
glide past and the arrangement is felt, not explained. No mode, slide or stop is visible. A rail
names the sections and shows the current one. Links and buttons inside cards stay live. "Explore"
frees the camera for pan and zoom without editing; "Back to reading" re-attaches at the nearest
section with an animated return, never a jump.

## The rules

- Content is the unit. The author never aims a camera. The route is the reading order of the
  layout: rows top to bottom, left to right, into containers (`getRoute`).
- One zoom for the whole route: fit the route's width (`maxZoom` caps it, and defaults to 1, so
  reading never magnifies a small document). The camera's y follows the scroll offset; each section
  is a snap offset (`getCameraTrack`).
- The browser owns the scroll: inertia, keys, scrollbar, `scroll-snap-type: y proximity`, reduced
  motion. The framework writes no gesture code and has no thresholds (`CanvasScroll`, on
  Motion's `scroll()` over the native scroll timeline).
- A phone reads at zoom 1 because the board's root container follows the viewport width
  (`widthMode: "viewport"`) and the grid's breakpoints fire.
- The URL names the current section (the board binds the hash through `section` and
  `onSectionChange`). Per-section zoom and chapters are author choices for later, not defaults.

## The seams

| Piece                                                             | Where                     | Contract                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getRoute({ windows, rects, roots })`                             | `next/route.ts`           | ordered `Section[]` of leaves                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `getCameraTrack({ sections, viewport, insets, limits, maxZoom })` | `next/route.ts`           | `{ zoom, length, sections, stops, at(offset), offsetAt(camera) }` or `null`. `sections` places every section, including two that share a row; `stops` is the distinct offsets the scroll snaps to                                                                                                                                                                                                                                                                                                                                   |
| `CanvasScroll`                                                    | `next/react/scroll.tsx`   | Base UI `ScrollArea` (Viewport is the scroller), sticky viewport, spacer, snap children, optional `scrollbar` slot; previews the camera per scroll frame (`previewCamera`) and commits on `scrollend` (`setCamera`); `attached` detaches and re-attaches with an animated return; `section` names the first section on mount and scrolls to it whenever the consumer changes it afterwards, so browser history reaches the view, while `onSectionChange` reports each change; a consumer binds the URL with two props and no effect |
| `setCamera({ center?, zoom? })`, `previewCamera(...)`             | `next/state.ts`           | `setCamera` commits the camera to the document view (persisted); `previewCamera` writes the session preview only, so a scroll frame never writes storage; both clamp zoom and stop any animation                                                                                                                                                                                                                                                                                                                                    |
| `useCanvasScroll()`                                               | `next/react/scroll.tsx`   | `{ sections, current, attached, scrollTo }` for rails                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `CanvasViewport mode`                                             | `next/react/viewport.tsx` | `edit` (everything), `read` (presses stop, wheel is the page's, touch `pan-y pinch-zoom`, no hotkeys), `explore` (any press pans, wheel pans and zooms, no editing). Inside a `CanvasScroll` the default follows `attached` (`read` or `explore`); outside it is `edit`. A consumer passes `mode` only to override                                                                                                                                                                                                                  |
| `data-selected` on `[data-slot="canvas-window"]`                  | `next/react/viewport.tsx` | the framework marks the selected window; a consumer styles through `in-data-selected:` and never reads the selection to set its own attribute                                                                                                                                                                                                                                                                                                                                                                                       |

Consumers: `packages/polkadot-ui/portfolio/board.tsx` (`/board?mode=read`) and
`apps/playground/src/routes/reading.tsx`. A consumer in reading mode owns exactly one bit
(`exploring`) and passes it as `attached`; the framework derives the viewport mode, reports the
section, marks the selected window, lists the selection's component actions
(`computed.selectionActions`) and defaults the grouping layout (`grouping` option). A consumer
that re-derives any of these has found a framework deficit; move it in, do not plumb it.

## Not verified

Seen live 2026-09-18 on `/board?mode=read` at desktop and phone width: eight sections at distinct
offsets, scrolling moves the camera by exactly the scroll delta in world y, the URL hash follows
the section, and only the world transform changes.

Still unseen: the scroll and snap feel, cards staying interactive under the sticky viewport, the
animated return from Explore, and reading at phone width near zoom 1, which waits on the container
sizing in backlog D6. Two cards that share a world row also share one scroll offset, so one of them
can never become the current section; whether side-by-side cards are one stop or two is open.
