import { createInventoryEndpoint } from "@/inventory-endpoint.ts";

export const GET = createInventoryEndpoint({
  getInventoryData: (playerProfile) =>
    playerProfile.inventory?.bag_contents?.talisman_bag?.data,
  notFoundMessage: "Cannot find accessory bag data",
});
