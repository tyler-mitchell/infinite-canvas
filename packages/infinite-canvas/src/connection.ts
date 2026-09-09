import type { InfiniteCanvasConnection, InfiniteCanvasState } from "./types";

/**
 * A connection is document state, like a window: it undoes, and it serializes.
 *
 * The endpoints are window ids rather than object references, so a connection survives every edit
 * that replaces a window record. Nothing here checks that the endpoints exist. Rendering already
 * skips an edge whose ends it cannot find, and refusing to store one would make the order in which
 * a consumer opens a window and its edges load-bearing.
 */

/** Adds one connection. An id that is already present wins, so replay is safe. */
function openInfiniteCanvasConnection<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  connection: InfiniteCanvasConnection,
): InfiniteCanvasState<Kind> {
  return state.connections.some((candidate) => candidate.id === connection.id)
    ? state
    : { ...state, connections: [...state.connections, connection] };
}

function closeInfiniteCanvasConnection<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  connectionId: string,
): InfiniteCanvasState<Kind> {
  const connections = state.connections.filter((connection) => connection.id !== connectionId);

  // The same array when nothing matched, so the reducer records no checkpoint.
  return connections.length === state.connections.length ? state : { ...state, connections };
}

/** Merges a patch into one connection. The id is fixed, so a patch cannot move a record. */
function updateInfiniteCanvasConnection<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{ connectionId: string; patch: Partial<InfiniteCanvasConnection> }>,
): InfiniteCanvasState<Kind> {
  if (!state.connections.some((connection) => connection.id === input.connectionId)) {
    return state;
  }

  return {
    ...state,
    connections: state.connections.map((connection) =>
      connection.id === input.connectionId
        ? { ...connection, ...input.patch, id: connection.id }
        : connection,
    ),
  };
}

/**
 * Drops every edge that touches a closed window.
 *
 * Closing a window already detaches it from its groups and workspaces. An edge left behind would
 * serialize forever and reconnect itself if a later window reused the id. Undo restores it with the
 * window, because both live in the same document.
 */
function detachInfiniteCanvasConnectionsFromWindow<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
): InfiniteCanvasState<Kind> {
  const connections = state.connections.filter(
    (connection) => connection.from !== windowId && connection.to !== windowId,
  );

  return connections.length === state.connections.length ? state : { ...state, connections };
}

export {
  closeInfiniteCanvasConnection,
  detachInfiniteCanvasConnectionsFromWindow,
  openInfiniteCanvasConnection,
  updateInfiniteCanvasConnection,
};
