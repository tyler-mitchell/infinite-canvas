import { RecordId } from "surrealdb";
import {
  EntityId,
  type ComponentInput,
  type ComponentTypes,
  type EntityTree,
  type GraphInput,
  type RelationTypes,
  type Schema,
  type SchemaNames,
  type WorldSnapshot,
} from "./contracts";
import { selectGraph, type QueryPattern, type QueryRow, type ValidateQuery } from "./query";
import type { Store } from "./database";
import type { Definition } from "./definition";

type Context = { readonly store: Store; readonly definition: Definition };

export function createOperations<Types extends ComponentTypes, Relations extends RelationTypes>({
  store,
  definition,
}: Context) {
  const { componentSchemas, relationSchemas, ComponentValues, ComponentName, RelationName } =
    definition;

  async function get(): Promise<WorldSnapshot<Types, Relations>>;
  async function get<Result>(
    select: (graph: WorldSnapshot<Types, Relations>) => Result,
  ): Promise<Awaited<Result>>;
  async function get<Name extends SchemaNames<Types>>(input: {
    readonly id: EntityId;
    readonly component: Name;
  }): Promise<Schema<Types[Name]>["infer"] | undefined>;
  async function get<const Names extends readonly SchemaNames<Types>[]>(input: {
    readonly id: EntityId;
    readonly components: Names;
  }): Promise<
    { readonly [Name in Names[number]]: Schema<Types[Name]>["infer"] | undefined } | undefined
  >;
  async function get(
    input?:
      | ((graph: WorldSnapshot<Types, Relations>) => unknown)
      | ({ readonly id: EntityId } & (
          | { readonly component: SchemaNames<Types> }
          | { readonly components: readonly SchemaNames<Types>[] }
        )),
  ): Promise<unknown> {
    if (input === undefined || typeof input === "function") {
      const [graph] = await store.surreal.query<[WorldSnapshot<Types, Relations>]>(`
        RETURN {
          entities: (SELECT record::id(id) AS id, components FROM entity),
          relations: (SELECT record::id(id) AS id, record::id(in) AS source,
            record::id(out) AS target, kind, data FROM relation)
        };
      `);
      return input === undefined ? graph : input(graph);
    }
    const names = ComponentName.array().assert(
      "component" in input ? [input.component] : input.components,
    );
    const entity = await store.surreal.select<{ components: Record<string, unknown> }>(
      new RecordId("entity", input.id),
    );
    if (!entity) return undefined;
    const values = Object.fromEntries(
      names.map((name) => {
        const value = entity.components[name];
        return [name, value === undefined ? undefined : componentSchemas[name]!.out.assert(value)];
      }),
    );
    return "component" in input ? values[input.component] : values;
  }

  return {
    get,
    async spawn({
      id = crypto.randomUUID(),
      components,
    }: {
      readonly id?: EntityId;
      readonly components: ComponentInput<Types>;
    }) {
      await store
        .create("entity", EntityId.assert(id))
        .content({
          components: ComponentValues.assert(components) as Record<string, unknown>,
        })
        .execute();
      return id;
    },
    async set({
      id,
      components,
    }: {
      readonly id: EntityId;
      readonly components: ComponentInput<Types>;
    }) {
      await store.surreal.query(
        "UPDATE ONLY $entity SET components = object::extend(components, $components) RETURN NONE;",
        {
          entity: new RecordId("entity", id),
          components: ComponentValues.assert(components),
        },
      );
    },
    async remove({
      id,
      component,
    }: {
      readonly id: EntityId;
      readonly component: SchemaNames<Types> & string;
    }) {
      await store.surreal.query(
        "UPDATE ONLY $entity SET components = object::remove(components, [$component]);",
        {
          entity: new RecordId("entity", id),
          component: ComponentName.assert(component),
        },
      );
    },
    async despawn(id: EntityId) {
      await store.delete("entity", id).execute();
    },
    async relate<Name extends SchemaNames<Relations> & string>({
      source,
      target,
      relation,
      data,
    }: {
      readonly source: EntityId;
      readonly target: EntityId;
      readonly relation: Name;
      readonly data: Schema<Relations[Name]>["inferIn"];
    }) {
      const kind = RelationName.assert(relation);
      await store.surreal.query(
        "INSERT RELATION INTO relation { in: $source, out: $target, kind: $kind, data: $data } ON DUPLICATE KEY UPDATE data = $input.data RETURN NONE;",
        {
          source: new RecordId("entity", source),
          target: new RecordId("entity", target),
          kind,
          data: relationSchemas[kind]!.assert(data),
        },
      );
    },
    async unrelate({
      source,
      target,
      relation,
    }: {
      readonly source: EntityId;
      readonly target: EntityId;
      readonly relation: SchemaNames<Relations> & string;
    }) {
      await store.surreal.query(
        "DELETE relation WHERE in = $source AND out = $target AND kind = $kind;",
        {
          source: new RecordId("entity", source),
          target: new RecordId("entity", target),
          kind: RelationName.assert(relation),
        },
      );
    },
    async query<const Pattern extends QueryPattern<Types, Relations>>(
      pattern: ValidateQuery<Pattern, Types, Relations>,
    ): Promise<readonly QueryRow<Pattern, Types, Relations>[]> {
      const query = selectGraph({
        pattern,
        components: componentSchemas,
        relations: relationSchemas,
      });
      const [rows] = await store.surreal.query<[QueryRow<Pattern, Types, Relations>[]]>(query);
      return rows;
    },
    async tree<Name extends SchemaNames<Relations> & string>({
      root,
      relation,
    }: {
      readonly root: EntityId;
      readonly relation: Name;
    }) {
      const [tree] = await store.surreal.query<[EntityTree<Types, Relations, Name> | undefined]>(
        `
        RETURN $root.{..}.{
          id: record::id(id), components,
          children: ->(relation WHERE kind = $relation).{ edge: data, target: out.@ }
        };
      `,
        { root: new RecordId("entity", root), relation: RelationName.assert(relation) },
      );
      return tree;
    },
  };
}

