/**
 * Surveys IndexedDB storage by querying the browser rather than SurrealDB. Opens no engine and
 * needs no connection, so it still reports on a database whose engine fails to start.
 *
 * Entry counts are exact. Byte figures are origin-level only: `quota` and `usage` cover the whole
 * origin, `usageDetails` is Chromium-only, and IndexedDB reports no per-store byte count.
 */

/** Timeout for opening a database, so one held open elsewhere does not block the survey. */
const OPEN_TIMEOUT_MS = 2000;

type SurrealObjectStoreSurvey = Readonly<{
  entries: number | null;
  name: string;
}>;

type SurrealDatabaseSurvey = Readonly<{
  name: string;
  stores: readonly SurrealObjectStoreSurvey[];
  unreadable: string | null;
  version: number | null;
}>;

type SurrealStorageSurvey = Readonly<{
  databases: readonly SurrealDatabaseSurvey[];
  /** False when `indexedDB.databases()` is unavailable, meaning unknown rather than empty. */
  enumerable: boolean;
  persisted: boolean | null;
  quotaBytes: number | null;
  unreadable: string | null;
  usageBytes: number | null;
  /** Chromium's non-standard `usageDetails`. `null` elsewhere, meaning absent rather than zero. */
  usageByBackend: Readonly<Record<string, number>> | null;
}>;

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function toPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB request failed"));
    };
  });
}

/**
 * Opens an existing database read-only. `open` without a version creates the database if absent,
 * so `upgradeneeded` firing means the name went stale, and the transaction is aborted instead.
 */
function openExisting(name: string) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name);
    const timer = setTimeout(() => {
      reject(new Error(`Timed out opening "${name}" — another connection is blocking it.`));
    }, OPEN_TIMEOUT_MS);

    request.onupgradeneeded = () => {
      request.transaction?.abort();
      clearTimeout(timer);
      reject(new Error(`"${name}" no longer exists.`));
    };
    request.onblocked = () => {
      clearTimeout(timer);
      reject(new Error(`"${name}" is blocked by an open connection with a different version.`));
    };
    request.onsuccess = () => {
      clearTimeout(timer);
      resolve(request.result);
    };
    request.onerror = () => {
      clearTimeout(timer);
      reject(request.error ?? new Error(`Could not open "${name}"`));
    };
  });
}

async function surveyDatabase(
  entry: Readonly<{ name: string; version: number | null }>,
): Promise<SurrealDatabaseSurvey> {
  try {
    const database = await openExisting(entry.name);
    const names = [...database.objectStoreNames];

    try {
      if (names.length === 0) {
        return { name: entry.name, stores: [], unreadable: null, version: database.version };
      }

      const transaction = database.transaction(names, "readonly");
      const stores = await Promise.all(
        names.map(async (name) => ({
          entries: await toPromise(transaction.objectStore(name).count()),
          name,
        })),
      );

      return { name: entry.name, stores, unreadable: null, version: database.version };
    } finally {
      database.close();
    }
  } catch (error) {
    return {
      name: entry.name,
      stores: [],
      unreadable: toMessage(error),
      version: entry.version,
    };
  }
}

async function readOriginUsage() {
  if (typeof navigator === "undefined" || navigator.storage === undefined) {
    return { persisted: null, quotaBytes: null, usageByBackend: null, usageBytes: null };
  }

  const estimate = await navigator.storage.estimate();
  const details = (estimate as Readonly<{ usageDetails?: Record<string, number> }>).usageDetails;

  return {
    persisted: await navigator.storage.persisted().catch(() => null),
    quotaBytes: estimate.quota ?? null,
    usageByBackend: details ?? null,
    usageBytes: estimate.usage ?? null,
  };
}

async function surveyStorage(): Promise<SurrealStorageSurvey> {
  const usage = await readOriginUsage();

  if (typeof indexedDB === "undefined" || typeof indexedDB.databases !== "function") {
    return {
      ...usage,
      databases: [],
      enumerable: false,
      unreadable: "This browser does not implement indexedDB.databases().",
    };
  }

  try {
    const listed = await indexedDB.databases();
    const named = listed.flatMap((entry) =>
      entry.name === undefined ? [] : [{ name: entry.name, version: entry.version ?? null }],
    );

    return {
      ...usage,
      databases: await Promise.all(
        named
          .toSorted((left, right) => left.name.localeCompare(right.name))
          .map((entry) => surveyDatabase(entry)),
      ),
      enumerable: true,
      unreadable: null,
    };
  } catch (error) {
    return { ...usage, databases: [], enumerable: false, unreadable: toMessage(error) };
  }
}

/**
 * Exact byte count for one database, obtained by walking every entry and summing key and value
 * sizes. SurrealDB's `indxdb` store holds both as raw byte arrays, so the sum is what it wrote.
 *
 * This is a logical payload figure and undercounts disk usage, which also includes the storage
 * engine's own keys, journal, and unreclaimed space. The two are never combined. Not run
 * automatically, because it deserialises every value in the database.
 */
type SurrealPayloadMeasurement = Readonly<{
  entries: number;
  /** False when an entry was not a byte array and its size came from its JSON form instead. */
  exact: boolean;
  keyBytes: number;
  name: string;
  valueBytes: number;
}>;

function sizeOf(value: unknown) {
  if (typeof value === "object" && value !== null && "byteLength" in value) {
    return { bytes: (value as Readonly<{ byteLength: number }>).byteLength, exact: true };
  }

  const encoded = JSON.stringify(value);

  return { bytes: encoded === undefined ? 0 : new Blob([encoded]).size, exact: false };
}

async function measureDatabasePayload(name: string): Promise<SurrealPayloadMeasurement> {
  const database = await openExisting(name);
  const stores = [...database.objectStoreNames];
  const totals = { entries: 0, exact: true, keyBytes: 0, valueBytes: 0 };

  try {
    if (stores.length === 0) {
      return { ...totals, name };
    }

    const transaction = database.transaction(stores, "readonly");

    await Promise.all(
      stores.map(
        (store) =>
          new Promise<void>((resolve, reject) => {
            const request = transaction.objectStore(store).openCursor();

            request.onsuccess = () => {
              const cursor = request.result;

              if (cursor === null) {
                resolve();

                return;
              }

              const key = sizeOf(cursor.key);
              const value = sizeOf(cursor.value);

              totals.entries += 1;
              totals.exact = totals.exact && key.exact && value.exact;
              totals.keyBytes += key.bytes;
              totals.valueBytes += value.bytes;
              cursor.continue();
            };
            request.onerror = () => {
              reject(request.error ?? new Error(`Could not read "${store}"`));
            };
          }),
      ),
    );

    return { ...totals, name };
  } finally {
    database.close();
  }
}

export { measureDatabasePayload, surveyStorage };
export type {
  SurrealDatabaseSurvey,
  SurrealObjectStoreSurvey,
  SurrealPayloadMeasurement,
  SurrealStorageSurvey,
};
