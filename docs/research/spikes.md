# Spikes

These spikes have no schedule. Each section gives the required evidence and its start condition.

## WebMCP product control

Status: Required by Tyler on 2026-08-26. `apps/polkadot/AGENTS.md` contains the architectural requirement.

WebMCP lets a page register tools for direct agent use.
The registration API is `document.modelContext.registerTool({ name, description, inputSchema, execute })`.
Results use JSON. A `toolchange` event reports a changed tool set.
The `tools` permissions policy defaults to `['self']`, and registration requires a secure context.

Polkadot already exposes `window.__canvas` as an `InfiniteCanvasHandle`.
The handle supplies `getState`, `commands`, `snapshot`, `subscribe`, `subscribeDocument`, and `getContextualCommands`.
`getContextualCommands` returns each command with its label, description, and current enabled state.
This shape can provide most fields in a WebMCP tool descriptor.

Current browser control uses `javascript_exec`, synthetic DOM events, and screen coordinates.
Observed browser coordinates did not match page coordinates.
A synthetic cmdk `Enter` did not work until focus settled.
HMR left a stale module while the probe read the old module.
A typed tool call removes these three browser-driver dependencies.

The spike must establish:

- How `getContextualCommands()` maps to `registerTool()`, including commands that are disabled at that time
- Which read tools answer "what windows are visible", "what is selected", and "what does this window contain"
- Whether the generic framework or Polkadot owns the registry
- How tools mark third-party page content with `untrustedContentHint`.

`getState` returns the complete canvas, and the handle does not supply these focused read queries.
Read tools can select specific values from `getState`.
Polkadot link windows can render third-party pages, so read tools must identify untrusted content.
A generic registry belongs to the framework. A registry that names Polkadot belongs to the application.

Start condition: Browser support is available for the selected test environment.
As of 2026-08-26, WebMCP was a Draft Community Group Report outside the standards track.
The registration getter recently moved from `navigator.modelContext` to `document.modelContext`.
Chrome 150 deprecated the old name.
One adapter module must contain the entry point.

## liquid-gooey HUD transitions

Status: Tyler raised this candidate on 2026-08-26. The HUD workstream owns it.

`liquid-gooey` is at `Jakubantalik/Libraries/packages/liquid-gooey`.
It supplies two React effects:

- **morph** merges touching shapes and changes their shape.
- **move** adds a trailing shape to a moving item.

The API wraps `<Liquid.Item x y effect>` with `<Liquid blur contrast fill>`.
It draws SVG silhouettes under real DOM content.
Blur and shadow apply to the shape while text and images remain sharp.

The Polkadot HUD changes across idle, selection, drag, connection, and tour states.
Possible uses include pill rails that merge when a contextual group appears, then split when it leaves.
Other uses include a radial menu that opens from one control and dock transitions for minimized windows.
A selection-count badge can separate from the selection bounds when it settles.

The spike must establish:

- Whether the SVG layer remains in screen space while the canvas uses `transform: scale()`
- The frame cost of multiple active `Liquid.Item` values during a drag
- A usable fallback for unsupported filters and `prefers-reduced-motion`
- Whether the effect and the pill rail `backdrop-filter` operate together.

Start condition: The HUD has explicit states and transitions between them.
Before this condition, the effect has no product behavior to represent.

## TypeGPU render layer

Status: Tyler raised this candidate on 2026-08-26.
Start condition: The product requires GPU output on hardware without WebGPU.

`@typegpu/gl` generates GLSL and supplies an experimental WebGL 2 backend for part of the TypeGPU render API.
A render effect can thus operate in a browser without WebGPU.
TypeGPU shader functions can also operate in an existing WebGL renderer.
These two paths permit incremental adoption.
The WebGPU requirement keeps the scene layer optional.
It prevents the scene layer from becoming the default.

R3F uses React reconciliation over a three.js scene graph.
The infinite canvas mainly needs a few data-driven render targets, such as fields, connectors, window proxies, and distant views.
Their content changes with the camera in each frame.
TypeGPU expresses these targets as typed GPU functions in TypeScript.
This path can remove `three` and its reconciler from the dependency floor.

The spike tests TypeGPU as the main render layer and `@typegpu/gl` as its fallback.
Status: Proof of concept. Migration is outside the scope.
It must establish:

- One current scene capability through TypeGPU with behavior parity
- The WebGL 2 fallback in a browser without WebGPU
- Whether `getInfiniteCanvasWindowProxies` and frustum code remain unchanged
- Whether the current proxy model depends on R3F concepts
- The bundle and dependency change after removal of `three` and `@react-three/fiber` from `/scene`.

The current /scene entry is optional and adds no cost when unused.
Without a blocked product feature, this spike remains an architecture preference.

The repository contains the TypeGPU inspector tools at `mcp__typegpu_inspector__*`.
They validate TypeGPU modules in a browser WebGPU runtime and return structured diagnostics.
The spike uses these tools.
