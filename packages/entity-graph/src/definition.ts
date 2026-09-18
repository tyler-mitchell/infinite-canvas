import { Module, type, type Type } from "arktype";

export function createDefinition({
  components,
  relations,
}: {
  readonly components: object;
  readonly relations: object;
}) {
  const componentSchemas: Record<string, Type<any, any>> = Object.fromEntries(
    Object.entries(
      components instanceof Module
        ? components
        : type.module(Object.fromEntries(Object.entries(components))),
    ),
  );
  const relationSchemas: Record<string, Type<any, any>> = Object.fromEntries(
    Object.entries(
      relations instanceof Module
        ? relations
        : type.module(Object.fromEntries(Object.entries(relations))),
    ),
  );
  const collision = Object.keys(componentSchemas).find(
    (name) => name === "id" || Object.hasOwn(relationSchemas, name),
  );
  if (collision !== undefined || Object.hasOwn(relationSchemas, "id")) {
    throw new TypeError(`Schema name is reserved or repeated: ${collision ?? "id"}`);
  }
  return {
    componentSchemas,
    relationSchemas,
    ComponentValues: type(
      Object.fromEntries(
        Object.entries(componentSchemas).map(([name, schema]) => [`${name}?`, schema]),
      ),
    ).onUndeclaredKey("reject"),
    ComponentName: type.enumerated(...Object.keys(componentSchemas)),
    RelationName: type.enumerated(...Object.keys(relationSchemas)),
  };
}

export type Definition = ReturnType<typeof createDefinition>;
