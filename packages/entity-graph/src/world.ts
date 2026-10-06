import type { Components, ComponentTypes, GraphInput, RelationTypes } from "./contracts";
import type { QueryPattern, QueryRow, ValidateQuery } from "./query";
import { openDatabase, type DatabaseEndpoint } from "./database";
import { createDefinition } from "./definition";
import { createOperations, insertGraph, updateGraph } from "./operations";
import { Table } from "surrealdb";
import type { Type } from "arktype";
type Resolved<T extends object> = T extends ComponentTypes
  ? T
  : ReturnType<typeof import("arktype").type.module<T>>;

export type World<Types extends ComponentTypes, Relations extends RelationTypes> = ReturnType<
  typeof createOperations<Types, Relations>
> & {
  transaction<Result>(
    execute: (world: ReturnType<typeof createOperations<Types, Relations>>) => Promise<Result>,
  ): Promise<Result>;
  update<const Pattern extends QueryPattern<Types, Relations>>(input: {
    readonly match: ValidateQuery<Pattern, Types, Relations>;
    readonly set: (entity: QueryRow<Pattern, Types, Relations>) => Components<Types>;
  }): Promise<void>;
  close: () => Promise<void>;
  subscribe: (listener: () => void) => () => void;
};

export function createWorld<
  const Types extends ComponentTypes,
  const Relations extends RelationTypes = {},
>({
  components,
  relations,
  initial,
}: {
  readonly components: Types;
  readonly relations?: Relations;
  readonly initial?: GraphInput<Types, Relations>;
  readonly endpoint?: DatabaseEndpoint;
}): Promise<World<Types, Relations>>;
export function createWorld<
  const ComponentDefinitions extends object,
  const RelationDefinitions extends object = {},
>({
  components,
  relations,
  initial,
}: {
  readonly components: ComponentDefinitions;
  readonly relations?: RelationDefinitions;
  readonly initial?: GraphInput<Resolved<ComponentDefinitions>, Resolved<RelationDefinitions>>;
  readonly endpoint?: DatabaseEndpoint;
}): Promise<World<Resolved<ComponentDefinitions>, Resolved<RelationDefinitions>>>;
export async function createWorld({
  components,
  relations,
  initial,
  endpoint,
}: {
  readonly components: object;
  readonly relations?: object;
  readonly initial?: GraphInput<Record<string, Type<any, any>>, Record<string, Type<any, any>>>;
  readonly endpoint?: DatabaseEndpoint;
}): Promise<unknown> {
  type Types = Record<string, Type<any, any>>;
  type Relations = Record<string, Type<any, any>>;
  const definition = createDefinition({ components, relations: relations ?? {} });
  const { database, store } = await openDatabase(endpoint);
  try {
    await store.transaction(async (store) => {
      const [initialized] = await store.surreal.query<[boolean]>("RETURN $initialized ?? false;");
      if (initialized) return;
      if (initial) await insertGraph<Types, Relations>({ store, definition, initial });
      await store.surreal.query("DEFINE PARAM $initialized VALUE true;");
    });
    const operations = createOperations<Types, Relations>({ store, definition });
    const entities = await database.live(new Table("entity"));
    const relations = await database.live(new Table("relation"));
    return {
      ...operations,
      subscribe(listener: () => void) {
        const stopEntities = entities.subscribe(listener);
        const stopRelations = relations.subscribe(listener);
        return () => {
          stopEntities();
          stopRelations();
        };
      },
      transaction<Result>(execute: (world: typeof operations) => Promise<Result>) {
        return store.transaction((store) =>
          execute(createOperations<Types, Relations>({ store, definition })),
        );
      },
      update(input: Pick<Parameters<typeof updateGraph>[0], "match" | "set">) {
        return store.transaction((store) => updateGraph({ ...input, store, definition }));
      },
      close: () => database.close(),
    };
  } catch (cause) {
    await database.close();
    throw cause;
  }
}
