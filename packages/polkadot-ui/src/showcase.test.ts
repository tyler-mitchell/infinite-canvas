import { existsSync, readdirSync, readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import { Api } from "../app/api.tsx";
import * as fixtures from "../app/fixtures.ts";
import { Props } from "../app/props.tsx";
import { activityLevel, type ActivityDay } from "./components/activity-grid.tsx";
import * as kit from "./index.ts";

/*
 * What the kit says about itself outside its own code: the pages, and the readme.
 *
 * An affordance the kit adds and no page passes is a claim with nothing behind it — a reader
 * cannot see what it does, and neither can anyone checking that it still works.
 *
 * Only the props the kit declares itself count. A table may also list what the Base UI primitive
 * underneath accepts, and that is reference rather than a promise to demonstrate — asking for all
 * of them reported sixty-four, most of them `open`, `disabled` and `modal` on primitives the kit
 * only passes through.
 */

/**
 * Comments removed from the `.tsx` sides. The rules here ask what a page *draws* — which tags, in
 * which order, with which props — and the doc comments in this kit name those same tags and props,
 * so read over the whole file a mention counts as a use. The notes and the README are read as prose
 * elsewhere in this file and keep their own text.
 */
const codeOf = (source: string) => source.replaceAll(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");

const appDir = new URL("../app/", import.meta.url);
const componentDir = new URL("./components/", import.meta.url);
const componentSource = (file: string) => codeOf(readFileSync(new URL(file, componentDir), "utf8"));
const pages = [
  ...readdirSync(appDir).filter((name) => name.endsWith(".tsx")),
  ...readdirSync(new URL("routes/", appDir))
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => `routes/${name}`),
].map((file) => ({ file, source: codeOf(readFileSync(new URL(file, appDir), "utf8")) }));

const everything = pages.map(({ source }) => source).join("\n");

/**
 * The opening tag from `<Name` to the `>` that closes it. Braces are counted, so JSX passed as a
 * prop does not end the tag early, and so are the angle brackets of a type argument: `Props` takes
 * one, and its `>` closes the type rather than the tag.
 */
const openingTags = (source: string, name: string) => {
  const found: string[] = [];

  for (const match of source.matchAll(new RegExp(String.raw`<${name}(?=[\s/<>])`, "g"))) {
    let braces = 0;
    let generics = 0;

    /* The matched text, not the pattern: an escaped name like `Tooltip\.Trigger` is longer than
     * the tag it matches, and offsetting by the pattern scanned straight past the `>`. */
    for (let at = match.index + match[0].length; at < source.length; at += 1) {
      const character = source[at]!;

      if (character === "{") braces += 1;
      else if (character === "}") braces -= 1;
      else if (braces > 0) continue;
      else if (character === "<") generics += 1;
      else if (character === ">" && generics > 0) generics -= 1;
      else if (character === ">") {
        found.push(source.slice(match.index, at));
        break;
      }
    }
  }

  return found;
};

/** Every prop a `Props<XProps>` table names, against the component the table is about. */
const documented = (source: string) =>
  openingTags(source, "Props").flatMap((tag) => {
    const [, owner] = /<Props<(\w+)Props>/.exec(tag) ?? [];
    if (!owner) return [];

    return [...tag.matchAll(/\bname:\s*"([^"]+)"/g)].map(([, prop]) => ({ owner, prop: prop! }));
  });

/**
 * A part is exported under one name and written under another. The mapping is not guessable —
 * `Toggle` is written `<ToggleGroup.Item>` — so it is read from the assignments the components
 * make: `ToggleGroup.Item = Toggle` says exactly how that export reaches a page.
 */
const writtenAs = new Map<string, string>();

for (const file of readdirSync(componentDir).filter((name) => name.endsWith(".tsx"))) {
  for (const [, parent, part, exported] of readFileSync(
    new URL(file, componentDir),
    "utf8",
  ).matchAll(/^(\w+)\.(\w+) = (\w+);$/gm)) {
    writtenAs.set(exported!, `${parent!}\\.${part!}`);
  }
}

const tagNamesFor = (owner: string) => {
  const dotted = writtenAs.get(owner);
  const [, head, tail] = /^([A-Z][a-z\d]+)([A-Z][A-Za-z\d]*)$/.exec(owner) ?? [];
  const guessed = head && tail ? [`${head}\\.${tail}`, `${head}s\\.${tail}`] : [];

  return [owner, ...(dotted ? [dotted] : []), ...guessed];
};

/**
 * What each component adds to the primitive under it, read from its own props type. Kept per
 * component: as one flat set, a `value` declared by the receipt barcode made `value` on Tabs look
 * like something this kit had added, when Base UI owns it.
 */
const kitDeclares = new Map<string, ReadonlySet<string>>();

for (const file of readdirSync(componentDir).filter((name) => name.endsWith(".tsx"))) {
  const source = componentSource(file);

  for (const [, owner, body] of source.matchAll(
    /export (?:type|interface) (\w+)Props\b([\s\S]*?)(?=\nexport |\nfunction |$)/g,
  )) {
    const props = [...body!.matchAll(/^\s*readonly\s+(\w+)\??:/gm)].map(([, prop]) => prop!);

    kitDeclares.set(owner!, new Set([...(kitDeclares.get(owner!) ?? []), ...props]));
  }
}

const undemonstrated = (
  sources: readonly { readonly file: string; readonly source: string }[],
  everySource: string,
  declared: ReadonlyMap<string, ReadonlySet<string>>,
) => {
  const seen = new Set<string>();

  return sources
    .flatMap(({ source }) => documented(source))
    .filter(({ owner, prop }) => {
      const key = `${owner}.${prop}`;
      if (seen.has(key) || !declared.get(owner)?.has(prop)) return false;
      seen.add(key);

      /* A boolean is often written bare, so `locale` counts as passed as much as `locale={true}`. */
      const passed = new RegExp(String.raw`(?<=\s)${prop}(?=[\s=/>])`);

      /* Children arrive between the tags, so a tag that is not self closing has passed them. */
      const written = (tag: string) =>
        prop === "children" ? !tag.trimEnd().endsWith("/") : passed.test(tag);

      return !tagNamesFor(owner).some((tag) => openingTags(everySource, tag).some(written));
    })
    .map(({ owner, prop }) => `${owner} adds ${prop} and no page passes it`)
    .sort();
};

test("an affordance the kit adds and no page passes is reported", () => {
  const kit = new Map([["Card", new Set(["tone"])]]);
  const shown = [
    { file: "p.tsx", source: '<Props<CardProps> rows={[{ name: "tone" }]} />\n<Card tone="a" />' },
  ];
  const hidden = [
    { file: "p.tsx", source: '<Props<CardProps> rows={[{ name: "tone" }]} />\n<Card />' },
  ];

  expect(undemonstrated(shown, shown[0]!.source, kit)).toEqual([]);
  /* Written bare, which is how a boolean usually arrives. */
  const bare = [
    { file: "p.tsx", source: '<Props<CardProps> rows={[{ name: "tone" }]} />\n<Card tone />' },
  ];

  expect(undemonstrated(bare, bare[0]!.source, kit)).toEqual([]);
  expect(undemonstrated(hidden, hidden[0]!.source, kit)).toEqual([
    "Card adds tone and no page passes it",
  ]);
  /* A prop the primitive underneath owns is reference, not a promise to demonstrate. */
  expect(undemonstrated(hidden, hidden[0]!.source, new Map())).toEqual([]);
  /* A name another component declares does not make it this one's affordance. */
  expect(undemonstrated(hidden, hidden[0]!.source, new Map([["Other", kit.get("Card")!]]))).toEqual(
    [],
  );
});

test("a tag holding JSX or a type argument ends in the right place", () => {
  const [held] = openingTags('<Card title={<span>{"x"}</span>} tone="a" />\n<Card />', "Card");

  expect(held).toContain('title={<span>{"x"}</span>}');
  expect(held).toContain('tone="a"');
  expect(held).not.toContain("<Card />");

  const [typed] = openingTags('<Props<CardProps> rows={[{ name: "tone" }]} />', "Props");

  expect(typed).toContain("<Props<CardProps>");
  expect(typed).toContain('name: "tone"');
});

/**
 * Base UI's tooltip is a visual hint by design: the popup carries no role, gets no id and is never
 * pointed at by the trigger, and its documentation says the trigger has to carry an `aria-label`
 * that matches what the tooltip says. Driving one confirmed it — the popup opened on focus with no
 * `role`, no `id`, and no `aria-describedby` anywhere. Both triggers here said only their own
 * visible word, so the number each tooltip existed to give was told to nobody.
 */
const unlabelledTooltips = (
  sources: readonly { readonly file: string; readonly source: string }[],
) =>
  sources.flatMap(({ file, source }) =>
    openingTags(source, "Tooltip\\.Trigger")
      .filter((tag) => !/\baria-label=/.test(tag))
      .map(() => `${file} opens a tooltip from a trigger that says only its own name`),
  );

test("a tooltip trigger that carries no label of its own is reported", () => {
  expect(
    unlabelledTooltips([{ file: "p.tsx", source: "<Tooltip.Trigger>a</Tooltip.Trigger>" }]),
  ).toEqual(["p.tsx opens a tooltip from a trigger that says only its own name"]);
  expect(
    unlabelledTooltips([
      { file: "p.tsx", source: '<Tooltip.Trigger aria-label="a, b">a</Tooltip.Trigger>' },
    ]),
  ).toEqual([]);
});

/**
 * And that the label is the tooltip's own words. The rule above asks only whether a label exists,
 * under a name that promised more: a trigger could carry `aria-label="queries"` beside a tooltip
 * reading `2.1M served` and pass, which is the failure the label is there to prevent.
 *
 * Compared with the punctuation taken out of both, since a label reads `region, edge, 42 ms` where
 * the tooltip prints `edge · 42 ms` and they are the same words.
 */
const plainWords = (text: string) =>
  text
    .toLowerCase()
    .replace(/[·,.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const unsaidTooltips = (sources: readonly { readonly file: string; readonly source: string }[]) =>
  sources.flatMap(({ file, source }) =>
    [...source.matchAll(/<Tooltip\.Content[^>]*>([^<]*)<\/Tooltip\.Content>/g)].flatMap(
      (content) => {
        const before = source.slice(0, content.index);
        const trigger = openingTags(before, "Tooltip\\.Trigger").at(-1) ?? "";
        const [, label] = /aria-label="([^"]*)"/.exec(trigger) ?? [];
        const said = plainWords(content[1]!);

        return label !== undefined && plainWords(label).includes(said)
          ? []
          : [`${file} says "${content[1]!.trim()}" in a tooltip its trigger does not say`];
      },
    ),
  );

test("a tooltip whose trigger does not say its words is reported", () => {
  const same = [
    {
      file: "p.tsx",
      source:
        '<Tooltip.Trigger aria-label="region, edge, 42 ms">region</Tooltip.Trigger>\n<Tooltip.Content>edge · 42 ms</Tooltip.Content>',
    },
  ];
  const other = [
    {
      file: "p.tsx",
      source:
        '<Tooltip.Trigger aria-label="region">region</Tooltip.Trigger>\n<Tooltip.Content>edge · 42 ms</Tooltip.Content>',
    },
  ];

  expect(unsaidTooltips(same)).toEqual([]);
  expect(unsaidTooltips(other)).toEqual([
    'p.tsx says "edge · 42 ms" in a tooltip its trigger does not say',
  ]);
});

test("every tooltip trigger says what its tooltip says", () => {
  const triggers = pages.flatMap(({ source }) => openingTags(source, "Tooltip\\.Trigger"));

  expect(unlabelledTooltips(pages)).toEqual([]);
  expect(unsaidTooltips(pages)).toEqual([]);
  /* After the rule, not before it: there are two triggers, so a floor of one fires on a page that
   * legitimately drops one and reports a number where the rule would have named the trigger. */
  expect(triggers.length).toBeGreaterThan(1);
});

/**
 * A sparkline is one `img` with one name, so nothing drawn inside is read on its own — the caption
 * badge included. One page showed `31ms` at the head under the name "p95 latency over 96 hours",
 * so a reader who could not see the chart got the window and never the figure.
 *
 * The same shape as the tooltip rule above and the same answer: whatever is shown has to be said
 * somewhere a reader reaches. A page that gives no `label` is fine — the default name already ends
 * with the latest reading.
 */
const unsaidCaptions = (sources: readonly { readonly file: string; readonly source: string }[]) =>
  sources
    .flatMap(({ file, source }) =>
      openingTags(source, "Sparkline").flatMap((tag) => {
        const caption = /caption=\{([^}]+)\}/.exec(tag)?.[1]?.trim();
        if (caption === undefined) return [];

        const label = /label=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(tag);
        const said = label === null ? "" : (label[1] ?? label[2] ?? "");

        return label !== null && !said.includes(caption)
          ? [`${file}: a sparkline shows ${caption} and its name does not say it`]
          : [];
      }),
    )
    .sort();

test("a caption a sparkline draws and never says is reported", () => {
  const quiet = [
    { file: "p.tsx", source: '<Sparkline values={A} caption={LATEST} label="latency" />' },
  ];
  const said = [
    {
      file: "p.tsx",
      source: "<Sparkline values={A} caption={LATEST} label={`latency, latest ${LATEST}`} />",
    },
  ];
  /* No label at all is not a fault: the component's own name ends with the latest reading. */
  const bare = [{ file: "p.tsx", source: "<Sparkline values={A} caption={LATEST} />" }];

  expect(unsaidCaptions(quiet)).toEqual([
    "p.tsx: a sparkline shows LATEST and its name does not say it",
  ]);
  expect(unsaidCaptions(said)).toEqual([]);
  expect(unsaidCaptions(bare)).toEqual([]);
});

test("every caption a sparkline draws is said in the name it carries", () => {
  const drawn = pages.flatMap(({ source }) => openingTags(source, "Sparkline"));

  expect(drawn.length).toBeGreaterThan(3);
  expect(unsaidCaptions(pages)).toEqual([]);
});

/**
 * The same trade in another component. A breakdown draws its legend and mutes it, on the grounds
 * that the bar's own name already lists every part and its share — which is true of the name the
 * component builds and not of one a page passes instead.
 *
 * Two pages passed "language split". The reader saw TypeScript 84%, WGSL 9%, CSS 7% and heard
 * three words. A name that replaces the default has to carry what the default carried, so the
 * check is whether it reaches for `breakdownLabel`; leaving the label off is always fine.
 */
const untoldShares = (sources: readonly { readonly file: string; readonly source: string }[]) =>
  sources
    .flatMap(({ file, source }) =>
      openingTags(source, "Breakdown")
        .map((tag) => /label=(?:"([^"]*)"|\{`([^`]*)`\}|\{([^}]*)\})/.exec(tag))
        .filter((written) => written !== null)
        .map((written) => written[1] ?? written[2] ?? written[3] ?? "")
        .filter((said) => !said.includes("breakdownLabel"))
        .map((said) => `${file}: a breakdown is named "${said}" and its shares go unsaid`),
    )
    .sort();

test("a breakdown named without its shares is reported", () => {
  const titled = [{ file: "p.tsx", source: '<Breakdown parts={L} label="language split" />' }];
  const whole = [
    { file: "p.tsx", source: "<Breakdown parts={L} label={`split: ${breakdownLabel(L)}`} />" },
  ];
  const bare = [{ file: "p.tsx", source: "<Breakdown parts={L} />" }];

  expect(untoldShares(titled)).toEqual([
    'p.tsx: a breakdown is named "language split" and its shares go unsaid',
  ]);
  expect(untoldShares(whole)).toEqual([]);
  expect(untoldShares(bare)).toEqual([]);
});

test("every breakdown says the shares it draws", () => {
  const drawn = pages.flatMap(({ source }) => openingTags(source, "Breakdown"));

  expect(drawn.length).toBeGreaterThan(2);
  expect(untoldShares(pages)).toEqual([]);
});

/**
 * `Readout` is a live region, which is what a figure changing in place needs and what a word in a
 * paragraph does not. The forms page marked seven terms with it, so a reader arrived at seven
 * regions that announce "Field" and never change again.
 *
 * `Code` is the same mono without the voice. The rule watches for the substitution coming back,
 * since the two look identical on the page and only one of them speaks.
 */
const spokenTerms = (sources: readonly { readonly file: string; readonly source: string }[]) =>
  sources
    .flatMap(({ file, source }) =>
      [...source.matchAll(/<Prose\b[\s\S]*?<\/Prose>/g)]
        .flatMap(([block]) => [...block.matchAll(/<Readout>([\s\S]*?)<\/Readout>/g)])
        .map(([, said]) => `${file}: a sentence says "${said!.trim()}" through a live region`),
    )
    .sort();

