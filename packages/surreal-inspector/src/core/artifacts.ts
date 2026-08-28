/**
 * Load size and duration of the engine's own resources, read from the performance timeline rather
 * than from the database.
 *
 * A `transferSize` of zero with a non-zero decoded size means the browser served it from its HTTP
 * cache. This is unrelated to the inspector's read cache.
 */

type SurrealArtifact = Readonly<{
  decodedBytes: number;
  durationMs: number;
  encodedBytes: number;
  /** Served from the HTTP cache; nothing crossed the network. */
  fromCache: boolean;
  name: string;
  transferBytes: number;
}>;

/**
 * Matches the WebAssembly binary, its worker, and the SDK bundle. Kept narrow because a looser
 * `surreal` pattern also matched this package's own modules under a dev server.
 */
const ENGINE_PATTERN = /\.wasm(?:$|[?#])|surrealdb|worker-agent/iu;

function toArtifact(entry: PerformanceResourceTiming): SurrealArtifact {
  return {
    decodedBytes: entry.decodedBodySize,
    durationMs: entry.duration,
    encodedBytes: entry.encodedBodySize,
    fromCache: entry.transferSize === 0 && entry.decodedBodySize > 0,
    name: entry.name,
    transferBytes: entry.transferSize,
  };
}

// Does not call `clearResourceTimings`, which would delete entries the host also reads.
function readEngineArtifacts(): readonly SurrealArtifact[] {
  if (typeof performance === "undefined") {
    return [];
  }

  return performance
    .getEntriesByType("resource")
    .filter((entry): entry is PerformanceResourceTiming => "transferSize" in entry)
    .filter((entry) => ENGINE_PATTERN.test(entry.name))
    .map(toArtifact)
    .toSorted((left, right) => right.decodedBytes - left.decodedBytes);
}

export { readEngineArtifacts };
export type { SurrealArtifact };
