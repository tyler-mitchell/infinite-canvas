import { canvasModel, editComponentProps, getInfiniteCanvasContextualCommands, insertComponent, resolveComponentProps, type InfiniteCanvasHandle } from "@hyphened/infinite-canvas";
import { defineTextTool, textPage, type ModelContextTool } from "model-context";
import { type } from "arktype";

import { BOARD_GROUP_ID } from "./layout.ts";
import { componentConfiguration, componentInstance } from "../content/model.ts";
import { portfolioQuery } from "../data/queries.ts";
import { queryClient } from "../data/query-client.ts";
import { components } from "../widgets/content.tsx";

const inputs = type.module({
  Page: { offset: "number.integer >= 0 = 0" },
  Identification: { "...": "Page", id: canvasModel.Id },
  Catalog: { "...": "Page", "id?": canvasModel.Id },
  Placement: { id: "string > 0", x: canvasModel.Cell, y: canvasModel.Cell },
  Command: { id: canvasModel.Id },
});

export function boardTools(handle: InfiniteCanvasHandle<"widget">): readonly ModelContextTool[] {
  return [
    defineTextTool({
      name: "command.list",
      description: "List available command ids. Read before executing a command.",
      execute: async () => JSON.stringify(getInfiniteCanvasContextualCommands(handle.getState()).filter((command) => command.enabled).map(({ id }) => id)),
    }),
    defineTextTool({
      name: "command.execute",
      description: "Execute an available canvas command by its catalog id. Uses the same command path as the visible controls. Persistence is debounced.",
      inputSchema: inputs.Command.toJsonSchema(),
      execute: async (raw) => {
        const input = inputs.Command(raw);
        if (input instanceof type.errors) return `Refused: ${input.summary}`;
        const command = getInfiniteCanvasContextualCommands(handle.getState()).find((item) => item.id === input.id);
        if (command?.enabled !== true) return "Refused: that command is unavailable in the current state.";
        handle.commands.executeCommand(command.command);
        return JSON.stringify({ executed: input.id });
      },
    }),
    defineTextTool({
      name: "component.create",
      description: "Create a component with props and either rect or target:{groupId,containerId?,index?,layout?:{x,y,span,rows}}. Container defaults to the group root.",
      inputSchema: canvasModel.ComponentCreate.merge({ props: "object" }).toJsonSchema(),
      execute: async (raw) => {
        const result = insertComponent({ handle, components, kind: "widget", input: raw });
        if (result instanceof type.errors) return `Refused: ${result.summary}`;
        if (result instanceof Error) return `Refused: ${result.message}`;
        return JSON.stringify({ id: result.id });
      },
    }),
    defineTextTool({
      name: "component.inspect",
      description: "Read one component and prop origins as JSON text pages. Continue with nextOffset.",
      inputSchema: inputs.Identification.toJsonSchema(),
      execute: async (raw) => {
        const { id, offset } = inputs.Identification.assert(raw);
        const window = handle.getState().windows.find((item) => item.id === id);
        const node = componentInstance(window?.data);
        if (node instanceof type.errors) return `Refused: ${node.summary}`;
        const { content } = await queryClient.fetchQuery(portfolioQuery);
        const resolved = resolveComponentProps({
          node,
          schema: Object.values(components).find((item) => item.id === node.component.id)?.schema,
          resolveRecord: (reference) => content.widgets.find((item) => reference.model.contractVersion === 1 && item.id === reference.recordId && item.kind === reference.model.id),
        });
        if (resolved instanceof Error) return `Refused: ${resolved.message}`;
        if (resolved instanceof type.errors) return `Refused: ${resolved.summary}`;
        return textPage({ offset, text: JSON.stringify({
          id: node.id, component: node.component, revision: node.revision, props: resolved.props,
          origins: Object.fromEntries(Object.entries(resolved.origins).map(([key, origin]) => [key,
            origin.kind === "literal" ? { kind: "literal" } : origin,
          ])),
        }) });
      },
    }),
    defineTextTool({
      name: "component.catalog",
      description: "List component ids. Supply id for its schema. JSON text pages continue with nextOffset.",
      inputSchema: inputs.Catalog.toJsonSchema(),
      execute: async (raw) => {
        const { id, offset } = inputs.Catalog.assert(raw ?? {});
        const definitions = Object.values(components);
        if (id === undefined) return textPage({ offset, text: JSON.stringify(definitions.map(({ id }) => id)) });
        const definition = definitions.find((item) => item.id === id);
        return definition === undefined ? "Refused: the component is not registered." : textPage({ offset, text: JSON.stringify(definition.schema.in.toJsonSchema()) });
      },
    }),
    defineTextTool({
      name: "component.configure",
      description: "Edit props or record bindings; reset removes overrides. Supply expectedRevision. Use props:{} for binding/reset-only edits.",
      inputSchema: componentConfiguration.merge({ props: "object", "bindings?": type({ "[string]": canvasModel.RecordBinding.merge({ "fallback?": "unknown" }) }) }).toJsonSchema(),
      execute: async (input) => {
        const { content } = await queryClient.fetchQuery(portfolioQuery);
        const result = editComponentProps({
          handle, components, input,
          resolveRecord: (reference) => content.widgets.find((item) => reference.model.contractVersion === 1 && item.id === reference.recordId && item.kind === reference.model.id),
        });
        if (result instanceof type.errors) return `Refused: ${result.summary}`;
        if (result instanceof Error) return `Refused: ${result.message}`;
        return JSON.stringify({ id: result.id, revision: result.revision });
      },
    }),
    defineTextTool({
      name: "board.describe",
      description: "Read camera, windows, and group containers for insertion targets. JSON text pages continue with nextOffset.",
      inputSchema: inputs.Page.toJsonSchema(),
      execute: async (raw) => {
        const { offset } = inputs.Page.assert(raw ?? {});
        const state = handle.getState();
        return textPage({ offset, text: JSON.stringify({ camera: state.camera, groups: state.groups.map(({ id, rect, tree }) => ({ id, rect, tree })), windows: state.windows.map(({ id, rect, mode }) => ({ id, rect, mode })) }) });
      },
    }),
    defineTextTool({
      name: "board.place",
      description: "Place a docked card at grid coordinates. Edit its span with widget.replace to change width.",
      inputSchema: inputs.Placement.toJsonSchema(),
      execute: async (raw) => {
        const { id, x, y } = inputs.Placement.assert(raw);
        const group = handle.getState().groups.find((item) => item.id === BOARD_GROUP_ID);
        if (group?.tree.kind !== "container" || !group.tree.children.some((item) => item.id === id)) {
          return "Refused: that card is not docked on the board.";
        }
        handle.commands.setGroupChildLayouts({ groupId: BOARD_GROUP_ID, layouts: { [id]: { x, y } } });
        return JSON.stringify(handle.snapshot());
      },
    }),
  ];
}
