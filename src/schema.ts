import { pgTable, integer, text } from "drizzle-orm/pg-core";

export const cacheTable = pgTable("inventory_cache", {
  player_uuid: text().notNull(),
  profile_uuid: text().notNull().unique(),
  expiration: integer().notNull(),
  data: text().notNull(),
});
