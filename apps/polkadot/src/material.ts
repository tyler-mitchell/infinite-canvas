/**
 * What a floating surface is made of, in one place.
 *
 * Every panel that sits above the canvas — the identity rail, the selection rail, the conflict
 * notice, the library, the minimap — is the same material: a lighter fill than the ground and a
 * single hairline of light along its **top** edge, with no outline. `styles.css` says why that
 * recipe and not a border; this is the recipe itself, so saying it and using it are not five
 * different acts.
 *
 * **This said "hairline" and emitted a ring.** `inset-ring-1` draws on four sides, which measured
 * as `oklch(1 0 0 / 0.07) 0 0 0 1px inset` — a `border: 1px solid white/7%` in all but name, the
 * one treatment the bar names and forbids. Window frames were always right, at
 * `0 1px 0 0 inset`, so the two surface families had been drawn by different rules the whole time.
 *
 * `inset-shadow-*` rather than `shadow-*` because it is its own Tailwind layer, the way
 * `inset-ring` was: a site setting `shadow-[var(--lift-2)]` composes with this instead of
 * replacing it.
 *
 * Written out five times before this. The cost was paid rather than predicted: removing one dead
 * property from that material meant editing five files, and the only reason all five were found is
 * that a measurement had already named them. A recipe nobody can enumerate is one the next change
 * applies to four of five surfaces.
 *
 * **Elevation and radius are deliberately not here.** They are the parts that legitimately differ —
 * the notice lifts higher than a rail because it interrupts, the minimap is a rounded rect where
 * the rails are pills — and folding them in would mean a variant for every combination, which is a
 * worse duplication wearing a tidier shape.
 *
 * A plain string rather than a `tv` slot: it is composed *into* slots across five files, and a slot
 * that only exists to be spliced into other slots is indirection. Tailwind's scanner reads this
 * file like any other source, so the classes are generated from here.
 */
export const FLOATING_SURFACE =
  "bg-[var(--surface)] inset-shadow-[0_1px_0_0_var(--edge-light)]" as const;
