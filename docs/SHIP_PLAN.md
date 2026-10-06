# Ship plan

> Adopted on 2026-06-24.
> The goal is an npm package, a safe public repository, and accurate production claims.
> The initial label was "works on my machine, verified by hand".
> This document expands P8 from [ROADMAP.md](ROADMAP.md).
> P1 through P7 require a package that external consumers can install.
> The initial findings came from repository evidence on 2026-06-24.

## Initial repository evidence

### Package identity

The unscoped npm name `infinite-canvas` already belonged to another publisher at version 1.0.0. The names
`@hyphened/infinite-canvas` and `@infinite-canvas/core` were available. The scoped rename was thus a
release requirement.

### Client directive

Sixteen source files declared `"use client"`. The built `dist/index.mjs` contained no copy of that directive.
A hooks-based package without this directive fails for Next.js App Router and React Server Components.

### Public repository files

The repository had no LICENSE file. Its `package.json` still declared MIT. The repository also had no
`.github/` directory and no CI.

Both README files still contained the Vite+ starter text. The phrases were "Vite+ Monorepo Starter" and
"vite-plus-starter".

### Dependencies and metadata

`@react-three/fiber` required the exact `10.0.0-canary.dbbe704` release. `three` was a required peer and a
top-level distribution import. Every consumer thus installed a canary and Three.js, even without
`sceneLayers`.
The manifest had no `sideEffects` field. It also lacked `repository`, `homepage`, and `keywords`.

`@zumer/snapdom` already used a lazy `import()`. The ESM distribution was 216 KB. The declarations were 100
KB. The theme stylesheet copied correctly. The suite contained 131 passing tests.

## Status on 2026-07-08

### Class 1: package publication

Status: done.

The package name changed to `@hyphened/infinite-canvas`. The bundle starts with `"use client"`. The manifest
gained complete npm metadata.

It declares `sideEffects: ["**/*.css"]` and package provenance. Peer ranges no longer require the exact R3F
canary.

`scripts/verify-artifact.mjs` is the persistent publication gate. `prepublishOnly` starts that gate.
The package proof used this sequence:

1. Enter `pnpm pack`.
2. Install the tarball into a new project outside the workspace.
3. Enter `tsc --noEmit` for the published `.d.mts`.
4. Bundle the consumer with esbuild.
5. Resolve the theme stylesheet subpath.
6. Enter `pnpm publish --dry-run`.

The dry-run command resolved to `@hyphened/infinite-canvas@0.1.0`.

### Class 3: public trust files

Status: done.
The repository gained these files and systems:

- LICENSE
- A root README
- An npm README with a compiled quick start
- `docs/API.md`, based on 287 names that existed in the built `.d.mts`
- CI for Node.js 22 and 24
- A provenance release workflow
- CONTRIBUTING
- CODE_OF_CONDUCT
- SECURITY
- CHANGELOG
- Issue templates
- A pull request template.

### Class 4 status

Optional 3D, item 13, was done. Accessibility, item 12, and the API audit, item 14, still had open work at
this date.

### Class 2: public source history

The mechanical work was done. `reference/` was untracked. The derived `/dynamic-grid` route was removed from
`apps/playground`.

The derived implementation still existed in Git history. Removal required `git filter-repo`. This action
rewrites all commit identifiers and had no remote recovery source. The owner thus controlled this action.

Neither `/dynamic-grid` nor `reference/` entered the package tarball. The npm package was ready without the
history rewrite.

## Other corrected faults

### Toolchain drift

The catalog used `@latest` for `vite`, `vitest`, and `vite-plus`. Each `install` can change the toolchain. A
change from 0.1.24 to 0.2.2 broke `vp test` during development. The catalog uses exact versions.

### Validation bundle cost

`arktype` used 45.5 KB after gzip. That value was 34 percent of the package. Every render path imported it
through `store -> persistence -> validation`.

Small handwritten guards replaced that dependency. Characterization tests first recorded the ArkType behavior.
The replacement kept that behavior. The gzip size changed from 132.9 KB to 87.4 KB.

### ARIA state

`aria-selected` is invalid on `role="group"`. The active window uses `aria-current`. Windows also use
`aria-roledescription="window"`. `src/accessibility.test.tsx` guards these attributes.

### Persistence route

