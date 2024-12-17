# Hypixel Skyblock Inventory API

This is a simple API that allows you to get the inventory of a player in Hypixel Skyblock.

The official API returns a base64 encoding of the raw NBT data of each item. This API decodes the data, returning a JSON object with the item's name, lore, enchantments, etc.

It is intended for developers who do not want to deal with the raw NBT data, or for those working in environments where NBT decoding is not possible or feasible.

## Usage

The API documentation can be found [here](https://skyblock-inventory-api.vercel.app).
