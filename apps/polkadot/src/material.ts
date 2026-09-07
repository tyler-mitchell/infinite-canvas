/**
 * What a panel floating over the canvas is made of.
 *
 * The hairline is the separation. The surface scale spans L 0 to L 0.19, so a panel at L 0.134
 * over a black canvas differs by too little for lightness alone to draw an edge — the same reason
 * every window, dialog and card draws one. The rail is the largest panel in the app and was the
 * one surface still relying on lightness.
 *
 * The top inset highlight is gone with it. A bevel and a hairline are two edges doing one job, and
 * the hairline is the one that holds over any ground.
 */
export const FLOATING_SURFACE = "border border-[var(--line)] bg-[var(--surface)]" as const;
