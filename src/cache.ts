import { drizzle } from "drizzle-orm/node-postgres";
import { cacheTable } from "@/schema.ts";
import { and, eq } from "drizzle-orm";

const db = drizzle(import.meta.env.DATABASE_URL!);

export class Cache {
  public async insert(
    playerUuid: string,
    profileUuid: string,
    data: string,
    ttl = 1000 * 60 * 60
  ) {
    const expiration = Date.now() + ttl;

    await db.insert(cacheTable).values({
      player_uuid: playerUuid,
      profile_uuid: profileUuid,
      data,
      expiration,
    });
  }

  public async get(
    playerUuid: string,
    profileUuid: string
  ): Promise<string | undefined> {
    const rows = await db
      .select()
      .from(cacheTable)
      .where(
        and(
          eq(cacheTable.player_uuid, playerUuid),
          eq(cacheTable.profile_uuid, profileUuid)
        )
      );
    const row = rows[0];

    if (!row) return undefined;

    if (row.expiration < Date.now()) {
      await db
        .delete(cacheTable)
        .where(
          and(
            eq(cacheTable.player_uuid, playerUuid),
            eq(cacheTable.profile_uuid, profileUuid)
          )
        );
      return undefined;
    }

    return row.data;
  }
}