test("a term marked with a live region inside a sentence is reported", () => {
  const spoken = [
    { file: "p.tsx", source: "<Prose>from the <Readout>Field</Readout> around</Prose>" },
  ];
  const quiet = [{ file: "p.tsx", source: "<Prose>from the <Code>Field</Code> around it</Prose>" }];
  /* A readout outside a sentence is a readout doing its job. */
  const figure = [{ file: "p.tsx", source: "<Row><Readout>8.2 ms</Readout></Row>" }];

  expect(spokenTerms(spoken)).toEqual(['p.tsx: a sentence says "Field" through a live region']);
  expect(spokenTerms(quiet)).toEqual([]);
  expect(spokenTerms(figure)).toEqual([]);
});

test("no sentence marks a term with a live region", () => {
  const terms = pages.flatMap(({ source }) => [...source.matchAll(/<Code>/g)]);

  expect(terms.length).toBeGreaterThan(6);
  expect(spokenTerms(pages)).toEqual([]);
});

/*
 * An exception naming a variant that does not exist was a rule here for one turn. `Api` is generic
 * over the object it reads now, so `except` is keyed to that object's own variants and a stale name
 * is a type error at the tag, which names the alternatives — `"ticked" is not assignable to
 * "checked" | "layout"`. The rule read the same thing later and said less, so it is gone rather
 * than kept beside the type.
 *
 * "No variant table offers a prop that comes from state" further down is a different question and
 * stays: it asks whether a state variant is being shown as a prop at all, not whether the name used
 * to leave it out exists.
 */

/**
 * The other thing written by hand beside a table is its heading, and nothing tied it to the rows
 * beneath. Forty-six tables carry one, so a section copied and half-edited would print one
 * component's name over another's props and read as correct.
 *
 * A props table takes its type, so its heading is that type's name and the two must agree exactly.
 * A variants object may dress more than one part — the receipt's line and the terminal's command
 * are drawn by their parent's — so a variants heading has to begin with the owner's name rather
 * than match it, which is what naming a part looks like.
 */
const flat = (words: string) => words.replace(/\s+/g, "").toLowerCase();

const misheadedTables = (sources: readonly { readonly file: string; readonly source: string }[]) =>
  sources
    .flatMap(({ file, source }) => [
      ...openingTags(source, "Api").flatMap((tag) => {
        const said = /name="([^"]*)"/.exec(tag)?.[1];
        const owner = /of=\{(\w+?)Variants\}/.exec(tag)?.[1];
        if (said === undefined || owner === undefined) return [];

        return flat(said).startsWith(flat(owner))
          ? []
          : [`${file}: ${owner} variants sit under "${said}"`];
      }),
      ...openingTags(source, "Props").flatMap((tag) => {
        const said = /name="([^"]*)"/.exec(tag)?.[1];
        const owner = /<Props<(\w+?)Props>/.exec(tag)?.[1];
        if (said === undefined || owner === undefined) return [];

        return flat(said) === flat(owner) ? [] : [`${file}: ${owner} props sit under "${said}"`];
      }),
    ])
    .sort();

test("a table headed with another component's name is reported", () => {
  const right = [{ file: "p.tsx", source: '<Api name="toggle group" of={toggleGroupVariants} />' }];
  /* A part of the same component, which is what the receipt's line and the terminal's do. */
  const part = [{ file: "p.tsx", source: '<Api name="terminal command" of={terminalVariants} />' }];
  const wrong = [{ file: "p.tsx", source: '<Api name="button" of={badgeVariants} />' }];
  const typed = [
    { file: "p.tsx", source: '<Props<ToolbarButtonProps> name="toolbar button" rows={[]} />' },
  ];
  const mistyped = [{ file: "p.tsx", source: '<Props<BadgeProps> name="button" rows={[]} />' }];

  expect(misheadedTables(right)).toEqual([]);
  expect(misheadedTables(part)).toEqual([]);
  expect(misheadedTables(wrong)).toEqual(['p.tsx: badge variants sit under "button"']);
  expect(misheadedTables(typed)).toEqual([]);
  expect(misheadedTables(mistyped)).toEqual(['p.tsx: Badge props sit under "button"']);
});

test("every table on every page is headed with what it lists", () => {
  const headed = pages.flatMap(({ source }) =>
    [...openingTags(source, "Api"), ...openingTags(source, "Props")].filter((tag) =>
      tag.includes("name="),
    ),
  );

  expect(headed.length).toBeGreaterThan(40);
  expect(misheadedTables(pages)).toEqual([]);
});

/**
 * A row's `values` and `fallback` describe a union, and seventeen rows carry one. Thirteen of them
 * describe a Base UI type — `side`, `align`, `modal`, an axis — which is gone by the time a test
 * runs, so nothing here can weigh them.
 *
 * Four can be weighed. The toolbar's button and the popover's trigger draw over the kit's button,
 * so their tone and size are a variant this package owns. A part settles a default in its own
 * signature or leaves the button's standing — both of these name a tone and say nothing about size
 * — so the fallback is read from the signature first and the variants object second. Every half
 * comes from the source, so changing a tone list or a part's default moves the expectation with it.
 */
const DRAWN_OVER_THE_BUTTON = ["ToolbarButton", "PopoverTrigger"] as const;

const defaultIn = (source: string, part: string, prop: string) =>
  new RegExp(String.raw`function ${part}\(\{[^}]*\b${prop} = "(\w+)"`).exec(source)?.[1];

const partsDrawnOver = new Map([
  ["ToolbarButton", componentSource("toolbar.tsx")],
  ["PopoverTrigger", componentSource("popover.tsx")],
]);

const misdescribedUnions = (
  sources: readonly { readonly file: string; readonly source: string }[],
) =>
  sources
    .flatMap(({ file, source }) =>
      [...source.matchAll(/<Props<(\w+)Props>([\s\S]*?)\/>/g)].flatMap(([, owner, body]) => {
        const declared = partsDrawnOver.get(owner!);
        if (declared === undefined) return [];

        return [...body!.matchAll(/\{[^{}]*\}/g)]
          .map(([row]) => ({
            prop: /name:\s*"([^"]+)"/.exec(row)?.[1],
            listed: /values:\s*\[([^\]]*)\]/.exec(row)?.[1],
            fallback: /fallback:\s*"([^"]+)"/.exec(row)?.[1],
          }))
          .filter(
            (row): row is { prop: string; listed: string; fallback: string } =>
              row.prop !== undefined && row.listed !== undefined && row.fallback !== undefined,
          )
          .flatMap(({ prop, listed, fallback }) => {
            const owns = (kit.buttonVariants as unknown as Tabled).variants?.[prop];
            if (owns === undefined) return [];

            const said = [...listed.matchAll(/"([^"]+)"/g)].map(([, value]) => value!);
            const whole = [...said, fallback].sort().join(",");
            const real = Object.keys(owns).sort().join(",");
            /* A part settles a default in its own signature or lets the button's stand. The
             * toolbar's button names a tone and says nothing about size, so both are read. */
            const settled =
              defaultIn(declared, owner!, prop) ??
              String((kit.buttonVariants as unknown as Tabled).defaultVariants?.[prop]);

            return [
              ...(whole === real ? [] : [`${file}: ${owner}.${prop} lists ${whole}, not ${real}`]),
              ...(settled === fallback
                ? []
                : [`${file}: ${owner}.${prop} falls back to ${settled}, not ${fallback}`]),
            ];
          });
      }),
    )
    .sort();

test("a union a row describes that the component does not have is reported", () => {
  const right = [
    {
      file: "p.tsx",
      source:
        '<Props<ToolbarButtonProps> name="x" rows={[{ name: "size", fallback: "md", values: ["sm", "lg", "icon"] }]} />',
    },
  ];
  const short = [
    {
      file: "p.tsx",
      source:
        '<Props<ToolbarButtonProps> name="x" rows={[{ name: "size", fallback: "md", values: ["sm", "lg"] }]} />',
    },
  ];
  const wrongDefault = [
    {
      file: "p.tsx",
      source:
        '<Props<ToolbarButtonProps> name="x" rows={[{ name: "tone", fallback: "soft", values: ["solid", "outline", "ghost"] }]} />',
    },
  ];

  expect(misdescribedUnions(right)).toEqual([]);
  expect(misdescribedUnions(short)).toEqual([
    "p.tsx: ToolbarButton.size lists lg,md,sm, not icon,lg,md,sm",
  ]);
  expect(misdescribedUnions(wrongDefault)).toEqual([
    "p.tsx: ToolbarButton.tone falls back to ghost, not soft",
  ]);
});

test("every union a row describes is the one its component has", () => {
  const weighed = pages.flatMap(({ source }) =>
    [...source.matchAll(/<Props<(\w+)Props>/g)].filter(([, owner]) =>
      DRAWN_OVER_THE_BUTTON.includes(owner as (typeof DRAWN_OVER_THE_BUTTON)[number]),
    ),
  );

  expect(weighed.length).toBe(DRAWN_OVER_THE_BUTTON.length);
  expect(misdescribedUnions(pages)).toEqual([]);
});

/**
 * The readme counts the kit twice — how many component modules there are, and how many of them
 * draw with `slots` rather than a `base`. Both were a component behind, and it also sent a reader
 * to a route that had been renamed. Numbers written in prose go stale the moment a file is added,
 * and nothing about the kit changes to say so.
 */
const NUMBERS = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/** Ten to nineteen are their own words rather than a ten and a unit, and had none. */
const TEENS = [
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];

const inWords = (count: number) => {
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty"];
  const [ten, unit] = [Math.floor(count / 10), count % 10];

  if (count < 10) return NUMBERS[count - 1]!;
  if (ten === 1) return TEENS[unit]!;
  return unit === 0 ? tens[ten]! : `${tens[ten]}-${NUMBERS[unit - 1]}`;
};

test("counting in words covers the range the readme uses", () => {
  /* Ten and nineteen because they used to answer "" and "-nine": a decade with no words in it. */
  expect([6, 9, 10, 13, 19, 20, 34, 40].map(inWords)).toEqual([
    "six",
    "nine",
    "ten",
    "thirteen",
    "nineteen",
    "twenty",
    "thirty-four",
    "forty",
  ]);
});

/**
 * Every document that names a route, not only the readme. The design note pointed at
 * `app/routes/data.tsx` for a whole session after that file became `readouts.tsx`, and a rule
 * reading one file would have gone on saying the docs were clean.
 */
const documents = [
  new URL("../README.md", import.meta.url),
  new URL("../docs/design/widget.md", import.meta.url),
  new URL("../docs/research/widget-runtime.md", import.meta.url),
  new URL("../docs/research/recursive-navigation.md", import.meta.url),
];

/**
 * A research note pins the version it read a package at, which is what makes a finding reopenable.
 * Two had drifted: `tailwind-variants` was recorded at 3.3.1 and is installed at 3.2.2, and Base UI
 * was credited with 48 component subpaths beside its own list of 38.
 *
 * Only the packages this one installs can be checked. A version recorded for something surveyed
 * and never installed — `motion`, TanStack Start — is history, and there is nothing here to read it
 * against.
 *
 * Both kinds of dependency count: the router is pinned in a note and lives in `devDependencies`,
 * so reading the runtime ones alone left the only correct pin of the four unguarded.
 */
test("every version a document pins for a dependency is the one installed", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as Record<string, Record<string, string>>;

  const installed = new Map(
    [...Object.keys(manifest.dependencies!), ...Object.keys(manifest.devDependencies!)].map(
      (name) => [
        name,
        JSON.parse(
          readFileSync(new URL(`../node_modules/${name}/package.json`, import.meta.url), "utf8"),
        ).version as string,
      ],
    ),
  );

  const wrong = documents.flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(/`(@?[\w/-]+)`[^\n|]{0,4}(\d+\.\d+\.\d+)/g)]
      .filter(([, name]) => installed.has(name!))
      .filter(([, name, pinned]) => installed.get(name!) !== pinned)
      .map(
        ([, name, pinned]) =>
          `${file.pathname.split("/").pop()} pins ${name} at ${pinned}, installed is ${installed.get(name!)}`,
      ),
  );

  /* The four names the documents pin, of which three are installed here and one never was. */
  expect(installed.size).toBeGreaterThan(12);
  expect(installed.get("@tanstack/react-router")).toBeDefined();
  expect(wrong).toEqual([]);
});

/**
 * The runtime note says a survey of an animation library was not adopted, and the evidence it
 * gives is the list of what the package depends on. That list is the argument: a fourth name would
 * make the sentence false and the section around it misleading, and the rule above reads the
 * versions a document pins rather than the set it claims.
 */
test("the dependencies a note names are the dependencies the package declares", () => {
  const note = readFileSync(new URL("../docs/research/widget-runtime.md", import.meta.url), "utf8");
  /* The note says this twice, in two wordings, and reading one of them is the fault it guards. */
  const claims = [
    ...note
      .replace(/\s+/g, " ")
      .matchAll(/its (?:declared )?dependencies are ([^.]+?)(?:, and |\.)/g),
  ].map(([, listed]) =>
    listed!
      .split(/,|\band\b/)
      .map((one) => one.trim().replaceAll("`", ""))
      .filter(Boolean)
      .sort(),
  );
  const declared = Object.keys(
    (
      JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
        readonly dependencies: Record<string, string>;
      }
    ).dependencies,
  );

  /*
   * Read first, and only this: a sentence that stops matching lists nothing at all. The count is
   * the comparison's to report rather than a floor's — a floor set at the count answers for both
   * and then reports the wrong one, which is what it did.
   */
  expect(claims.length).toBe(2);
  expect(claims).toEqual([[...declared].sort(), [...declared].sort()]);
});

/**
 * The note names three libraries in the words people use for them; the code names them as they are
 * installed. That translation is the one thing here written by hand, and it is small and factual.
 */
const SPECIFIERS: Record<string, RegExp> = {
  "three.js": /^three(\/|$)/,
  R3F: /^@react-three\//,
  TypeGPU: /^@?typegpu(\/|$)/,
};

/**
 * The same sentence carries a second claim, and three of the note's questions are closed on it:
 * they are handed to whatever owns the GPU world, on the grounds that this package has no canvas.
 * An import would reopen all three and nothing would say so.
 */
test("nothing in the package imports the libraries a note says it does not", () => {
  const note = readFileSync(new URL("../docs/research/widget-runtime.md", import.meta.url), "utf8");
  /* Not `[^.]+`: one of the names has a dot in it, and that reading stopped inside three.js. */
  const sentence = /nothing under `src\/` or `app\/` imports (.+?)\.(?:\s|$)/;
  const [, named] = sentence.exec(note.replace(/\s+/g, " ")) ?? [];
  const claimed = (named ?? "")
    .split(/,|\bor\b/)
    .map((one) => one.trim())
    .filter(Boolean);
  const sources = [new URL("./", import.meta.url), appDir].flatMap((dir) =>
    (readdirSync(dir, { recursive: true }) as readonly string[])
      .filter((name) => /\.tsx?$/.test(name))
      .map((name) => readFileSync(new URL(name, dir), "utf8")),
  );

  /* Both read first: a sentence naming a fourth library needs a fourth line above, and a walk
   * that finds no files imports nothing at all. */
  expect(claimed).toEqual(Object.keys(SPECIFIERS));
  expect(sources.length).toBeGreaterThan(60);
  expect(
    sources.flatMap((source) =>
      [...source.matchAll(/from "([^"]+)"/g)]
        .map(([, from]) => from!)
        .filter((from) => claimed.some((one) => SPECIFIERS[one]?.test(from))),
    ),
  ).toEqual([]);
});

/**
 * The runtime note enumerates every primitive Base UI ships, and the kit's rule that no primitive
 * is hand-rolled rests on that list being the whole of it. The version it names is already checked
 * against the lockfile above; the list is not, so a release adding a primitive would leave the
 * document quietly short while still naming the right version.
 *
 * Read from the same place the document says it read: the package's own `exports`. The five
 * composition hooks it lists after the divider are not primitives and are counted separately, and
 * `esm`, `types` and the `internals/` subpaths are not component subpaths at all.
 */
const HOOKS_NOT_PRIMITIVES = [
  "use-render",
  "merge-props",
  "direction-provider",
  "csp-provider",
  "unstable-use-media-query",
];

test("the primitives a document enumerates are the ones the package ships", () => {
  const note = readFileSync(new URL("../docs/research/widget-runtime.md", import.meta.url), "utf8");
  const shipped = Object.keys(
    (
      JSON.parse(
        readFileSync(
          new URL("../node_modules/@base-ui/react/package.json", import.meta.url),
          "utf8",
        ),
      ) as { readonly exports: Record<string, unknown> }
    ).exports,
  )
    .filter((key) => key.startsWith("./"))
    .map((key) => key.slice(2))
    .filter(
      (key) =>
        !key.includes("*") &&
        !key.startsWith("internals/") &&
        !["esm", "types", "package.json"].includes(key) &&
        !HOOKS_NOT_PRIMITIVES.includes(key),
    )
    .sort();

  const [, counted] = /declares (\d+) component subpaths/.exec(note) ?? [];
  const [, block] = /```txt\n(accordion[\s\S]*?)```/.exec(note) ?? [];
  const named = block!
    .split("·")[0]!
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .sort();

  expect(shipped.length).toBeGreaterThan(30);
  expect(named).toEqual(shipped);
  expect(Number(counted)).toBe(shipped.length);
});