No playground route used a `storageKey`. The project thus had no browser persistence evidence.
The `/persistence` route added that evidence. The rectangle coordinate `x: 144.21052631578948` survived a
complete storage cycle. Transient input state did not enter storage.

The route also covered three invalid inputs:

- A poisoned payload
- A window with an unknown `kind`
- Invalid JSON.

Each case recovered without console errors.

## Consumer-only package faults

### Optional 3D metadata

`peerDependenciesMeta.optional` did not make the peer optional for bundlers. A dynamic `import()` still has a
specifier that a bundler resolves. A consumer without 3D packages thus failed on `three`.

The correction added a public API seam. `InfiniteCanvasWebGpuSurface` moved to
`@hyphened/infinite-canvas/scene`. Consumers inject it through `sceneSurface`.

The main entry does not import the scene entry. A main-entry build contains no `three` import.

A consumer without the two 3D peers typechecks and bundles. That bundle uses 40.1 KB after gzip. The scene
path uses 263.3 KB after gzip.

### Declaration directive

The `"use client"` banner also entered `index.d.mts`. A directive prologue is illegal in an ambient
declaration. A consumer without `skipLibCheck` failed with TS1036.

The gate requires the directive in JavaScript and prohibits it in declarations. A valid JavaScript
artifact keeps `"use client"` as its first statement. A consumer with `skipLibCheck: false` proves both
requirements. Test artifacts with known faults made each assertion fail.

## Related program state on 2026-07-08

P2 tranche 1 added frame-chrome memoization. It remained unmeasured. See
[research/performance-profile.md](research/performance-profile.md).
P1 had all pointer gestures:

- Dock
- Shell move
- Shell resize
- Seam weight change
- Tab removal
- Tab reorder.

Undo, redo, and layout recipes were also present. FOCUS-002, FOCUS-003, and ACC-001 were present. Scenario
tests for P1 did not yet exist. No test covered groups, history, or recipes at that time.

## Bumpy release flow from 2026-08-12

Bumpy owns versions, the changelog, and publication. A bump file on `main` opens or updates
`bumpy/version-packages`. Merging that pull request publishes with npm OIDC.
This flow replaced three manual steps:

- Editing the `version` field
- Editing the changelog
- Creating and pushing a tag.

CI starts the package build, `publint`, `attw`, and a clean consumer install. The first publication creates the
npm name. It also configures `release.yml` as the trusted publisher. Later releases use tokenless CI.

## Automation limit found on 2026-08-12

The repository had no Git remote. `git remote -v` returned no entries.
Thus, no GitHub Actions job started. The `ci.yml` and `release.yml` files described the intended pipeline. No
event started that pipeline.

The `pre-push` hook never started because no push target existed. That hook contains `vp check` and
source-reading gates. Its comment said "where a red run costs nobody's attention" and assigned tests and builds
to CI.

`pre-commit` was the only automatic hook. It calls `vp staged` for staged-file format and lint work. It does
not cover unstaged dependents.

A `process.env.NODE_ENV` reference broke the playground build. Package-local gates did not find the consumer
failure.

`pre-commit` also starts the four source-reading gates. The `pre-commit` path also starts the
source-only checks. They read source and take milliseconds. `vp check`, tests, and builds remain outside that
hook. The `pre-push` hook and CI still own them after a remote exists.

The local `pre-push` path is the
workspace-wide path before a remote exists.
Until then, no automation starts tests or builds.
Enter `pnpm --filter @hyphened/infinite-canvas verify` and the playground build manually.
Creating a remote and publishing remain owner actions.

## Original blocker classes

These classes record the initial plan. Later sections give their final state.

### Class 1: package publication

1. Rename the package to `@hyphened/infinite-canvas`.
2. Preserve `"use client"` in the bundle.
3. Add `repository`, `homepage`, `bugs`, `keywords`, `sideEffects`, `engines`, and `publishConfig.provenance`.
4. Widen the R3F peer range.
5. Select the supported React 19 and `three` ranges.
6. Decide whether the R3F and Three.js peers are optional.

A blanket `false` value for side effects was not permitted. The package cannot use `false` after it ships CSS.
The theme stylesheet and directives require explicit handling. The package proof includes the `theme.css`
subpath.

### Class 2: public source

1. Add an MIT license for Tyler Davis Mitchell at the root and package.
2. Resolve the IP risk in `/dynamic-grid`.
3. Decide whether `reference/` belongs in the public repository.

