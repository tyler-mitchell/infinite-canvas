import { expectTypeOf, test } from "vite-plus/test";
import { type, type Type } from "arktype";
import { createWorld, type World } from "../src/world";
import type { QueryPattern } from "../src/query";

const Position = type({ x: "number", y: "number" });
const relations = type.module({ Contains: { weight: "number" } });

function readChildren(world: World<Record<string, typeof Position>, typeof relations>) {
  return world.query({ Contains: { target: { Position: true } } });
}

function register<Components extends Record<string, typeof Position>>(components: Components) {
  return createWorld({ components, relations });
}

function readDynamic(
  world: World<Record<string, typeof Position>, typeof relations>,
  pattern: QueryPattern<Record<string, typeof Position>, typeof relations>,
) {
  return world.query(pattern);
}

function readRegistered(
  world: Awaited<ReturnType<typeof register<{ Position: typeof Position }>>>,
) {
  return world.query({ Position: true });
}

function readSnapshot(
  world: World<{ Position: typeof Position } & Record<string, Type>, typeof relations>,
) {
  return world.get();
}

test("known relations retain their type with dynamic component names", () => {
  expectTypeOf<Awaited<ReturnType<typeof readChildren>>[number]["Contains"]>().toEqualTypeOf<
    readonly {
      readonly edge: { weight: number };
      readonly target: { readonly id: string; readonly Position: { x: number; y: number } };
    }[]
  >();
});

test("registered schemas retain the caller's component keys", () => {
  expectTypeOf<Awaited<ReturnType<typeof readRegistered>>[number]["Position"]>().toEqualTypeOf<{
    x: number;
    y: number;
  }>();
});

test("dynamic patterns preserve registered component data", () => {
  expectTypeOf<Awaited<ReturnType<typeof readDynamic>>[number]["Position"]>().toEqualTypeOf<{
    x: number;
    y: number;
  }>();
});

test("snapshots preserve known components beside runtime registrations", () => {
  expectTypeOf<
    Awaited<ReturnType<typeof readSnapshot>>["entities"][number]["components"]["Position"]
  >().toEqualTypeOf<{ x: number; y: number } | undefined>();
});
