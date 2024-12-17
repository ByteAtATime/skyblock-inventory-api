import { z } from "zod";
import { type Compound, parse } from "prismarine-nbt";

const inventorySchema = z
  .object({
    data: z.string(),
  })
  .optional();

const bagContentsSchema = z
  .object({
    talisman_bag: inventorySchema,
  })
  .optional();

const inventoryContentsSchema = z
  .object({
    inv_contents: inventorySchema,
    ender_chest_contents: inventorySchema,
    bag_contents: bagContentsSchema,
  })
  .optional();

const memberSchema = z.object({
  inventory: inventoryContentsSchema,
});

const profileSchema = z.object({
  profile_id: z.string(),
  members: z.record(z.string(), memberSchema),
});

export const playerDataSchema = z.object({
  profiles: z.array(profileSchema),
});

type PlayerData = z.infer<typeof playerDataSchema>;
type Profile = z.infer<typeof profileSchema>;
type MemberData = z.infer<typeof memberSchema>;

// Helper functions
export const createErrorResponse = (
  message: string,
  status: number,
): Response => {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
};

export const fetchHypixelProfile = async (
  playerUuid: string,
): Promise<unknown> => {
  const response = await fetch(
    `https://api.hypixel.net/v2/skyblock/profiles?uuid=${playerUuid}`,
    {
      headers: {
        "API-Key": import.meta.env.HYPIXEL_API_KEY,
      },
    },
  );
  return response.json();
};

export const getPlayerProfile = (
  data: PlayerData,
  playerUuid: string,
  profileUuid: string,
): { profile: Profile | undefined; playerProfile: MemberData | undefined } => {
  const profile = data.profiles.find((p) => p.profile_id === profileUuid);
  const playerProfile = profile?.members[playerUuid.replaceAll("-", "")];
  return { profile, playerProfile };
};

export const decodeInventoryData = async (
  inventoryData: string,
): Promise<Compound> => {
  const decodedInventory = await parse(new Buffer(inventoryData, "base64"));
  return decodedInventory.parsed.value.i?.value as unknown as Compound;
};

export const getParsedPlayerProfile = async (
  playerUuid: string,
  profileUuid: string,
): Promise<{
  profile: Profile | undefined;
  playerProfile: MemberData | undefined;
}> => {
  const rawData = await fetchHypixelProfile(playerUuid);
  const { data, error } = playerDataSchema.safeParse(rawData);

  if (error || !data) {
    throw new Error(String(error)); // Or handle the error as appropriate
  }

  const { profile, playerProfile } = getPlayerProfile(
    data,
    playerUuid,
    profileUuid,
  );

  if (!profile || !playerProfile) {
    throw new Error(`Player does not have profile ${profileUuid}`); // Or handle the error
  }

  return { profile, playerProfile };
};
