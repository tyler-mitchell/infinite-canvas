import { useCallback, useEffect, useState } from "react";
import type { Surreal } from "surrealdb";

import { readCatalogue, type SurrealCatalogue } from "../core/catalogue";
import { createSurrealReader, getErrorMessage, type SurrealReader } from "../core/reads";
import type { SurrealInspectorSource } from "../core/source";

/**
 * Connects one source and reads its catalogue.
 *
 * `source.connect` returns the host's existing client, so this hook opens and closes nothing. It
 * owns the reader and the catalogue, both discarded when the source changes.
 *
 * `catalogue` stays `null` until an answer arrives, so panels can distinguish "not read yet" from
 * "no tables".
 */

type SurrealInspection = Readonly<{
  catalogue: SurrealCatalogue | null;
  client: Surreal | null;
  error: string | null;
  reader: SurrealReader | null;
  /** Re-read everything, dropping the cache first. */
  refresh: () => void;
  /** Incremented by `refresh`, so panels with their own reads can depend on it. */
  revision: number;
}>;

function useSurrealInspection(source: SurrealInspectorSource): SurrealInspection {
  const [state, setState] = useState<
    Readonly<{
      catalogue: SurrealCatalogue | null;
      client: Surreal | null;
      error: string | null;
      reader: SurrealReader | null;
    }>
  >({ catalogue: null, client: null, error: null, reader: null });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const cancelled = { value: false };

    setState({ catalogue: null, client: null, error: null, reader: null });

    void (async () => {
      try {
        const client = await source.connect();
        const reader = createSurrealReader(client);
        const catalogue = await readCatalogue(reader);

        if (!cancelled.value) {
          setState({ catalogue, client, error: null, reader });
        }
      } catch (error) {
        if (!cancelled.value) {
          setState({
            catalogue: null,
            client: null,
            error: getErrorMessage(error),
            reader: null,
          });
        }
      }
    })();

    return () => {
      cancelled.value = true;
    };
  }, [revision, source]);

  return {
    ...state,
    refresh: useCallback(() => {
      setRevision((current) => current + 1);
    }, []),
    revision,
  };
}

export { useSurrealInspection };
export type { SurrealInspection };