/**
 * The runtime note's central finding — that Start's dev middleware never mounts here — rests on one
 * structural fact rather than on a version: `vite` in this workspace is an alias for a different
 * product, the override reaches every package, and the peer check that would object is silenced.
 * The vite config cites that finding for why this app is on Router.
 *
 * So the fact is pinned rather than the conclusion. Re-running the finding means installing Start
 * and standing up a shell, which is the owner's call; noticing that its ground has moved costs one
 * read of the file the note quotes.
 */
test("the alias a document rests on is the alias the workspace declares", () => {
  const note = readFileSync(new URL("../docs/research/widget-runtime.md", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../../../pnpm-workspace.yaml", import.meta.url), "utf8");

  const [, quoted] = /```yaml\n# pnpm-workspace\.yaml\n([\s\S]*?)```/.exec(note) ?? [];
  const claimed = (quoted ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\w[\w-]*:\s*\S/.test(line) && !line.startsWith("allowAny"));

  expect(claimed).toEqual(["vite: npm:@voidzero-dev/vite-plus-core@0.2.9", 'vite: "catalog:"']);
  expect(claimed.filter((line) => !workspace.includes(line))).toEqual([]);
  /* Written inline in the note and across two lines in the file, so it is read rather than matched. */
  expect(/allowAny:\s*(?:\[[^\]]*vite|\n\s*-\s*vite)/.test(workspace)).toBe(true);
});

/**
 * The note rejects a shell partly because the toolchain's own documents say nothing about serving
 * one, and it shows the search that found nothing. An empty result is the weakest kind of evidence
 * to leave unattended: the day the toolchain ships an SSR guide, the finding is wrong and the
 * silence that proved it reads exactly the same.
 *
 * The files and the words come from the note's own command, so widening the search there widens
 * this. A file that has gone also has no matches, which is why the sizes are read first.
 */
test("the toolchain docs a note searched still say nothing about the shell it rejected", () => {
  const note = readFileSync(new URL("../docs/research/widget-runtime.md", import.meta.url), "utf8");
  const [, command] = /```sh\n(grep[\s\S]*?vite-plus[\s\S]*?)```/.exec(note) ?? [];
  const words = (/"([^"]+)"/.exec(command ?? "")?.[1] ?? "").split("\\|");
  const searched = [...(command ?? "").matchAll(/(node_modules\/vite-plus\/\S+\.md)/g)].map(
    ([, name]) => ({
      name: name!,
      text: existsSync(new URL(`../${name}`, import.meta.url))
        ? readFileSync(new URL(`../${name}`, import.meta.url), "utf8")
        : "",
    }),
  );

  /* Read first: a file that is gone matches nothing, and reads just like the finding holding. */
  expect(words.sort()).toEqual(["middlewareMode", "ssr", "tanstack"]);
  expect(searched.filter(({ text }) => text.length < 200).map(({ name }) => name)).toEqual([]);
  expect(
    searched
      .filter(({ text }) => new RegExp(words.join("|"), "i").test(text))
      .map(({ name }) => name),
  ).toEqual([]);
});

/**
 * The navigation note is a design for an owner this package does not have, and it says so. What it
 * does carry that can go stale is a claim about the router: twelve affordances named in backticks,
 * described as verified against the installed version. A rename upstream would leave the design
 * resting on a name that no longer exists, and the version pin above would still read as correct.
 *
 * Only lower camel case is read. The note also backticks its own target code — `CanvasFrame`, a
 * `FrameStack`, the `_splat` param — and those are things it proposes rather than things it found.
 */
test("every router affordance a document names is one the router still exports", () => {
  const note = readFileSync(
    new URL("../docs/research/recursive-navigation.md", import.meta.url),
    "utf8",
  );
  const declared = readFileSync(
    new URL("../node_modules/@tanstack/react-router/dist/esm/index.d.ts", import.meta.url),
    "utf8",
  );

  const named = [...new Set([...note.matchAll(/`([a-z][A-Za-z]{4,})`/g)].map(([, name]) => name!))];
  const gone = named.filter((name) => !new RegExp(String.raw`\b${name}\b`).test(declared)).sort();

  expect(named.length).toBeGreaterThan(8);
  expect(gone).toEqual([]);
});

/**
 * A route named in prose against the routes that exist. The pattern reads a plain file name and
 * not a splat one, which is deliberate rather than an oversight: the navigation note tells the
 * story of `app/routes/w.$.tsx`, a lab route that was removed, and says so in the same sentence.
 * A reference to a route that is gone on purpose is history, and widening this would report it.
 */
test("no document points at a route file that is gone", () => {
  const real = readdirSync(new URL("routes/", appDir)).filter((name) => name.endsWith(".tsx"));

  const stale = documents.flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(/app\/routes\/([\w-]+\.tsx)/g)]
      .map(([, named]) => named!)
      .filter((named) => !real.includes(named))
      .map((named) => `${file.pathname.split("/").pop()} points at ${named}`),
  );

  expect(real.length).toBe(10);
  expect(stale).toEqual([]);
});

/**
 * The design note records a scope rule it dropped, and names the composites that rule would have
 * excluded — counted in words and listed. The readme's own list of components is read; this one
 * was not, so a renamed composite would leave the note naming something the kit does not export
 * while every run stayed green.
 *
 * What a composite is cannot be derived, so the list stays written. Whether each name is a
 * component can be, and that is the half that goes stale.
 */
test("the composites the design note names are ones the kit exports", () => {
  const note = readFileSync(new URL("../docs/design/widget.md", import.meta.url), "utf8");
  const [, counted, listed] =
    /ships (\w+) composites that rule would have excluded: ([^.]+)\./.exec(note) ?? [];
  const named = (listed ?? "").split(",").map((one) => one.trim().replaceAll("`", ""));

  /* Read first: a reader that matches nothing splits an empty string into one empty name. */
  expect(named.length).toBeGreaterThan(5);
  expect(counted).toBe(inWords(named.length));
  expect(named.filter((one) => !(one in kit))).toEqual([]);
});

test("the readme counts the kit as it is, and names routes that exist", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8").toLowerCase();
  const modules = readdirSync(componentDir).filter(
    (name) => name.endsWith(".tsx") && !name.endsWith(".test.tsx"),
  );
  const slotted = modules.filter((file) =>
    readFileSync(new URL(file, componentDir), "utf8").includes("slots: {"),
  );
  const routes = readdirSync(new URL("routes/", appDir))
    .filter((name) => name.endsWith(".tsx") && name !== "__root.tsx")
    .map((name) => `/${name.replace(/(index)?\.tsx$/, "")}`);

  expect(modules.length).toBeGreaterThan(30);
  /* The two counts, with the hyphen the readme may have wrapped a line on. */
  expect(readme.replace(/-\n/g, "-")).toContain(`${inWords(modules.length)} component modules`);
  expect(readme.replace(/-\n/g, "-")).toContain(
    `${inWords(slotted.length)} of the ${inWords(modules.length)} are the former`,
  );

  const missing = [...readme.matchAll(/`(\/[a-z]*)`/g)]
    .map(([, route]) => route!)
    .filter((route) => !routes.includes(route));

  expect(routes.length).toBe(9);
  expect([...new Set(missing)]).toEqual([]);

  /*
   * And the other way round. The readme named eight routes and counted them in words while the
   * forms page had been up for a day, which neither the count above nor the names below could say.
   */
  expect(routes.filter((route) => !readme.includes(`\`${route}\``))).toEqual([]);
  expect(readme.replace(/-\n/g, "-")).toContain(`${inWords(routes.length)} routes`);
});

/**
 * Any document that counts the lab app's routes, not only the readme: the research note opens by
 * saying what this package is, and said eight flat routes for as long as the readme said eight.
 */
test("every document that counts the routes counts the routes there are", () => {
  const routes = readdirSync(new URL("routes/", appDir)).filter(
    (name) => name.endsWith(".tsx") && name !== "__root.tsx",
  );

  const counted = documents.flatMap((file) => {
    const text = readFileSync(file, "utf8").toLowerCase().replace(/-\n/g, "-");

    return (
      [...text.matchAll(/\b([a-z]+)(?: flat)? routes\b/g)]
        .map(([, word]) => word!)
        /* The teens are here because a word this cannot read is skipped, not reported. */
        .filter(
          (word) =>
            NUMBERS.includes(word) || TEENS.includes(word) || /^(?:twenty|thirty)/.test(word),
        )
        .map((word) => ({ file: file.pathname.split("/").pop()!, word }))
    );
  });

  /* Read first: a sweep that matched no sentence would agree with any number in any of them. */
  expect(counted.length).toBeGreaterThan(1);
  expect(counted.filter(({ word }) => word !== inWords(routes.length))).toEqual([]);
});

/**
 * The same for the modules. The readme's count is checked above and was right; the two research
 * notes carry their own, in digits rather than words, and both had stood at thirty-nine since the
 * day they were written.
 */
test("every document that counts the modules counts the modules there are", () => {
  const modules = readdirSync(componentDir).filter(
    (name) => name.endsWith(".tsx") && !name.endsWith(".test.tsx"),
  );

  const counted = documents.flatMap((file) => {
    const text = readFileSync(file, "utf8").toLowerCase().replace(/-\n/g, "-");

    return [...text.matchAll(/\b([a-z-]+|\d+)(?: component)? modules\b/g)]
      .map(([, count]) => count!)
      .filter(
        (count) =>
          /^\d+$/.test(count) ||
          NUMBERS.includes(count) ||
          TEENS.includes(count) ||
          count.includes("-"),
      )
      .map((count) => ({ file: file.pathname.split("/").pop()!, count }));
  });

  const right = new Set([String(modules.length), inWords(modules.length)]);

  expect(counted.length).toBeGreaterThan(2);
  expect(counted.filter(({ count }) => !right.has(count))).toEqual([]);
});

/**
 * A disabled field is a group that is off, and Base UI turns off the form controls it owns — the
 * input, the switch, the checkbox. Anything else inside stays live, and the greyed label says
 * otherwise: the workspace field on the forms page held a button that was fully clickable beside
 * an input that was not.
 *
 * Which tags answer `disabled` is asked of the kit rather than listed here. `variants.test.tsx`
 * asks the same question for a different reason — whether a control that answers it draws
 * anything — so the two agree on what a control is without either one holding a list.
 */
const takesDisabled = new Set(
  Object.entries(kit)
    .filter(([name]) => /^[A-Z]/.test(name))
    .flatMap(([name, value]) => {
      if (typeof value !== "function") return [];

      try {
        const markup = renderToStaticMarkup(createElement(value as never, { disabled: true }));

        /* A native control carries the attribute itself; everything else carries Base UI's. */
        return markup.includes("data-disabled=") || /\sdisabled=""/.test(markup) ? [name] : [];
      } catch {
        return [];
      }
    }),
);

/**
 * And which of them a field turns off by itself. Base UI hands its own form controls the field's
 * state through context, so an input, a switch and the field's own label are already off inside a
 * disabled field — asked by rendering each one in one and counting how many parts come back
 * disabled, rather than by deciding which components look like form controls.
 */
const inheritsDisabled = new Set(
  [...takesDisabled].flatMap((name) => {
    const value = (kit as Record<string, unknown>)[name];

    try {
      const bare = renderToStaticMarkup(createElement(kit.Field, { disabled: true }));
      const held = renderToStaticMarkup(
        createElement(kit.Field, { disabled: true }, createElement(value as never)),
      );
      const count = (markup: string) => markup.split("data-disabled=").length;

      return count(held) > count(bare) ? [name] : [];
    } catch {
      return [];
    }
  }),
);

const liveInsideDisabled = (
  sources: readonly { readonly file: string; readonly source: string }[],
  answers: ReadonlySet<string>,
) =>
  sources
    .flatMap(({ file, source }) =>
      openingTags(source, "Field")
        .filter((tag) => /(?<=\s)disabled(?=[\s/>]|$)|disabled=\{true\}/.test(tag))
        .flatMap((tag) => {
          const opened = source.indexOf(tag) + tag.length;
          const closed = source.indexOf("</Field>", opened);
          const held = source.slice(opened, closed < 0 ? undefined : closed);

          /* A part is written `Field.Label` and exported `FieldLabel`, so the dot is the join. */
          return [...held.matchAll(/<([A-Z][\w.]*)(?=[\s/>])/g)]
            .map(([, name]) => name!)
            .filter((name) => answers.has(name.replaceAll(".", "")))
            .filter(
              (name) =>
                !new RegExp(String.raw`<${name.replace(".", "\\.")}[^>]*\sdisabled[\s/>=]`).test(
                  held,
                ),
            )
            .map((name) => `${file} leaves ${name} live inside a disabled field`);
        }),
    )
    .sort();

test("a live control inside a disabled field is reported", () => {
  const answers = new Set(["Button", "Input"]);
  const live = [
    { file: "p.tsx", source: "<Field disabled>\n<Input />\n<Button>go</Button>\n</Field>" },
  ];
  const off = [
    {
      file: "p.tsx",
      source: "<Field disabled>\n<Input disabled />\n<Button disabled />\n</Field>",
    },
  ];
  const open = [{ file: "p.tsx", source: "<Field>\n<Button>go</Button>\n</Field>" }];

  expect(liveInsideDisabled(live, answers)).toEqual([
    "p.tsx leaves Button live inside a disabled field",
    "p.tsx leaves Input live inside a disabled field",
  ]);
  expect(liveInsideDisabled(off, answers)).toEqual([]);
  expect(liveInsideDisabled(open, answers)).toEqual([]);
});

test("no page leaves a control live inside a field that is off", () => {
  /* Read first: a set that answered nothing would find nothing to be wrong with any page. */
  expect(takesDisabled.has("Button")).toBe(true);
  expect(takesDisabled.has("Input")).toBe(true);
  /* The input takes the field's state and the button does not, which is the whole distinction. */
  expect(inheritsDisabled.has("Input")).toBe(true);
  expect(inheritsDisabled.has("Button")).toBe(false);

  const owed = new Set([...takesDisabled].filter((name) => !inheritsDisabled.has(name)));

  expect(liveInsideDisabled(pages, owed)).toEqual([]);
});

/**
 * The readme says the sheet cuts transform and height transitions under reduced motion and keeps
 * the colour ones, and that the animations a duration cannot govern are switched off by name. Both
 * are claims about a file, and neither was read against it.
 *
 * The named ones are derived rather than listed: an animation driven by a view timeline takes its
 * progress from the scroll position, so clamping `animation-duration` does nothing to it. Every
 * selector in the sheet that carries one has to appear in the reduce block, or it keeps running
 * for a reader who asked for stillness.
 */
const reduceBlock = () => {
  const sheet = readFileSync(new URL("./theme.css", import.meta.url), "utf8");
  const at = sheet.indexOf("@media (prefers-reduced-motion: reduce)");
  if (at < 0) return { block: "", scrolled: [] as string[] };

  /* To the blank line after the block's own closing brace, which is where the next rule starts. */
  const block = sheet.slice(at, sheet.indexOf("\n}\n", sheet.indexOf("*::after", at)) + 3);

  const scrolled = [...sheet.matchAll(/(\.[\w-]+)\s*\{[^}]*animation-timeline:\s*view\(/g)].map(
    ([, selector]) => selector!,
  );

  return { block, scrolled };
};

test("the sheet stills what the readme says it stills", () => {
  const { block, scrolled } = reduceBlock();
  const [, kept] = /transition-property:\s*([^;]+);/.exec(block) ?? [];

  expect(block).toContain("prefers-reduced-motion");
  expect(scrolled).toEqual([".pk-rise"]);

  /* What a reader asked to be spared, kept out of the list the sheet still transitions. */
  const moving = ["transform", "translate", "scale", "rotate", "height", "width", "all"].filter(
    (property) => new RegExp(String.raw`\b${property}\b`).test(kept ?? ""),
  );

  expect(kept).toContain("color");
  expect(moving).toEqual([]);
  expect(scrolled.filter((selector) => !block.includes(selector))).toEqual([]);

  /*
   * Narrowing the list is half of it. Without the two clamps a colour still fades over its full
   * length and a keyframe still runs its course, so the block would read as doing its job while a
   * reader who asked for stillness waited out every one.
   *
   * Read in the built sheet as well as this one: the browser resolves them to
   * `transition-duration: var(--pk-duration-detail)` and `animation-duration: 1ms`, both important,
   * so what the source says here is what ships.
   */
  expect(block).toMatch(/transition-duration:\s*var\(--pk-duration-[a-z]+\)\s*!important/);
  expect(block).toMatch(/animation-duration:\s*1ms\s*!important/);
  expect(block).toMatch(/animation-iteration-count:\s*1\s*!important/);
});

/**
 * The setup the readme teaches, against the manifest that has to serve it. The kit has exactly one
 * consumer — its own lab app, which imports by package name on purpose so the documented path is
 * the one that runs — and nothing tied the two together: a subpath the readme tells a consumer to
 * import and the manifest does not export is a setup that fails on someone else's machine first.
 */
test("every path the readme tells a consumer to import is one the package exports", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  const manifest = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { readonly exports: Record<string, string> };

  const asked = [
    ...new Set(
      [...readme.matchAll(/(?:from|@import)\s+"(polkadot-ui(?:\/[\w./-]+)?)"/g)].map(
        ([, specifier]) => specifier!,
      ),
    ),
  ].sort();

  const offered = new Set(
    Object.keys(manifest.exports).map((key) => key.replace(/^\./, "polkadot-ui")),
  );

  /* Read first: the readme asks for the entry and the stylesheet, or this compares nothing. */
  expect(asked).toContain("polkadot-ui");
  expect(asked).toContain("polkadot-ui/theme.css");
  expect(asked.filter((specifier) => !offered.has(specifier))).toEqual([]);

  /* And every path the manifest offers is a file that is there to serve. */
  const missing = Object.values(manifest.exports).filter(
    (path) => !existsSync(new URL(path, new URL("../", import.meta.url))),
  );

  expect(missing).toEqual([]);
});

