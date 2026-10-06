import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth.ts";
import type { canvasSnapshot } from "@hyphened/infinite-canvas/next";

export * from "./auth.ts";

export const portfolio = sqliteTable("portfolio", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  draft: text("draft", { mode: "json" }).$type<typeof canvasSnapshot.infer>().notNull(),
  published: text("published", { mode: "json" }).$type<typeof canvasSnapshot.infer>(),
  revision: integer("revision").notNull().default(1),
});
