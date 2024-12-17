import type {APIRoute} from "astro";
import {createErrorResponse, fetchHypixelProfile, getPlayerProfile, playerDataSchema} from "@/skyblock.ts";
import {Cache} from "@/cache.ts";

export const POST: APIRoute = async ({ request, params }) => {
    const { player, profile: profileUuid } = params;

    if (!player || !profileUuid) {
        return new Response("Invalid request", { status: 400 });
    }

    const body = await request.json();
    const { ttl = undefined } = body;

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

    // Store the fetched playerProfile in the cache
    await Cache.instance.insert(player, profileUuid, JSON.stringify(fetchedPlayerProfile), ttl);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
}
