import { canvasModel } from "./schema";
import { type, type Type } from "arktype";
import { createElement, type FunctionComponent, type ReactNode } from "react";
import type { InfiniteCanvasHandle } from "./canvas-handle";
import { createInfiniteCanvasWindow } from "./factory";
import { findInfiniteCanvasGroupNode } from "./group-tree";
import type { InfiniteCanvasRect } from "./types";

export type ComponentRenderContext = Readonly<{
  onPropsChange: (props: Record<string, unknown>) => void;
  onTargetSizeChange?: (size: Readonly<{ height: number; element: HTMLDivElement }>) => void;
}>;

export function defineComponent<Schema extends Type, const Id extends string>({
  id,
  schema,
  render,
}: Readonly<{
  id: Id;
  schema: Schema;
  render: (props: Schema["infer"], context: ComponentRenderContext) => ReactNode;
}>) {
  const Component: FunctionComponent<{
    props: Schema["infer"];
    context: ComponentRenderContext;
  }> = ({ props, context }) => render(props, context);
  Component.displayName = id;
  return {
    id,
    schema,
    render(input: unknown, context: ComponentRenderContext) {
      const props = schema(input);
      if (props instanceof type.errors) return props;
      return createElement(Component, { props, context });
    },
  };
}

export type ComponentNode = typeof canvasModel.ComponentNode.infer;
export type ComponentRecordResolver = (reference: typeof canvasModel.RecordRef.infer) => unknown;

/** Creates a window with validated, serializable component props. */
export function createComponentWindow<Kind extends string>({
  id,
  kind,
  definition,
  props,
  rect,
}: Readonly<{
  id: string;
  kind: Kind;
  definition: Readonly<{ id: string; schema: Type }>;
  props: unknown;
  rect: InfiniteCanvasRect;
}>) {
  const input = canvasModel.ComponentCreate({
    windowId: id,
    componentId: definition.id,
    props,
    rect,
  });
  if (input instanceof type.errors) return input;
  const parsed = definition.schema(input.props);
  if (parsed instanceof type.errors) return parsed;
  return createInfiniteCanvasWindow({
    id,
    kind,
    title: definition.id,
    rect,
    data: {
      id,
      kind: "component",
      revision: 0,
      component: { id: definition.id, contractVersion: 1 },
      slots: {},
      props: Object.fromEntries(
        Object.entries(input.props).map(([name, value]) => [
          name,
          { kind: "literal" as const, value },
        ]),
      ),
    },
  });
}

/** Inserts a registered component through the current store. */
export function insertComponent<Kind extends string>({
  handle,
  input,
  components,
  kind,
}: Readonly<{
  handle: Pick<InfiniteCanvasHandle<Kind>, "getState" | "commands">;
  input: unknown;
  components: Readonly<Record<string, Readonly<{ id: string; schema: Type }>>>;
  kind: Kind;
}>) {
  const creation = canvasModel.ComponentCreate(input);
  if (creation instanceof type.errors) return creation;
  const state = handle.getState();
  if (state.windows.some((window) => window.id === creation.windowId))
    return new Error("That window id is already in use.");
  const target = creation.target;
  const group = target && state.groups.find((group) => group.id === target.groupId);
  const container =
    group && findInfiniteCanvasGroupNode(group.tree, target?.containerId ?? group.tree.id);
  if (target && container?.kind !== "container")
    return new Error("The target group container does not exist.");
  if (target?.layout && container?.kind === "container" && container.layout !== "masonry")
    return new Error("Grid placement requires a masonry container.");
  const rect = creation.rect ?? group?.rect;
  if (rect === undefined) return new Error("Supply a rectangle or a target group.");
  const definition = Object.values(components).find((item) => item.id === creation.componentId);
  if (definition === undefined) return new Error("The component is not registered.");
  const window = createComponentWindow({
    id: creation.windowId,
    kind,
    definition,
    props: creation.props,
    rect,
  });
  if (window instanceof type.errors) return window;
  handle.commands.dispatch({ type: "window.open", window, target });
  return (
    handle.getState().windows.find((item) => item.id === window.id) ??
    new Error("The component could not be inserted.")
  );
}

