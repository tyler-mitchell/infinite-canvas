# What a Widget is

A proposal, derived from counting the design POC rather than from taste. Nothing here is built.
Two earlier attempts at `Widget` were deleted; this exists so a third is designed before it is
written.

Source: `docs/handoff/LayoutEnginePOC.dc.html` (45 draggable widgets). Counted 2026-09-09.

## The counts, which contradict both earlier attempts

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

Three things follow, and each one kills something I had already built:

**There is no single `Label`.** There are two chrome registers doing different jobs. A _label_
names a section — `frame budget`, `now playing`, `inbox`, `elsewhere`. A _kind_ tags what a thing
is — `gist`, `reading`, `issue`, `reference`. They differ in face, size, tracking and case, and
they never substitute for each other. My `Widget.Label` collapsed both into one part.

**`Footer` is not a part.** 13 of 45. It is a rule plus a metadata row, which is two things that
already exist. Promoting it to a named part made every widget look like it should have one.

**Metadata is the through-line, not the header.** 49 instances across 45 widgets is the highest
count in the design, higher than any container. The design language is not "a card with a header";
it is _a surface that is dense with mono metadata_, wearing whatever chrome that particular
instrument needs.

## The split the counts imply

`Widget` was doing two jobs. They separate cleanly:

```tsx
// target — the frame. Tone, padding, radius, lift, hairline. Knows nothing about content.
<Surface tone="card" padding="default">
  {children}
</Surface>
```

```tsx
// target — the chrome vocabulary. Free-standing, composed only where a widget needs it.
<Label>frame budget</Label>       // sans 500 11px 0.02em  — names a section
<Kind>gist</Kind>                 // mono 500 10px 0.05em caps — tags what a thing is
<Meta>8.2 ms</Meta>               // mono 11px — the through-line
<Title>infinite-canvas</Title>    // sans 600 17px -0.03em
<Readout>1,243 commits · wk 12</Readout>  // mono, live, aria-live
```

Nothing forces a widget into a shape. A repo card composes `Kind` + `Title` + `Meta`; the frame
budget composes `Label` + `Readout` + a canvas; the printer composes almost none of it.

```tsx
// target — what a consumer writes. No Header, no Body, no Footer.
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

## The test each part has to pass

From the handoff's own thesis: _every widget is an instrument, not a card. A card displays a value;
an instrument reveals behaviour._ The stated test is "if it were static, would it still be worth
its space?"

Applied to the kit, that produces a rule for what belongs here:

| Belongs in polkadot-ui                                                     | Does not                                         |
| -------------------------------------------------------------------------- | ------------------------------------------------ |
| `Surface`, `Row` — frame and layout, no content opinion                    | a `RepoCard` — that is a product's composition   |
| `Label`, `Kind`, `Meta`, `Title`, `Readout` — the type scale as components | a `StatRow` — two `Meta`s in a `Row`             |
| `Sparkline`, `ActivityGrid` — instruments with no product meaning          | a `CommitChart` — a sparkline with a domain name |

The line: the kit ships **vocabulary**, the product ships **sentences**.

## What this leaves open

- Whether the type-scale parts should be components at all, or a `text` tv variant applied to any
  element. Components are more discoverable; a variant composes into anything. Undecided, and the
  answer changes the API more than anything else here.
- `Readout` implies `aria-live`, which is a behaviour rather than a style, and is the one part that
  might justify more than a slot.
- The instrument components (`Sparkline`, `ActivityGrid`) are a separate question from the
  vocabulary and should not be designed in the same pass.

Status: target, unbuilt. Nothing in this document has been written as code.
