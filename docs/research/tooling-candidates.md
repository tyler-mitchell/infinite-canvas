# Tool candidates

> Provenance: This document updates the kek-monorepo `tooling-shortlist.md`.
> The update occurred on 2026-06-10 and uses sources from 2026-04-22 and 2026-04-23.
> The framework uses Legend State. The sources evaluated it as a candidate.
> The predecessor used `@react-three/xr` pointers. This framework uses DOM pointers and does not use that package.

## Adopted

- `@legendapp/state` 3 supplies the state adapter behind `store.tsx`.
  The independent pure core keeps a later evaluation local.
- `@zumer/snapdom` supplies snapshot capture through a dynamic import.

## Add after the stated trigger

- When GPU work starts, add `r3f-perf` as a playground development dependency.
  Measure scene examples, grid work, camera motion, and future guides before you add more effects.
- After the scene contains interactive controls, add `@react-three/a11y`.
  FR-9 requires accessibility, but DOM chrome gives standard DOM work higher value.
- If desktop labels, guides, or HUD text move into the GPU layer, add `troika-three-text`.
  Do not implement GPU text in this project.
- `@base-ui/react` already supplies Floating UI positioning for menus and popovers in the DOM layer.
  Add `@floating-ui/react` for canvas overlays that the UI kit cannot express.
  The trigger is a contextual menu or the body-content portal work in [body-content-contract.md](body-content-contract.md).
- When snap candidates and culling require a spatial index, add RBush or Flatbush.
  [snapping.md](snapping.md) defines the trigger.

## Situational candidates

- If root DOM gestures become complex, add `@use-gesture/react`.
  Pinch normalization is one possible trigger in [zoom-policy.md](../zoom-policy.md).
- The framework does not use the `@react-three/xr` pointer-events layer at this time.
  If interactive chrome returns, add it with R3F v10 event priorities.
  Do not add custom raycast logic for this case.

## Rejected candidates

- `@react-three/handle` does not fit the interaction engine.
  `interaction.ts` already contains its useful architecture: a framework-independent core, complete interaction state, and an apply boundary.
- `@react-three/uikit` does not fit because window bodies use the DOM.
- GridStack and React-Grid-Layout use dashboard layout rules.
  Risk R8 excludes those rules from the desktop model.
- Risk R7 permits `@lume/kiwi` only after weights and min-max rules fail in a measured case.
- `camera-controls`, `@react-three/offscreen`, and `three-mesh-bvh` do not address the current needs of the 2D orthographic desktop.