/** Validates and commits an instance edit against the current store revision. */
export function editComponentProps<Kind extends string>({
  handle,
  input,
  components,
  resolveRecord,
}: Readonly<{
  handle: Pick<InfiniteCanvasHandle<Kind>, "getState" | "commands">;
  input: unknown;
  components: Readonly<Record<string, Readonly<{ id: string; schema: Type }>>>;
  resolveRecord: ComponentRecordResolver;
}>) {
  const edit = canvasModel.ComponentPropsEdit(input);
  if (edit instanceof type.errors) return edit;
  const window = handle.getState().windows.find((item) => item.id === edit.windowId);
  if (window === undefined) return new Error("The component window is missing.");
  const instance = canvasModel.ComponentNode(window.data);
  if (instance instanceof type.errors) return instance;
  const definition = Object.values(components).find((item) => item.id === instance.component.id);
  if (definition === undefined) return new Error("The component definition is missing.");
  if (instance.revision !== edit.expectedRevision) {
    return new Error("The component changed after it was read.", {
      cause: { expectedRevision: edit.expectedRevision, currentRevision: instance.revision },
    });
  }
  const props = Object.fromEntries(
    Object.entries(edit.props).map(([name, value]) => [name, { kind: "literal" as const, value }]),
  );
  const bindings = edit.bindings ?? {};
  if (Object.keys(bindings).some((name) => Object.hasOwn(props, name)))
    return new Error("A property cannot receive a literal and a binding in the same edit.");
  const reset = new Set(edit.reset ?? []);
  if ([...Object.keys(props), ...Object.keys(bindings)].some((name) => reset.has(name)))
    return new Error("A property cannot be reset and assigned in the same edit.");
  const retained = Object.fromEntries(
    Object.entries(instance.props).filter(([name]) => !reset.has(name)),
  );
  const data = {
    ...instance,
    revision: instance.revision + 1,
    props: { ...retained, ...props, ...bindings },
  };
  const resolved = resolveComponentProps({ node: data, resolveRecord, schema: definition.schema });
  if (resolved instanceof Error || resolved instanceof type.errors) return resolved;
  handle.commands.setWindowData({ windowId: window.id, data });
  return data;
}

/** Resolve authored props without modifying their source records. */
export function resolveComponentProps({
  node,
  resolveRecord,
  schema,
}: Readonly<{
  node: ComponentNode;
  resolveRecord: ComponentRecordResolver;
  schema?: Type;
}>) {
  const values = Object.entries(node.props).map(([name, property]) => {
    if (property.kind === "literal") {
      return { name, value: property.value, origin: property, missing: false };
    }
    const record = resolveRecord(property.source.record);
    const value = property.path.reduce<unknown>((current, key) => {
      if (current === null || typeof current !== "object" || !Object.hasOwn(current, key))
        return undefined;
      return Reflect.get(current, String(key));
    }, record);
    if (value === undefined && Object.hasOwn(property, "fallback")) {
      return {
        name,
        value: property.fallback,
        origin: { kind: "fallback" as const, binding: property },
        missing: false,
      };
    }
    return { name, value, origin: property, missing: value === undefined };
  });
  const missing = values.find((value) => value.missing);
  if (missing !== undefined)
    return new Error(`The binding for ${missing.name} cannot be resolved.`);
  const props: Record<string, unknown> = Object.fromEntries(
    values.map(({ name, value }) => [name, value]),
  );
  const origins = Object.fromEntries(values.map(({ name, origin }) => [name, origin]));
  if (schema === undefined) return { props, origins };
  const parsed = schema(props);
  if (parsed instanceof type.errors) return parsed;
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
    return new Error("Component props must resolve to an object.");
  return {
    props: parsed as Record<string, unknown>,
    origins: Object.fromEntries(
      Object.keys(parsed).map((name) => [
        name,
        origins[name] ?? { kind: "default", component: node.component },
      ]),
    ),
  };
}
