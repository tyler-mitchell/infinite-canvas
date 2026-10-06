import { type, type Type } from "arktype";
import { BoundQuery, RecordId, escapeIdent, surql } from "surrealdb";
import {
  EntityId,
  type ComponentTypes,
  type RelationTypes,
  type Schema,
  type SchemaNames,
} from "./contracts";
import { combine, predicate } from "./predicate";

export type QueryPattern<C extends ComponentTypes, R extends RelationTypes> = {
  readonly id?: EntityId | readonly EntityId[];
} & { readonly [K in SchemaNames<C>]?: unknown } & {
  readonly [K in SchemaNames<R>]?: {
    readonly target: object;
    readonly edge?: unknown;
    readonly direction?: "incoming" | "outgoing";
  };
};

type ValidateRelation<P, C extends ComponentTypes, R extends RelationTypes> = P extends {
  target: infer Target extends object;
}
  ? {
      [K in keyof P]: K extends "target"
        ? QueryPattern<C, R> & ValidateQuery<Target, C, R>
        : K extends "edge"
          ? type.validate<P[K]>
          : K extends "direction"
            ? "incoming" | "outgoing"
            : never;
    }
  : never;
export type ValidateQuery<P, C extends ComponentTypes, R extends RelationTypes> = object extends P
  ? P
  : {
      [K in keyof P]: K extends "id"
        ? P[K]
        : K extends SchemaNames<R>
          ? ValidateRelation<P[K], C, R>
          : K extends SchemaNames<C>
            ? P[K] extends true
              ? true
              : type.validate<P[K]>
            : never;
    };
type Result<T> = { [K in keyof T]: T[K] };

export type QueryRow<P, C extends ComponentTypes, R extends RelationTypes> = Result<
  { readonly id: EntityId } & {
    [K in keyof P as K extends "id" ? never : K]: K extends SchemaNames<R>
      ? P[K] extends { target: infer Target }
        ? readonly {
            readonly edge: Result<
              Schema<R[K]>["infer"] &
                (P[K] extends { edge: infer Edge } ? type.infer.Out<Edge> : unknown)
            >;
            readonly target: QueryRow<Target, C, R>;
          }[]
        : never
      : K extends SchemaNames<C>
        ? Result<
            Schema<C[K]>["infer"] &
              (unknown extends P[K]
                ? unknown
                : Exclude<P[K], undefined> extends true
                  ? unknown
                  : type.infer.Out<Exclude<P[K], undefined>>)
          >
        : never;
  }
>;

export function selectGraph({
  pattern,
  components,
  relations,
}: {
  readonly pattern: Readonly<Record<string, unknown>>;
  readonly components: Readonly<Record<string, Type<any, any>>>;
  readonly relations: Readonly<Record<string, Type<any, any>>>;
}): BoundQuery {
  function relation(name: string, value: unknown) {
    if (
      !Object.hasOwn(relations, name) ||
      typeof value !== "object" ||
      value === null ||
      !("target" in value) ||
      typeof value.target !== "object" ||
      value.target === null
    )
      throw new TypeError(`Invalid relation query: ${name}`);
    const direction = "direction" in value ? value.direction : "outgoing";
    if (direction !== "incoming" && direction !== "outgoing")
      throw new TypeError("Invalid relation direction");
    const path = {
      incoming: { arrow: "<-", endpoint: "in" },
      outgoing: { arrow: "->", endpoint: "out" },
    }[direction];
    return { ...path, target: value.target, edge: "edge" in value ? value.edge : undefined };
  }

  function edges({
    name,
    value,
    subject,
  }: {
    name: string;
    value: unknown;
    subject: string;
  }): BoundQuery {
    const spec = relation(name, value);
    const conditions = [
      surql`kind = ${name}`,
      matches({ pattern: spec.target, subject: spec.endpoint }),
    ];
    if (spec.edge !== undefined)
      conditions.push(predicate({ definition: spec.edge, path: "data" }));
    return surql`${new BoundQuery(subject + spec.arrow)}(relation WHERE ${combine(conditions)})`;
  }

  function matches({ pattern, subject }: { pattern: object; subject: string }): BoundQuery {
    const conditions: BoundQuery[] = [];
    const prefix = subject ? `${subject}.` : "";
    for (const [name, value] of Object.entries(pattern) as [string, unknown][]) {
      if (name === "id") {
        const ids = (Array.isArray(value) ? value : [value]).map(
          (id) => new RecordId("entity", EntityId.assert(id)),
        );
        conditions.push(surql`${new BoundQuery(`${prefix}id`)} IN ${ids}`);
      } else if (Object.hasOwn(components, name)) {
        const path = `${prefix}components.${escapeIdent(name)}`;
        conditions.push(new BoundQuery(`${path} != NONE`));
        if (value !== true) conditions.push(predicate({ definition: value, path }));
      } else {
        conditions.push(surql`count(${edges({ name, value, subject })}) > 0`);
      }
    }
    return combine(conditions);
  }

  function project(pattern: object): BoundQuery {
    const fields = new BoundQuery("{ id: record::id(id)");
    for (const [name, value] of Object.entries(pattern) as [string, unknown][]) {
      if (name === "id") continue;
      const alias = escapeIdent(name);
      if (Object.hasOwn(components, name)) {
        fields.append(`, ${alias}: components.${alias}`);
      } else {
        const spec = relation(name, value);
        fields.append(
          surql`, ${new BoundQuery(alias)}: ${edges({ name, value, subject: "" })}.{ edge: data, target: ${new BoundQuery(spec.endpoint)}.${project(spec.target)} }`,
        );
      }
    }
    return fields.append(" }");
  }

  return surql`SELECT VALUE ${project(pattern)} FROM entity WHERE ${matches({ pattern, subject: "" })}`;
}
