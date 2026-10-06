import { observable, when } from "@legendapp/state";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";

vi.mock("@surrealdb/wasm", () => ({ createWasmWorkerEngines: () => ({}) }));
vi.mock("@surrealdb/wasm/worker?worker", () => ({ default: class {} }));

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const setup = async () => {
  const { Surreal } = await import("surrealdb");
  const error = new Error("Connection refused");
  const connect = vi.spyOn(Surreal.prototype, "connect").mockRejectedValue(error);
  const close = vi.spyOn(Surreal.prototype, "close").mockResolvedValue(true);
  const { openLocalDatabase } = await import("./database.client");
  return { close, connect, error, openLocalDatabase, Surreal };
};

test("a failed shared startup closes its client and permits a new attempt", async () => {
  const { close, connect, error, openLocalDatabase } = await setup();
  const first = openLocalDatabase();
  expect(openLocalDatabase()).toBe(first);
  await expect(first).rejects.toMatchObject({ cause: error });
  expect(close).toHaveBeenCalledTimes(1);
  expect(close.mock.contexts[0]).toBe(connect.mock.contexts[0]);

  await expect(openLocalDatabase()).rejects.toMatchObject({ cause: error });
  expect(connect).toHaveBeenCalledTimes(2);
  expect(close).toHaveBeenCalledTimes(2);
  expect(connect.mock.contexts[1]).not.toBe(connect.mock.contexts[0]);
  expect(vi.getTimerCount()).toBe(0);
});

test("the startup deadline closes the pending client", async () => {
  const { close, connect, openLocalDatabase } = await setup();
  const closed$ = observable(false);
  connect.mockImplementation(async () => {
    await when(closed$);
    throw new Error("Connection closed");
  });
  close.mockImplementation(async () => {
    closed$.set(true);
    return true;
  });
  const failure = expect(openLocalDatabase()).rejects.toMatchObject({
    name: "LocalDatabaseUnavailableError",
  });
  await vi.advanceTimersByTimeAsync(10_000);
  await failure;
  expect(close).toHaveBeenCalledTimes(1);
  expect(close.mock.contexts[0]).toBe(connect.mock.contexts[0]);
  expect(vi.getTimerCount()).toBe(0);
});

test("cleanup failure does not replace the startup error", async () => {
  const { close, error, openLocalDatabase } = await setup();
  const closeError = new Error("Close failed");
  close.mockRejectedValue(closeError);
  const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  await expect(openLocalDatabase()).rejects.toMatchObject({ cause: error });
  expect(warning).toHaveBeenCalledWith("Failed to close the database after startup failed", {
    error: closeError,
  });
});

test("a connection that resolves after timeout cannot start installation", async () => {
  const { connect, openLocalDatabase, Surreal } = await setup();
  const released$ = observable(false);
  connect.mockImplementation(async () => {
    await when(released$);
    return true;
  });
  const select = vi
    .spyOn(Surreal.prototype, "use")
    .mockRejectedValue(new Error("Unexpected selection"));
  const install = vi
    .spyOn(Surreal.prototype, "import")
    .mockRejectedValue(new Error("Unexpected installation"));
  const failure = expect(openLocalDatabase()).rejects.toMatchObject({
    name: "LocalDatabaseUnavailableError",
  });
  await vi.advanceTimersByTimeAsync(10_000);
  await failure;
  released$.set(true);
  await vi.advanceTimersByTimeAsync(0);
  expect(select).not.toHaveBeenCalled();
  expect(install).not.toHaveBeenCalled();
});
