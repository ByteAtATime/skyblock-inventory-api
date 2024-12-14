import type {APIRoute} from "astro";
import {z} from "zod";
import {type Compound, parse} from "prismarine-nbt";

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

export const GET: APIRoute = async ({params}) => {
    const { player, profile: profileUuid } = params;

    if (!player) {
        return new Response(JSON.stringify({ success: false, error: "Missing player UUID" }), { status: 400 });
    }

    if (!profileUuid) {
        return new Response(JSON.stringify({ success: false, error: "Missing profile UUID" }), { status: 400 });
    }

    const res = await fetch(`https://api.hypixel.net/v2/skyblock/profiles?uuid=${player}`, {
        headers: {
            "API-Key": import.meta.env.HYPIXEL_API_KEY
        }
    })

    const rawData = await res.json();
    const { data, error } = playerDataSchema.safeParse(rawData);

    if (error || !data) {
        return new Response(JSON.stringify({ success: false, error }), { status: 500 });
    }

    const profile = data.profiles.find(p => p.profile_id === profileUuid);
    const playerProfile = profile?.members[player.replaceAll("-", "")];

    if (!profile || !playerProfile) {
        return new Response(JSON.stringify({ success: false, error: `Player does not have profile ${profileUuid}` }), { status: 400 });
    }

    const inventory = playerProfile.inventory?.inv_contents?.data;

    if (!inventory) {
        return new Response(JSON.stringify({ success: false, error: "Cannot find inventory data; player may not have enabled API" }), { status: 400 });
    }

    const decodedInventory = await parse(new Buffer(inventory, "base64"));

    const inventoryData = decodedInventory.parsed.value.i?.value as unknown as Compound;

    return new Response(JSON.stringify(inventoryData.value));
}
