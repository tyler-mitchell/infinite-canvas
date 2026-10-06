---
"@hyphened/infinite-canvas": minor
---

Use a continuous zoom and pan trajectory for camera navigation with configurable curvature.

Apply camera state directly to the world transform without a second animation queue or React render.

Limit zoom-dependent control styles to overlays and keep the world ready for composited motion.

Start navigation from the displayed pose and commit pan and zoom through the shared camera action.

Follow reactive destinations on one animation clock without committing intermediate views.
Retarget camera interpolation from its current progress and retain configurable motion.
