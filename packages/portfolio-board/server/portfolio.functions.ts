import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { getRequestHeaders, setResponseHeader } from "@tanstack/react-start/server";
import { redirect, notFound } from "@tanstack/react-router";
import { canvasSnapshot } from "@hyphened/infinite-canvas";
import { type } from "arktype";
import { env } from "cloudflare:workers";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { createAuth } from "./auth.ts";
import { db } from "./database.ts";
import { portfolio } from "../db/schema.ts";

const authentication = createMiddleware({ type: "function" }).server(async ({ next }) => {
  setResponseHeader("Cache-Control", "no-store");
  const session =
    env.BETTER_AUTH_SECRET && env.BETTER_AUTH_URL
      ? await createAuth(env).api.getSession({ headers: getRequestHeaders() })
      : null;
  return next({ context: { userId: session?.user.id } });
});

export const getPortfolio = createServerFn({ method: "GET" })
  .middleware([authentication])
  .handler(async ({ context }) => {
    if (!context.userId)
      throw redirect({
        to: "/auth/$path",
        params: { path: "sign-in" },
        headers: { "Cache-Control": "no-store" },
      });
    const row = await db
      .select({ id: portfolio.id, document: portfolio.draft, revision: portfolio.revision })
      .from(portfolio)
      .where(eq(portfolio.ownerId, context.userId))
      .get();
    return row === undefined ? null : { ...row, document: JSON.stringify(row.document) };
  });

export const savePortfolio = createServerFn({ method: "POST" })
  .middleware([authentication])
  .validator(
    type({
      id: "null",
      revision: "0",
    })
      .or({
        id: "string.uuid",
        revision: "number.integer > 0",
      })
      .and({
        document: "string",
        publish: "boolean = false",
      }),
  )
  .handler(async ({ context, data }) => {
    if (!context.userId) return { status: "unauthenticated" as const };
    const document = canvasSnapshot.assert(JSON.parse(data.document));
    const values = { draft: document, ...(data.publish ? { published: document } : {}) };
    const columns = { id: portfolio.id, revision: portfolio.revision };
    const saved = await (data.id === null
      ? db
          .insert(portfolio)
          .values({ id: crypto.randomUUID(), ownerId: context.userId, ...values })
          .onConflictDoNothing({ target: portfolio.ownerId })
          .returning(columns)
          .get()
      : db
          .update(portfolio)
          .set({ ...values, revision: sql`${portfolio.revision} + 1` })
          .where(
            and(
              eq(portfolio.id, data.id),
              eq(portfolio.ownerId, context.userId),
              eq(portfolio.revision, data.revision),
            ),
          )
          .returning(columns)
          .get());
    if (!saved) return { status: "conflict" as const };
    return { status: data.publish ? ("published" as const) : ("saved" as const), ...saved };
  });

export const getPublishedPortfolio = createServerFn({ method: "GET" })
  .validator(type({ id: "string.uuid" }))
  .handler(async ({ data }) => {
    const row = await db
      .select({ document: portfolio.published })
      .from(portfolio)
      .where(and(eq(portfolio.id, data.id), isNotNull(portfolio.published)))
      .get();
    if (!row?.document) throw notFound();
    return JSON.stringify(row.document);
  });
