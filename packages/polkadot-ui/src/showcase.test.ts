import { readdirSync, readFileSync } from "node:fs";

import { expect, test } from "vite-plus/test";

/*
 * The pages are the kit's only documentation, so an affordance the kit adds and no page passes is
 * a claim with nothing behind it: a reader cannot see what it does, and neither can anyone
 * checking that it still works.
 *
 * Only the props the kit declares itself count. A table may also list what the Base UI primitive
 * underneath accepts, and that is reference rather than a promise to demonstrate — asking for all
 * of them reported sixty-four, most of them `open`, `disabled` and `modal` on primitives the kit
 * only passes through.
 */

const appDir = new URL("../app/", import.meta.url);
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

    for (let at = match.index + name.length + 1; at < source.length; at += 1) {
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
 * A part is exported under one name and written under another: `MenuItem` is `<Menu.Item>` and
 * `TabPanel` is `<Tabs.Panel>`. Four props read as undemonstrated until this was allowed for.
 */
const tagNamesFor = (owner: string) => {
  const [, head, tail] = /^([A-Z][a-z\d]+)([A-Z][A-Za-z\d]*)$/.exec(owner) ?? [];

  return head && tail ? [owner, `${head}\\.${tail}`, `${head}s\\.${tail}`] : [owner];
};

/**
 * What each component adds to the primitive under it, read from its own props type. Kept per
 * component: as one flat set, a `value` declared by the receipt barcode made `value` on Tabs look
 * like something this kit had added, when Base UI owns it.
 */
const componentDir = new URL("./components/", import.meta.url);
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

test("every affordance the kit adds is one the pages pass", () => {
  const named = pages.flatMap(({ source }) => documented(source));

  expect(named.length).toBeGreaterThan(40);
  expect(kitDeclares.size).toBeGreaterThan(40);
  expect(undemonstrated(pages, everything, kitDeclares)).toEqual([]);
});
