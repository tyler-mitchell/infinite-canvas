# polkadot-ui

Base UI primitives styled with tailwind-variants slots. Thirty-nine component modules, one
stylesheet, and no CSS written anywhere else.

## Setup

The stylesheet scans its own components, so importing it is the whole setup.

```css
/* app/styles.css */
@import "tailwindcss";
@import "polkadot-ui/theme.css";
```

```tsx
import { Button, Row, Surface, Label, Meta } from "polkadot-ui";

<Surface tone="card">
  <Row>
    <Label>résumé</Label>
    <Meta>a4 · 148 kB</Meta>
  </Row>
  <Button tone="ghost" size="sm">
    new copy
  </Button>
</Surface>;
```

`Surface` owns tone, padding, radius and lift. `Row` owns a two-ended line and an optional rule.
Neither has an opinion about what goes inside it.

## The two rules

**Every class a component draws lives in one `tv` call at the top of its file.** A component that
draws several elements names them as `slots`; one that draws a single element uses `base`. Thirty-
three of the thirty-nine are the former.

```tsx
// badge.tsx — one element, so one base and no slots.
const badge = tv({
  base: "inline-flex flex-none items-center gap-1 rounded-pk-pill border border-transparent px-2 py-[3px] font-pk-sans whitespace-nowrap",
  variants: {
    tone: {
      neutral: "bg-pk-ink/[0.06] text-pk-ink-dim",
      accent: "bg-pk-accent text-pk-on-accent",
      outline: "border-pk-line text-pk-ink-dim",
      quiet: "px-0 text-pk-ink-faint",
    },
    look: { tag: "text-pk-label", label: "text-pk-micro uppercase" },
  },
  defaultVariants: { tone: "neutral", look: "tag" },
});
```

```tsx
// terminal.tsx — several elements, so each is a named slot.
const terminal = tv({
  slots: {
    root: "flex w-full flex-col gap-1 overflow-x-auto font-pk-mono text-pk-mono",
    command: "flex gap-2 whitespace-pre",
    prompt: "flex-none text-pk-ink-faint select-none",
    output: "whitespace-pre text-pk-ink-faint",
  },
  variants: {
    running: { true: { text: "text-pk-accent" }, false: {} },
  },
  defaultVariants: { running: false },
});
```

**No Tailwind class strings in JSX.** A component's markup names slots, never classes:

```tsx
// Right — the slot carries the styling.
<span className={styles.root({ className })} />

// Wrong — a class string in the markup.
<span className="inline-flex items-center rounded-full px-2" />
```

The same holds in consuming pages: put page-level classes in that page's own `tv({ slots })` block
and read them from there. Every route in `app/` is written this way.

**Components import `tv` from `src/tv.ts`, never from `tailwind-variants`.** The type scale uses
`text-*` names, and so do the ink colours, so tailwind-merge cannot tell `text-pk-label` from
`text-pk-on-accent` and silently drops one of them:

```ts
// src/tv.ts — tv told which text-* names are sizes, so a slot may set both a size and a colour.
export const tv = createTV({
  twMergeConfig: { extend: { classGroups: { "font-size": [{ text: [...FONT_SIZES] }] } } },
});
```

A new `--text-pk-*` token in `theme.css` has to be added to `FONT_SIZES` as well, or any slot that
sets that size together with a colour will lose one of the two.

## Variants are not always props

`tv` cannot tell a prop from state. `Switch`'s `checked` and `ToggleGroup`'s `pressed` are variants
selected by state Base UI hands to `className`, so a consumer cannot write them:

```tsx
// Base UI passes state to className; the variant is selected from it, not from a prop.
<TogglePrimitive className={(state) => toggleGroup({ look, pressed: state.pressed }).item()} />
```

Where a component's own state drives a variant, it is documented as state rather than as a prop.

## Base UI state, not CSS pseudo-classes

Base UI sets `data-disabled` on every part but only sets the native `disabled` attribute on form
controls. A `disabled:` variant silently never matches on a `Switch`, which renders
`<span role="switch" aria-disabled data-disabled>`. Target the attribute:

```
data-disabled:pointer-events-none data-disabled:opacity-40
```

## Type scale

Text roles are named for their job, not their size: `display`, `title`, `label`, `kind`, `prose`,
`meta`, `readout`. `Readout` is the only role that is more than a class — it carries a live region,
so a value that changes in place is reachable by someone who cannot see it change.

```tsx
<Row>
  <Label>frame budget</Label>
  <Readout>8.2 ms</Readout>
</Row>
```

## Reduced motion

`theme.css` cuts transform and height transitions under `prefers-reduced-motion: reduce` and keeps
colour ones, so a rolling digit and an opening panel snap while a hover still fades.

## Components

**Frame** surface, row, separator, scroll area, toolbar, icon tile
**Text** display, title, label, kind, prose, meta, readout
**Controls** button, toggle group, switch, slider
**Disclosure** accordion, collapsible, tabs
**Overlays** dialog, menu, popover, tooltip
**Readouts** sparkline, bars, activity grid, breakdown, number ticker, stat, metric tile
**Marks** avatar, badge, status dot, keycap
**Rows** list item, commit row, binding
**Cards** aurora, contact card, pending card, activity feed, swipe deck, layout preview, terminal,
receipt

## The reference app

```sh
pnpm --filter polkadot-ui dev
```

Eight routes, each composed from the kit itself: `/` for a board of finished widgets;
`/foundations` for colour, hairlines, radii and type; `/layout`, `/controls`, `/disclosure` and
`/overlays` for the primitives; `/widgets` and `/data` for the composed cards and readouts. Props
tables on those pages are read off each component's live `tv` object, so they cannot fall behind
the component.