The derived route came from deobfuscated third-party code. The source was the "Robot Components" nodegrid
bundle. `reference/infinite-canvas-dynamic-grid/` contained related source material. The public-source
decision covers all of `reference/infinite-canvas-dynamic-grid/`.

`GRID_MOTION_STUDY.md` recorded extracted motion constants and a GLSL grain shader. The deobfuscated source
files were already absent from Git history. The derived implementation still created legal risk in a public
repository. The `/dynamic-grid` implementation was the affected route.

The 78 tracked files under `reference/` came from Tyler's kek code. Those files were not the same legal risk.
They added public-repository noise and linked to deobfuscated material.

### Class 3: public trust

1. Add CI for install, `vp check`, tests, and build.
2. Replace both starter README files.
3. Prove a packed tarball in a new application outside the workspace.
4. Add CHANGELOG, version management, `CONTRIBUTING`, `CODE_OF_CONDUCT`, and templates.

Only a clean `npm pack` consumer can expose source-link packaging faults.

### Class 4: production work

The initial list included accessibility, optional 3D, and an API audit.

## Accessibility status

Directional focus uses `window.focusDirection`. The default chord is Alt with an arrow. This item was stale
after the command landed.

A later keyboard audit found missing camera input. The command set supported fit-all, fit-selection, and
reset-zoom. It did not provide pan or zoom.

The project added view.pan and `view.zoomBy`. The same audit found pointer-only group actions. It also found
window lifecycle behavior outside the command registry.
The new command set covers docking, undocking, layout conversion, axis, dissolve, reorder, and lifecycle.
`command-coverage.test.ts` requires a command classification for each new action.

### Zoom chords

`view.zoomBy` uses the bare `=` and `-` keys. The command does not use `Mod+=` or `Mod+-`. Those chords belong
to browser page zoom.

The first design used `Shift+=` to match the `Shift+0/1/2` view family. `@tanstack/hotkeys` rejected
`Shift+=`. `Shift` changes the punctuation key on some layouts. Digit chords do not have that problem. Thus,
`Shift+1` remains valid.
The bare zoom keys are safe because command registration uses `ignoreInputs`.

### Pan chord

`view.pan` has no default chord. All arrow combinations already have meanings:

- `window.nudge` uses a bare arrow.
- `Alt` changes focus.
- `Alt` with Shift changes size.
- The `Alt` family remains reserved for window input.
- `Shift`, `Alt+Shift`, and `Mod+Shift` have related command families.
- `Mod+Arrow` belongs to browser history or document-edge movement on macOS.
- A second `Mod+Arrow` binding cannot share that browser input.

A shared bare-arrow chord cannot work. Bindings register separately. The handler consumes a chord before it
examines command availability. One key press can move a window and pan the canvas.

The pan command remains in the palette. Consumers can bind it through `hotkeyBindings`. The same binding
system keeps `window.nudge` replaceable.

## Optional 3D

Status: done.

A lazy mount did not solve the peer problem. Bundlers resolve dynamic import specifiers. The solution required
the `@hyphened/infinite-canvas/scene` entry and `sceneSurface` input. Only the scene entry imports the renderer
peers.
The `/scene` entry owns those peers.

A consumer without the scene path uses 40.1 KB after gzip.

## API audit

Status: done.

At the start of the audit, the two entries exported 192 values and 164 types. The earlier source said "287 names".
That count
came from an older state. Later group, history, recipe, and portal work changed the total again.

`docs/API.md` is handwritten. The source barrel and `docs/API.md` must contain the same public names.

It is not generated. Its old header incorrectly described generated documentation. The file drifted by 43
names.

`scripts/verify-api-doc.mjs` compares each barrel export with the document. This gate keeps `docs/API.md`
current. CI and `prepublishOnly` start the gate.

The stability gate uses `scripts/verify-api-stability.mjs` and `scripts/api-stability.json`. Before
classification, 374 names had no stability tier. The final classification recorded 312 stable names and 42
experimental names.
The absence of a tier did not mean "no promise".

Classification belongs to each module. A new export from `geometry.ts` inherits that module tier. A new module
fails until someone assigns a tier.
The gate covers five failure types:

- A module with no classification
- A module in both tiers
- A stale manifest entry
- A stale `typesExperimental` name
- A document that omits an experimental module.

