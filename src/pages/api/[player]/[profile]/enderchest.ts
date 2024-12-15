import type {APIRoute} from "astro";
import {
    createErrorResponse,
    decodeInventoryData,
    fetchHypixelProfile,
    getPlayerProfile,
    playerDataSchema
} from "@/skyblock.ts";
import {parseInventory} from "@/item.ts";

export const GET: APIRoute = async ({ params }) => {
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

        const inventory = playerProfile.inventory?.ender_chest_contents?.data;

        if (!inventory) {
            return createErrorResponse(
                "Cannot find inventory data; player may not have enabled API",
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