export async function insertGraph<Types extends ComponentTypes, Relations extends RelationTypes>({
  store,
  definition,
  initial,
}: Context & {
  readonly initial: GraphInput<Types, Relations>;
}) {
  await store.surreal.query(
    "INSERT INTO entity $entities; INSERT RELATION INTO relation $relations;",
    {
      entities: initial.entities.map(({ id, components }) => ({
        id: new RecordId("entity", EntityId.assert(id)),
        components: definition.ComponentValues.assert(components),
      })),
      relations: (initial.relations ?? []).map(({ id, source, target, kind, data }) => {
        return {
          ...(id === undefined ? {} : { id: new RecordId("relation", EntityId.assert(id)) }),
          in: new RecordId("entity", EntityId.assert(source)),
          out: new RecordId("entity", EntityId.assert(target)),
          kind: definition.RelationName.assert(kind),
          data: definition.relationSchemas[kind]!.assert(data),
        };
      }),
    },
  );
}

export async function updateGraph({
  store,
  definition,
  match,
  set,
}: Context & {
  readonly match: Readonly<Record<string, unknown>>;
  readonly set: (entity: Readonly<Record<string, unknown>> & { readonly id: EntityId }) => unknown;
}) {
  const query = selectGraph({
    pattern: match,
    components: definition.componentSchemas,
    relations: definition.relationSchemas,
  });
  const [entities] =
    await store.surreal.query<[(Readonly<Record<string, unknown>> & { readonly id: EntityId })[]]>(
      query,
    );
  await store.surreal.query(
    "FOR $entity IN $entities { UPDATE ONLY $entity.id SET components = object::extend(components, $entity.components) RETURN NONE; };",
    {
      entities: entities.map((entity) => ({
        id: new RecordId("entity", entity.id),
        components: definition.ComponentValues.out.assert(set(entity)),
      })),
    },
  );
}
