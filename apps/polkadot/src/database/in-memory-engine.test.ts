import { createWasmEngines } from "@surrealdb/wasm";
import { Surreal } from "surrealdb";
import { expect, test } from "vite-plus/test";

import { database, namespace } from "./local-database";

// The SurrealDB WASM engine does not start under the Node test runner.
test.skip("an in-memory database opens and answers a query", async () => {
  const client = new Surreal({ engines: createWasmEngines() });

  await client.connect("mem://");
  await client.use({ database, namespace });

  const [answer] = await client.query<[number]>("RETURN 1 + 1;");

  expect(answer).toBe(2);

  await client.close();
});
