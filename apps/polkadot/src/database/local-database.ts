import manifest from "../../surql/manifest.json";

/**
 * Where the local database is and what gets installed into it — without the engine.
 *
 * Split out of `database.client` on purpose. That module imports an eleven-megabyte WebAssembly
 * engine, so anything importing it pays for the engine; and two things now need to know only the
 * database's *address and schema source* — the client that opens it, and the inspector handle that
 * describes it before anything is opened. Constants that cost 11 MB to read are not constants.
 */

const namespace = "polkadot";
const database = "polkadot";
const endpoint = "indxdb://polkadot";

const modules = import.meta.glob("../../surql/**/*.surql", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Readonly<Record<string, string>>;

/** The connection string this app opens, which is also the IndexedDB database's name. */
const localDatabaseEndpoint = { database, endpoint, namespace };

/**
 * The SurQL this database installs, in the order it installs it, with each file's source attached.
 *
 * The install is additive: every statement in the corpus is guarded by `IF NOT EXISTS`, so a
 * definition that changes in the source is never applied to a database that already holds the old
 * one. Nothing records which files ran and there is no schema-version row to consult — so the only
 * way to know whether a database still matches the source is to compare the two, and this is the
 * side of that comparison the database cannot supply.
 */
const installedSurql = {
  stages: manifest.stages.map((stage) => ({
    files: stage.files.map((file) => ({
      path: file,
      source: modules[`../../surql/${file}`] ?? "",
    })),
    name: stage.name,
  })),
  version: manifest.version,
};

export { database, endpoint, installedSurql, localDatabaseEndpoint, manifest, modules, namespace };
