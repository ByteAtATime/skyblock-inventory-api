import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const cacheTable = sqliteTable("inventory_cache", {
    player_uuid: text().notNull(),
    profile_uuid: text().notNull().unique(),
    expiration: int().notNull(),
    data: text().notNull()
})