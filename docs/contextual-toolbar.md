# Contextual toolbar

A toolbar anchored to the current selection, holding tools that act directly or disclose a panel.
Spectrum calls the floating selection form an action bar; Figma calls it the toolbar; the disclosure
unit is the WAI-ARIA disclosure pattern. Source: FigJam and Figma captures, 2026-09-19.

## Parts

| Part                | Base UI                                       | Notes                               |
| ------------------- | --------------------------------------------- | ----------------------------------- |
| `Toolbar.Root`      | `Toolbar.Root`                                | `orientation`, roving focus         |
| `Toolbar.Group`     | `Toolbar.Group`                               | related tools, no separator between |
| `Toolbar.Separator` | `Toolbar.Separator`                           | between groups                      |
| `Tool`              | `Toolbar.Button`                              | action                              |
| `Tool` + `Popover`  | `Toolbar.Button` as `Popover.Trigger`         | disclosure; chevron affordance      |
| `Tool` + `Menu`     | `Toolbar.Button` as `Menu.Trigger`            | single-choice list                  |
| `Tool` toggle       | `Toolbar.Button` as `Toggle`                  | sticky pressed state                |
| `Tool` overflow     | `Toolbar.Button` as `Popover.Trigger`         | holds a command list                |
| Tooltip             | `Tooltip.Trigger render={<Toolbar.Button />}` | every icon-only tool; reversed      |

Compose through `render`, never by nesting a second button. The direction differs: a popup trigger
goes inside the toolbar button, `Toolbar.Button render={<Popover.Trigger />}`, while a tooltip goes
outside it, `Tooltip.Trigger render={<Toolbar.Button />}`. A wrapper that styles its trigger must
yield when given `render`, or its classes stack on the rendered element's.

## Tool kinds

| Kind       | Trigger content | Opens         | Example                     |
| ---------- | --------------- | ------------- | --------------------------- |
| action     | icon            | —             | duplicate, delete           |
| toggle     | icon            | —             | palette on/off              |
| disclosure | icon + chevron  | popover panel | fill, stroke, corner radius |
| menu       | icon + chevron  | menu          | move / hand / scale         |
| overflow   | icon            | command list  | more actions                |

Chevron is present only when the tool opens something.

## Panel kinds

| Panel         | Contents                                                         | Seen in                 |
| ------------- | ---------------------------------------------------------------- | ----------------------- |
| swatch picker | mode segmented control, 2 rows of swatches, last swatch = custom | fill, stroke            |
| segmented     | `Solid \| Dashed \| None`, `Fill \| Transparent \| No fill`      | stroke, fill            |
| field group   | 2×2 number fields with per-field icon, plus a link-all control   | corner radius           |
| field row     | number fields with leading icon, optional select                 | preview size            |
| command list  | search input, optional tabs, items with right-aligned shortcuts  | overflow, quick actions |

Panel opens on the tool's side, offset from the toolbar, and closes on outside press and `Escape`.
A panel may open a second panel; the second anchors to the first tool, not to the selection.

## Anchoring

| Rule            | Value                                                    |
| --------------- | -------------------------------------------------------- |
| anchor          | union of the selected windows' rects, in the world layer |
| side            | `top`, flip to `bottom` on collision                     |
| align           | `center`                                                 |
| offset          | fixed gap above the selection bounds                     |
| tracking        | anchor is a real element, so pan and zoom move it        |
| empty selection | toolbar unmounted                                        |

Placement, flipping and collision come from the positioner. The framework supplies the anchor
element; the toolbar takes it as a prop and knows nothing else about the canvas.

## Item states

| State    | Source                    | Presentation                     |
| -------- | ------------------------- | -------------------------------- |
| disabled | command `canRun` is false | dimmed, not focusable by pointer |
| pressed  | toggle is on              | filled tone                      |
| open     | its panel is open         | filled tone, held while open     |
| current  | menu item matches state   | leading check                    |
| shortcut | command hotkey            | right-aligned, muted             |

## Keyboard

| Key                 | Effect                                 |
| ------------------- | -------------------------------------- |
| arrows              | move between tools (roving tabindex)   |
| `Enter` / `Space`   | run, or open the panel                 |
| `Escape`            | close panel, focus returns to its tool |
| tool's own shortcut | runs without opening the toolbar       |

## Declaration

Tools are data: `{ id, label, icon, kind }` plus the command for an action, the panel for a
disclosure, the items for a menu. Label drives the tooltip and the accessible name. No tool is
written twice for the toolbar and the launcher: both read the same command registry, and
availability is `canRun` in both.

## Not in scope here

Selection handles, the resize frame, and the "add" affordance above the selection are separate
parts of the selection layer, not toolbar items.
