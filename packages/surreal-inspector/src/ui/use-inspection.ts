import { useCallback, useEffect, useState } from "react";
import type { Surreal } from "surrealdb";

import { readCatalogue, type SurrealCatalogue } from "../core/catalogue";
import { createSurrealReader, getErrorMessage, type SurrealReader } from "../core/reads";
import type { SurrealInspectorSource } from "../core/source";

/** The hook reuses the host client and clears state when the source changes. */

type SurrealInspection = Readonly<{
  catalogue: SurrealCatalogue | null;
  client: Surreal | null;
  error: string | null;
  reader: SurrealReader | null;
  /** This method starts a new source read. */
  refresh: () => void;
  /** This value increases after each refresh. */
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