The audit kept three pure helpers in the main entry:

- `scene-layer-geometry`
- `spatial-target`
- `window-proxy`.

`verify-pure-core.mjs` proves that these helpers do not import `three`. Each helper has a consumer.

The audit considered "consider moving scene helpers behind `/scene`". Moving them forces 3D peers on SVG
connector users. The pure helpers thus stay outside
`/scene`. The optional renderer remains inside `/scene`.

The audit removed unused API instead. `window-scene-shell` exported 15 names with no consumer outside
`window-scene-shell.test.ts`. `getMinimumWorldLength` had no reference. `scene-model` only re-exported
`window-proxy` under old names.

The `@deprecated` aliases were `getWindowSceneModel` and `InfiniteCanvasWindowSceneModel`. Those aliases also
left the public API. No consumer release existed, so the removal did not break a consumer.

`window-scene-shell.ts` remains because `window-proxy` calls one function from it. A future minor release can
export it after a consumer requirement appears.

## Current delivery gates

The plan separates package publication, public source, and production evidence.

| Gate                | Status      | Remaining action                                            |
| ------------------- | ----------- | ----------------------------------------------------------- |
| npm package         | Ready       | Publication is an owner action through the release process. |
| Public repository   | Owner-gated | Purge the derived history after explicit approval.          |
| Production evidence | Partial     | Complete the remaining browser and performance evidence.    |

### Package publication

Local package evidence covers all required checks. `prepublishOnly` starts `scripts/verify-artifact.mjs`.
`pnpm publish --dry-run` resolves `@hyphened/infinite-canvas@0.1.0`.

The package never included `reference/` or `/dynamic-grid`. No `/dynamic-grid` file enters the tarball. The
source-history problem affects the public repository. It does not affect the tarball.

The original owner step was to create the npm organization and enter `pnpm publish`. That setup still authorizes
one local `pnpm publish` action. The later Bumpy flow replaces direct releases after initial setup.

### Public repository

`reference/` is untracked. The derived route is outside the application. A fresh clone builds.

The derived implementation remains in Git history. A `git filter-repo` invocation removes that history. A
description of `git filter-repo` is not authorization to use it.

A history purge rewrites every commit identifier. The repository has no remote recovery source. Only the owner
can authorize that operation.

### Production evidence

The remaining evidence changed over time. C1 and C2 are done. C4 still requires a real browser. C5
implementation later landed, but screen-reader evidence remained open at the recorded status.

## C1: drift gates

Status: done.
`README.md` called `docs/API.md` "the full export surface". The document omitted 43 names. Undo,
redo, recipes, and portals had no section.

`scripts/verify-api-doc.mjs` compares each export. CI starts it before the build. `prepublishOnly` also starts
it.
The parser also fails after an unsupported export form appears. A gate that cannot parse a new form must not
report success.

`README.md` and `CONTRIBUTING.md` also claimed a pure-core import test. No such test existed.
`scripts/verify-pure-core.mjs` starts from 29 pure-core roots. The crawl reached 33 modules at that time.
It fails on paths to `react`, `@legendapp/state`, `three`, `@react-three/fiber`, or `@zumer/snapdom`.

Type-only imports do not count. For example, `import { type X } from "./store"` disappears from runtime
output. The gate also fails when the crawl reaches fewer modules than its floor.

The third gate addressed staged-file scope. `pre-commit` starts `vp staged`. That command cannot see a dependent
file that is not staged.
Making `isGrouped` required on `InfiniteCanvasWindowFrame` broke two unstaged test files. Six "clean" commits passed
staged checks while workspace `vp check` failed.

The `.vite-hooks/pre-push` hook starts `vp check`. It also starts both source-reading gates. Deleting the prop
from an unstaged test produced `vp staged → exit 0`. The full hook produced `pre-push → exit 1`.

Tests and builds remain in CI. The hook stays short enough for regular use.
The exit evidence includes these failures:

- An observable import in `reducer.ts`
- A second observable path into `reducer.ts`
- A `three` import three levels away
- A stale root
- A missing API name
- A type-only import does not fail.

The API document gate found three later omissions within six commits.

## C2: scenario evidence

Status: done on 2026-08-12.
The source called C2 "the single largest gap in the project".
All 17 identifiers have assertions:

