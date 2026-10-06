import { type, type Module, type Type } from "arktype";

export const EntityId = type("string > 0");
export type EntityId = typeof EntityId.infer;

export type ComponentTypes = Module | Readonly<Record<string, Type<any, any>>>;
export type RelationTypes = Module | Readonly<Record<string, Type<any, any>>>;
export type SchemaNames<T> = {
  [K in keyof T]: T[K] extends Type<any, any> ? K : never;
}[keyof T] &
  string;
export type Schema<T> = Extract<T, Type<any, any>>;

export type Components<Types extends ComponentTypes> = {
  readonly [Name in keyof Types as Types[Name] extends Type<any, any> ? Name : never]?: Schema<
    Types[Name]
  >["infer"];
};

export type ComponentInput<Types extends ComponentTypes> = [SchemaNames<Types>] extends [never]
  ? Readonly<Record<string, never>>
  : {
      readonly [Name in keyof Types as Types[Name] extends Type<any, any> ? Name : never]?: Schema<
        Types[Name]
      >["inferIn"];
    };

export type Entity<Types extends ComponentTypes> = {
  readonly id: EntityId;
  readonly components: Components<Types>;
};

export type Relation<Types extends RelationTypes> = {
  [Name in SchemaNames<Types>]: {
    readonly id: EntityId;
    readonly source: EntityId;
    readonly target: EntityId;
    readonly kind: Name;
    readonly data: Schema<Types[Name]>["infer"];
  };
}[SchemaNames<Types>];

export type WorldSnapshot<Types extends ComponentTypes, Relations extends RelationTypes> = {
  readonly entities: readonly Entity<Types>[];
  readonly relations: readonly Relation<Relations>[];
};

export type GraphInput<C extends ComponentTypes, R extends RelationTypes> = {
  readonly entities: readonly { readonly id: string; readonly components: ComponentInput<C> }[];
  readonly relations?: readonly {
    [Name in SchemaNames<R> & string]: {
      readonly id?: EntityId;
      readonly source: string;
      readonly target: string;
      readonly kind: Name;
      readonly data: Schema<R[Name]>["inferIn"];
    };
  }[SchemaNames<R> & string][];
};

export type EntityTree<
  C extends ComponentTypes,
  R extends RelationTypes,
  Name extends SchemaNames<R>,
> = Entity<C> & {
  readonly children: readonly {
    readonly edge: Schema<R[Name]>["infer"];
    readonly target: EntityTree<C, R, Name>;
  }[];
};
