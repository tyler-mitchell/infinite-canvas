/** The browser performance timeline supplies these resource sizes and durations. */

type SurrealArtifact = Readonly<{
  decodedBytes: number;
  durationMs: number;
  encodedBytes: number;
  /** This value is true when the HTTP cache supplies the resource. */
  fromCache: boolean;
  name: string;
  transferBytes: number;
}>;

/** This pattern matches only the WebAssembly binary, worker, and SDK bundle. */
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

// The function keeps resource timings for host consumers.
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
