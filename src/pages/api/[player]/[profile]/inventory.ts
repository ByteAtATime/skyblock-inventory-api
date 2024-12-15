import type { APIRoute } from "astro";
import { z } from "zod";
import { type Compound, parse } from "prismarine-nbt";
import {parseInventory} from "@/item.ts";

const playerDataSchema = z.object({
    profiles: z.array(z.object({
        profile_id: z.string(),
        members: z.record(z.string(), z.object({
            inventory: z.object({
                inv_contents: z.object({
                    data: z.string(),
                }),
            }).optional(),
        })),
    })),
});

const createErrorResponse = (message: string, status: number): Response => {
    return new Response(
        JSON.stringify({ success: false, error: message }),
        { status }
    );
};

const fetchHypixelProfile = async (playerUuid: string) => {
    const response = await fetch(
        `https://api.hypixel.net/v2/skyblock/profiles?uuid=${playerUuid}`,
        {
            headers: {
                "API-Key": import.meta.env.HYPIXEL_API_KEY
            }
        }
    );
    return response.json();
};

const getPlayerProfile = (data: z.infer<typeof playerDataSchema>, playerUuid: string, profileUuid: string) => {
    const profile = data.profiles.find(p => p.profile_id === profileUuid);
    const playerProfile = profile?.members[playerUuid.replaceAll("-", "")];
    return { profile, playerProfile };
};

const decodeInventoryData = async (inventoryData: string): Promise<Compound> => {
    const decodedInventory = await parse(new Buffer(inventoryData, "base64"));
    return decodedInventory.parsed.value.i?.value as unknown as Compound;
};

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

        const inventory = playerProfile.inventory?.inv_contents?.data;

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