- DOCK-001 through DOCK-005
- SPLIT-001 through SPLIT-003
- TAB-001 and TAB-002
- ACC-001
- FAIL-001
- FOCUS-001 through FOCUS-003
- PERSIST-001 and PERSIST-003.

The suite had 237 tests across 27 files. It had 165 tests across 22 files when the item started.
The tests use three files:

- `group-tree.test.ts` covers pure tree structure.
- `history.test.ts` covers transactions.
- `acceptance-scenarios.test.ts` covers behavior that requires complete state.

The state tests cover shell movement, seam weights, zoom during drag, and storage of a group.

ACC-001 required moving `getNextRovingIndex` out of `group-layer.tsx`. The function became
`getNextInfiniteCanvasRovingIndex` in `window-focus.ts`. The move left `window-focus.ts` as the pure focus
module. It is internal.

It implements pure roving-key geometry beside directional focus.
The first FAIL-001 test expected a 150-unit result. The real result was 100 units because the test changed
`zoom` and kept `center` fixed. The document number assumed `camera.zoomAt`.

The corrected test uses pointer-anchored zoom. It also proves that the grabbed world point remains below the
pointer.

### Test plan that preceded implementation

A 2026-07-09 source audit produced [research/c2-test-plan.md](research/c2-test-plan.md). That session did not
include test implementation. The plan gives an arrange, action, and assertion for each P1 and P4
scenario.
It changed "write the suite" into "type these assertions".
The plan includes two regression guards:

- Dock intent applies once.
- Pan keeps a zoom change that occurs during the pan.

It also defines a coverage floor for P1 and P4.

### Defects that mapped to missing scenarios

The audit found these four direct matches:

| Defect                                                   | Scenario  |
| -------------------------------------------------------- | --------- |
| Alt with drag dispatched `interaction.step` three times. | DOCK-001  |
| Grouped-window resize handles covered the gutter.        | SPLIT-001 |
| Zoom during drag moved the window away from the pointer. | FAIL-001  |
| `window.nudge` removed a member from its group position. | DOCK-003  |

The audit also found four defects without a scenario:

- A `scope="window"` portal rendered below its own window.
- A finite `maxPendingCaptures` value left refused captures blank.
- The frustum probe scanned its tracked set quadratically in each frame.
- A group tab strip created one tab stop for each tab.

Three more faults appeared and were found on the same day. Two belonged to group-resize code. One used a
browser-owned shortcut. A later workspace `vp check` also found failures that six staged-file checks missed.

### Status correction

An older paragraph said no test covered groups, history, or recipes. That statement was true before C2. It
became false after `group-tree.test.ts`, `history.test.ts`, and `acceptance-scenarios.test.ts` landed.

The exact old claim was "No test in the suite touches groups, history, or recipes. P1 and P4 are capability-complete and verification-empty".

The later suite had 469 tests across 51 files. Its identifiers remain in `acceptance-scenarios.md`. The
document kept the historical reason for C2 without keeping a false current status.

### Source audit evidence

The source audit did not replace tests. It examined two high-risk paths first.

In `recipes.ts`, `reconcileInfiniteCanvasGroups` starts when a recipe enters state.
`undockInfiniteCanvasGroupWindow` removes each leaf that no longer names a live window. It removes an empty
tree. Thus, a recipe cannot restore a group with a missing member.

In `history.ts`, `pushInfiniteCanvasHistory` records the document before an action. It clears the redo branch.
A drag records only the transition from `null` input state. `interaction.step` does not add another entry. One
`interaction.step` series belongs to each drag transaction.

Undo and redo move documents between `past` and `future`. They preserve the current document. A pointer press
and release without movement still creates one empty undo step. That behavior is intentional and documented.

The wider audit found two live defects. A recursive parser for `localStorage` threw `RangeError` instead of the
required `null` after extreme nesting. `validation.ts` limits depth.
Pan also discarded a zoom change that occurred during pan. `stepCanvasInteraction` keeps that change.
The audit also examined these paths and found no fault:

- `interaction.ts` drag and zoom deltas
- `geometry.ts` pointer zoom and pan math
- `selection.ts` marquee accumulation
- `group-tree.ts` dock, undock, and normalization
- Snapping resolution and candidate construction.

