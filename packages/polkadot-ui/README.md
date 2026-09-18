# polkadot-ui

Base UI primitives styled with tailwind-variants slots. Fifty-one component modules, one
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

## Card layout

```tsx
import { Card, Kind, Prose } from "polkadot-ui";

<Card.Root style={{ height: 320 }}>
  <Card.Body>
    <Card.Header>
      <Kind>Project</Kind>
    </Card.Header>
    <Card.Content>
      <Prose>Project details.</Prose>
    </Card.Content>
    <Card.Footer rule="above">Updated today</Card.Footer>
  </Card.Body>
</Card.Root>;
```

`Card.Content` scrolls within the available height. The header and footer keep their size.
`Card.Root` defaults to no padding; `Card.Body` owns padding and spacing.
Use `fill={false}` for an intrinsic-height body.

## The two rules

**Every class a component draws lives in one `tv` call at the top of its file.** A component that
draws several elements names them as `slots`; one that draws a single element uses `base`.
Forty of the fifty-one are the former.

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
    /* The accent is the whole of what a running command looks like, so it is said as well. */
    state: "sr-only",
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

**Borrowing from a sibling: its variants when the element is not yours, the component itself when it
is.** `Field` styles a Base UI label, so it can only take the classes; the plot and the deck each
draw a span they own, so they draw the `Readout` and the announcing behaviour has one owner:

```tsx
// field.tsx — the element comes from Base UI, so only the classes can be borrowed.
<FieldPrimitive.Label className={textVariants({ as: "label", className: styles.label({ className }) })} />

// activity-grid.tsx — the element is the component's own, so borrow the component.
<Readout className={styles.readout()}>{/* … */}</Readout>
```

Reaching for the variants where the component would do leaves two copies of a behaviour. Announcing
was written out by hand in two components before this, and `role="status"` now appears in one file.

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

`IconTile` has the same shape and the same answer. Its label opens on hover or on keyboard focus,
so on a phone it stays shut — a tap leaves it nine pixels wide, against sixty-eight for a tile held
open. The name is in the markup, so a screen reader reads it; a sighted reader on a phone does not.
Set `open` on any tile whose name has to be read.

Use `open={false}` in a fixed square. The label stays available to assistive technology.

```tsx
<IconTile open label="held open" icon={<span>ON</span>} />
```

## A focus ring offsets against its seat

`--pk-ring-seat` is the colour behind a control. The root sets it to the ground and every `Surface`
tone restates the one it paints, so a control never names its own backdrop — write
`focus-visible:ring-offset-(color:--pk-ring-seat)` and let the cascade answer. Anything new that
paints a background should restate it too.

The seat answers for the offset, not for the ring itself. The accent ring is built for the dark
grounds; `Receipt` is a light sheet, and it restates the seat **and** rings in `pk-paper-ink`,
because the accent on paper is 1.31:1 and invisible where paper ink reaches 13.48:1. A control from this kit dropped inside a
`Receipt` keeps its accent ring and loses it — put `pk-paper-*` colours on anything that goes on the
paper.

## A card being dragged

The sheet carries one rule for something this kit does not draw. A consumer that moves cards around
marks the one under the pointer, and the lift comes from the stylesheet rather than from the
consumer's own shadow:

```css
[data-slot="board-item"][data-dragging] {
  box-shadow: var(--pk-lift-held);
}
```

Nothing here sets those attributes — no component is a board — so the rule is inert until a
consumer writes them. It is the one place the kit styles a slot it does not own, which is why it is
written down rather than left to be found in the sheet.

## Which names you can read

`var(--pk-lift-held)` above is a `--pk-*` name, and that is the half of the sheet a browser can see.
`theme.css` declares every token twice: once on `:root` as `--pk-surface`, `--pk-radius-card`,
`--pk-lift-held`, and again inside `@theme` as `--color-pk-surface`, `--radius-pk-card` and their
siblings. The second set exists to tell Tailwind what `bg-pk-surface` and `rounded-pk-card` mean.
Tailwind writes those values straight into the utilities and never emits the names, so
`var(--color-pk-surface)` resolves to nothing — no error, no colour.

Read at `:root` in a running page: 82 `--pk-*` names have values and every `@theme` name is empty.
Write a utility, or read a `--pk-*` name. A rule holds every CSS example in these documents to that.

## Type scale

Text roles are named for their job, not their size: `display`, `title`, `label`, `kind`, `prose`,
`meta`, `readout`, `code`. `Code` and `Readout` draw the same mono and differ in one thing: a
readout stays on one line, because a figure broken in two reads as two figures, and a term sitting
in a sentence must be free to wrap. They shared a role until a long name pushed a page 206px wider
than the screen.

`Readout` is the only role that is more than a class — it carries a live region,
so a value that changes in place is reachable by someone who cannot see it change.

