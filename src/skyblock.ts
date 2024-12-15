import { z } from "zod";
import { type Compound, parse } from "prismarine-nbt";

export const playerDataSchema = z.object({
    profiles: z.array(z.object({
        profile_id: z.string(),
        members: z.record(z.string(), z.object({
            inventory: z.object({
                inv_contents: z.object({
                    data: z.string(),
                }).optional(),
                ender_chest_contents: z.object({
                    data: z.string(),
                }).optional(),
            }).optional(),
        })),
    })),
});

export const createErrorResponse = (message: string, status: number): Response => {
    return new Response(
        JSON.stringify({ success: false, error: message }),
        { status }
    );
};

export const fetchHypixelProfile = async (playerUuid: string) => {
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

export const getPlayerProfile = (data: z.infer<typeof playerDataSchema>, playerUuid: string, profileUuid: string) => {
    const profile = data.profiles.find(p => p.profile_id === profileUuid);
    const playerProfile = profile?.members[playerUuid.replaceAll("-", "")];
    return { profile, playerProfile };
};

export const decodeInventoryData = async (inventoryData: string): Promise<Compound> => {
    const decodedInventory = await parse(new Buffer(inventoryData, "base64"));
    return decodedInventory.parsed.value.i?.value as unknown as Compound;
};