Every drag reprojects both pointer endpoints. At fixed zoom, the result is bit-identical to the older
calculation.
Selection in `add` mode can create duplicate identifiers. `normalizeSelectionWindowIds` removes them later.

The group identifier format is `targetId::edge`. Redocking at one edge extends the split. It does not create a
colliding container. Weights preserve neighbor proportions.

Snap evidence covered hysteresis, priority, resize-edge signs, gap centering, stable identifiers, and overlap
requirements.
`registry.ts` still has one unreachable inconsistency. The empty-window and normal paths preserve transient
`interaction`. The all-unregistered fallback clears it.

Public store input does not expose that difference. Hydrated state already has interaction set to `null`.

### Acceptance status language

The 2026-07-08 review also found stale status headings in `acceptance-scenarios.md`. Some headings said
grouping was absent while related entries said `done`.

`SNAP-005`, `PERSIST-001`, and `PERSIST-003` also had old status. The old `open` value mixed two meanings. The
document uses `built` for unguarded behavior and `unbuilt` for missing behavior. The review kept `open`,
`built`, and `unbuilt` as separate states.

## C1b: stability gate

Status: done.
This is the API-audit gate described earlier. `verify-api-stability.mjs` classifies modules and blocks
unclassified additions. The audit found 15 unused exports in `window-scene-shell`.
A new barrel module fails before it receives a tier. Five negative cases prove the gate.

## C3: group-shell resize

Status: built and owner-observed.
The owner reported that a group outer edge did not move. The `groupResize` input changes `group.rect`. It
exists beside `groupMove` and `groupGutter`. Member rectangles update from the group model.

The minimum size is structural. It does not combine each pane `minSize`. The solver never reads a pane
`minSize`.

The floor includes gutters, tab strips, accordion headers, and `MINIMUM_GROUP_PANE_EXTENT`. The input
calculation happens at drag start. A mode change during drag cannot change the floor.

Shell handles sit outside the group rectangle. Window DOM covers the inside area above the shell. An inside
handle cannot receive pointer input.

A later review found an inconsistent accordion minimum. The accordion branch used only the active child.

The tab branch used the widest child. Both use the widest possible content.

`setGroupActiveChild` can activate a larger child. The shell must already permit that size. The action also
carries `minSize`. This matches the gutter input `availableExtent`.

The owner moved a shell edge in the browser on 2026-07-08. The structural floor and single undo entry remained
unobserved at that time.

Exit conditions:

- An outer edge resizes the shell.
- The shell stops at its structural floor.
- One drag creates one undo entry.

## C4: performance measurement

Status: benchmark ready. Real-hardware measurement open.
P2 tranche 1 is committed and unmeasured. The current tables describe the earlier runtime. No later item can
quote a new number before the benchmark finishes.

An older version said `NFR-1` failed. That statement came from stale text in `REQUIREMENTS.md`. Commit
`962e42c` changed 20-window pan from 15.6 fps to 96.9 fps. The actual NFR-1 limit is ten windows.

P2 has a separate 100-window, 60-fps limit. An 80-window pan measured 21.3 fps. NFR-1 passed while P2 remained
open.

The benchmark lives in `apps/playground/src/showcases/benchmark.ts`. The `/stress` route exposes it as
`window.__canvasBench`. This `/stress` measurement schedules one input for each `rAF`.
Use this procedure on real hardware:

1. For `count ∈ {20, 40, 80}`, open `/stress?count=<count>&raster=false`.
2. Wait for all windows to mount.
3. Enter `await window.__canvasBench.baseline()`.
4. Record the printed `{ pan, drag, zoom }` object.
5. Put each `p95` result in `benchmark-baseline.ts`.
6. Store each result in `RUNS` under its `count`.
7. Measure the 80-window and 160-window cases with `raster=true`.
8. Add the values to [research/performance-profile.md](research/performance-profile.md).

`RUNS` is empty before the first hardware measurement. Thus, `compare()` returns `unrecorded` instead of a false
`pass`.
The raster cases must show background throttling without blank windows. They cover the `maxPendingCaptures`
correction.

A regression requires two limits. The `p95` value must exceed `REGRESSION_MARGIN`, which is 0.25. It must also
exceed `REGRESSION_FLOOR_MS`, which is 1.5 ms.

Absolute times require real hardware. The embedded preview limits `rAF` under load. Preview `rAF` behavior
cannot supply the baseline. Ratios and slopes are more useful than preview milliseconds.

