import { createTV } from "tailwind-variants";

/** Every `--text-pk-*` the theme declares. A size missing here is dropped when a slot also sets a colour. */
export const FONT_SIZES = [
  "pk-micro",
  "pk-label",
  "pk-control",
  "pk-meta",
  "pk-note",
  "pk-body",
  "pk-lede",
  "pk-item",
  "pk-title",
  "pk-head",
  "pk-display",
  "pk-mono-sm",
  "pk-mono",
  "pk-mono-lg",
  "pk-print",
  "pk-print-xs",
] as const;

/**
 * Every other theme name whose Tailwind prefix and `tw-merge` group share a word. Unlisted, each is
 * a class `tw-merge` has never seen: it keeps the name beside the one it was written to replace, and
 * which of them draws is decided by the order the stylesheet happens to print.
 *
 * That is not theory. A number field's step buttons pass `rounded-none` over the button's
 * `rounded-pk-control` and drew an 8px corner, because the two never collapsed. Found by reading a
 * computed radius on the page.
 */
export const THEME_NAMES = {
  rounded: [
    "pk-widget",
    "pk-card",
    "pk-inner",
    "pk-tray",
    "pk-control",
    "pk-control-inner",
    "pk-chip",
    "pk-pill",
  ],
  shadow: ["pk-swipe", "pk-card", "pk-tray", "pk-knob", "pk-paper", "pk-cell"],
  ease: ["pk-swift", "pk-settle"],
  animate: ["pk-ping", "pk-caret"],
} as const;

/**
 * A radius name is legal on each side and each corner too, and `tw-merge` keeps one group per
 * side. Listed for the shorthand alone, `rounded-l-pk-control` would be the unknown class instead.
 */
const ROUNDED_SIDES = [
  "",
  "-s",
  "-e",
  "-t",
  "-r",
  "-b",
  "-l",
  "-ss",
  "-se",
  "-es",
  "-ee",
  "-tl",
  "-tr",
  "-br",
  "-bl",
] as const;

const radiusGroups = Object.fromEntries(
  ROUNDED_SIDES.map((side) => [
    `rounded${side}`,
    [{ [`rounded${side}`]: [...THEME_NAMES.rounded] }],
  ]),
);

/** `tv` told which of the kit's own names belong to which property, so a later class can win. */
export const tv = createTV({
  twMergeConfig: {
    extend: {
      classGroups: {
        "font-size": [{ text: [...FONT_SIZES] }],
        ...Object.fromEntries(
          Object.entries(THEME_NAMES)
            .filter(([group]) => group !== "rounded")
            .map(([group, names]) => [group, [{ [group]: [...names] }]]),
        ),
        ...radiusGroups,
      },
    },
  },
});