/**
 * What a consumer's bundler will try to resolve, against what the manifest promises them. A module
 * under `src` may import a dependency or a peer and nothing else: a development dependency resolves
 * here, where the whole workspace is installed, and is simply absent on the machine that installs
 * the package — the failure lands on someone else and looks like the kit is broken.
 *
 * The pages are exempt because they ship to nobody: the lab app is the one consumer, and it may
 * reach for the router and the test runner the way any application does.
 */
const bareImports = (source: string) =>
  [...source.matchAll(/from "([^".][^"]*)"/g)]
    .map(([, specifier]) => specifier!)
    .filter((specifier) => !specifier.startsWith("."))
    .map((specifier) =>
      specifier.startsWith("@")
        ? specifier.split("/").slice(0, 2).join("/")
        : specifier.split("/")[0]!,
    );

const unpromised = (sources: readonly string[], promised: ReadonlySet<string>): readonly string[] =>
  [
    ...new Set(
      sources
        .flatMap(bareImports)
        .filter((name) => !name.startsWith("node:") && name !== "polkadot-ui")
        .filter((name) => !promised.has(name)),
    ),
  ].sort();

test("an import the manifest does not promise is reported", () => {
  const promised = new Set(["react", "@base-ui/react"]);

  expect(unpromised(['import { useRender } from "@base-ui/react/use-render";'], promised)).toEqual(
    [],
  );
  expect(
    unpromised(['import { createFileRoute } from "@tanstack/react-router";'], promised),
  ).toEqual(["@tanstack/react-router"]);
  /* A relative import is the package's own, and a builtin is everyone's. */
  expect(
    unpromised(
      ['import { tv } from "../tv.ts";\nimport { readFileSync } from "node:fs";'],
      promised,
    ),
  ).toEqual([]);
});

test("a module a consumer loads imports only what the manifest promises", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as {
    readonly dependencies: Record<string, string>;
    readonly peerDependencies: Record<string, string>;
  };

  const promised = new Set([
    ...Object.keys(manifest.dependencies),
    ...Object.keys(manifest.peerDependencies),
  ]);

  const shipped = [
    ...readdirSync(new URL(".", import.meta.url))
      .filter((name) => /\.tsx?$/.test(name) && !name.includes(".test."))
      .map((file) => readFileSync(new URL(file, import.meta.url), "utf8")),
    ...readdirSync(componentDir)
      .filter((name) => /\.tsx?$/.test(name) && !name.includes(".test."))
      .map((file) => readFileSync(new URL(file, componentDir), "utf8")),
  ];

  /* Read first: the modules are read and they do import from outside, or this compares nothing. */
  expect(shipped.length).toBeGreaterThan(40);
  expect(shipped.flatMap(bareImports)).toContain("@base-ui/react");
  expect(unpromised(shipped, promised)).toEqual([]);
});

/**
 * The manifest tells a bundler that nothing but a stylesheet does anything at import time, which
 * is what lets a consumer's build drop what it does not use. A module that reached for the document
 * or registered something at the top level would be dropped along with it, and the bug would appear
 * only in a production build — the hardest kind to find from here.
 *
 * The compound parts are the one statement that is allowed: `Tabs.List = TabsList` hangs a part off
 * a function this module also exports, which is the idiom every compound kit uses.
 */
const PART_ASSIGNMENT = /^[A-Z]\w*\.[A-Z]\w* = [A-Z]\w*;$/;

const atImportTime = (source: string) =>
  source
    .split("\n")
    .filter((line) => /^[a-zA-Z]/.test(line))
    .filter(
      (line) =>
        !/^(?:import|export|const|let|var|function|type|interface|class|declare|enum|async)\b/.test(
          line,
        ),
    )
    .filter((line) => !PART_ASSIGNMENT.test(line.trim()));

test("a module that does something at import time is reported", () => {
  expect(atImportTime("const a = 1;\nTabs.List = TabsList;\nexport { a };")).toEqual([]);
  expect(atImportTime('document.addEventListener("click", go);')).toEqual([
    'document.addEventListener("click", go);',
  ]);
});

test("nothing a consumer loads does anything at import time but hang up its parts", () => {
  const shipped = [
    ...readdirSync(new URL(".", import.meta.url))
      .filter((name) => /\.tsx?$/.test(name) && !name.includes(".test."))
      .map((file) => ({ file, source: readFileSync(new URL(file, import.meta.url), "utf8") })),
    ...readdirSync(componentDir)
      .filter((name) => /\.tsx?$/.test(name) && !name.includes(".test."))
      .map((file) => ({ file, source: readFileSync(new URL(file, componentDir), "utf8") })),
  ];

  const manifest = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as {
    readonly sideEffects: readonly string[];
  };

  /* Read first: the parts are found and allowed, so the sweep is reading real modules. */
  expect(manifest.sideEffects).toEqual(["**/*.css"]);
  expect(
    shipped.some(({ source }) => source.split("\n").some((line) => PART_ASSIGNMENT.test(line))),
  ).toBe(true);

  expect(
    shipped.flatMap(({ file, source }) => atImportTime(source).map((line) => `${file}: ${line}`)),
  ).toEqual([]);
});

/**
 * A ceiling two charts share has to be one both of them fit under. The bars clamp a share at one,
 * so a series that outgrows the ceiling does not overflow or throw — it flattens against the top
 * and keeps drawing, while the section teaching the comparison says one scale.
 *
 * The pages state no total by hand: every figure beside a series is a reduce, a max or an index of
 * that series, so a fixture and its caption cannot disagree. This is the one number that can.
 */
const overCeiling = (
  source: string,
  series: Record<string, readonly number[] | undefined>,
): readonly string[] => {
  const ceilings = new Map(
    [...source.matchAll(/const (\w+) = Math\.max\(\.\.\.(\w+)\)/g)].map(([, name, from]) => [
      name!,
      from!,
    ]),
  );

  return [
    ...source.matchAll(/<Bars\s+values=\{(\w+)\}\s+max=\{(\w+)\}/g),
    ...source.matchAll(/values=\{(\w+)\}\s*\n\s*max=\{(\w+)\}/g),
  ]
    .flatMap(([, drawn, ceiling]) => {
      const under = series[ceilings.get(ceiling!) ?? ""];
      const values = series[drawn!];
      if (!under || !values) return [];

      return Math.max(...values) > Math.max(...under)
        ? [`${drawn} rises past the ceiling ${ceiling} takes from ${ceilings.get(ceiling!)}`]
        : [];
    })
    .sort();
};

test("a series that rises past the ceiling it shares is reported", () => {
  const source =
    "const CEILING = Math.max(...SMALL);\n<Bars values={BIG} max={CEILING} />\n<Bars values={SMALL} max={CEILING} />";
  const series = { BIG: [10, 40], SMALL: [1, 4] };

  expect(overCeiling(source, series)).toEqual([
    "BIG rises past the ceiling CEILING takes from SMALL",
  ]);
  expect(overCeiling(source, { BIG: [1, 2], SMALL: [1, 4] })).toEqual([]);
});

test("every series drawn against a shared ceiling fits under it", () => {
  const readouts = pages.find(({ file }) => file === "routes/readouts.tsx")!.source;
  const series = fixtures as unknown as Record<string, readonly number[] | undefined>;

  /* Read first: the page does share a ceiling, and both series are real. */
  expect(readouts).toContain("max={INSTALL_CEILING}");
  expect(series.INSTALLS?.length).toBeGreaterThan(4);
  expect(series.INSTALLS_SMALL?.length).toBeGreaterThan(4);
  expect(overCeiling(readouts, series)).toEqual([]);
});

/**
 * A props row with nothing but a name draws a name and an empty column beside it. Neither table
 * component can drop a row — both map everything they are given — so this is the slip that is
 * actually available: a row added for a prop whose values or note were never written.
 *
 * `Api` says "no variants" when it has nothing, and that case is `saysNothing` above. This is the
 * hand-written half, where a row can be empty one row at a time.
 */
const silentRows = (sources: readonly { readonly file: string; readonly source: string }[]) =>
  sources
    .flatMap(({ file, source }) =>
      openingTags(source, "Props").flatMap((tag) => {
        const rows = /rows=\{\[([\s\S]*)\]\}/.exec(tag)?.[1] ?? "";

        return [...rows.matchAll(/\{([^{}]*)\}/g)]
          .map(([, body]) => body!)
          .filter((body) => /\bname:\s*"/.test(body))
          .filter((body) => !/\b(?:values|fallback|note):/.test(body))
          .map((body) => `${file}: ${/name:\s*"([^"]+)"/.exec(body)?.[1]} says only its name`);
      }),
    )
    .sort();

test("a props row that says only its name is reported", () => {
  const quiet = [{ file: "p.tsx", source: '<Props<CardProps> rows={[{ name: "tone" }]} />' }];
  const said = [
    { file: "p.tsx", source: '<Props<CardProps> rows={[{ name: "tone", note: "the fill" }]} />' },
  ];

  expect(silentRows(quiet)).toEqual(["p.tsx: tone says only its name"]);
  expect(silentRows(said)).toEqual([]);
});

test("no props row on a page says only its name", () => {
  /* Read first: the sweep reaches the rows, or an empty one would look like a clean page. */
  const counted = pages.flatMap(({ source }) =>
    openingTags(source, "Props").flatMap((tag) => [
      ...(/rows=\{\[([\s\S]*)\]\}/.exec(tag)?.[1] ?? "").matchAll(/\bname:\s*"/g),
    ]),
  );

  expect(counted.length).toBeGreaterThan(50);
  expect(silentRows(pages)).toEqual([]);
});

/** `text.tsx` is listed as its seven roles, which is what a page writes, rather than as a module. */
const LISTED_AS_ITS_PARTS = ["text"];

test("the readme's list of components is the list of components", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8").toLowerCase();
  /*
   * To the next heading rather than to a named one. Ending it at `## the reference` meant any
   * section written between the two fell inside the list, and the run of names then swallowed the
   * prose after it — the last one stopped being a name of its own while the guards below still
   * passed.
   */
  const from = readme.indexOf("## components");
  const section = readme.slice(from, readme.indexOf("\n## ", from + 1));

  const listed = new Set(
    [...section.matchAll(/\*\*[a-z\s]+\*\*([^*]+)/g)].flatMap(([, items]) =>
      items!
        .replace(/\s+/g, " ")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

  const modules = readdirSync(componentDir)
    .filter((name) => name.endsWith(".tsx") && !name.endsWith(".test.tsx"))
    .map((name) => name.replace(/\.tsx$/, "").replaceAll("-", " "));

  /* Read first: a section that parsed to nothing would report every module the kit has. */
  expect(listed.has("toggle group")).toBe(true);
  expect(listed.has("status dot")).toBe(true);
  expect(modules.length).toBeGreaterThan(30);
  expect(modules.filter((name) => !listed.has(name))).toEqual(LISTED_AS_ITS_PARTS);
});

/**
 * The readme quotes two components' `tv` blocks to show the rule they follow. A quotation goes
 * stale silently: the terminal's grew two slots and half a variant while the readme kept the old
 * one, which left it printing a `running` variant that styled a `text` slot the same block never
 * declared — tailwind-variants code that could not run.
 *
 * Compared with the spacing taken out, because the readme wraps a short object onto one line where
 * the source spreads it, and that is formatting rather than a difference.
 */
const asOneLine = (block: string) =>
  block
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:,])\s*/g, "$1")
    /* A comma before a brace is there because the line wrapped, so it is spacing as well. */
    .replace(/,(?=\})/g, "")
    .trim();

/** Each quoted block, against the component the comment above it names, path and all. */
const quotedBlocks = (document: string) =>
  [
    ...document.matchAll(
      /\/\/ (?:[\w./-]*\/)?([a-z-]+\.tsx)[^\n]*\n(const \w+ = tv\(\{[\s\S]*?\n\}\);)/g,
    ),
  ].map(([, file, block]) => ({ file: file!, block: block! }));

const misquoted = (document: string, read: (file: string) => string) =>
  quotedBlocks(document).flatMap(({ file, block }) => {
    const source = read(file);
    const [written] = /const \w+ = tv\(\{[\s\S]*?\}\);/.exec(source) ?? [];

    if (!written) return [`${file} has no tv block to quote`];

    return asOneLine(written) === asOneLine(block) ? [] : [`${file} is quoted as it no longer is`];
  });

test("a readme quotation that no longer matches its component is reported", () => {
  const quoted = '```tsx\n// a.tsx — one\nconst a = tv({\n  base: "flex",\n});\n```';

  /* The fixture is read first, because a pattern that matched nothing would pass every case. */
  expect(quotedBlocks(quoted).map(({ file }) => file)).toEqual(["a.tsx"]);
  expect(misquoted(quoted, () => 'const a = tv({\n  base: "flex",\n});')).toEqual([]);
  /* The same block, wrapped differently, is the same block. */
  expect(misquoted(quoted, () => 'const a = tv({ base: "flex" });')).toEqual([]);
  expect(misquoted(quoted, () => 'const a = tv({\n  base: "grid",\n});')).toEqual([
    "a.tsx is quoted as it no longer is",
  ]);
  expect(misquoted(quoted, () => "const a = 1;")).toEqual(["a.tsx has no tv block to quote"]);
});

/**
 * `Api` reads a `tv` object and prints its variants. Given one with none — or one whose every
 * variant is excepted — it prints the words "no variants" instead, which a reader sees.
 *
 * Forty components have no variants and no table, so a table saying so is out of step with the
 * page around it as well as empty. Four went up in one sitting before anyone read the page.
 */
const saysNothing = (
  sources: readonly { readonly file: string; readonly source: string }[],
  variantsOf: (name: string) => readonly string[],
) =>
  sources
    .flatMap(({ file, source }) =>
      openingTags(source, "Api").map((tag) => {
        const of = /of=\{(\w+)\}/.exec(tag)?.[1] ?? "";
        const except = [
          ...(/except=\{\[([^\]]*)\]\}/.exec(tag)?.[1] ?? "").matchAll(/"(\w+)"/g),
        ].map(([, key]) => key!);

        return { file, of, shown: variantsOf(of).filter((key) => !except.includes(key)) };
      }),
    )
    .filter(({ shown }) => shown.length === 0)
    .map(({ file, of }) => `${file} tables ${of}, which has nothing to list`)
    .sort();

test("a variant table with nothing to list is reported", () => {
  const page = [
    {
      file: "p.tsx",
      source: '<Api name="a" of={aVariants} />\n<Api of={bVariants} except={["checked"]} />',
    },
  ];
  const variants = (name: string) => (name === "aVariants" ? ["tone"] : ["checked"]);

  expect(saysNothing(page, variants)).toEqual([
    "p.tsx tables bVariants, which has nothing to list",
  ]);
  expect(saysNothing(page, () => ["tone", "checked"])).toEqual([]);
});

