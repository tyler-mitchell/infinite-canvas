import { defineTextTool, textPage, type ModelContextTool } from "model-context";
import { type } from "arktype";

import { widgetKinds } from "../content/model.ts";
import { createWidget, identifyWidget, moveWidget, replaceWidget, type WidgetChange } from "./portfolio.ts";
import { changePortfolio } from "./mutations.ts";
import { portfolioQuery } from "./queries.ts";
import { queryClient } from "./query-client.ts";

const inputs = type.module({
  Page: { offset: "number.integer >= 0 = 0" },
  Read: identifyWidget.merge({ offset: "number.integer >= 0 = 0" }),
  Catalog: { "...": "Page", "kind?": type.enumerated(...Object.keys(widgetKinds)) },
  Create: { widget: "object" },
  Replace: { expected: "object", widget: "object" },
});

async function write(change: WidgetChange) {
  const result = await changePortfolio(change);
  if (result instanceof Error || result instanceof type.errors) return refusal(result);
  return JSON.stringify({ operation: change.operation, saved: true });
}

const refusal = (error: unknown) => {
  console.warn("The portfolio edit was refused.", error);
  if (error instanceof type.errors) return `Refused: ${error.summary}`;
  if (error instanceof Error) return `Refused: ${error.message}`;
  return "Refused: the portfolio could not be saved.";
};

export const contentTools: readonly ModelContextTool[] = [
  defineTextTool({
    name: "portfolio.read",
    description: "List card ids and kinds in order. JSON text pages continue with nextOffset. Use widget.read for content.",
    inputSchema: inputs.Page.toJsonSchema(),
    execute: async (raw) => {
      const { offset } = inputs.Page.assert(raw ?? {});
      return textPage({ offset, text: JSON.stringify((await queryClient.fetchQuery(portfolioQuery)).content.widgets.map(({ id, kind }) => ({ id, kind }))) });
    },
  }),
  defineTextTool({
    name: "widget.catalog",
    description: "List card kinds. Supply kind for its schema. JSON text pages continue with nextOffset.",
    inputSchema: inputs.Catalog.toJsonSchema(),
    execute: async (raw) => {
      const { kind, offset } = inputs.Catalog.assert(raw ?? {});
      if (kind === undefined) return textPage({ offset, text: JSON.stringify(Object.keys(widgetKinds)) });
      const entry = Object.entries(widgetKinds).find(([name]) => name === kind);
      return entry === undefined ? "Refused: unknown card kind." : textPage({ offset, text: JSON.stringify(entry[1].toJsonSchema()) });
    },
  }),
  defineTextTool({
    name: "widget.read",
    description: "Read one card as JSON text pages. Continue with nextOffset. portfolio.read lists ids.",
    inputSchema: inputs.Read.toJsonSchema(),
    execute: async (raw) => {
      const { id, offset } = inputs.Read.assert(raw);
      const { content } = await queryClient.fetchQuery(portfolioQuery);
      const found = content.widgets.find((item) => item.id === id);
      if (found === undefined) return "Refused: no widget has that id.";
      return textPage({ offset, text: JSON.stringify(found) });
    },
  }),
  defineTextTool({
    name: "widget.create",
    description: "Append a card. Supply a unique stable id and the complete fields from widget.catalog.",
    inputSchema: inputs.Create.toJsonSchema(),
    execute: async (raw) => {
      try { return await write({ operation: "create", ...createWidget.assert(raw) }); }
      catch (error) { return refusal(error); }
    },
  }),
  defineTextTool({
    name: "widget.replace",
    description: "Replace a card’s fields. Supply the unchanged original as expected and edited values as widget. Concurrent changes are refused.",
    inputSchema: inputs.Replace.toJsonSchema(),
    execute: async (raw) => {
      try {
        const { widget, expected } = replaceWidget.assert(raw);
        return await write({ operation: "replace", id: widget.id, widget, expected });
      } catch (error) { return refusal(error); }
    },
  }),
  defineTextTool({
    name: "widget.remove",
    description: "Delete one authored card. Its canvas window is also removed, including detached windows.",
    inputSchema: identifyWidget.toJsonSchema(),
    execute: async (raw) => {
      try { return await write({ operation: "remove", ...identifyWidget.assert(raw) }); }
      catch (error) { return refusal(error); }
    },
  }),
  defineTextTool({
    name: "widget.move",
    description: "Move a card in document order. Position zero is first; positions past the end append it.",
    inputSchema: moveWidget.toJsonSchema(),
    execute: async (raw) => {
      try { return await write({ operation: "move", ...moveWidget.assert(raw) }); }
      catch (error) { return refusal(error); }
    },
  }),
];
