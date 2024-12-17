import { z } from "zod";

const nbtBase = z.object({
  type: z.string(),
  value: z.union([z.string(), z.number(), z.array(z.number())]),
});

const createNbtObject = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({ type: z.string(), value: schema });

const nbtTexture = z.object({
  Signature: nbtBase,
  Value: nbtBase,
});

const nbtSkullOwner = createNbtObject(
  z.object({
    Id: nbtBase,
    hypixelPopulated: nbtBase,
    Properties: createNbtObject(
      z.object({
        textures: createNbtObject(
          z.object({
            value: z.array(nbtTexture),
          }),
        ),
      }),
    ),
  }),
).optional();

const nbtDisplay = createNbtObject(
  z.object({
    Lore: createNbtObject(
      z.object({
        value: z.array(z.string()),
      }),
    ).optional(),
    Name: nbtBase.optional(),
  }),
).optional();

const nbtExtraAttributes = createNbtObject(
  z.object({
    id: nbtBase.optional(),
    uuid: nbtBase.optional(),
    timestamp: createNbtObject(z.array(z.number())).optional(),
    modifier: nbtBase.optional(),
    originTag: nbtBase.optional(),
    hot_potato_count: nbtBase.optional(),
    runes: createNbtObject(z.record(nbtBase)).optional(),
  }),
).optional();

const baseItemSchema = z.object({
  id: nbtBase.optional(),
  Count: nbtBase.optional(),
  Damage: nbtBase.optional(),
  tag: createNbtObject(
    z.object({
      HideFlags: nbtBase.optional(),
      SkullOwner: nbtSkullOwner,
      display: nbtDisplay,
      ExtraAttributes: nbtExtraAttributes,
      Unbreakable: nbtBase.optional(),
    }),
  ).optional(),
});

const rawInventorySchema = z.array(z.union([z.null(), baseItemSchema]));

type ItemRarity =
  | "COMMON"
  | "UNCOMMON"
  | "RARE"
  | "EPIC"
  | "LEGENDARY"
  | "MYTHIC"
  | "SPECIAL";
type ItemType = "SWORD" | "BOW" | "ARMOR" | "ACCESSORY" | "CONSUMABLE" | "MISC";
type ItemStat = { regular: number; dungeon?: number };
type ItemCharges = { current: number; maximum: number; rechargeTime: string };
type ItemAbility = {
  name: string;
  description: string;
  manaCost?: number;
  cooldown?: string;
  soulflowCost?: number;
  charges?: ItemCharges;
};
type ItemFlags = {
  isUnbreakable: boolean;
  isDungeonItem: boolean;
  isCoopSoulbound: boolean;
  isStarred: boolean;
  hasHotPotatoBooks: number;
};
type ParsedItem = {
  id: string;
  name: string;
  description: string;
  rarity: ItemRarity;
  type: ItemType;
  count: number;
  stats?: Record<string, ItemStat>;
  flags: ItemFlags;
  ability?: ItemAbility;
  modifier?: string;
  runes?: Record<string, number>;
};

const statPatterns = {
  damage: "Damage: ",
  strength: "Strength: ",
  critChance: "Crit Chance: ",
  critDamage: "Crit Damage: ",
  intelligence: "Intelligence: ",
  health: "Health: ",
  defense: "Defense: ",
  speed: "Speed: ",
  attackSpeed: "Bonus Attack Speed: ",
  seaCreatureChance: "Sea Creature Chance: ",
  miningSpeed: "Mining Speed: ",
  ferocity: "Ferocity: ",
  fishingSpeed: "Fishing Speed: ",
} as const;

const textUtils = {
  clean: (text: string) => text.replace(/§[0-9a-fklmnor]/g, ""),
  extractNumber: (str: string) =>
    Number(str.match(/[+-]?[\d,]+\.?\d*/)?.[0]?.replace(",", "")) ?? 0,
};

