import { type } from "arktype";
import { RecordId } from "surrealdb";

import { initialDocument } from "../content/initial.ts";
import { document, parseDocument, widget } from "../content/model.ts";
import { getDatabase } from "./client.ts";

const record = new RecordId("portfolio", "local");
const storedPortfolio = type({ content: document, "board?": "string" });
const editResult = type({ content: document }).or({ error: "string" });

export const createWidget = type({ widget });
export const replaceWidget = type({ widget, expected: widget });
export const identifyWidget = type({ id: "string > 0" });
export const moveWidget = type({ id: "string > 0", position: "number.integer >= 0" });

export type Portfolio = typeof storedPortfolio.infer;
export type WidgetChange =
  | { operation: "create"; widget: typeof widget.infer }
  | { operation: "replace"; id: string; widget: typeof widget.infer; expected: typeof widget.infer }
  | { operation: "remove"; id: string }
  | { operation: "move"; id: string; position: number };

/** Initialize once; existing authored content is never reseeded. */
export async function openPortfolio(): Promise<Portfolio> {
  const database = await getDatabase();
  const [result] = await database.query("RETURN fn::portfolio_open($record, $initial);", {
    record,
    initial: initialDocument,
  });
  const stored = storedPortfolio.assert(result);

  return { content: parseDocument(stored.content), board: stored.board };
}

/** The database applies each edit to its current document in one statement. */
export async function editPortfolio(change: WidgetChange) {
  if (change.operation === "create" || change.operation === "replace") {
    const parsed = widget(change.widget);
    if (parsed instanceof type.errors) return parsed;
    if (change.operation === "replace" && parsed.id !== change.id) {
      return new Error("The widget id cannot change during replacement.");
    }
    if (change.operation === "replace") {
      const expected = widget(change.expected);
      if (expected instanceof type.errors) return expected;
      if (expected.id !== change.id) {
        return new Error("The original widget id must match the edited widget.");
      }
    }
  }
  const database = await getDatabase();
  const [result] = await database.query("RETURN fn::portfolio_edit($record, $change);", { record, change });
  const parsed = editResult.assert(result);

  if ("error" in parsed) return new Error(parsed.error);
  return parseDocument(parsed.content);
}

export async function saveBoard(board: string) {
  const database = await getDatabase();
  await database.query("UPDATE ONLY $record SET board = $board RETURN NONE;", { record, board });
}