```tsx
<Row>
  <Label>frame budget</Label>
  <Readout>8.2 ms</Readout>
</Row>
```

## A word too long to break

Text wraps `anywhere`, not at a space. Both break a word that would overflow, but only `anywhere`
lowers the width a box reports as its minimum, and a role inside a `Row` is a flex item, which
keeps a minimum as wide as its longest word. With the weaker wrap the row stayed too wide and
pushed the whole page sideways instead of wrapping.

What stays on one line is every control and every figure: a toggle, a tab, a toolbar button, an
icon tile's label, a status dot, a stat. A label that wraps to two lines reads as a broken control,
so these keep `whitespace-nowrap` and nothing clips them — which means **a long word in one of them
widens the page rather than being cut**. Measured at 320 across all nine pages: five report nothing,
and the twenty that remain are all of that one family. Keep a control's words short; anything that
can run long belongs in a text role.

## Reduced motion

`theme.css` cuts transform and height transitions under `prefers-reduced-motion: reduce` and keeps
colour ones, so a rolling digit and an opening panel snap while a hover still fades.

Rim highlights stay static. Hover changes their shadow without a continuous animation.

## Compound widget layout

### Engraved dividers

```tsx
import { Separator } from "polkadot-ui";

<Separator look="engraved" />
<Separator look="engraved" orientation="vertical" />
```

A dark 1px line has a faint highlight below or to the right and a narrow soft shadow on the other side.
The adjacent surfaces should share a background. Keep the highlight faint to suggest a recessed cut.

```css
:root {
  --pk-divider-shadow: rgb(0 0 0 / 0.8);
  --pk-divider-highlight: rgb(255 255 255 / 0.04);
  --pk-divider-soft-shadow: rgb(0 0 0 / 0.2);
}
```

`look="line"` remains the default. Both treatments retain the separator's layout size and semantics.

Use `Row ruleLook="engraved"` with `rule="above"` or `rule="below"` for an attached divider.
It uses the same divider tokens and retains the row's existing spacing.

### Content composition

```tsx
import { MetricTile, Separator, Surface } from "polkadot-ui";

<Surface>
  <MetricTile look="readout" label="Hookload (klbs)" limit="500">
    318.90
  </MetricTile>
  <Separator look="engraved" />
</Surface>;
```

`MetricTile look="readout"` uses a prominent sans-serif value and a smaller, muted limit.
The value and limit share a baseline; the limit can move to the next line in narrow layouts.
Omit `limit` for a single value.
Pass formatted text to retain decimal places. The default `look="tile"` keeps the compact treatment.

```css
:root {
  --pk-metric-value-size: 2.5rem;
  --pk-metric-limit-size: 1.875rem;
  --pk-metric-text-shadow: 0 1px 1px rgb(0 0 0 / 0.35);
}
```

```tsx
import { ContactCard, ListItem, Receipt, Surface, Terminal } from "polkadot-ui";

<Surface>
  <ListItem trail={0}>Unresolved items in the current project</ListItem>
</Surface>

<Receipt>
  <Receipt.Head mark="TM" wordmark="Tyler Mitchell" />
  <Receipt.Note>Document details</Receipt.Note>
  <Receipt.Action disabled>Download unavailable</Receipt.Action>
</Receipt>

<ContactCard render={<a href="mailto:hello@example.com" />}>
  <ContactCard.Body>
    <ContactCard.Label>Contact</ContactCard.Label>
    <ContactCard.Address>hello@example.com</ContactCard.Address>
    <ContactCard.Note>Replies within two working days</ContactCard.Note>
  </ContactCard.Body>
  <ContactCard.Arrow />
</ContactCard>

<Terminal>
  <Terminal.Command prompt=">" running runningLabel="Installing">
    vp install
  </Terminal.Command>
  <Terminal.Output>Resolving dependencies</Terminal.Output>
</Terminal>
```

`ListItem` permits multiline content and retains numeric zero in its optional parts.
`Receipt.Action` accepts Base UI Button props, including `disabled`, `render`, and `nativeButton`.
`Receipt.Head` accepts React content for `mark` and `wordmark`; `mark={null}` omits the mark.
`ContactCard` accepts compound children. Each part accepts `className`, `render`, and a ref.
Omit or reorder parts as needed. `ContactCard.Arrow` is decorative and accepts replacement children.
`Terminal.Command` accepts a decorative `prompt` and an accessible `runningLabel`.
The defaults are `$` and `running`. Set `prompt={null}` to omit the prompt.
`Terminal` is a focusable log with selectable text and native horizontal scrolling.
Its default accessible name is `Terminal output`; override it with `aria-label`.
`PendingCard` and `ActivityFeed` accept Surface props, including `tone`, `padding`, and `render`.
Their text fields accept inline React content. Set `PendingCard stamp={null}` to omit the stamp.
Activity entries retain numeric zero in optional duration and time fields.
Set `ActivityFeed title={null}` to omit its header.
`ScrollArea` accepts `viewportProps` and `contentProps` from the corresponding Base UI parts.
Pass focus and scroll refs or handlers through `viewportProps`; the root ref points to the outer box.
`Bars` and `LayoutPreview` have default heights; `className` can set another height.
`Aurora` has a 214px minimum height. Its text stays in normal layout and can increase that height.
Use `className` to change the minimum height.

