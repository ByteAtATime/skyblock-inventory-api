import { createInventoryEndpoint } from "@/inventory-endpoint.ts";

export const GET = createInventoryEndpoint({
    getInventoryData: (playerProfile) => playerProfile.inventory?.inv_contents?.data,
    notFoundMessage: "Cannot find inventory data"
});