test("no page shows a variant table that has nothing to list", () => {
  const variantsOf = (name: string) => {
    const file = readdirSync(componentDir).find(
      (candidate) =>
        candidate.endsWith(".tsx") &&
        new RegExp(String.raw`\bas ${name}\b`).test(
          readFileSync(new URL(candidate, componentDir), "utf8"),
        ),
    );
    if (!file) return [];

    const source = readFileSync(new URL(file, componentDir), "utf8");
    const block = /const \w+ = tv\(\{[\s\S]*?\n\}\);/.exec(source)?.[0] ?? "";
    const listed = /\n {2}variants: \{([\s\S]*?)\n {2}\},/.exec(block)?.[1] ?? "";

    return [...listed.matchAll(/^ {4}(\w+): \{/gm)].map(([, key]) => key!);
  };

  /* Read first: a lookup that found no variants for anything would report every table on the page. */
  expect(variantsOf("buttonVariants")).toEqual(["tone", "size"]);
  expect(variantsOf("selectVariants")).toEqual([]);
  expect(saysNothing(pages, variantsOf)).toEqual([]);
});

/**
 * The table prints every value of every variant it lists, so a value no page draws is a promise
 * the showcase does not keep: the reader is told a tone exists and never sees one.
 *
 * A default is drawn by any tag that leaves the prop out, which is how most of them are seen, so
 * the omission counts. A default that every tag overrides does not: it is printed as the one in
 * force and appears nowhere.
 */
interface Tabled {
  readonly variants?: Record<string, Record<string, unknown>>;
  readonly defaultVariants?: Record<string, unknown>;
}

/**
 * Which tags a page writes for the parts a `tv` object dresses. The name of the object does not
 * give them: `radioVariants` dresses `<RadioGroup>`, and `receiptVariants` dresses four parts of a
 * receipt written as `<Receipt.Line>`. The file exporting the object exports the parts as well, so
 * the tags are read from there rather than derived from the name — derived, the sweep called nine
 * drawn values undrawn.
 */
const tagsOwning = new Map<string, readonly string[]>();

/**
 * A key the component works out for itself when the prop is left off — `head ?? sparklineHead(…)`.
 * The page draws whichever value the data produces and writes none of them, so a demonstration
 * cannot be asked for by name. Read from the call rather than assumed: the sweep called the badge
 * and the empty head undrawn while the readouts page drew both.
 */
const computedKeys = new Map<string, ReadonlySet<string>>();

for (const file of readdirSync(componentDir).filter((name) => name.endsWith(".tsx"))) {
  const source = readFileSync(new URL(file, componentDir), "utf8");
  const exported = [...source.matchAll(/^export \{([\s\S]*?)\};$/gm)]
    .flatMap(([, list]) => list!.split(","))
    .map((part) => part.trim().split(/\s+as\s+/));

  const parts = exported
    .map(([name]) => name!)
    .filter((name) => /^[A-Z]/.test(name) && !name.endsWith("Variants"))
    .flatMap(tagNamesFor);

  /*
   * Handed straight to the call, `head: head ?? sparklineHead(…)`, or resolved once into a name
   * first and handed over as that — `const marked = head ?? …` and then `head: marked`, which is
   * what a component does when the same answer decides the drawing and the name. Reading only the
   * first shape made a refactor look like a key that stopped being computed.
   */
  const direct = [...source.matchAll(/(\w+):\s*\1\s*\?\?/g)].map(([, key]) => key!);
  const named = [...source.matchAll(/const (\w+) = (\w+) \?\?/g)]
    .filter(([, alias, key]) => new RegExp(String.raw`\b${key!}:\s*${alias!}\b`).test(source))
    .map(([, , key]) => key!);

  const computed = new Set([...direct, ...named]);

  for (const [, alias] of exported) {
    if (!alias?.endsWith("Variants")) continue;

    tagsOwning.set(alias, parts);
    computedKeys.set(alias, computed);
  }
}

const undrawnValues = (
  sources: readonly { readonly file: string; readonly source: string }[],
  everySource: string,
  describes: (name: string) =>
    | {
        readonly config: Tabled;
        readonly tags: readonly string[];
        readonly computed?: ReadonlySet<string>;
      }
    | undefined,
) =>
  sources
    .flatMap(({ file, source }) =>
      openingTags(source, "Api").flatMap((tag) => {
        const of = /of=\{(\w+)\}/.exec(tag)?.[1];
        const described = of ? describes(of) : undefined;
        const variants = described?.config.variants;
        if (!of || !described || !variants) return [];

        const except = [
          ...(/except=\{\[([^\]]*)\]\}/.exec(tag)?.[1] ?? "").matchAll(/"(\w+)"/g),
        ].map(([, key]) => key!);

        const written = described.tags.flatMap((name) => openingTags(everySource, name));

        return Object.entries(variants)
          .filter(([key]) => !except.includes(key) && !described.computed?.has(key))
          .flatMap(([key, values]) => {
            const passed = written.flatMap((one) =>
              [
                ...one.matchAll(new RegExp(String.raw`\b${key}=(?:"([^"]*)"|\{([^}]*)\})`, "g")),
              ].map(([, quoted, braced]) => ({ quoted, braced: braced?.trim() })),
            );

            /*
             * A boolean is usually written bare, and a value out of a map arrives under a name.
             * The tag ends at its `>`, so a bare prop written last is at the end of the string:
             * `<Terminal.Command running` was read as a terminal that never runs.
             */
            const bare = written.some((one) =>
              new RegExp(String.raw`(?<=\s)${key}(?=[\s/>]|$)`).test(one),
            );
            const given = passed.flatMap(({ quoted, braced }) => [quoted ?? braced!]);
            const fromData = passed.some(
              ({ braced }) =>
                braced !== undefined &&
                /^[A-Za-z_$][\w$]*$/.test(braced) &&
                !/^(?:true|false)$/.test(braced),
            );
            const omitted = written.some((one) => !new RegExp(String.raw`\b${key}\b`).test(one));

            const drawn = (value: string) =>
              fromData ||
              given.includes(value) ||
              (bare && value === "true") ||
              (String(described.config.defaultVariants?.[key]) === value && omitted);

            return Object.keys(values)
              .filter((value) => !drawn(value))
              .map((value) => `${file} tables ${of} ${key}=${value}, which no page draws`);
          });
      }),
    )
    .sort();

test("a tabled value that no page draws is reported", () => {
  const config: Tabled = {
    variants: { tone: { plain: 0, loud: 0 }, lifted: { true: 0, false: 0 } },
    defaultVariants: { tone: "plain" },
  };
  const describes = (name: string) =>
    name === "cardVariants" ? { config, tags: ["Card"] } : undefined;
  const page = (body: string) => [{ file: "p.tsx", source: `<Api of={cardVariants} />\n${body}` }];

  const all = page('<Card />\n<Card tone="loud" />\n<Card lifted />\n<Card lifted={false} />');

  expect(undrawnValues(all, all[0]!.source, describes)).toEqual([]);

  const quiet = page("<Card />");

  expect(undrawnValues(quiet, quiet[0]!.source, describes)).toEqual([
    "p.tsx tables cardVariants lifted=false, which no page draws",
    "p.tsx tables cardVariants lifted=true, which no page draws",
    "p.tsx tables cardVariants tone=loud, which no page draws",
  ]);

  /* The default is drawn by a tag that leaves it out, and by nothing else. */
  const always = page('<Card tone="loud" lifted />\n<Card tone="plain" lifted={false} />');

  expect(undrawnValues(always, always[0]!.source, describes)).toEqual([]);

  const overridden = page('<Card tone="loud" lifted />\n<Card tone="loud" lifted={false} />');

  expect(undrawnValues(overridden, overridden[0]!.source, describes)).toEqual([
    "p.tsx tables cardVariants tone=plain, which no page draws",
  ]);

  /* A value out of a map is written as a name, and the map is what draws the whole set. */
  const mapped = page("<Card tone={tone} lifted={lifted} />");

  expect(undrawnValues(mapped, mapped[0]!.source, describes)).toEqual([]);

  /* A key the table excepts is not a promise, so its values are not owed a drawing. */
  const excepted = [
    {
      file: "p.tsx",
      source: '<Api of={cardVariants} except={["lifted"]} />\n<Card tone="loud" />',
    },
  ];

  expect(undrawnValues(excepted, excepted[0]!.source, describes)).toEqual([
    "p.tsx tables cardVariants tone=plain, which no page draws",
  ]);

  /* A key the component works out for itself cannot be asked for by name either. */
  const works = (name: string) =>
    name === "cardVariants"
      ? { config, tags: ["Card"], computed: new Set(["tone", "lifted"]) }
      : undefined;

  expect(undrawnValues(quiet, quiet[0]!.source, works)).toEqual([]);
});

test("every value a variant table prints is one the pages draw", () => {
  const describes = (name: string) => {
    const config = (kit as Record<string, Tabled | undefined>)[name];
    const tags = tagsOwning.get(name);

    return config && tags ? { config, tags, computed: computedKeys.get(name) } : undefined;
  };

  /* Read first: a lookup that found no tags would call every value undrawn. */
  expect(describes("radioVariants")?.tags).toContain("RadioGroup");
  expect(describes("receiptVariants")?.tags).toContain("Receipt\\.Line");
  expect([...(describes("sparklineVariants")?.computed ?? [])]).toEqual(["head"]);
  expect(undrawnValues(pages, everything, describes)).toEqual([]);
});

/*
 * The size each type row states is `theme.test.ts`, which reads the role's token out of `text.tsx`
 * and the size out of the sheet. A second copy of it lived here for part of a morning.
 */

test("every component a document quotes is quoted as it is", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  const design = readFileSync(new URL("../docs/design/widget.md", import.meta.url), "utf8");
  const read = (file: string) => readFileSync(new URL(file, componentDir), "utf8");

  expect(quotedBlocks(readme).map(({ file }) => file)).toEqual(["badge.tsx", "terminal.tsx"]);
  /* The design note writes the path out, and quoted three of the seven roles for a while. */
  expect(quotedBlocks(design).map(({ file }) => file)).toEqual(["text.tsx"]);
  expect(misquoted(readme, read)).toEqual([]);
  expect(misquoted(design, read)).toEqual([]);
});

/**
 * What each component falls back to when a prop is left out, read from the defaults it destructures.
 * Only the kit's own; the primitive's are read below and laid under these, since a wrapper that
 * settles a prop itself is what a page sees.
 */
const fallsBackTo = new Map<string, ReadonlyMap<string, string>>();

