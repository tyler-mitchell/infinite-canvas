---
"@hyphened/infinite-canvas": major
---

Keep scroll navigation independent from editing and publish section changes after scrolling settles.

Preserve the current camera after cancelled attachment and use the same inset framing at completion.

Keep detached scroll geometry updates from cancelling camera navigation.

Animate back to the reading path when scrolling starts from an off-path camera.

Initialize the computed camera track to null before route geometry is available.

Remove the camera wheel listener while native scroll navigation owns input.

Let camera preview call its controller directly without a nested stop action.

Skip selection geometry and resize-handle discovery outside edit mode.

Return an element-owned callback ref from useCanvasOccluder instead of a ref object.
Keep its inset registered during remeasurement and remove it when the element detaches.
