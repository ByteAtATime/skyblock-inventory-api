type ItemRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC' | 'SPECIAL';
type ItemType = 'SWORD' | 'BOW' | 'ARMOR' | 'ACCESSORY' | 'CONSUMABLE' | 'MISC';

type ItemStat = {
    regular: number;
    dungeon?: number;
};

type ItemCharges = {
    current: number;
    maximum: number;
    rechargeTime: string;
};

type ItemAbility = {
    name: string;
    description: string;
    manaCost?: number;
    cooldown?: string;
    soulflowCost?: number;
    charges?: ItemCharges;
};

type ItemFlags = {
    readonly isUnbreakable: boolean;
    readonly isDungeonItem: boolean;
    readonly isCoopSoulbound: boolean;
    readonly isStarred: boolean;
    readonly hasHotPotatoBooks: number;
};

type InventoryItem = {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly rarity: ItemRarity;
    readonly type: ItemType;
    readonly count: number;
    readonly stats?: Record<string, ItemStat>;
    readonly enchantments?: Record<string, number>;
    readonly ability?: ItemAbility;
    readonly flags: ItemFlags;
    readonly modifier?: string;
    readonly runes?: Record<string, number>;
};

type StatPattern = {
    readonly [K in keyof typeof statPatterns]: string;
};

const statPatterns = {
    damage: 'Damage: ',
    strength: 'Strength: ',
    critChance: 'Crit Chance: ',
    critDamage: 'Crit Damage: ',
    intelligence: 'Intelligence: ',
    health: 'Health: ',
    defense: 'Defense: ',
    speed: 'Speed: ',
    attackSpeed: 'Bonus Attack Speed: ',
    seaCreatureChance: 'Sea Creature Chance: ',
    miningSpeed: 'Mining Speed: ',
    ferocity: 'Ferocity: ',
    fishingSpeed: 'Fishing Speed: ',
} as const satisfies StatPattern;

