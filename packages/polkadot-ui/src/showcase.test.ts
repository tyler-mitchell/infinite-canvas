import { readdirSync, readFileSync } from "node:fs";

import { expect, test } from "vite-plus/test";

import * as fixtures from "../app/fixtures.ts";
import { activityLevel, type ActivityDay } from "./components/activity-grid.tsx";

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

const appDir = new URL("../app/", import.meta.url);
const componentDir = new URL("./components/", import.meta.url);
const pages = [
  ...readdirSync(appDir).filter((name) => name.endsWith(".tsx")),
  ...readdirSync(new URL("routes/", appDir))
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => `routes/${name}`),
].map((file) => ({ file, source: readFileSync(new URL(file, appDir), "utf8") }));

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
  const source = readFileSync(new URL(file, componentDir), "utf8");

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

test("every tooltip trigger says what its tooltip says", () => {
  const triggers = pages.flatMap(({ source }) => openingTags(source, "Tooltip\\.Trigger"));

  expect(unlabelledTooltips(pages)).toEqual([]);
  /* After the rule, not before it: there are two triggers, so a floor of one fires on a page that
   * legitimately drops one and reports a number where the rule would have named the trigger. */
  expect(triggers.length).toBeGreaterThan(1);
});

/**
 * The readme counts the kit twice — how many component modules there are, and how many of them
 * draw with `slots` rather than a `base`. Both were a component behind, and it also sent a reader
 * to a route that had been renamed. Numbers written in prose go stale the moment a file is added,
 * and nothing about the kit changes to say so.
 */
const NUMBERS = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

const inWords = (count: number) => {
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty"];
  const [ten, unit] = [Math.floor(count / 10), count % 10];

  if (count < 10) return NUMBERS[count - 1]!;
  return unit === 0 ? tens[ten]! : `${tens[ten]}-${NUMBERS[unit - 1]}`;
};

test("counting in words covers the range the readme uses", () => {
  expect([6, 9, 20, 34, 40].map(inWords)).toEqual([
    "six",
    "nine",
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

/** Each quoted block, against the component the comment above it names. */
const quotedBlocks = (readme: string) =>
  [...readme.matchAll(/\/\/ ([a-z-]+\.tsx)[^\n]*\n(const \w+ = tv\(\{[\s\S]*?\n\}\);)/g)].map(
    ([, file, block]) => ({ file: file!, block: block! }),
  );

const misquoted = (readme: string, read: (file: string) => string) =>
  quotedBlocks(readme).flatMap(({ file, block }) => {
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

test("every component the readme quotes is quoted as it is", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

  expect(quotedBlocks(readme).map(({ file }) => file)).toEqual(["badge.tsx", "terminal.tsx"]);
  expect(misquoted(readme, (file) => readFileSync(new URL(file, componentDir), "utf8"))).toEqual(
    [],
  );
});

/**
 * What each component falls back to when a prop is left out, read from the defaults it destructures.
 * Only the kit's own: a Base UI default is not written down here and cannot be checked against.
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

    return list
      ? list[1]!
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
          .join(" · ")
      : value;
  };

  for (const [, owner, body] of source.matchAll(/function (\w+)\(\{([\s\S]*?)\}:/g)) {
    const defaults = [...body!.matchAll(/^\s*(\w+) = (.+?),$/gm)].map(
      ([, prop, value]) => [prop!, resolve(value!)] as const,
    );

    fallsBackTo.set(`${owner!}Props`, new Map(defaults));
  }
}

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
  expect(misstatedDefault(pages, fallsBackTo)).toEqual([]);
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
  const keys = [...source.matchAll(/\b(\w+): state\.\w+/g)].map(([, key]) => key!);

  if (exported && keys.length > 0) stateDriven.set(exported, new Set(keys));
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
