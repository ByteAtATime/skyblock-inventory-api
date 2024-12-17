import type { APIRoute } from "astro";
import { createErrorResponse, getParsedPlayerProfile } from "@/skyblock.ts";
import { Cache } from "@/cache.ts";

export const POST: APIRoute = async ({ request, params }) => {
  const { player, profile: profileUuid } = params;

  if (!player || !profileUuid) {
    return new Response("Invalid request", { status: 400 });
  }

  const body = await request.json();
  const { ttl = undefined } = body;

  const { profile, playerProfile: fetchedPlayerProfile } =
    await getParsedPlayerProfile(player, profileUuid);

  if (!profile || !fetchedPlayerProfile) {
    return createErrorResponse(
      `Player does not have profile ${profileUuid}`,
      400,
    );
  }

  // Store the fetched playerProfile in the cache
  await Cache.instance.insert(
    player,
    profileUuid,
    JSON.stringify(fetchedPlayerProfile),
    ttl,
  );

  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