const parseInventoryItem = (rawItem: Record<string, any>): InventoryItem | null => {
    if (!rawItem.id || !rawItem.tag?.value) return null;

    const tag = rawItem.tag.value;
    const display = tag.display?.value;
    const extraAttrs = tag.ExtraAttributes?.value;
    const loreLines = display?.Lore?.value?.value ?? [];

    const cleanFormatting = (text: string) => text.replace(/§[0-9a-fklmnor]/g, '');
    const extractNumber = (str: string) => Number(str.match(/[+-]?[\d,]+\.?\d*/)?.[0].replace(',', '')) || 0;

    const parseStats = (lines: string[]) => {
        const stats: Record<string, ItemStat> = {};

        for (const line of lines) {
            const cleanLine = cleanFormatting(line);
            const gearScoreMatch = line.match(/Gear Score: §d(\d+)(?: §8\((\d+)\))?/);

            if (gearScoreMatch) {
                stats.gearScore = {
                    regular: +gearScoreMatch[1],
                    ...(gearScoreMatch[2] && { dungeon: +gearScoreMatch[2] })
                };
                continue;
            }

            for (const [key, prefix] of Object.entries(statPatterns)) {
                if (!cleanLine.startsWith(prefix)) continue;

                const matches = cleanLine.match(/\+?([\d,]+\.?\d*)(?: §8\(\+([\d,]+\.?\d*)\))?/);
                if (!matches) continue;

                stats[key] = {
                    regular: Number(matches[1].replace(',', '')),
                    ...(matches[2] && { dungeon: Number(matches[2].replace(',', '')) })
                };
            }
        }

        return Object.keys(stats).length ? stats : undefined;
    };

    const parseAbility = (lines: string[]): ItemAbility | undefined => {
        const abilityIndex = lines.findIndex(line => cleanFormatting(line).includes('Ability: '));
        if (abilityIndex === -1) return undefined;

        const ability: ItemAbility = {
            name: cleanFormatting(lines[abilityIndex]).split('Ability: ')[1].replace(/(RIGHT|LEFT) CLICK|HOLD/g, "").trim(),
            description: '',
        };

        const descriptionLines: string[] = [];

        for (let i = abilityIndex + 1; i < lines.length; i++) {
            const line = cleanFormatting(lines[i]);

            switch (true) {
                case line.includes('Mana Cost:'):
                    ability.manaCost = extractNumber(line);
                    break;
                case line.includes('Cooldown:'):
                    ability.cooldown = line.split('Cooldown: ')[1];
                    break;
                case line.includes('Soulflow Cost:'):
                    ability.soulflowCost = extractNumber(line);
                    break;
                case line.includes('Charges:'): {
                    const [current, maximum] = line.match(/\d+/g)?.map(Number) ?? [];
                    ability.charges = {
                        current,
                        maximum,
                        rechargeTime: `${maximum}s`,
                    };
                    break;
                }
                case line && !line.startsWith('§'):
                    descriptionLines.push(line);
                    break;
                case line === '':
                    i = lines.length;
                    break;
            }
        }

        ability.description = descriptionLines.join(' ');
        return ability;
    };

    const determineRarity = (lines: string[]): ItemRarity => {
        const lastLine = lines.at(-1) ?? '';
        if (lastLine.includes('MYTHIC')) return 'MYTHIC';
        if (lastLine.includes('LEGENDARY')) return 'LEGENDARY';
        if (lastLine.includes('EPIC')) return 'EPIC';
        if (lastLine.includes('RARE')) return 'RARE';
        if (lastLine.includes('UNCOMMON')) return 'UNCOMMON';
        if (lastLine.includes('SPECIAL')) return 'SPECIAL';
        return 'COMMON';
    };

    const determineType = (id: string, lines: string[]): ItemType => {
        if (id.includes('SWORD')) return 'SWORD';
        if (id.includes('BOW')) return 'BOW';
        if (/HELMET|CHESTPLATE|LEGGINGS|BOOTS/.test(id)) return 'ARMOR';
        if (lines.some(line => line.includes('ACCESSORY'))) return 'ACCESSORY';
        if (id.includes('POTION') || id.includes('SCROLL')) return 'CONSUMABLE';
        return 'MISC';
    };

    return {
        id: extraAttrs?.id?.value ?? 'UNKNOWN',
        name: cleanFormatting(display?.Name?.value ?? 'Unknown Item'),
        description: cleanFormatting(display?.Lore?.value?.value?.join('\n') ?? ''),
        rarity: determineRarity(loreLines),
        type: determineType(extraAttrs?.id?.value ?? '', loreLines),
        count: rawItem.Count.value,
        stats: parseStats(loreLines),
        enchantments: extraAttrs?.enchantments?.value &&
            Object.fromEntries(
                Object.entries(extraAttrs.enchantments.value)
                    .map(([name, data]) => [name, data.value])
            ),
        ability: parseAbility(loreLines),
        flags: {
            isUnbreakable: Boolean(tag.Unbreakable?.value),
            isDungeonItem: Boolean(
                extraAttrs?.id?.value?.includes('DUNGEON') ||
                loreLines.some(line => line.includes('DUNGEON'))
            ),
            isCoopSoulbound: loreLines.some(line => line.includes('Co-op Soulbound')),
            isStarred: Boolean(display?.Name?.value?.includes('✪')),
            hasHotPotatoBooks: extraAttrs?.hot_potato_count?.value ?? 0
        },
        ...(extraAttrs?.modifier?.value && { modifier: extraAttrs.modifier.value }),
        ...(extraAttrs?.runes?.value && {
            runes: Object.fromEntries(
                Object.entries(extraAttrs.runes.value)
                    .map(([name, data]) => [name, data.value])
            )
        })
    };
};

export const parseInventory = (rawInventory: unknown[]): { items: InventoryItem[] } => ({
    items: rawInventory
        .map(item => parseInventoryItem(item as Record<string, any>))
        .filter((item): item is InventoryItem => item !== null)
});