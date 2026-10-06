import { createWasmWorkerEngines } from "@surrealdb/wasm";
import WorkerAgent from "@surrealdb/wasm/worker?worker";
import { Surreal } from "surrealdb";
import { orm, table, t, type Orm } from "surqlize";

const entityTable = table("entity", { components: t.object({}) });
export type Store = Orm<[typeof entityTable]>;
export type DatabaseEndpoint = "mem://" | `indxdb://${string}`;

export async function openDatabase(endpoint: DatabaseEndpoint = "mem://") {
  const database = new Surreal({
    engines: createWasmWorkerEngines({ createWorker: () => new WorkerAgent() }),
  });
  try {
    await database.connect(endpoint, { namespace: "world", database: "world" });
    await database.query(`
      DEFINE TABLE IF NOT EXISTS entity SCHEMAFULL;
      DEFINE FIELD IF NOT EXISTS components ON entity TYPE object FLEXIBLE DEFAULT {};
      DEFINE TABLE IF NOT EXISTS relation TYPE RELATION IN entity OUT entity ENFORCED SCHEMAFULL;
      DEFINE FIELD IF NOT EXISTS kind ON relation TYPE string;
      DEFINE FIELD IF NOT EXISTS data ON relation TYPE any;
      DEFINE INDEX IF NOT EXISTS relation_identity ON relation FIELDS in, kind, out UNIQUE;
    `);
    return { database, store: orm(database, entityTable) };
  } catch (cause) {
    await database.close();
    throw cause;
  }
}
