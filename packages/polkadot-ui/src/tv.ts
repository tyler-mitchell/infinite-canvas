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

/** `tv` told which `text-*` names are sizes, so a slot may set both a size and a colour. */
export const tv = createTV({
  twMergeConfig: { extend: { classGroups: { "font-size": [{ text: [...FONT_SIZES] }] } } },
});
