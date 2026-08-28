import { createWasmEngines } from "@surrealdb/wasm";
import { Surreal } from "surrealdb";
import { expect, test } from "vite-plus/test";

import { database, namespace } from "./local-database";

/**
 * No write in this app can be driven from a node test. This is where that was established.
 *
 * `connect("mem://")` never settles under `vp test` — not a rejection, a hang. The non-worker
 * engine rules out the Worker as the cause: the WASM engine itself does not start here.
 *
 * The cost is not this file. Every verb that writes has to be verified in a browser, which is why
 * agent verification in this repo runs through one. A test asserting a write is a test that hangs.
 *
 * Skipped rather than deleted so the next person does not repeat the experiment. Flip it if the
 * environment gains a browser runner or a WASM-capable one — jsdom is not installed, so that is
 * the first thing to try.
 */
test.skip("an in-memory database opens and answers a query", async () => {
  const client = new Surreal({ engines: createWasmEngines() });

  await client.connect("mem://");
  await client.use({ database, namespace });

  const [answer] = await client.query<[number]>("RETURN 1 + 1;");

  expect(answer).toBe(2);

  await client.close();
});
