<!-- Keep the pull request to one behavioral change. Read CONTRIBUTING.md. -->

## What changed

<!-- Describe the behavior and its effect in one or two sentences. -->

## Why

<!-- Link the issue. If this change closes it, add `Closes #123`. -->

## Review steps

<!-- Give the steps that show the result. A playground route can provide evidence. -->

## Checklist

- [ ] `pnpm exec vp check` passes for lint, format, and the type check.
- [ ] `pnpm exec vp run -r test` passes.
- [ ] New behavior has a test. A bug fix includes the prior failing case.

If this change touches `packages/infinite-canvas/src/**`, make sure that these statements are true:

- [ ] Framework source has no icon-library import or literal `className="…"` value.
- [ ] New structural elements have entries in `INFINITE_CANVAS_SLOTS` in `src/data-attributes.ts`.
- [ ] Appearance is in `src/theme.css` and uses the `data-slot` contract.
- [ ] The pure core imports no React, `three`, `@react-three/fiber`, `@legendapp/state`, or `@zumer/snapdom`.
- [ ] The pure core runs without a renderer.
- [ ] `pnpm exec vp run @hyphened/infinite-canvas#verify` passes.
- [ ] Changes to `exports` or `publishConfig` pass package verification.

These files enforce the framework boundaries:

- `src/headless-boundary.test.ts`
- `src/theme-tokens.test.ts`
- `src/framework-boundary.test.ts`
- `packages/infinite-canvas/scripts/verify-pure-core.mjs`
- `vp pack` and `verify:consumer`.

If this change affects consumers, make sure that these statements are true:

- [ ] One bump file under `.bumpy` describes the change.
- [ ] The bump file identifies changes to the public API, rendered DOM, `data-slot`, or persistence format.
- [ ] Each breaking change is explicit. The package is `0.2.x`.
