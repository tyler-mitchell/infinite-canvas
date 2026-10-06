import manifest from "../../surql/manifest.json";

// Keep database metadata separate from the 11 MB WASM client.
const namespace = "polkadot";
const database = "polkadot";
const endpoint = "indxdb://polkadot";

const modules = import.meta.glob("../../surql/**/*.surql", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Readonly<Record<string, string>>;

const localDatabaseEndpoint = { database, endpoint, namespace };

// The manifest preserves install order and includes each source file.
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
