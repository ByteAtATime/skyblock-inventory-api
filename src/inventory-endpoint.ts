import type { APIRoute } from "astro";
import {
    createErrorResponse,
    decodeInventoryData,
    fetchHypixelProfile,
    getPlayerProfile,
    playerDataSchema
} from "@/skyblock.ts";
import { parseInventory } from "@/item.ts";

type InventoryGetter = (playerProfile: any) => any;

interface EndpointOptions {
    getInventoryData: InventoryGetter;
    notFoundMessage: string;
}

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
            const rawData = await fetchHypixelProfile(player);
            const { data, error } = playerDataSchema.safeParse(rawData);

            if (error || !data) {
                return createErrorResponse(String(error), 500);
            }

            const { profile, playerProfile } = getPlayerProfile(data, player, profileUuid);

            if (!profile || !playerProfile) {
                console.dir(data, {depth: 5})
                return createErrorResponse(
                    `Player does not have profile ${profileUuid}`,
                    400
                );
            }

            const inventory = getInventoryData(playerProfile);

            if (!inventory) {
                return createErrorResponse(
                    `${notFoundMessage}; player may not have enabled API`,
                    400
                );
            }

            const inventoryData = await decodeInventoryData(inventory);
            return new Response(JSON.stringify(parseInventory(inventoryData.value)));
        } catch (error) {
            return createErrorResponse(
                `Internal server error: ${error}`,
                500
            );
        }
    };
};