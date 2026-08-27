/**
 * What a floating surface is made of, in one place.
 *
 * Every panel that sits above the canvas — the identity rail, the selection rail, the conflict
 * notice, the library, the minimap — is the same material: a lighter fill than the ground and a
 * single hairline of light along its edge, with no outline. `styles.css` says why that recipe and
 * not a border; this is the recipe itself, so saying it and using it are not five different acts.
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
  "bg-[var(--surface)] inset-ring-1 inset-ring-[var(--edge-light)]" as const;
