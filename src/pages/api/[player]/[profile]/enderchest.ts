import { createInventoryEndpoint } from "@/inventory-endpoint.ts";

export const GET = createInventoryEndpoint({
  getInventoryData: (playerProfile) =>
    playerProfile.inventory?.ender_chest_contents?.data,
  notFoundMessage: "Cannot find ender chest data",
});