The preview attempt occurred on 2026-07-09. It used the `preview_*` sandbox. The `baseline()` call at 20 windows
exceeded 280 seconds. The effective rate was approximately 1 fps.

The page remained responsive and the benchmark produced no errors. The preview environment was not a valid
measurement device. On real hardware, `baseline()` must return in seconds.
See the 2026-07-09 section in [research/performance-profile.md](research/performance-profile.md).
Exit conditions:

- The profile describes the current runtime.
- The scripted benchmark fails after a regression.
- The results show whether frame-chrome memoization improves the 80-window result.

## C5: focus and panel relationships

The original status was open and required browser evidence. The recorded requirement in `docs/REQUIREMENTS.md`
remained `partial` after the first keyboard work. The later implementation added focus trapping. Screen-reader
evidence remained open at the last recorded review.

The required behavior is:

- `Tab` from the command surface enters the active body.
- `Tab` stays inside the active body.
- One final `Tab` step wraps to the first eligible control.
- Focus cannot enter inactive window content.
- `Escape` returns focus to the command surface.
- A screen reader reports the tab and panel relation.

### Identifier design

The original problem was a `role="tab"` without `aria-controls`. A frame did not have an `id`. Each
`role="tab"` needs a related panel.

React 19 `useId()` creates a canvas instance identifier at the desktop root. The root exposes one
`instanceId` to the frame and group layers. It is stable across renders, safe for server rendering, and unique
for each component instance.

The first design used `id={`${instanceId}-${windowId}`}`. The implemented format became
`id={`${instanceId}-window-${windowId}`}`. Two canvas roots get different prefixes. A window identifier is
already unique inside one canvas.

The group tab adds `aria-controls` for the active member. Its `aria-controls` value names the active panel
`id`. The relationship stays in the render layer. It does not enter persistence, the pure core, or undo state.

### Trap design

The active window owns `Tab` inside its body. At the last or first focusable descendant, `Tab` or `Shift+Tab`
wraps. The query stays inside `[data-infinite-canvas-body]`.

`Escape` calls `focusInfiniteCanvasCommandSurface`. The command surface already handles this return for Close
and Minimize. No trap exists when no window is active.

The preview browser proved the identifier half on 2026-07-09. Each tab had a well-formed `aria-controls`
value. The preview also examined `aria-controls` after tab activation. The screen-reader review must cover the
tab role and `aria-controls` relation.

The active value resolved to its rendered panel. Inactive panels mount after activation.
The focus trap and screen-reader pass were still open in that status section. Later source evidence showed
focus-trap.ts in place.

## Results of the seven-hour work period

A source review found eight existing defects:

- A finite `maxPendingCaptures` value left a window blank.
- Alt with drag cleared `dockIntent` through three reducer steps.
- Dead group resize handles covered a gutter.
- A `scope="window"` portal rendered below its own window.
- Zoom during drag moved the window away from the pointer.
- `window.nudge` removed a group member from its shell.
- The frustum probe scanned its tracked set quadratically.
- A tab strip created one stop for each tab.

A new `Mod+Alt+Arrow` chord also collided with macOS browser tab switching. The page cannot cancel that
browser action. The audit removed the collision.

P1 became capability complete. The work covered dock, shell move, shell resize, seam weight changes, tab
removal, and tab reorder. It also covered FOCUS-002, FOCUS-003, and ACC-001.

At first, the owner used only one new path. The owner moved a group shell edge. Other paths were reasoned,
typechecked, or gated but not viewed.
The `/portals` route changed so one gesture can expose its prior layering fault.
At the end of that period, three gate actions remained:

- npm publication was an owner action.
- Public source required the owner-approved history purge.
- Production evidence required C2, C4, and C5.

C2 later completed. C4 still requires real hardware. C5 implementation later existed, but screen-reader
evidence stayed open.

The planned release was `0.2.0`. The plan excluded `1.0`. The earlier package value was `0.1.0`. Requirements
and README text must state accurate limits.

## Historical work order

### Public-source mechanical work

Status: done.
The `reference/` directory became untracked and entered `.gitignore`. The root `.gitignore` keeps that
directory outside new commits. It remained on disk as a private visual reference. This move was reversible.

