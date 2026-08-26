# Polkadot session state

Current goal: build and plan the Polkadot spatial workbench  
Current stage: Phase 1 database admission after framework-first retrospective
Goal status: active

## Completed

- TanStack Start scaffold under `apps/polkadot`
- Vite+, pnpm workspace, React 19, Legend State, Tailwind, UI, and infinite-canvas integration
- Parent-owned canvas store and product shell
- Package-local check and production client/server build
- Living product research and feature catalogue in `PRODUCT_PLAN.md`
- Context-safe delivery plan in `IMPLEMENTATION_PHASES.md`
- Framework-first affordance admission record and subtree guidance
- Retrospective corrections for sequence, framework data and placement,
  Legend State construction, Pacer scheduling, and tailwind-variants styling
- Upstream Vite worker fix backported onto the last IndexedDB-capable WASM line
- Full repository check, 489 framework tests, and all package/application builds

## Current work

- Run only Phase 1's prepared IndexedDB worker admission proof.
- Prove local canvas creation, revisioned autosave, reload, and worker cleanup.
- Keep every later feature phase closed until that spine exits.

## Next implementation phase

Phase 1: database corpus and browser worker, in progress.

The SurQL corpus, package integration, worker bundle, and revision proofs are
complete. The remaining exit condition is IndexedDB admission in headless Chrome
under the compatible 2.6.1 worker engine. The earlier witness failed under the
3.x engine before this compatibility decision.

## Authorities

- Product and feature decisions: `PRODUCT_PLAN.md`
- Build order and exit criteria: `IMPLEMENTATION_PHASES.md`
- Implementation admission: `AFFORDANCE_AUDIT.md` and local `AGENTS.md`
- Framework behavior: `packages/infinite-canvas` code and tests
- Repository workflow: root `AGENTS.md`

## Known constraints

- Browser automation is paused until the affordance review and source checks close.
- When resumed, it runs only through headless `agent-browser` in the scheduled five-minute witness window.
- A terminal HTTP health check precedes launch; explicit close and process checks end every witness.
- The private editor is browser-rendered because IndexedDB and the WASM engine are client-only.
- The framework layout is the only authority for windows, groups, workspaces, and geometry.
- Product records own content, relations, connections, regions, waypoints, tours, and assets.
- Remote features cannot weaken the complete local-only product.
- Shared live layout remains frontier work until personal view state and ordered document mutations are proven.
