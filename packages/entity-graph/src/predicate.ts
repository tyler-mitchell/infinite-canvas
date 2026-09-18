import { type, type Type } from "arktype";
import { BoundQuery, escapeIdent, surql } from "surrealdb";

export function combine(
  queries: readonly BoundQuery[],
  operator: "AND" | "OR" = "AND",
): BoundQuery {
  if (queries.length === 0) return new BoundQuery(operator === "AND" ? "true" : "false");
  return queries.reduce(
    (result, query, index) =>
      result.append(surql`${new BoundQuery(index === 0 ? "" : ` ${operator} `)}(${query})`),
    new BoundQuery(),
  );
}

export function predicate({
  definition,
  path,
}: {
  readonly definition: unknown;
  readonly path: string;
}): BoundQuery {
  const root = type.raw(definition).out.internal;
  return lower({ root, path });
}

function lower({
  root,
  path,
}: {
  readonly root: Type["internal"];
  readonly path: string;
}): BoundQuery {
  const field = new BoundQuery(path);
  if (root.hasKind("unit")) return surql`${field} = ${root.unit}`;
  if (root.hasKind("union"))
    return combine(
      root.branches.map((root) => lower({ root, path })),
      "OR",
    );
  if (root.hasKind("domain")) {
    const functions: Record<string, string> = {
      number: "type::is_number",
      string: "type::is_string",
      object: "type::is_object",
    };
    const fn = functions[root.domain];
    if (fn === undefined) throw new TypeError(`Unsupported database predicate: ${root.expression}`);
    return new BoundQuery(`${fn}(${path})`);
  }
  if (!root.hasKind("intersection"))
    throw new TypeError(`Unsupported database predicate: ${root.expression}`);
  for (const kind of [
    "predicate",
    "pattern",
    "sequence",
    "index",
    "proto",
    "minLength",
    "maxLength",
    "after",
    "before",
  ] as const) {
    if (root.select({ boundary: "shallow", kind, method: "find" })) {
      throw new TypeError(`Unsupported database predicate: ${root.expression}`);
    }
  }
  const parts: BoundQuery[] = [];
  const domain = root.select({ boundary: "shallow", kind: "domain", method: "find" });
  if (domain) parts.push(lower({ root: domain, path }));
  const min = root.select({ boundary: "shallow", kind: "min", method: "find" });
  const max = root.select({ boundary: "shallow", kind: "max", method: "find" });
  const divisor = root.select({ boundary: "shallow", kind: "divisor", method: "find" });
  if (min) parts.push(surql`${field} ${new BoundQuery(min.exclusive ? ">" : ">=")} ${min.rule}`);
  if (max) parts.push(surql`${field} ${new BoundQuery(max.exclusive ? "<" : "<=")} ${max.rule}`);
  if (divisor) parts.push(surql`${field} % ${divisor.rule} = 0`);
  const structure = root.select({ boundary: "shallow", kind: "structure", method: "find" });
  if (structure) {
    for (const prop of root.props) {
      if (typeof prop.key !== "string")
        throw new TypeError("Database predicate fields must be strings");
      const property = `${path}.${escapeIdent(prop.key)}`;
      const condition = lower({ root: prop.value, path: property });
      parts.push(
        prop.optional
          ? surql`IF ${new BoundQuery(property)} = NONE THEN true ELSE (${condition}) END`
          : condition,
      );
    }
  }
  return combine(parts);
}
