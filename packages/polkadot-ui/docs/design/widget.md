# What a Widget is

Derived from counting the design POC rather than from taste. Two earlier attempts at a `Widget`
component were deleted; this recorded the design before a third was written. It has since been
built, and the scope rule at the end was overruled on purpose.

Source: `docs/handoff/LayoutEnginePOC.dc.html` at the repository root, not in this package
(45 draggable widgets). Counted 2026-09-09.

Status: built. Every part proposed here exists and is demonstrated in `app/`.

## The counts

```txt
draggable widgets                                    45
mono metadata  (DM Mono, #7d8288)                    49   ← more than one per widget
label   sans 500 11px 0.02em #878c92                 15
kind    mono 500 10px 0.05em UPPERCASE #878c92       14
footer / section rule (border-top #16181a)           13
pill badge (border-radius 999)                       10
canvas                                                5
rim card (conic border)                               3
```

Three things followed, and each one killed something already built:

**There is no single `Label`.** There are two chrome registers doing different jobs. A _label_
names a section — `frame budget`, `now playing`, `inbox`, `elsewhere`. A _kind_ tags what a thing
is — `gist`, `reading`, `issue`, `reference`. They differ in face, size, tracking and case, and
they never substitute for each other.

**`Footer` is not a part.** 13 of 45. It is a rule plus a metadata row, which is two things that
already exist. Promoting it to a named part made every widget look like it should have one.

**Metadata is the through-line, not the header.** 49 instances across 45 widgets is the highest
count in the design, higher than any container. The design language is not "a card with a header";
it is _a surface that is dense with mono metadata_, wearing whatever chrome that particular
instrument needs.

## The split, as built

`Widget` was doing two jobs, and they separated cleanly.

```tsx
// src/components/surface.tsx — the frame. Tone, padding, radius, lift, hairline.
<Surface tone="card" padding="default">
  {children}
</Surface>
```

```tsx
// src/components/text.tsx — the chrome vocabulary, composed only where a widget needs it.
<Label>frame budget</Label>       // sans 500 11px 0.02em — names a section
<Kind>gist</Kind>                 // sans 500 10px 0.05em caps — tags what a thing is
<Meta>8.2 ms</Meta>               // sans 400 11px 0.005em — the through-line
<Title>infinite-canvas</Title>    // sans 500 15px -0.025em
<Readout>1,243 commits · wk 12</Readout>  // mono 400 11px, and a live region
```

One value moved: the POC sets `kind` in mono, and the kit sets it in sans. The counts above record
what the POC does; the kit keeps mono for figures and for anything a terminal would print, and puts
chrome in sans throughout.

Nothing forces a widget into a shape. A repo card composes `Kind` + `Title` + `Meta`; the frame
budget composes `Label` + `Readout` + a sparkline; the printer composes almost none of it.

```tsx
// app/routes/readouts.tsx — what a consumer writes. No Header, no Body, no Footer.
<Surface tone="card">
  <Row>
    <Label>frame budget</Label>
    <Readout>8.2 ms</Readout>
  </Row>
  <Sparkline values={frames} />
</Surface>
```

## Why `Row` and not `Header`

The chrome line is a two-end row: something naming, something reporting. That is `justify-between`,
which is a layout, not a semantic. Calling it `Header` implies a document structure the POC does
not have — several widgets put their naming line at the _bottom_, and the printer has two.

`Row` is honest about being a layout primitive. Whether it is a header is the consumer's business.

## What the open questions turned into

**Components or a `text` variant?** Both, and the variant is the primitive. `text` is one `tv` with
an `as` variant, and the named parts are thin components over it, so a consumer can reach for
either.

```tsx
// src/components/text.tsx
const text = tv({
  base: "wrap-anywhere",
  variants: {
    as: {
      label: "font-pk-sans text-pk-label text-pk-ink-dim",
      kind: "font-pk-sans text-pk-micro text-pk-ink-dim uppercase",
      meta: "font-pk-sans text-pk-meta text-pk-ink-faint",
      title: "font-pk-sans text-pk-title text-pk-ink-bright",
      display: "font-pk-sans text-pk-display text-pk-ink-bright",
      prose: "font-pk-sans text-pk-body text-pk-ink-soft text-pretty",
      readout: "font-pk-mono text-pk-mono whitespace-nowrap text-pk-ink-muted tabular-nums",
    },
  },
  defaultVariants: { as: "meta" },
});
```

**`Readout` is more than a slot**, as suspected. It is the only text role that carries behaviour.

```tsx
// src/components/text.tsx — a value that changes in place stays reachable.
props: { role: "status", "aria-live": "polite", ... }
```

That behaviour is the whole difference, and it is wrong for a word in a sentence. `Code` is the
same mono in a `code` element with no voice, for naming a component or a prop inside prose. The
forms page marked seven terms with `Readout` before the pair existed, and gave a reader seven
regions that announce `Field` and never change.

```tsx
<Readout>8.2 ms</Readout>   // a figure that changes in place — announces
<Code>Field</Code>          // a name from the code in a sentence — silent
```

## The scope rule, and why it was overruled

This document originally drew the line at vocabulary:

> the kit ships **vocabulary**, the product ships **sentences**

and listed `RepoCard`, `StatRow` and `CommitChart` as things that would not belong. The kit now
ships ten composites that rule would have excluded: `ActivityFeed`, `Binding`, `Breakdown`,
`ContactCard`, `Keycap`, `LayoutPreview`, `PendingCard`, `Receipt`, `SwipeDeck`, `Terminal`.

That was a deliberate decision by the owner, who asked for the POC's widgets themselves rather
than only the parts they are made from. The rule as written no longer describes the package, so it
is replaced rather than quietly ignored.

The line that does hold: **a component may be named for a domain, but it may not know a product's
data.** `CommitRow` takes a sha, a subject and an age; it does not fetch commits. `ActivityFeed`
takes entries; it does not know what a run is. `SwipeDeck` takes items and reports which way each
one went. Every composite is parameterised over its content, which is what keeps it a component
rather than a screen.

What still would not belong is anything wired to a particular application's state.
