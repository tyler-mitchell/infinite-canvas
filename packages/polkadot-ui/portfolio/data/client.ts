import { createWasmWorkerEngines } from "@surrealdb/wasm";
import WorkerAgent from "@surrealdb/wasm/worker?worker";
import { Surreal } from "surrealdb";

import schema from "./schema.surql?raw";

const database = new Surreal({
  engines: createWasmWorkerEngines({ createWorker: () => new WorkerAgent() }),
});
const connection: { pending?: Promise<Surreal> } = {};

/** Reuse the local connection; a failed open can be retried. */
export function getDatabase(): Promise<Surreal> {
  if (connection.pending !== undefined) return connection.pending;

  connection.pending = database
    .connect("indxdb://portfolio", { database: "portfolio", namespace: "portfolio" })
    .then(async () => {
      await database.query(schema);
      return database;
    })
    .catch((error: unknown) => {
      connection.pending = undefined;
      console.warn("The portfolio database could not open. A retry is available.", error);
      throw error;
    });

  return connection.pending;
}