The derived route moved from `apps/playground` to `reference/infinite-canvas-dynamic-grid/playground/`.
Ignoring the route in place was not stable. `routeTree.gen.ts` is tracked and reflects files under `routes/`.
The `routeTree.gen.ts` edit matched generator output after the move. Navigation reads each route `staticData`.
The entry thus disappeared with the route.

`vite.config.ts` uses `ignorePatterns`. `tsconfig.json` uses `exclude`. Both tolerate an absent `reference/`
directory. A fresh clone builds.

The derived implementation still exists before `HEAD`. The final owner action is still `git filter-repo`. Only
the owner can approve the irreversible history rewrite.

### Early FR-9 work

The original requirements marked FR-9 as `open`. A window manager without keyboard navigation did not support
an accurate production claim.

The first scope excluded groups. Directional focus used `state.windows`. A pure function lived near
`camera-navigation.ts`.

The command used replaceable `hotkeyBindings`. Focus navigation reused `navigateToWindow`. The initial target
was the global geometry part of FOCUS-001.
The implementation became `window.focusDirection` in `src/window-focus.ts`. Its chord is `Alt+Arrow`.

The command handler also started consuming unavailable owned chords. Without that rule, `Alt+ArrowLeft` opened
browser history at the window edge.
Close and Minimize also returned focus before they removed their element. Without that transfer, focus moved
to `<body>` and hotkeys stopped.

FR-9 then moved to `partial`. After P1, focus searched group members before global windows. Inactive tabs and
collapsed folds were not targets.

Group tab strips also moved to one tab stop. Each tab is a `<button>`. The tab list uses roving `tabIndex`.
Arrow, Home, and End move the active stop. Enter and Space activate a tab.

Automatic activation was rejected. It mounts and removes a window body after each arrow.
At that historical point, two items remained:

- Focus trapping and a documented path into body content
- `aria-controls` and a `role="tab"` relation for each tab.

A frame only had `data-infinite-canvas-window-id`. The later `useId()` work supplied a DOM identifier. That
`useId()` value separates two canvases on one page.

### Early API tiering

The first audit described 287 names. The later count was 354 after P1 and P4.
The project added `@experimental` to three groups:

- `createInfiniteCanvasHandle`
- Raster policy
- Six frustum-visibility exports.

`API.md` gained a stability section.
The frustum hooks remain inactive without `diagnostics.frustum`. Only the probe under `/scene` writes that
store. `useInfiniteCanvasWindowFramed` otherwise returns its fallback. Its null value means unmeasured, not
offscreen.

The audit kept the `getInfiniteCanvas*Scene*` helpers in the main entry. They are pure geometry in
`scene-layer-geometry.ts`. SVG connector users can use them without a 3D engine.

### Group model and remaining measurement

`InfiniteCanvasGroup` entered `InfiniteCanvasState`. The reducer gained nine group mutations.
`group-layer.tsx` renders the shell.
Persistence moved to `version: 2`. A `version: 1` document adds `groups: []`.

The implementation included dock, shell move, seam weight change, and tab removal. The group owns layout. A
member `rect` is a calculated projection. Snapping, selection bounds, camera framing, and proxies remain
group-independent.

The tranche-1 measurement was not done. It still required `/stress` on real hardware. The hardware measurement
supplies the final stress baseline. The DOCK, SPLIT, TAB, and ACC tests also did not exist at that historical
point.

Track C2 later added them.

### Deferred optimizations

Window-layer culling was not on the first release path. Tranche 1 changed the estimate that frame chrome
dominated.

Unmounting an offscreen body loses scroll, focus, and uncontrolled input. A window manager cannot use this
optimization.

HTML-in-Canvas texture mode also remained outside the first release path. It required Chrome 148 or later with
the Origin Trial flag.

## Owner decisions

The owner had three decisions:

1. Exclude the derived dynamic-grid material, create a clean implementation, or accept the legal risk.
2. Exclude `reference/` from the public repository or keep it.
3. Create the npm organization for `@hyphened/infinite-canvas`.

The recorded recommendation was to exclude the derived work first. A public repository must not restore
`/dynamic-grid` before that decision changes. A second `/dynamic-grid` implementation requires a clean source.

A future `git filter-repo` action still requires explicit owner approval. A later clean implementation can use
the motion study only for visual direction.

The package scope leaves room for `/core`, `/theme`, and `/styled`.