for (const file of readdirSync(componentDir).filter((name) => name.endsWith(".tsx"))) {
  const source = readFileSync(new URL(file, componentDir), "utf8");

  /*
   * A default may be a named constant rather than a literal, and that is the one most likely to
   * drift: change the numbers and the page still prints the old ones. Look it up in the same file
   * and compare the numbers, so `DEFAULT_THRESHOLDS` reads as the `1 · 3 · 6 · 10` a page prints.
   */
  const resolve = (value: string) => {
    if (!/^[A-Z_]+$/.test(value)) return value.replace(/^"|"$/g, "");

    const list = new RegExp(String.raw`const ${value}[^=]*= \[([^\]]*)\]`).exec(source);

    if (list) {
      return list[1]!
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .join(" · ");
    }

    /* A scalar constant is the same idea and drifts the same way: `DEFAULT_CELL` is one source for
     * a size the signature takes and a page prints. */
    const scalar = new RegExp(
      String.raw`const ${value}[^=]*= ("[^"]*"|-?\d+(?:\.\d+)?|true|false);`,
    ).exec(source);

    return scalar ? scalar[1]!.replace(/^"|"$/g, "") : value;
  };

  for (const [, owner, body] of source.matchAll(/function (\w+)\(\{([\s\S]*?)\}:/g)) {
    /*
     * Delimited by the destructure rather than by the line. Anchored to a line, a signature
     * written on one — `{ parts, showLegend = true, label }` — settled nothing this could read,
     * so a documented default went unchecked while the rule reported that it agreed.
     */
    const defaults = [
      ...body!.matchAll(/(\w+) = ("[^"]*"|[A-Z][A-Z_]+|-?\d+(?:\.\d+)?|true|false)\s*(?=[,}])/g),
    ].map(([, prop, value]) => [prop!, resolve(value!)] as const);

    fallsBackTo.set(`${owner!}Props`, new Map(defaults));
  }
}

/**
 * What Base UI settles for a prop this kit passes straight through. Its types write each one as
 * `@default`, so they can be read after all — thirty of the fifty-eight defaults the pages state
 * are its rather than this kit's, and the note above said they were beyond reach.
 *
 * The mapping is the kit's own declaration. `export type MenuProps = MenuPrimitive.Root.Props`
 * says which part backs a kit type, and a composed one names every part it draws from, so
 * `MenuContentProps` reads the popup and the positioner together. A kit signature still wins:
 * a wrapper that settles `sideOffset` itself is what a page actually sees.
 */
const primitiveDir = new URL("../node_modules/@base-ui/react/esm/", import.meta.url);

const pascal = (module: string) =>
  module.replace(/(?:^|-)([a-z])/g, (_, letter: string) => letter.toUpperCase());

const primitiveDefaults = new Map<string, ReadonlyMap<string, string>>();

/**
 * A part need not declare the prop it documents. `AccordionPanelProps` has an empty body and takes
 * `hiddenUntilFound` and `keepMounted` through `Pick<AccordionRoot.Props, …>`, which is where the
 * `@default` for each of them sits — so what a part inherits is followed, not only what it writes.
 */
/** What a part's interface is read for: the default it documents, or the type it declares. */
const harvest = {
  default: (body: string) =>
    [...body.matchAll(/@default ([^\n*]+?)\s*\n\s*\*\/\s*(\w+)\??:/g)].map(
      ([, value, prop]) => [prop!, value!.replace(/^'|'$/g, "")] as const,
    ),
  type: (body: string) =>
    [...body.matchAll(/^ {2}(\w+)\??: ([^;\n]+) \| undefined;/gm)].map(
      ([, prop, written]) => [prop!, written!.trim()] as const,
    ),
} as const;

/**
 * Every interface Base UI declares, by name, with what it inherits and what it writes. Indexed by
 * name rather than by folder because a part's props need not live under it: the popover's
 * positioner takes `side` and `align` from `UseAnchorPositioningSharedParameters` over in `utils`,
 * and the tooltip's redeclares `side` to give it a tooltip's default. Reading the folder found the
 * tooltip and missed the popover.
 *
 * The body is taken by counting braces rather than by matching to a line, because
 * `PopoverPositionerProps` closes as `{}` on the line it opens, and a pattern reaching for the next
 * unindented brace ran past it into the next declaration.
 */
const declaredInterfaces = new Map<string, { inherits: string; body: string }>();

const indexInterfaces = (dir: URL) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      indexInterfaces(new URL(`${entry.name}/`, dir));
      continue;
    }
    if (!entry.name.endsWith(".d.ts")) continue;

    const text = readFileSync(new URL(entry.name, dir), "utf8");

    for (const opened of text.matchAll(/export interface (\w+)([^{]*)\{/g)) {
      const from = opened.index + opened[0].length;
      let depth = 1;
      let at = from;

      while (at < text.length && depth > 0) {
        if (text[at] === "{") depth += 1;
        else if (text[at] === "}") depth -= 1;
        at += 1;
      }

      declaredInterfaces.set(opened[1]!, { inherits: opened[2]!, body: text.slice(from, at - 1) });
    }
  }
};

indexInterfaces(primitiveDir);

const defaultsIn = (
  declaration: string,
  reading: keyof typeof harvest = "default",
  seen: ReadonlySet<string> = new Set(),
): ReadonlyMap<string, string> => {
  const key = `${declaration}.${reading}`;
  const known = primitiveDefaults.get(key);
  if (known) return known;
  if (seen.has(key)) return new Map();

  const found = new Map<string, string>();
  const declared = declaredInterfaces.get(declaration);
  if (declared === undefined) return found;

  const deeper = new Set([...seen, key]);

  /* `Pick` keeps the names it lists and `Omit` drops them; a bare name brings everything it has. */
  for (const [, kind, from, listed] of declared.inherits.matchAll(
    /(Pick|Omit)<(\w+(?:\.Props)?),\s*([^>]+)>/g,
  )) {
    const named = new Set([...listed!.matchAll(/'([^']+)'/g)].map(([, one]) => one!));

    for (const [prop, value] of defaultsIn(from!.replace(/\.Props$/, "Props"), reading, deeper)) {
      if (kind === "Pick" ? named.has(prop) : !named.has(prop)) found.set(prop, value);
    }
  }

  for (const [, bare] of declared.inherits.matchAll(/\b(\w+)\b(?!\s*[<.])/g)) {
    if (bare === declaration || !declaredInterfaces.has(bare!)) continue;

    for (const [prop, value] of defaultsIn(bare!, reading, deeper)) found.set(prop, value);
  }

  /* Last, so a part that redeclares an inherited prop is the one that counts. */
  for (const [prop, value] of harvest[reading](declared.body)) found.set(prop, value);

  primitiveDefaults.set(key, found);
  return found;
};

const settledByPart = (module: string, part: string) => defaultsIn(`${pascal(module)}${part}Props`);

const partsBehind = new Map<string, readonly { module: string; part: string }[]>();

for (const file of readdirSync(componentDir).filter((name) => name.endsWith(".tsx"))) {
  const source = componentSource(file);
  const imported = new Map(
    [...source.matchAll(/import \{ \w+ as (\w+) \} from "@base-ui\/react\/([\w-]+)"/g)].map(
      ([, alias, module]) => [alias!, module!] as const,
    ),
  );

  /* Either shape says the same thing: `Field` writes an interface because it adds a `className`. */
  const declarations = [
    ...source.matchAll(/export type (\w+Props) =([^;]*);/g),
    ...source.matchAll(/export interface (\w+Props)\s+extends([^{]*)\{/g),
  ];

  for (const [, owner, declared] of declarations) {
    const parts = [...declared!.matchAll(/(\w+)\.(\w+)\.Props/g)].flatMap(([, alias, part]) => {
      const module = imported.get(alias!);

      return module ? [{ module, part: part! }] : [];
    });

    if (parts.length > 0) partsBehind.set(owner!, parts);
  }
}

/** The primitive's defaults under this kit's own, which override them where a wrapper settles one. */
const settlesOn = new Map<string, ReadonlyMap<string, string>>(fallsBackTo);

for (const [type, parts] of partsBehind) {
  const merged = new Map<string, string>();

  for (const { module, part } of parts) {
    for (const [prop, value] of settledByPart(module, part)) merged.set(prop, value);
  }
  for (const [prop, value] of fallsBackTo.get(type) ?? []) merged.set(prop, value);

  settlesOn.set(type, merged);
}

/**
 * Every closed union Base UI names, by name. Fifteen of them, and no two share a name with
 * different members, so a prop typed `Side` or `TabsRoot.Orientation` resolves on the last segment
 * without following an import.
 */
const namedUnions = new Map<string, readonly string[]>();

const collectUnions = (dir: URL) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      collectUnions(new URL(`${entry.name}/`, dir));
      continue;
    }
    if (!entry.name.endsWith(".d.ts")) continue;

    for (const [, named, members] of readFileSync(new URL(entry.name, dir), "utf8").matchAll(
      /export type (\w+) = ((?:'[^']*'\s*\|\s*)+'[^']*');/g,
    )) {
      namedUnions.set(named!, [...members!.matchAll(/'([^']*)'/g)].map(([, one]) => one!).sort());
    }
  }
};

collectUnions(primitiveDir);

/** A union this kit writes out itself, rather than taking one from the primitive under it. */
const ownUnions = new Map<string, readonly string[]>();

for (const file of readdirSync(componentDir).filter((name) => name.endsWith(".tsx"))) {
  for (const [, owner, body] of componentSource(file).matchAll(
    /export (?:type|interface) (\w+Props)\b([\s\S]*?)(?=\nexport |\nfunction |$)/g,
  )) {
    for (const [, prop, members] of body!.matchAll(
      /readonly (\w+)\??:\s*((?:"[^"]*"\s*\|\s*)+"[^"]*")/g,
    )) {
      ownUnions.set(
        `${owner!}.${prop!}`,
        [...members!.matchAll(/"([^"]*)"/g)].map(([, one]) => one!).sort(),
      );
    }
  }
}

/**
 * A prop names its union or writes it out. `side?: Side` is a name to look up; `trackCursorAxis?:
 * 'none' | 'x' | 'y' | 'both'` is the union itself, and `modal?: boolean | 'trap-focus'` is one
 * with `boolean` standing for its own two values, which is how a table prints it.
 *
 * A member that is neither a literal nor `boolean` — a `number`, a function — leaves the whole
 * thing unresolved rather than half read.
 */
const membersOf = (written: string): readonly string[] | undefined => {
  if (/^[\w.]+$/.test(written)) return namedUnions.get(written.split(".").at(-1)!);
  if (!written.includes("'")) return undefined;

  const members = written.split("|").flatMap((one) => {
    const part = one.trim();
    if (part === "boolean") return ["true", "false"];

    return /^'[^']*'$/.test(part) ? [part.slice(1, -1)] : [""];
  });

  return members.includes("") ? undefined : members.sort();
};

const unionFor = (type: string, prop: string): readonly string[] | undefined => {
  const own = ownUnions.get(`${type}.${prop}`);
  if (own) return own;

  for (const { module, part } of partsBehind.get(type) ?? []) {
    const written = defaultsIn(`${pascal(module)}${part}Props`, "type").get(prop);
    const members = written === undefined ? undefined : membersOf(written);

    if (members) return members;
  }

  return undefined;
};

const misstatedDefault = (
  sources: readonly { readonly file: string; readonly source: string }[],
  defaults: ReadonlyMap<string, ReadonlyMap<string, string>>,
) =>
  sources
    .flatMap(({ file, source }) =>
      openingTags(source, "Props").flatMap((tag) => {
        const [, type] = /<Props<(\w+Props)>/.exec(tag) ?? [];
        const known = type ? defaults.get(type) : undefined;
        if (!known) return [];

        return [...tag.matchAll(/\{\s*name: "(\w+)",\s*fallback: "([^"]*)"/g)]
          .map(([, prop, stated]) => ({ prop: prop!, stated: stated!, real: known.get(prop!) }))
          .filter(({ stated, real }) => real !== undefined && real !== stated)
          .map(
            ({ prop, stated, real }) =>
              `${type}.${prop} says ${stated}, the code uses ${real} (${file})`,
          );
      }),
    )
    .sort();

test("a stated default that is not the one the code uses is reported", () => {
  const defaults = new Map([["TickerProps", new Map([["pad", "0"]])]]);
  const right = [
    { file: "p.tsx", source: '<Props<TickerProps> rows={[{ name: "pad", fallback: "0" }]} />' },
  ];
  const wrong = [
    { file: "p.tsx", source: '<Props<TickerProps> rows={[{ name: "pad", fallback: "4" }]} />' },
  ];

  expect(misstatedDefault(right, defaults)).toEqual([]);
  expect(misstatedDefault(wrong, defaults)).toEqual([
    "TickerProps.pad says 4, the code uses 0 (p.tsx)",
  ]);
  /* A prop the code gives no default is Base UI's, and this says nothing about it. */
  expect(misstatedDefault(wrong, new Map([["TickerProps", new Map()]]))).toEqual([]);
});

test("every default a page states is the one the component falls back to", () => {
  expect(fallsBackTo.get("NumberTickerProps")?.get("pad")).toBe("0");
  /* A signature written on one line is still a signature: `Breakdown` settles `showLegend` on it. */
  expect(fallsBackTo.get("BreakdownProps")?.get("showLegend")).toBe("true");
  const stated = pages.flatMap(({ source }) =>
    openingTags(source, "Props").flatMap((tag) => {
      const [, type] = /<Props<(\w+Props)>/.exec(tag) ?? [];

      return [...tag.matchAll(/\{\s*name: "(\w+)",\s*fallback: "[^"]*"/g)].map(([, prop]) => ({
        named: `${type}.${prop}`,
        weighed: settlesOn.get(type ?? "")?.has(prop!) === true,
      }));
    }),
  );

  /*
   * 55 of the 58 defaults the pages state are weighed: 28 this kit settles in its own signature,
   * the rest read from the primitive behind it. The three left over are named rather than counted,
   * so a new one that slips out of reach fails here instead of quietly lowering the total.
   *
   * Both sizes come from `buttonVariants.defaultVariants`, which the union rule above already
   * weighs. The bars' `max` is prose for a default the component works out from the data it is
   * given, which is what a `fallback` being a string is for.
   */
  const unweighed = stated
    .filter(({ weighed }) => !weighed)
    .map(({ named }) => named)
    .sort();

  expect(unweighed).toEqual([
    "BarsProps.max",
    "PopoverTriggerProps.size",
    "ToolbarButtonProps.size",
  ]);

  /*
   * Two of those three are a `tv` variant the union rule weighs against `buttonVariants`, so one
   * row is left that nothing weighs at all. The readme says which it is and why, so the claim and
   * the remainder move together rather than the prose going quietly stale.
   */
  const owned = ["PopoverTriggerProps.size", "ToolbarButtonProps.size"];

  expect(unweighed.filter((named) => !owned.includes(named))).toEqual(["BarsProps.max"]);
  expect(readFileSync(new URL("../README.md", import.meta.url), "utf8")).toContain(
    "the bars' `max` falls back to",
  );
  expect(stated.length).toBeGreaterThan(55);
  expect(misstatedDefault(pages, settlesOn)).toEqual([]);
});

/*
 * Whether every exported component is drawn on a page belongs to `index.test.ts`, which asked it
 * first and reads the same `Tabs.Tab = Tab` mappings to do it. A second copy lived here for one
 * commit before that file was read.
 */

/**
 * A variant is not always a prop. A toggle's `pressed` and a switch's `checked` are filled from the
 * state Base UI hands to `className`, so a consumer cannot write them — and a table read off the
 * `tv` object cannot tell the difference. `Api` takes `except` for exactly this, and nothing made
 * sure it was used: a state key left in is a table offering a prop that does not exist, and a
 * misspelt `except` entry is silently ignored.
 */
const stateDriven = new Map<string, ReadonlySet<string>>();

for (const file of readdirSync(componentDir).filter((name) => name.endsWith(".tsx"))) {
  const source = readFileSync(new URL(file, componentDir), "utf8");
  const [, exported] = /\bas (\w+Variants)\b/.exec(source) ?? [];
  if (!exported) continue;

  /*
   * A key filled from Base UI's state, and a key no function in the file takes: the grid works its
   * own tone out of the counts and the deck holds `held` itself, so neither reaches the tv object
   * from a prop either. Both are the same thing to a reader — a row offering something to pass.
   */
  const fromState = [...source.matchAll(/\b(\w+): state\.\w+/g)].map(([, key]) => key!);
  /* The type parameters of a generic component sit between its name and its props. */
  const taken = new Set(
    [...source.matchAll(/function \w+(?:<[^>]*>)?\(\{([\s\S]*?)\}:/g)]
      .flatMap(([, params]) => [...params!.matchAll(/(?:^|,)\s*(\w+)/g)])
      .map(([, name]) => name!),
  );

  const declared = Object.keys(
    ((kit as Record<string, Tabled | undefined>)[exported] ?? {}).variants ?? {},
  );
  const keys = [...fromState, ...declared.filter((key) => !taken.has(key))];

  if (keys.length > 0) stateDriven.set(exported, new Set(keys));
}

const stateShownAsProp = (
  sources: readonly { readonly file: string; readonly source: string }[],
  fromState: ReadonlyMap<string, ReadonlySet<string>>,
) =>
  sources
    .flatMap(({ file, source }) =>
      openingTags(source, "Api").flatMap((tag) => {
        const [, owner] = /\bof=\{(\w+)\}/.exec(tag) ?? [];
        const keys = owner ? fromState.get(owner) : undefined;
        if (!keys) return [];

        const excepted = new Set(
          [...tag.matchAll(/except=\{\[([^\]]*)\]\}/g)].flatMap(([, list]) =>
            [...list!.matchAll(/"([^"]+)"/g)].map(([, name]) => name!),
          ),
        );

        return [...keys]
          .filter((key) => !excepted.has(key))
          .map((key) => `${owner} lists ${key}, which comes from state, not a prop (${file})`);
      }),
    )
    .sort();

test("a state variant left in a table is reported", () => {
  const fromState = new Map([["toggleVariants", new Set(["pressed"])]]);
  const bare = [{ file: "p.tsx", source: "<Api name='t' of={toggleVariants} />" }];
  const excepted = [
    { file: "p.tsx", source: '<Api name="t" of={toggleVariants} except={["pressed"]} />' },
  ];

  expect(stateShownAsProp(bare, fromState)).toEqual([
    "toggleVariants lists pressed, which comes from state, not a prop (p.tsx)",
  ]);
  expect(stateShownAsProp(excepted, fromState)).toEqual([]);
  /* A misspelt entry excepts nothing, which is the failure the rule exists to catch. */
  expect(
    stateShownAsProp(
      [{ file: "p.tsx", source: '<Api of={toggleVariants} except={["presed"]} />' }],
      fromState,
    ),
  ).toEqual(["toggleVariants lists pressed, which comes from state, not a prop (p.tsx)"]);
});

test("no variant table offers a prop that comes from state", () => {
  expect(stateDriven.get("toggleGroupVariants")).toEqual(new Set(["pressed"]));
  expect(stateDriven.get("switchVariants")).toEqual(new Set(["checked"]));
  expect(stateShownAsProp(pages, stateDriven)).toEqual([]);
});

test("every affordance the kit adds is one the pages pass", () => {
  const named = pages.flatMap(({ source }) => documented(source));

  expect(named.length).toBeGreaterThan(40);
  expect(kitDeclares.size).toBeGreaterThan(40);
  expect(undemonstrated(pages, everything, kitDeclares)).toEqual([]);
});

/**
 * A legend names every band of its scale, so a plot that never reaches the top one shows a colour
 * that stands for nothing. Both grids drew four of five: the fixture's busy season sat outside the
 * half year a grid shows, and that window is measured back from today, so it could not return.
 */
const BANDS = 5;

/** What a prop is given, as written, or nothing when the tag leaves it out. */
const givenAs = (tag: string, prop: string) =>
  new RegExp(String.raw`\b${prop}=\{([^}]*)\}`).exec(tag)?.[1]?.trim();

/** A count written on the tag, or the page constant it names. */
const countOn = (page: string, written: string | undefined) => {
  if (written === undefined) return undefined;
  if (/^\d+$/.test(written)) return Number(written);

  return Number(new RegExp(String.raw`\b${written}\s*=\s*(\d+)`).exec(page)?.[1] ?? Number.NaN);
};

/** The fixtures hold series, lists and single numbers, and only a series of counts can be read. */
const isSeries = (value: unknown): value is readonly { readonly count: number }[] =>
  Array.isArray(value) && value.every((day) => typeof (day as ActivityDay)?.count === "number");

const unreachableBand = (
  sources: readonly { readonly file: string; readonly source: string }[],
  series: Readonly<Record<string, unknown>>,
) =>
  sources.flatMap(({ file, source }) =>
    openingTags(source, "ActivityGrid").flatMap((tag) => {
      const name = givenAs(tag, "days") ?? "";
      const days = series[name];
      const weeks = countOn(source, givenAs(tag, "weeks"));
      const bounds = givenAs(tag, "thresholds")?.match(/\d+/g)?.map(Number);

      if (!isSeries(days) || !weeks || Number.isNaN(weeks)) {
        return [`${file} ${name}: nothing to count`];
      }

      const reached = new Set(
        days.slice(-weeks * 7).map((day) => activityLevel(day.count, bounds)),
      );

      return reached.size === BANDS ? [] : [`${file} ${name}: ${reached.size} of ${BANDS} bands`];
    }),
  );

test("a grid whose plot cannot reach its own top band is reported", () => {
  const page = `const SHOWN = 2;\n<ActivityGrid days={QUIET} weeks={SHOWN} />`;
  const busy = `<ActivityGrid days={BUSY} weeks={2} thresholds={[1, 2, 3, 4]} />`;
  const series = {
    QUIET: Array.from({ length: 14 }, () => ({ count: 0 })),
    BUSY: Array.from({ length: 14 }, (_, day) => ({ count: day % 5 })),
  };

  expect(unreachableBand([{ file: "a.tsx", source: page }], series)).toEqual([
    "a.tsx QUIET: 1 of 5 bands",
  ]);
  expect(unreachableBand([{ file: "b.tsx", source: busy }], series)).toEqual([]);
  expect(
    unreachableBand([{ file: "c.tsx", source: `<ActivityGrid days={GONE} weeks={2} />` }], series),
  ).toEqual(["c.tsx GONE: nothing to count"]);
});

test("every band a grid's legend shows is one its plot draws", () => {
  expect(pages.flatMap(({ source }) => openingTags(source, "ActivityGrid")).length).toBe(2);
  expect(unreachableBand(pages, fixtures)).toEqual([]);
});

/**
 * A span is a statement about the track count of the grid holding it, and the window is not that
 * grid. Measured at 640: the page column was 358, where one 200px track fits, so a span of two
 * invented an implicit second track sized by what was left rather than by the minimum — the
 * template read `200px 146px` where two `1fr` were asked for, and the card in the 146 held a
 * shortcut needing 128, whose label sat 20 outside it.
 *
 * `@min-` asks the container, which is the grid, so nothing asks for a track that is not there.
 */
const windowKeyedSpan = (files: readonly { file: string; source: string }[]) =>
  files
    .flatMap(({ file, source }) =>
      [...source.matchAll(/(?<!@)\bmin-\[[^\]]+\]:(?:col|row)-span-[^\s"'`]+/g)].map(
        ([match]) => `${file} ${match}`,
      ),
    )
    .sort();

test("a span asks the grid holding it, not the window", () => {
  const windowed = `widget: "col-span-1 min-[440px]:col-span-2"`;
  const contained = `widget: "col-span-1 @min-[440px]:col-span-2"`;
  const unrelated = `card: "min-[440px]:gap-4"`;

  expect(windowKeyedSpan([{ file: "a.tsx", source: windowed }])).toEqual([
    "a.tsx min-[440px]:col-span-2",
  ]);
  expect(windowKeyedSpan([{ file: "b.tsx", source: contained }])).toEqual([]);
  expect(windowKeyedSpan([{ file: "c.tsx", source: unrelated }])).toEqual([]);

  /* Read first: the spans are still written down, so the sweep has something to be right about. */
  expect(everything).toContain("@min-[440px]:col-span-2");
  expect(windowKeyedSpan(pages)).toEqual([]);
});

const statedUnions = (sources: readonly { readonly file: string; readonly source: string }[]) =>
  sources.flatMap(({ file, source }) =>
    [...source.matchAll(/<Props<(\w+Props)>([\s\S]*?)\n\s*\/>/g)].flatMap(([, type, body]) =>
      [...body!.matchAll(/\{[^{}]*\}/g)].flatMap((row) => {
        const prop = /name:\s*"(\w+)"/.exec(row[0])?.[1];
        const listed = /values:\s*\[([^\]]*)\]/.exec(row[0])?.[1];
        const fallback = /fallback:\s*"([^"]+)"/.exec(row[0])?.[1];
        if (prop === undefined || listed === undefined) return [];

        const said = [
          ...[...listed.matchAll(/"([^"]*)"/g)].map(([, one]) => one!),
          ...(fallback === undefined ? [] : [fallback]),
        ].sort();
        const real = unionFor(type!, prop);
        const note = /note:\s*"([^"]*)"/.exec(row[0])?.[1] ?? "";
        const spelled = said.filter((one) =>
          new RegExp(String.raw`\b${one.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\b`).test(note),
        );

        return [{ file, named: `${type}.${prop}`, said, real, spelled }];
      }),
    ),
  );

