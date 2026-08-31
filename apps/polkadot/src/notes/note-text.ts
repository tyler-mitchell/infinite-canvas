// This parser reads serialized note text without starting Lexical.
type SerializedNode = Readonly<{
  children?: readonly unknown[];
  text?: unknown;
  type?: unknown;
}>;

// Only block nodes end a line. Inline nodes stay on the current line.
const BLOCK_TYPES = new Set([
  "code",
  "heading",
  "listitem",
  "paragraph",
  "quote",
  "table",
  "tablerow",
]);

const isNode = (value: unknown): value is SerializedNode =>
  typeof value === "object" && value !== null;

function collect(node: SerializedNode, lines: string[]) {
  if (typeof node.text === "string") {
    lines[lines.length - 1] = `${lines[lines.length - 1] ?? ""}${node.text}`;

    return;
  }

  if (node.type === "linebreak") {
    lines.push("");

    return;
  }

  for (const child of node.children ?? []) {
    if (isNode(child)) {
      collect(child, lines);
    }
  }

  // Add the break after child text reaches the current line.
  if (typeof node.type === "string" && BLOCK_TYPES.has(node.type)) {
    lines.push("");
  }
}

// Invalid or empty serialized states return no lines.
function getNoteLines(serialized: string): readonly string[] {
  if (serialized.trim() === "") {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch {
    return [];
  }

  if (!isNode(parsed)) {
    return [];
  }

  const root = (parsed as Readonly<{ root?: unknown }>).root;

  if (!isNode(root)) {
    return [];
  }

  const lines: string[] = [""];

  collect(root, lines);

  return lines.map((line) => line.trim()).filter((line) => line !== "");
}

const getNoteText = (serialized: string) => getNoteLines(serialized).join("\n");

// null means that the note has no readable text.
const getNoteOpeningLine = (serialized: string): string | null =>
  getNoteLines(serialized)[0] ?? null;

export { getNoteLines, getNoteOpeningLine, getNoteText };
