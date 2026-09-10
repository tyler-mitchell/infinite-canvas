# polkadot-ui

Base UI primitives styled with tailwind-variants slots. Forty-six component modules, one
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
nine of the forty-six are the former.

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
    text: "text-pk-ink-muted",
    output: "whitespace-pre text-pk-ink-faint",
    caret: "ml-px inline-block w-[7px] animate-pk-caret bg-pk-accent text-transparent select-none",
  },
  variants: {
    running: {
      true: { text: "text-pk-accent", prompt: "text-pk-accent/60" },
      false: {},
    },
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

**Import `tv` from `polkadot-ui`, never from `tailwind-variants` — in a component or a page.** The
type scale uses `text-*` names, and so do the ink colours, so the stock merge cannot tell
`text-pk-label` from `text-pk-on-accent`. It keeps the colour, drops the size, and says nothing:

```ts
stock({ base: "text-pk-label text-pk-on-accent" })(); // → "text-pk-on-accent"
tv({ base: "text-pk-label text-pk-on-accent" })(); // → both
```

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

The attribute is rarely the word you expect, and guessing it fails silently: the rule is valid CSS,
the component compiles, and the state never arrives. A tab carries `aria-selected` but is styled by
`data-active`, so `data-selected:` matched nothing and the selected tab stayed dim for as long as
nobody read its colour. Read the attributes off the rendered element before styling a state.

## A readout says what it shows

Anything that carries meaning in pixels alone takes `role="img"` and names itself from its own
data, with a `label` prop to override. A caller who hides the legend, or passes no caption, still
leaves a reader something to hear.

```tsx
<Sparkline values={[1, 2, 3]} />   {/* "3 readings, latest 3" */}
<Breakdown parts={LANGUAGES} />    {/* "TypeScript 84%, WGSL 9%, CSS 7%" */}
```

Where a visible legend restates that label, hide it with `aria-hidden` rather than letting the same
content be read twice.

A control is named by `Field`, which is the only thing that ties the words to the control. A
`Switch` beside a bare `Label` announces its state and never its name.

```tsx
<Field>
  <Switch checked={sound} onCheckedChange={setSound} />
  <Field.Label>sound</Field.Label>
</Field>
```

A tooltip is the exception: it is a visual hint and nothing more. Base UI gives the popup no role
and no id, and nothing points at it, so its words reach only someone who can see it. Say them on
the trigger as well.

On a touch device the popup never opens at all. Base UI's hover path runs only for a mouse-like
pointer, and every `hover:` utility sits inside `@media (hover: hover)`, which a phone does not
match — measured at 375px with touch emulated. The trigger's label still carries the words, so a
screen reader has them; a sighted reader on a phone does not. Keep a tooltip for a hint that
repeats what the trigger already says, and put anything that has to be seen in the layout.

```tsx
<Tooltip.Trigger aria-label="queries, 2.1M served">queries</Tooltip.Trigger>
<Tooltip.Content>2.1M served</Tooltip.Content>
```

## A focus ring offsets against its seat

`--pk-ring-seat` is the colour behind a control. The root sets it to the ground and every `Surface`
tone restates the one it paints, so a control never names its own backdrop — write
`focus-visible:ring-offset-(color:--pk-ring-seat)` and let the cascade answer. Anything new that
paints a background should restate it too.

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

The feed's entry animation runs on a scroll timeline and is switched off by name, because clamping
`animation-duration` does not govern one: its progress comes from the scroll position, not from
time. The rim sweeps are named there too, for a different reason — they are driven by time, but a
sweep clamped to a millisecond is still a sweep, and turning them off says so plainly.

## Components

**Frame** surface, row, separator, scroll area, toolbar, icon tile
**Text** display, title, label, kind, prose, meta, readout
**Controls** button, toggle group, switch, slider
**Forms** field, checkbox, radio, input, select, combobox, number field
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

Nine routes, each composed from the kit itself: `/` for a board of finished widgets;
`/foundations` for colour, hairlines, radii and type; `/layout`, `/controls`, `/forms`,
`/disclosure` and `/overlays` for the primitives; `/widgets` and `/readouts` for the composed cards
and readouts.

Those pages carry two kinds of table. Variants are read off each component's live `tv` object, so
they cannot fall behind it. Props that are not variants — a popover's `side`, a ticker's `stagger` —
are written by hand, but each row's name is keyed to the component's props type, so a renamed or
removed prop fails typechecking rather than quietly documenting something that no longer exists.
Their values can still drift; their names cannot.