/**
 * A row's `values` are the alternatives and its `fallback` is the default, so a value in both is
 * printed twice and reads as one more choice than the prop has. Fifteen of the seventeen rows were
 * already written that way; the tabs' orientation and the tooltip's cursor axis were not, and each
 * listed its own default among the alternatives.
 */
test("a row that lists its own default among the alternatives is reported", () => {
  const doubled = (rows: readonly { named: string; said: readonly string[] }[]) =>
    rows
      .filter(({ said }) => new Set(said).size !== said.length)
      .map(({ named }) => named)
      .sort();

  expect(doubled([{ named: "A.x", said: ["one", "one", "two"] }])).toEqual(["A.x"]);
  expect(doubled([{ named: "A.x", said: ["one", "two"] }])).toEqual([]);
  expect(doubled(statedUnions(pages))).toEqual([]);
});

/**
 * What a row states against the union the prop really has. Five of the seventeen resolve: one this
 * kit writes out itself, and four typed by a union Base UI names. The rest are a `tv` variant,
 * which the rule further up weighs against `buttonVariants`, or a prop the positioner takes from a
 * shared interface rather than declaring, which this does not follow.
 *
 * Every `side` is a deliberate short list, and all three agree. Base UI also takes `inline-start`
 * and `inline-end`, which follow the writing direction rather than the box, and each table names
 * the four a reader can picture. They are named here so the omission reads as one decision rather
 * than three gaps — and so a table that quietly drops a fifth still fails.
 */
const PICTURED_SIDES_ONLY = [
  "MenuContentProps.side",
  "PopoverContentProps.side",
  "TooltipContentProps.side",
];

/**
 * A note that spells out what two of a prop's values do has started a list, and a reader takes the
 * one it leaves out as unsupported rather than undescribed. The dialog's `modal` note named `true`
 * and `trap-focus` and left `false` unmentioned, which is how the row came to omit it as well.
 *
 * Naming one value is an explanation rather than a list — a note may single out the interesting
 * case — so two is what starts the count.
 */
/** A list a person reads. Left to itself a list of values joins on commas and no spaces. */
const listed = (values: readonly string[]) => `[${values.join(", ")}]`;

const halfSpelled = (
  rows: readonly {
    readonly named: string;
    readonly said: readonly string[];
    readonly spelled: readonly string[];
  }[],
) =>
  rows
    .filter(({ said, spelled }) => spelled.length > 1 && spelled.length < said.length)
    .map(
      ({ named, said, spelled }) => `${named} says what ${listed(spelled)} do, not ${listed(said)}`,
    )
    .sort();

test("a note that says what some of the values do, and not the rest, is reported", () => {
  const whole = [{ named: "A.x", said: ["off", "on"], spelled: ["off", "on"] }];
  const partial = [{ named: "A.x", said: ["off", "on", "auto"], spelled: ["off", "on"] }];
  const single = [{ named: "A.x", said: ["off", "on", "auto"], spelled: ["auto"] }];

  expect(halfSpelled(whole)).toEqual([]);
  expect(halfSpelled(partial)).toEqual(["A.x says what [off, on] do, not [off, on, auto]"]);
  expect(halfSpelled(single)).toEqual([]);
  expect(halfSpelled(statedUnions(pages))).toEqual([]);
});

/* A union is a set, so a table may order it to read well. Writing one twice is the rule above. */
const sameValues = (said: readonly string[], real: readonly string[]) =>
  listed([...said].sort()) === listed([...real].sort());

test("a stated union that is not the one the prop has is reported", () => {
  const short = statedUnions(pages).flatMap(({ named, said, real }) =>
    real === undefined || PICTURED_SIDES_ONLY.includes(named) || sameValues(said, real)
      ? []
      : [`${named} states ${listed(said)}, the prop takes ${listed(real)}`],
  );

  /* Read first: a resolver that resolves nothing agrees with every table it is given. */
  expect(statedUnions(pages).filter(({ real }) => real !== undefined).length).toBeGreaterThan(12);
  /* And a comparison that agrees with everything reports nothing, which reads the same as clean. */
  expect(sameValues(["top", "bottom"], ["bottom", "top"])).toBe(true);
  expect(sameValues(["top", "bottom"], ["top", "left"])).toBe(false);
  expect(sameValues(["top"], ["top", "bottom"])).toBe(false);
  expect(short).toEqual([]);
});

/**
 * Which value you get by writing nothing is drawn in the accent, and the accent carries in
 * lightness as well as in hue — 2.69:1 against the other values in greyscale — so it survives a
 * reader who cannot separate the two colours. It does not survive a reader who sees neither.
 *
 * The variants table is the harder of the two: its default sits among the others rather than ahead
 * of them, so a reader was given `sm md lg` with nothing at all saying which one they would get.
 */
test("a table says in words which value it takes when you write nothing", () => {
  const stated = renderToStaticMarkup(
    createElement(Props<{ side?: "top" | "bottom" }>, {
      rows: [{ name: "side", fallback: "bottom", values: ["top"] }],
    }),
  );
  const read = renderToStaticMarkup(
    createElement(Api, {
      of: { variants: { size: { sm: {}, md: {} } }, defaultVariants: { size: "md" } },
    }),
  );

  expect(stated).toContain('bottom<span class="sr-only"> by default</span>');
  expect(read).toContain('md<span class="sr-only"> by default</span>');
  /* A value that is not the default says nothing extra, so the mark means what it says. */
  expect(stated).toContain(">top</span>");
  expect(read).toContain(">sm</span>");
});

/**
 * Two of a thing on one page need two names, which the kit says on the `label` of the grid, the
 * deck and the sparkline. Nothing checked it, and the widgets page had two breakdowns of the same
 * data under one name — a reader met "language split: TypeScript 84%, WGSL 9%, CSS 7%" twice with
 * nothing to tell the cards apart, while the legend that distinguishes them is aria-hidden by
 * design and so reaches nobody.
 *
 * Read as written rather than as rendered: two identical expressions on a page are two identical
 * names, whatever they interpolate.
 */
