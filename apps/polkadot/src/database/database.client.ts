import { createWasmWorkerEngines } from "@surrealdb/wasm";
import WorkerAgent from "@surrealdb/wasm/worker?worker";
import { type } from "arktype";
import { StringRecordId, Surreal } from "surrealdb";

import manifest from "../../surql/manifest.json";

const namespace = "polkadot";
const database = "polkadot";
const endpoint = "indxdb://polkadot";
const modules = import.meta.glob("../../surql/**/*.surql", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Readonly<Record<string, string>>;

const lifecycle: { promise?: Promise<Surreal> } = {};

const CanvasRecord = type({
  id: "string",
  layout: "object",
  revision: "number.integer >= 0",
  title: "string > 0",
}).onUndeclaredKey("delete");

type CanvasRecord = typeof CanvasRecord.infer;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

class CanvasRevisionConflictError extends Error {
  override readonly name = "CanvasRevisionConflictError";
  readonly canvasId: string;
  readonly expectedRevision: number;

  constructor(input: Readonly<{ canvasId: string; expectedRevision: number }>) {
    super(`Canvas ${input.canvasId} changed after revision ${input.expectedRevision}`);
    this.canvasId = input.canvasId;
    this.expectedRevision = input.expectedRevision;
  }
}

function createClient() {
  return new Surreal({
    engines: {
      ...createWasmWorkerEngines({ createWorker: () => new WorkerAgent() }),
    },
  });
}

async function connectAndInstall() {
  const client = createClient();

  try {
    try {
      await client.connect(endpoint);
    } catch (error) {
      throw new Error(`Failed to open ${endpoint}: ${getErrorMessage(error)}`, { cause: error });
    }

    try {
      await client.use({ database, namespace });
    } catch (error) {
      throw new Error(`Failed to select ${namespace}/${database}: ${getErrorMessage(error)}`, {
        cause: error,
      });
    }

    for (const stage of manifest.stages) {
      for (const file of stage.files) {
        const source = modules[`../../surql/${file}`];

        if (source === undefined) {
          throw new Error(`Missing SurQL manifest entry: ${file}`);
        }

        try {
          await client.import(source);
        } catch (error) {
          throw new Error(`Failed to install ${file}: ${getErrorMessage(error)}`, { cause: error });
        }
      }
    }

    return client;
  } catch (error) {
    await client.close();
    throw error;
  }
}

function openLocalDatabase() {
  lifecycle.promise ??= connectAndInstall().catch((error) => {
    lifecycle.promise = undefined;
    throw error;
  });

  return lifecycle.promise;
}

async function openDefaultCanvas(initialLayout: object): Promise<CanvasRecord> {
  const client = await openLocalDatabase();
  // One statement, one result. `LET $x = …; RETURN $x;` is two statements, and SurrealDB answers
  // with one result per statement — so destructuring `[record]` read the `LET`, which is NONE.
  const [record] = await client
    .query<[unknown]>("RETURN fn::open_default_canvas($layout);", { layout: initialLayout })
    .json();

  return CanvasRecord.assert(record);
}

async function saveCanvas(
  input: Readonly<{
    canvasId: string;
    layout: object;
    revision: number;
  }>,
): Promise<CanvasRecord> {
  const client = await openLocalDatabase();
  const [record] = await client
    .query<[unknown]>("RETURN fn::save_canvas($canvas, $revision, $layout);", {
      canvas: new StringRecordId(input.canvasId),
      layout: input.layout,
      revision: input.revision,
    })
    .json();

  if (record === null || record === undefined) {
    throw new CanvasRevisionConflictError({
      canvasId: input.canvasId,
      expectedRevision: input.revision,
    });
  }

  return CanvasRecord.assert(record);
}

async function closeLocalDatabase() {
  const pending = lifecycle.promise;
  lifecycle.promise = undefined;

  if (pending === undefined) {
    return;
  }

  const client = await pending.catch(() => null);
  await client?.close();
}

export {
  CanvasRevisionConflictError,
  closeLocalDatabase,
  openDefaultCanvas,
  openLocalDatabase,
  saveCanvas,
};
export type { CanvasRecord };
