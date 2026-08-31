import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { SurrealMigrationManifest } from "surreal-inspector";

/** The loader resolves each listed SurQL file relative to the manifest. */

type ManifestFile = Readonly<{
  stages: readonly Readonly<{ files: readonly string[]; name: string }>[];
  version: number;
}>;

async function loadManifest(manifestPath: string): Promise<SurrealMigrationManifest> {
  const absolute = resolve(manifestPath);
  const parsed = JSON.parse(await readFile(absolute, "utf8")) as ManifestFile;
  const root = dirname(absolute);

  return {
    stages: await Promise.all(
      parsed.stages.map(async (stage) => ({
        files: await Promise.all(
          stage.files.map(async (path) => ({
            path,
            source: await readFile(resolve(root, path), "utf8"),
          })),
        ),
        name: stage.name,
      })),
    ),
    version: parsed.version,
  };
}

export { loadManifest };
