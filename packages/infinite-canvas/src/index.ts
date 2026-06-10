/**
 * Framework entry point. The real public surface lands with the Phase 1 core
 * port (see docs/ARCHITECTURE_PLAN.md); this seed exists to prove the
 * source-linked dev loop between the package and the playground.
 */
export const frameworkStatus = {
  name: "infinite-canvas",
  phase: "pre-port scaffold",
} as const;

export type FrameworkStatus = typeof frameworkStatus;