`ActivityGrid` accepts `render` and a consumer ref while retaining its size measurement.
Consumer keyboard and blur handlers compose with the grid handlers.
`Surface interactive={false}` disables hover treatment for every tone.
Set `Readout aria-live="off"` for frequent updates that should be read on request, such as a clock.
`SwipeDeck` accounts for uniform parent scaling and commits from the release position.
Its keyboard handler composes with consumer handlers; secondary pointer presses do not start a swipe.

## A surface painted by a shader

`Backdrop` paints a canvas under its children through TypeGPU. It reads the ground the shader lays
ink on from its own background, and the accent it tints with from `--pk-accent`, so a consumer
restates the ground with a class and the shader follows; `ground` and `accent` take any CSS colour
instead. Without WebGPU the canvas never mounts and that background stands.

```tsx
import { Backdrop, SPARKLE, Surface, sparkle } from "polkadot-ui";

// Built once, outside render: each call specialises a new pair of shaders.
const CALM = sparkle({ field: { layers: 48, flowSpeed: 0.2 }, glints: false });

<Surface tone="card" padding="none">
  <Backdrop shader={SPARKLE}>…</Backdrop>
</Surface>;
```

A shader is a source and effects, written against `src/shaders/surface.ts`. The source paints a
whole surface; each effect reads the scene painted so far and paints the next one; the last stage
paints the canvas, all in one submission. Every constant a shader is tuned by is an option, inlined
into the WGSL when the shader is built, so a tuned shader costs nothing at run time.

The host caps the canvas at `maxPixelRatio` device pixels per CSS pixel and `maxPixels` in all,
paints the sparkle's field at half resolution and its glints at full, stops off screen, in a hidden
tab and under reduced motion, and paints one frame when `paused`.

## Components

**Frame** surface, backdrop, card, stack, row, separator, scroll area, toolbar, icon tile
**Text** display, title, label, kind, prose, meta, readout, link
**Controls** button, toggle group, switch, slider
**Forms** field, checkbox, radio, input, select, combobox, number field
**Disclosure** accordion, collapsible, tabs
**Overlays** dialog, menu, popover, tooltip
**Readouts** sparkline, bars, activity grid, breakdown, number ticker, stat, metric tile
**Marks** avatar, badge, status dot, keycap, image
**Rows** list item, commit row, binding
**Cards** aurora, contact card, pending card, activity feed, swipe deck, layout preview, terminal,
receipt

## Adding a component

Nine rules answer for a bare component, and the suite names each one rather than failing
generically. The list is what they asked for, measured by adding a component that draws slots and
nothing else, then fixing only what was reported until the suite went green:

```txt
src/components/<name>.tsx     one tv call at the top, a named props type, no class strings in JSX
src/index.ts                  the component, its variants object, and its props type
app/routes/<page>.tsx         drawn on a page — a component nothing demonstrates is reported
README.md                     added to the Components list, the module count, and the slot count
docs/research/widget-runtime.md   the same module count, written as a numeral, in two places
src/components/<name>.test.ts     only if it works something out: a helper it exports
src/<name>.dom.test.tsx           only if it answers a key or moves the focus: needs a document
```

Nine is the floor, not a promise: a component with variants, a props table or an exported helper
meets more. Re-measure rather than trusting the number — add the file and read what the suite says.

The counts are the part worth knowing about in advance: two documents state how many component
modules there are, one in words and one as a numeral, and both are checked. A component that draws
a colour the theme does not declare, or one that reaches a contrast the pages state, is answered
for by `theme.css` and `contrast.test.ts` in the same way.

The `.dom.test.tsx` suffix is what puts a test in a document. Only those files get one: a document
replaces the global `URL`, and every other suite here reads its files through `import.meta.url`, so
setting one for the whole package stops eight suites before a rule runs.

Nothing here needs remembering. Add the file, run `vp test`, and each rule says what it wants.

## The reference app

The [portfolio guide](portfolio/README.md) covers its widget modules and profile tools.

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

Their values are checked as well, against whichever source settles them. A stated default is read
from the component's own signature where it has one, and otherwise from the `@default` the
primitive writes in its type — following what a part inherits, since the popover's positioner takes
`side` and `align` from a shared interface and the accordion's panel takes two more through a
`Pick`. A stated union is read from the type the prop really has, whether the prop names that union
or writes it out. One row escapes all of it: the bars' `max` falls back to "the largest value",
which is prose for a default the component works out from the data it is given.
