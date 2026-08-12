<!--
Thanks for contributing. Keep the PR focused — one behavioral change reviews far
better than five. See CONTRIBUTING.md for the full guide.
-->

## What changed

<!-- One or two sentences. What does this do, and why does it matter? -->

## Why

<!-- Link the issue this closes, or describe the problem. `Closes #123` -->

## How to verify

<!-- The steps a reviewer takes to see it working. A playground showcase route is ideal. -->

---

## Checklist

- [ ] `pnpm exec vp check` passes (lint, format, typecheck).
- [ ] `pnpm exec vp run -r test` passes.
- [ ] New behavior has a test; a bug fix has the failing case that now passes.

If this touches `packages/infinite-canvas/src/**`, also confirm:

- [ ] **Headless boundary holds** — no icon-library import and no literal `className="…"` string in
      framework source (so: no Tailwind utilities). Appearance lives in `src/theme.css`, keyed off the
      `data-slot` contract in `src/data-attributes.ts`. New structural element? New slot in
      `INFINITE_CANVAS_SLOTS`. _Verified by `src/headless-boundary.test.ts` and `src/theme-tokens.test.ts`._
- [ ] **Framework boundary holds** — the pure core (geometry, reducer, selection, snapping, commands,
      state, validation) still imports no React, no `three`, and no `@legendapp/state`, and still runs
      without a renderer. _Verified by `src/framework-boundary.test.ts`._
- [ ] **Packaging invariants hold** — `pnpm exec vp run @hyphened/infinite-canvas#verify` passes. Relevant
      if you added an import, changed the entry point, or touched `exports` / `publishConfig`.
      _Enforced by `packages/infinite-canvas/scripts/verify-artifact.mjs`, which also gates publish._

If this is user-facing:

- [ ] Added an entry under `## [Unreleased]` in `CHANGELOG.md`.
- [ ] Public API, rendered DOM, `data-slot` contract, or serialized persistence shape changed? Say so
      explicitly above — the package is `0.1.x`, but breaks should be deliberate.
