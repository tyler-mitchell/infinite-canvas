# Documentation

This directory contains project documents for the infinite-canvas framework.

## Source order

If documents conflict, use this source order:

1. Code and tests in `packages/infinite-canvas/`.
2. Local implementation documents.
3. Requirements, policies, plans, and research in this directory.

The `reference/` directory is local and is not part of a clone. See
[SHIP_PLAN.md](SHIP_PLAN.md) for the reason.

## Documents

- [API.md](API.md) lists 232 values and 190 types from the public barrels.
- [SHIP_PLAN.md](SHIP_PLAN.md) lists blockers for production and public use.
- [ROADMAP.md](ROADMAP.md) defines programs P1 through P8, their dependencies, and their exit criteria.
- [ARCHITECTURE_PLAN.md](ARCHITECTURE_PLAN.md) records the port plan from 2026-06-10. Most work is completed.
- [SHAPING_PLAN.md](SHAPING_PLAN.md) records the completed HTML-in-canvas and headless extraction plan from 2026-06-10.
- [REQUIREMENTS.md](REQUIREMENTS.md) lists each framework requirement and its status.
- [zoom-policy.md](zoom-policy.md) defines the zoom model and marks open work.

## Research

These documents contain specifications and reference material for future work.
The project copied them from kek-monorepo on 2026-06-10 and added a provenance note to each file.

- [grouping-and-docking.md](research/grouping-and-docking.md) specifies group shells, container trees, layouts, and operation order.
- [snapping.md](research/snapping.md) specifies hysteresis, docking intent, spatial indexing, and organization commands.
- [state-focus-and-recipes.md](research/state-focus-and-recipes.md) defines state boundaries, group focus, and layout recipes.
- [acceptance-scenarios.md](research/acceptance-scenarios.md) lists architecture acceptance tests and their coverage status.
- [body-content-contract.md](research/body-content-contract.md) defines portal roots, positioning, input ownership, accessibility, and low-zoom chrome.
- [risk-register.md](research/risk-register.md) lists architecture risks and their status.
- [api-friction-backlog.md](research/api-friction-backlog.md) lists API defects and unresolved usability problems.
- [tooling-candidates.md](research/tooling-candidates.md) lists packages and the conditions for their use.
- [feature-landscape-2026.md](research/feature-landscape-2026.md) contains the early 2026 product survey.

## Local and historical documents

The local implementation set contains `reference/infinite-canvas/README.md`, `FEATURE_TRACKER.md`, `RASTERIZATION_PLAN.md`, and `SELECTION_AND_KEYBOARD_PLAN.md`.

The repository excludes these historical documents:

- `current-runtime-audit.md`
- `implementation-roadmap.md`
- `agent-handoff-report.md`
- The old `README.md`
- `core-architecture.md`
- `state-management-evaluation.md`
- `handle-source-review.md`
- Corpus files 01, 02, 06, and 10.

The first four documents describe the replaced `desktop-*` architecture.
`core-architecture.md` contains a scene-owned chrome rule that the current architecture reversed.
`state-management-evaluation.md` ended with the current Legend State choice.
`handle-source-review.md` informed the handle behavior in `interaction.ts`.
The source documents remain at `apps/web/reference/infinite-canvas/` in kek-monorepo.