const twiceNamed = (files: readonly { file: string; source: string }[]) =>
  files
    .flatMap(({ file, source }) => {
      const said = [...source.matchAll(/\blabel=(\{`[^`]*`\}|"[^"]*")/g)].map(([, one]) => one!);
      const counted = said.reduce<Record<string, number>>(
        (all, one) => ({ ...all, [one]: (all[one] ?? 0) + 1 }),
        {},
      );

      return Object.entries(counted)
        .filter(([, times]) => times > 1)
        .map(([one, times]) => `${file}: ${times} of ${one}`);
    })
    .sort();

test("a page does not give two things the same name", () => {
  const twice = [{ file: "a.tsx", source: '<Bars label="load" /><Bars label="load" />' }];
  const once = [{ file: "b.tsx", source: '<Bars label="load" /><Bars label="idle" />' }];

  expect(twiceNamed(twice)).toEqual(['a.tsx: 2 of "load"']);
  expect(twiceNamed(once)).toEqual([]);
  /* Read first: the pages do name things this way, so the sweep has something to be right about. */
  expect(everything).toContain("label={`language split");
  expect(twiceNamed(pages)).toEqual([]);
});

/**
 * The runtime note lists fifteen modules it deleted rather than kept as a fallback — a spring
 * integrator, a frame clock, a board engine, a geometry folder — and says every path is still
 * absent. That sentence is the whole evidence that the replacement happened rather than being
 * described, and a file coming back would leave it reading as true.
 *
 * The note's own count of the components is read the same way. The readme's is pinned in words
 * further up; this one is a numeral in a different file and nothing looked at it.
 */
const stillGone = (note: string) =>
  [...note.matchAll(/^(src\/[\w./-]+)\s+removed/gm)]
    .map(([, path]) => path!)
    .filter((path) => existsSync(new URL(`../${path}`, import.meta.url)));

test("a module a note says it deleted has not come back", () => {
  const note = readFileSync(new URL("../docs/research/widget-runtime.md", import.meta.url), "utf8");
  const modules = readdirSync(componentDir).filter((name) => name.endsWith(".tsx"));

  /* Read first: the paths are read out of the note, so a note that lists none would agree here. */
  expect([...note.matchAll(/^(src\/[\w./-]+)\s+removed/gm)]).toHaveLength(15);
  expect(stillGone(note)).toEqual([]);
  expect(note).toContain(`${modules.length} component modules`);
});

/**
 * The navigation note cites the router's own source by line — `createRouteMask` at 263, the search
 * middlewares at 24-25, a run of four at 14-17. Those citations are its provenance: the rule above
 * checks the names still exist, and a name can exist while the line that was read has moved.
 *
 * The version is pinned separately, so a bump fails there first. This catches the other order —
 * the note's version updated and its line numbers left behind. Ranges are read in the order they
 * are written, which is how the four at 14-17 were found listed in the wrong one.
 */
const misplacedCitations = (note: string, source: readonly string[]) =>
  [...note.matchAll(/((?:`\w+`(?:, )?)+)\s*\((?:lines? )?(\d+)(?:-(\d+))?\)/g)].flatMap(
    ([, names, first, last]) => {
      const cited = [...names!.matchAll(/`(\w+)`/g)].map(([, name]) => name!);
      const from = Number(first);
      if (last !== undefined && Number(last) - from + 1 !== cited.length) {
        return [`${cited.join(",")} spans ${first}-${last} for ${cited.length} names`];
      }

      return cited.flatMap((name, step) =>
        (source[from + step - 1] ?? "").includes(name) ? [] : [`${name} is not at ${from + step}`],
      );
    },
  );

test("every line a note cites in the router's source is the line it names", () => {
  const note = readFileSync(
    new URL("../docs/research/recursive-navigation.md", import.meta.url),
    "utf8",
  );
  const source = readFileSync(
    new URL("../node_modules/@tanstack/react-router/src/index.tsx", import.meta.url),
    "utf8",
  ).split("\n");

  expect(misplacedCitations("`a` (2)", ["x", "a"])).toEqual([]);
  expect(misplacedCitations("`a` (1)", ["x", "a"])).toEqual(["a is not at 1"]);
  /* Read first: the note really does cite lines, so a pattern that matched none would agree. */
  expect(
    [...note.matchAll(/((?:`\w+`(?:, )?)+)\s*\((?:lines? )?(\d+)(?:-(\d+))?\)/g)].length,
  ).toBeGreaterThan(4);
  expect(misplacedCitations(note, source)).toEqual([]);
});

/**
 * A word with nothing to break on is cut wherever a card hides its overflow, and the card reports
 * no overflow of its own, so the words go without a mark. Every text role wraps for that reason.
 * The readout does not, because a figure broken across two lines reads as two figures, and it says
 * so with `whitespace-nowrap`. A new role has to answer which of the two it is.
 *
 * The wrap is `wrap-anywhere` rather than `break-words`, and the difference is not cosmetic. Both
 * break a word that would overflow, but only `anywhere` lowers the width the box reports as its
 * minimum. A role used inside a `Row` is a flex item, and a flex item keeps a minimum as wide as
 * its longest word, so with `break-words` the row stayed too wide and pushed the page sideways
 * instead: 320 became 481 on the readouts page. Measured at 320 on four pages, the change takes
 * the page-widening texts from 14, 28, 19 and 18 to 0, 14, 5 and 6, and moves no box on any of
 * them — where a zero minimum, which fixes the same thing, moved 78 and 212.
 *
 * Measured at 1280 on all nine pages, by putting one long address into every text a page draws:
 * wrapping saves 66 of them, 8 of which are field labels this role reaches through `Field`. What
 * remains is a box that cannot shrink because it says it stays on one line.
 */
test("every text role either wraps a long word or says it stays on one line", () => {
  const roles = Object.keys((kit.textVariants as unknown as Tabled).variants?.as ?? {});
  const silent = roles
    .filter((role) => {
      const drawn = kit.textVariants({ as: role as never });

      return !/\b(?:wrap-anywhere|break-words|whitespace-nowrap)\b/.test(drawn);
    })
    .sort();

  expect(roles.length).toBeGreaterThan(5);
  expect(kit.textVariants({ as: "readout" })).toContain("whitespace-nowrap");
  expect(kit.textVariants({ as: "prose" })).toContain("wrap-anywhere");
  expect(silent).toEqual([]);
});

const WRITTEN_OUT = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

const asCount = (said: string | undefined) =>
  said === undefined
    ? undefined
    : WRITTEN_OUT.includes(said)
      ? WRITTEN_OUT.indexOf(said)
      : /^\d+$/.test(said)
        ? Number(said)
        : undefined;

/**
 * A count a name states, in the two places these pages put one: after the word `over`, and in
 * front of the thing being counted, which is the prop's own name. Both are unambiguous — `p95`
 * sits after neither, and so does the `2.1M` in a tooltip.
 */
const countIn = (label: string, prop: string) =>
  asCount(/\bover\s+([a-z]+|\d+)\b/.exec(label)?.[1]) ??
  asCount(new RegExp(String.raw`\b([a-z]+|\d+)\s+${prop}\b`).exec(label)?.[1]);

/**
 * A name that counts what it draws is a number written in prose, and the ratio table taught what
 * happens to those: nothing reads them, so nothing notices when the series moves underneath. Eight
 * are stated across these pages — sixty-four weeks and eight weeks and three panes twice each,
 * seventy-two frames and ninety-six hours once — and every one was right and unguarded.
 *
 * The series is found rather than named: whichever prop is handed a bare identifier the fixtures
 * hold as an array is the one being counted.
 */
const counted = pages.flatMap(({ file, source }) => {
  const names = [
    ...new Set([...source.matchAll(/<([A-Z][\w.]*)(?=[\s/>])/g)].map(([, one]) => one!)),
  ];

  return names.flatMap((name) =>
    openingTags(source, name).flatMap((tag) => {
      /* A name may be a plain string or a template. The holes carry values, never the count. */
      const label =
        /\blabel="([^"]*)"/.exec(tag)?.[1] ??
        /\blabel=\{`([^`]*)`\}/.exec(tag)?.[1]?.replaceAll(/\$\{[^}]*\}/g, " ");
      const carried = [...tag.matchAll(/\b(\w+)=\{(\w+)\}/g)].find(([, , held]) =>
        Array.isArray((fixtures as Record<string, unknown>)[held!]),
      );

      if (label === undefined || carried === undefined) return [];

      const [, prop, held] = carried;
      const said = countIn(label, prop!);

      return said === undefined
        ? []
        : [
            {
              where: `${file} ${name}`,
              said,
              holds: (fixtures as Record<string, readonly unknown[]>)[held!]!.length,
              held: held!,
            },
          ];
    }),
  );
});

test("a name that counts what it draws counts what the series holds", () => {
  expect(countIn("commits per week over 64 weeks", "values")).toBe(64);
  expect(countIn("weekly installs over eight weeks", "values")).toBe(8);
  expect(countIn("split, three panes", "panes")).toBe(3);
  /* The two a looser reader would have taken for counts. */
  expect(countIn("p95 latency, latest 20ms", "values")).toBeUndefined();
  expect(countIn("queries, 2.1M served", "values")).toBeUndefined();

  /* Read first: a reader that finds no name at all disagrees with nothing. */
  expect(counted.map(({ held }) => held).sort()).toEqual([
    "COMMIT_WEEKS",
    "COMMIT_WEEKS",
    "FRAME_BUDGET",
    "INSTALLS",
    "INSTALLS",
    "LATENCY",
    "SPLIT_PANES",
    "SPLIT_PANES",
  ]);
  expect(counted.filter(({ said, holds }) => said !== holds)).toEqual([]);
});

/**
 * The plot hands the answer to a render prop, so the node the page returns is what decides whether
 * the promise is kept — a plain span changes silently.
 *
 * Driven rather than reasoned: one ArrowLeft on the live page moved the cursor seven days and the
 * footer read `3 contributions · Thu Sep 03` from a `role="status"` node. The pages get it right
 * today; nothing said they had to.
 */
const silentRenderProp = (sources: readonly { readonly file: string; readonly source: string }[]) =>
  sources.flatMap(({ file, source }) =>
    [...source.matchAll(/<ActivityGrid(?=[\s/<>])[\s\S]*?<\/ActivityGrid>/g)]
      .filter(([block]) => block.includes("=>") && !block.includes("<Readout"))
      .map(() => `${file} returns a node that does not announce`),
  );

test("a render prop that does not announce is reported", () => {
  expect(
    silentRenderProp([
      {
        file: "a.tsx",
        source: "<ActivityGrid days={D}>{(d) => <Readout>x</Readout>}</ActivityGrid>",
      },
      { file: "b.tsx", source: "<ActivityGrid days={D}>{(d) => <span>x</span>}</ActivityGrid>" },
      /* No render prop at all is allowed: the prop is optional and the summary still answers. */
      { file: "c.tsx", source: "<ActivityGrid days={D}></ActivityGrid>" },
    ]),
  ).toEqual(["b.tsx returns a node that does not announce"]);
});

/**
 * The general form. Stating `aria-keyshortcuts` tells a reader which keys work, so pressing one owes
 * that reader an answer they can hear — 4.1.3, since the content changes and the focus does not.
 *
 * Two components state it and both were silent, each found by being driven on the page. They answer
 * the same way now: a region of their own. The deck says what settled and what is next; the plot
 * names the focused day, and hands that over only when a page passes its own readout, which is what
 * the rule above holds. One condition for both, because a second way to be right is a second way to
 * be wrong.
 */
const STATES_ITS_KEYS = ["activity-grid.tsx", "swipe-deck.tsx"];

const named = () =>
  readdirSync(componentDir)
    .filter((name) => name.endsWith(".tsx"))
    .map((file) => ({ file, source: readFileSync(new URL(file, componentDir), "utf8") }));

/**
 * Announcing has one owner. `Readout` is the kit's `role="status"` span, and both components that
 * answer their keys draw one — the plot visibly, the deck under `sr-only`, where the readout's own
 * font classes are inert and the single owner is worth more than the tidier class list.
 *
 * Each had its own copy of the two attributes first. Two copies of a screen reader behaviour drift
 * the day somebody changes the politeness or adds `aria-atomic`, and nothing would have said so.
 */
const announces = (source: string) => /<Readout[\s/>]/.test(source);

test("a component that states its keys answers them in a way a reader can hear", () => {
  const stating = named().filter(({ source }) => source.includes("aria-keyshortcuts"));

  /* The answers first, so losing one reports the component that went silent rather than a changed
   * list of components. */
  expect(stating.filter(({ source }) => !announces(source)).map(({ file }) => file)).toEqual([]);
  expect(silentRenderProp(pages)).toEqual([]);
  /* Last: a third component that states its keys is named here rather than going unchecked. */
  expect(stating.map(({ file }) => file).sort()).toEqual(STATES_ITS_KEYS);
});

test("nothing but the readout writes a live region", () => {
  const writing = [...named(), ...pages].filter(({ source }) =>
    /aria-live|role="status"/.test(source),
  );

  /* Read first: the owner is still there. An owner that lost its own attributes would otherwise
   * make this pass by there being nothing left to find. */
  expect(readFileSync(new URL("text.tsx", componentDir), "utf8")).toContain(
    '"aria-live": "polite"',
  );
  expect(writing.map(({ file }) => file)).toEqual(["text.tsx"]);
  /* And the sentence that teaches it, so the README cannot go on claiming one file after a second
   * starts writing its own. */
  expect(readFileSync(new URL("../README.md", import.meta.url), "utf8")).toContain(
    "appears in one file",
  );
});

/**
 * The general case behind the plot's silence: a prop whose own comment says it carries something a
 * reader needs, and which is optional. Omit it and the reader loses that thing, unless the component
 * has something to fall back on.
 *
 * Six props say it. Five are names, and each derives one from its own data — `barsLabel`,
 * `breakdownLabel`, `sparklineLabel`, and a named constant in the plot and the deck. The sixth was
 * the plot's readout, whose fallback was nothing at all until the plot got its own line, and that is
 * why it is written down here rather than pattern-matched: its answer is an element, not a string.
 */
const FALLS_BACK_TO_SOMETHING_ELSE: Record<string, string> = {
  "activity-grid.tsx children": "the plot draws its own readout when none is passed",
};

/**
 * A doc comment and the optional prop directly under it. The body is tempered so it cannot reach
 * past its own `*​/`: written lazily, it spanned two comments and handed one prop's wording to
 * another, which reported the deck's `onSettle` as something a reader depends on.
 */
const DOCUMENTED_OPTIONAL = /\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*readonly (\w+)\?:/g;

/** What the comment has to mention for the prop to be one a reader depends on. */
const FOR_A_READER = /\breader\b|cannot see|announce/;

const readerProps = (sources: readonly { readonly file: string; readonly source: string }[]) =>
  sources.flatMap(({ file, source }) =>
    [...source.matchAll(DOCUMENTED_OPTIONAL)]
      .filter(([, doc]) => FOR_A_READER.test(doc!))
      .map(([, , prop]) => ({ file, source, prop: prop!, what: `${file} ${prop}` })),
  );

const optionalAndUnanswered = (
  sources: readonly { readonly file: string; readonly source: string }[],
) =>
  readerProps(sources)
    .filter(
      ({ source, prop, what }) =>
        !(
          source.includes(`${prop} = `) ||
          source.includes(`${prop}?.trim() ||`) ||
          what in FALLS_BACK_TO_SOMETHING_ELSE
        ),
    )
    .map(({ what }) => what);

test("an optional prop with nothing to fall back on is reported", () => {
  expect(
    optionalAndUnanswered([
      {
        file: "a.tsx",
        source:
          "/** Names it for a reader. */\n  readonly label?: string;\n  aria-label={label?.trim() || derived()}",
      },
      { file: "b.tsx", source: "/** Names it for a reader. */\n  readonly label?: string;" },
      /* No mention of a reader: an optional prop is just optional. */
      { file: "c.tsx", source: "/** How wide. */\n  readonly size?: number;" },
    ]),
  ).toEqual(["b.tsx label"]);
});

test("every optional prop a reader depends on has something to fall back on", () => {
  const asked = readerProps(named()).map(({ what }) => what);

  expect(optionalAndUnanswered(named())).toEqual([]);
  /*
   * Read after: the whole rule turns on a word in a comment, so a doc rewritten without it would
   * drop the prop out of the category and take the check with it. Pinned, so that shows up.
   */
  expect(asked.sort()).toEqual([
    "activity-grid.tsx children",
    "activity-grid.tsx label",
    "bars.tsx label",
    "breakdown.tsx label",
    "scroll-area.tsx label",
    "sparkline.tsx label",
    "swipe-deck.tsx label",
  ]);
});

/**
 * The decision log is tab separated with six columns, and a row that loses one is a row whose
 * evidence and result have merged into a single cell — readable enough to miss, and wrong.
 *
 * Checked here because the hand check was not reliable: a shell one-liner that printed "ok"
 * unconditionally passed a five-column row straight through. A rule cannot print the wrong answer.
 */
test("every row of the decision log has its six columns", () => {
  const log = readFileSync(new URL("../docs/internal/decisions.tsv", import.meta.url), "utf8");
  const rows = log.split("\n").filter((row) => row.length > 0);

  /* Read first: an empty read would agree with anything. */
  expect(rows.length).toBeGreaterThan(40);
  expect(rows[0]).toBe("ts\tphase\tdecision\twhy\tevidence\tresult");
  expect(
    rows
      .map((row, at) => ({ row: at + 1, columns: row.split("\t").length }))
      .filter(({ columns }) => columns !== 6),
  ).toEqual([]);
});

/**
 * Two comments send a reader to a document for figures no test here can produce, because none of
 * them has a layout engine. A pointer to a file that has moved is worse than no pointer: it reads
 * as though the evidence exists and sends the reader looking for it.
 */
const citedDocs = (sources: readonly { readonly file: string; readonly source: string }[]) =>
  sources.flatMap(({ file, source }) =>
    [...source.matchAll(/`(docs\/[\w./-]+\.md)`/g)].map(([, path]) => ({ file, path: path! })),
  );

test("a document a comment names is a document that is there", () => {
  const cited = citedDocs(named());

  /* Read first: a pattern that found nothing would make the loop below pass over nothing. */
  expect(cited.length).toBeGreaterThan(1);
  expect(
    cited
      .filter(({ path }) => !existsSync(new URL(`../${path}`, import.meta.url)))
      .map(({ file, path }) => `${file} points at ${path}`),
  ).toEqual([]);
});

/**
 * A ticker holds the whole figure for a reader and says nothing when that figure moves: the rolling
 * digits are hidden, and the text behind them is replaced in silence. `Readout` is the one thing in
 * this kit that announces, so a ticker that counts belongs inside one — which is why the ticker
 * carries no live region of its own, and why its own documentation says to compose the two.
 *
 * Every ticker these pages draw is inside one. A bare one would leave that guidance true of the
 * component and false of the showcase, and the showcase is the shape a consumer copies.
 */
test("every ticker the pages draw is drawn through the one thing that announces", () => {
  const found = (pattern: RegExp) =>
    pages.flatMap(({ file, source }) => [...source.matchAll(pattern)].map(() => file)).sort();

  const drawn = found(/<NumberTicker[\s/>]/g);

  /* Read first: no tickers at all would make the comparison below agree with nothing. */
  expect(drawn.length).toBeGreaterThan(2);
  expect(found(/render=\{<NumberTicker[\s/>]/g)).toEqual(drawn);
});

/**
 * The rail repeats on every page and costs ten stops before a page's own first control — counted in
 * the browser, and `/foundations` holds none at all, so ten tabs reached nothing. One stop skips it.
 *
 * The link has to be first in the document, hidden until focused, and pointing at something that
 * exists. A skip link to a missing id is the failure that looks exactly like a working one.
 */
const skipLinkOf = (source: string) => {
  const [, target] = /<a href="#([\w-]+)" className=\{styles\.skip\(\)\}>/.exec(source) ?? [];
  const [, slot] = /skip:\s*"([^"]*)"/.exec(source) ?? [];

  return { target, slot, lands: target ? source.includes(`id="${target}"`) : false };
};

test("a skip link with nowhere to land is reported", () => {
  const shell = (target: string, id: string) =>
    `skip: "sr-only focus:not-sr-only"\n<a href="#${target}" className={styles.skip()}>\n<main id="${id}"`;

  expect(skipLinkOf(shell("content", "content")).lands).toBe(true);
  expect(skipLinkOf(shell("content", "main")).lands).toBe(false);
  expect(skipLinkOf("<main id='content'>").target).toBeUndefined();
});

test("the shell opens with a link past the rail, and it lands somewhere", () => {
  const root = readFileSync(new URL("../app/routes/__root.tsx", import.meta.url), "utf8");
  const { target, slot, lands } = skipLinkOf(root);

  expect(target).toBe("content");
  expect(lands).toBe(true);
  /* Out of the way until focused, and back in the flow once it is. */
  expect(slot).toContain("sr-only");
  expect(slot).toContain("focus:not-sr-only");
  /* First in the document, so it is the first stop rather than the eleventh. */
  expect(root.indexOf('href="#content"')).toBeLessThan(root.indexOf("<nav"));
  /* The landing takes focus without joining the tab order. */
  expect(root).toContain('<main id="content" tabIndex={-1}');
});

/**
 * A trigger with no header around it draws a button and no heading at all, so the panel it opens is
 * labelled by nothing and a reader navigating by heading walks past the whole accordion.
 *
 * The header used to be inside the trigger, where it could not be forgotten and its level could not
 * be chosen either — Base UI draws an `h3`, and these items sit under the page's own `h1`, so the
 * outline read 1 then 3 with nothing between. Separating them fixed the level and made the omission
 * possible, which is what this holds.
 */
const barePanelHeadings = (
  sources: readonly { readonly file: string; readonly source: string }[],
) =>
  sources
    .flatMap(({ file, source }) => {
      const triggers = [...source.matchAll(/<Accordion\.Trigger[\s/>]/g)].length;
      const headers = [...source.matchAll(/<Accordion\.Header[\s/>]/g)].length;

      return triggers === headers
        ? []
        : [`${file} draws ${triggers} triggers under ${headers} headers`];
    })
    .sort();

test("an accordion trigger with no heading over it is reported", () => {
  expect(barePanelHeadings([{ file: "a.tsx", source: "<Accordion.Trigger>" }])).toEqual([
    "a.tsx draws 1 triggers under 0 headers",
  ]);
  expect(
    barePanelHeadings([
      { file: "b.tsx", source: "<Accordion.Header render={<h2 />}><Accordion.Trigger />" },
    ]),
  ).toEqual([]);
});

test("every accordion a page draws keeps its heading, and says which level", () => {
  const drawn = pages.filter(({ source }) => source.includes("<Accordion.Trigger"));

  /* Read first: no accordion at all would make the comparison below agree with nothing. */
  expect(drawn.map(({ file }) => file)).toEqual(["routes/disclosure.tsx"]);
  expect(barePanelHeadings(pages)).toEqual([]);
  expect(drawn[0]!.source).toContain("<Accordion.Header render={<h2 />}>");
});

/**
 * The sheet declares its names twice, and only one half survives into the browser.
 *
 * `:root` holds the real tokens — `--pk-surface`, `--pk-lift-held` — and a consumer can read any of
 * them. The `@theme` block below republishes them as `--color-pk-surface` and its siblings, which
 * is how Tailwind is told what `bg-pk-surface` means: Tailwind writes the value straight into the
 * utility and never emits the alias, so `var(--color-pk-surface)` resolves to nothing at all.
 *
 * Read at `:root` in the running page: 82 `--pk-*` tokens resolve and every `@theme` name is empty.
 * So a CSS example in a document is one of two things, and one of them silently does nothing.
 */
const sheetNames = () => {
  const sheet = readFileSync(new URL("./theme.css", import.meta.url), "utf8");
  const themeAt = sheet.indexOf("@theme");
  const root = sheet.slice(0, themeAt < 0 ? sheet.length : themeAt);

  return {
    reachable: new Set([...root.matchAll(/^\s*(--pk-[a-z\d-]+):/gm)].map(([, name]) => name!)),
    aliases: new Set(
      [...sheet.matchAll(/^\s*(--(?:color|text|radius|shadow|ease|animate|font)-pk-[a-z\d-]+):/gm)]
        .map(([, name]) => name!)
        .filter((name) => !name.includes("--", 2)),
    ),
  };
};

const unreadable = (
  docs: readonly { readonly file: string; readonly source: string }[],
  names: ReturnType<typeof sheetNames>,
) =>
  docs
    .flatMap(({ file, source }) =>
      [...source.matchAll(/```css\n([\s\S]*?)```/g)].flatMap(([, block]) =>
        [...block!.matchAll(/var\((--[a-z\d-]+)\)/g)]
          .map(([, name]) => name!)
          .filter((name) => !names.reachable.has(name))
          .map(
            (name) =>
              `${file} writes var(${name}), which ${
                names.aliases.has(name) ? "Tailwind never emits" : "the sheet never declares"
              }`,
          ),
      ),
    )
    .sort();

test("a document reaching for a name the browser cannot see is reported", () => {
  const names = {
    reachable: new Set(["--pk-lift-held"]),
    aliases: new Set(["--color-pk-surface"]),
  };

  expect(
    unreadable(
      [{ file: "a.md", source: "```css\na { color: var(--color-pk-surface); }\n```" }],
      names,
    ),
  ).toEqual(["a.md writes var(--color-pk-surface), which Tailwind never emits"]);
  expect(
    unreadable(
      [{ file: "b.md", source: "```css\na { box-shadow: var(--pk-lift-held); }\n```" }],
      names,
    ),
  ).toEqual([]);
  expect(
    unreadable([{ file: "c.md", source: "```css\na { color: var(--pk-gone); }\n```" }], names),
  ).toEqual(["c.md writes var(--pk-gone), which the sheet never declares"]);
});

test("every name a document tells a consumer to read is one the browser can", () => {
  const names = sheetNames();
  const docs = [
    { file: "README.md", source: readFileSync(new URL("../README.md", import.meta.url), "utf8") },
    ...readdirSync(new URL("../docs/design/", import.meta.url))
      .filter((name) => name.endsWith(".md"))
      .map((file) => ({
        file,
        source: readFileSync(new URL(file, new URL("../docs/design/", import.meta.url)), "utf8"),
      })),
  ];

  /* Read first: both halves found, sorted the right way round, and the documents actually opened. */
  expect(names.reachable.size).toBeGreaterThan(60);
  expect(names.aliases.size).toBeGreaterThan(40);
  expect(names.reachable.has("--pk-lift-held")).toBe(true);
  expect(names.aliases.has("--color-pk-surface")).toBe(true);
  expect(names.reachable.has("--color-pk-surface")).toBe(false);
  expect(docs.length).toBeGreaterThan(1);
  expect(unreadable(docs, names)).toEqual([]);
});
