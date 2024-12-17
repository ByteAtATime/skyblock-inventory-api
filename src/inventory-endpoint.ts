import type { APIRoute } from "astro";
import {
    createErrorResponse,
    decodeInventoryData,
    fetchHypixelProfile,
    getPlayerProfile,
    playerDataSchema
} from "@/skyblock.ts";
import { parseInventory } from "@/item.ts";
import { Cache } from "@/cache.ts";

type InventoryGetter = (playerProfile: any) => any;

interface EndpointOptions {
    getInventoryData: InventoryGetter;
    notFoundMessage: string;
}

const cache = new Cache();

export const createInventoryEndpoint = (options: EndpointOptions): APIRoute => {
    const { getInventoryData, notFoundMessage } = options;

    return async ({ params }) => {
        const { player, profile: profileUuid } = params;

        if (!player) {
            return createErrorResponse("Missing player UUID", 400);
        }

        if (!profileUuid) {
            return createErrorResponse("Missing profile UUID", 400);
        }

        try {
            // Check the cache first
            const cachedData = await cache.get(player, profileUuid);
            let playerProfile;

            if (cachedData) {
                playerProfile = JSON.parse(cachedData);
            } else {
                // Fetch the data if not in cache
                const rawData = await fetchHypixelProfile(player);
                const { data, error } = playerDataSchema.safeParse(rawData);

                if (error || !data) {
                    return createErrorResponse(String(error), 500);
                }

                const { profile, playerProfile: fetchedPlayerProfile } = getPlayerProfile(data, player, profileUuid);

                if (!profile || !fetchedPlayerProfile) {
                    console.dir(data, { depth: 5 });
                    return createErrorResponse(
                        `Player does not have profile ${profileUuid}`,
                        400
                    );
                }

                playerProfile = fetchedPlayerProfile;
                // Store the fetched playerProfile in the cache
                await cache.insert(player, profileUuid, JSON.stringify(playerProfile));
            }

            const inventory = getInventoryData(playerProfile);

            if (!inventory) {
                return createErrorResponse(
                    `${notFoundMessage}; player may not have enabled API`,
                    400
                );
            }

            const inventoryData = await decodeInventoryData(inventory);
            return new Response(JSON.stringify(parseInventory(inventoryData.value)), { headers: { "Content-Type": "application/json" } });
        } catch (error) {
            return createErrorResponse(
                `Internal server error: ${error}`,
                500
            );
        }
    };
};