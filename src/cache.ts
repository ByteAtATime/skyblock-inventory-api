import { Database } from "bun:sqlite"

type CacheRow = {
    player_uuid: string;
    profile_uuid: string;
    expiration: number;
    data: string;
}

export class Cache {
    private db: Database;

    constructor(dbPath: string) {
        this.db = new Database(dbPath, {create: true});

        this.init();
    }

    public async init() {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS inventory_cache
            (
                player_uuid  TEXT    NOT NULL,
                profile_uuid TEXT    NOT NULL UNIQUE,
                expiration   INTEGER NOT NULL,
                data         TEXT    NOT NULL
            );
        `);
    }

    public async insert(playerUuid: string, profileUuid: string, data: string, ttl = 1000 * 60 * 60) {
        const expiration = Date.now() + ttl;

        this.db.run(
            `
                INSERT INTO inventory_cache (player_uuid, profile_uuid, expiration, data)
                VALUES (?, ?, ?, ?) ON CONFLICT(profile_uuid) DO
                UPDATE SET expiration = ?, data = ?;
            `,
            [playerUuid, profileUuid, expiration, data, expiration, data]
        );
    }

    public async get(playerUuid: string, profileUuid: string): Promise<string | undefined> {
        const row = this.db.query(
            `SELECT *
             FROM inventory_cache
             WHERE player_uuid = ?
               AND profile_uuid = ?`,
        ).get(playerUuid, profileUuid) as CacheRow;

        if (!row) return undefined;

        if (row.expiration < Date.now()) {
            this.db.run(`DELETE
                         FROM inventory_cache
                         WHERE player_uuid = ?
                           AND profile_uuid = ?`, [playerUuid, profileUuid]);
            return undefined;
        }

        return row.data;
    }
}