const itemParsers = {
  stats: (lines: readonly string[]): Record<string, ItemStat> | undefined => {
    const stats = Object.entries(statPatterns).reduce(
      (acc, [key, prefix]) => {
        const line = lines.find((l) => textUtils.clean(l).startsWith(prefix));
        if (!line) return acc;

        const matches = textUtils
          .clean(line)
          .match(/\+?([\d,]+\.?\d*)(?: §8\(\+([\d,]+\.?\d*)\))?/);
        if (!matches) return acc;

        acc[key] = {
          regular: Number(matches[1].replace(",", "")),
          ...(matches[2] && { dungeon: Number(matches[2].replace(",", "")) }),
        };
        return acc;
      },
      {} as Record<string, ItemStat>,
    );

    const gearScoreLine = lines.find((line) => line.includes("Gear Score:"));
    if (gearScoreLine) {
      const [, regular, dungeon] =
        gearScoreLine.match(/Gear Score: §d(\d+)(?: §8\((\d+)\))?/) ?? [];
      if (regular) {
        stats.gearScore = {
          regular: +regular,
          ...(dungeon && { dungeon: +dungeon }),
        };
      }
    }

    return Object.keys(stats).length ? stats : undefined;
  },

  ability: (lines: readonly string[]): ItemAbility | undefined => {
    const abilityIndex = lines.findIndex((line) =>
      textUtils.clean(line).includes("Ability: "),
    );
    if (abilityIndex === -1) return undefined;

    const ability: ItemAbility = {
      name: textUtils
        .clean(lines[abilityIndex])
        .split("Ability: ")[1]
        .replace(/(RIGHT|LEFT) CLICK|HOLD/g, "")
        .trim(),
      description: "",
    };

    const descriptionLines: string[] = [];

    for (let i = abilityIndex + 1; i < lines.length; i++) {
      const line = textUtils.clean(lines[i]);
      if (!line || line.startsWith("§")) break;

      if (line.includes("Mana Cost:"))
        ability.manaCost = textUtils.extractNumber(line);
      else if (line.includes("Cooldown:"))
        ability.cooldown = line.split("Cooldown: ")[1];
      else if (line.includes("Soulflow Cost:"))
        ability.soulflowCost = textUtils.extractNumber(line);
      else if (line.includes("Charges:")) {
        const [current, maximum] = line.match(/\d+/g)?.map(Number) ?? [];
        ability.charges = { current, maximum, rechargeTime: `${maximum}s` };
      } else descriptionLines.push(line);
    }

    ability.description = descriptionLines.join(" ");
    return ability;
  },

  rarity: (lines: string[]): ItemRarity => {
    const lastLine = lines.at(-1) ?? "";
    return lastLine.includes("MYTHIC")
      ? "MYTHIC"
      : lastLine.includes("LEGENDARY")
        ? "LEGENDARY"
        : lastLine.includes("EPIC")
          ? "EPIC"
          : lastLine.includes("RARE")
            ? "RARE"
            : lastLine.includes("UNCOMMON")
              ? "UNCOMMON"
              : lastLine.includes("SPECIAL")
                ? "SPECIAL"
                : "COMMON";
  },

  type: (id: string, lines: string[]): ItemType => {
    if (id.includes("SWORD")) return "SWORD";
    if (id.includes("BOW")) return "BOW";
    if (/HELMET|CHESTPLATE|LEGGINGS|BOOTS/.test(id)) return "ARMOR";
    if (lines.some((line) => line.includes("ACCESSORY"))) return "ACCESSORY";
    if (id.includes("POTION") || id.includes("SCROLL")) return "CONSUMABLE";
    return "MISC";
  },
};

export const parseInventory = (rawInventory: unknown) => {
  const parsed = rawInventorySchema.safeParse(rawInventory);
  if (!parsed.success) throw new Error(`Invalid NBT data: ${parsed.error}`);

  return {
    items: parsed.data
      .filter(
        (item): item is NonNullable<typeof item> =>
          item?.tag?.value?.display?.value?.Lore?.value?.value !== undefined,
      )
      .map((item) => {
        const extraAttrs = item.tag?.value?.ExtraAttributes?.value;
        const display = item.tag?.value?.display?.value;
        const loreLines = display?.Lore?.value?.value ?? [];
        if (!extraAttrs?.id?.value || !display) return null;

        const id = String(extraAttrs.id.value);
        const parsedItem: ParsedItem = {
          id,
          name: textUtils.clean(String(display.Name?.value ?? "Unknown Item")),
          description: textUtils.clean(loreLines.join("\n")),
          rarity: itemParsers.rarity(loreLines),
          type: itemParsers.type(id, loreLines),
          count: Number(item.Count?.value ?? 1),
          stats: itemParsers.stats(loreLines),
          flags: {
            isUnbreakable: Boolean(item.tag?.value?.Unbreakable?.value),
            isDungeonItem:
              id.includes("DUNGEON") ||
              loreLines.some((line) => line.includes("DUNGEON")),
            isCoopSoulbound: loreLines.some((line) =>
              line.includes("Co-op Soulbound"),
            ),
            isStarred: String(display.Name?.value ?? "").includes("✪"),
            hasHotPotatoBooks: Number(extraAttrs?.hot_potato_count?.value ?? 0),
          },
          ability: itemParsers.ability(loreLines),
        };

        if (extraAttrs?.modifier?.value) {
          parsedItem.modifier = String(extraAttrs.modifier.value);
        }

        if (extraAttrs?.runes?.value) {
          parsedItem.runes = Object.fromEntries(
            Object.entries(extraAttrs.runes.value).map(([name, data]) => [
              name,
              Number((data as any).value),
            ]),
          );
        }

        return parsedItem;
      })
      .filter((item): item is ParsedItem => item !== null),
  };
};
