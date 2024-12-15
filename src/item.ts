interface InventoryItem {
    id: string;
    name: string;
    rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC' | 'SPECIAL';
    type: string;
    count: number;
    stats?: {
        [stat: string]: {
            regular: number;
            dungeon?: number;
        };
    };
    enchantments?: Record<string, number>;
    ability?: {
        name: string;
        description: string;
        manaCost?: number;
        cooldown?: string;
        soulflowCost?: number;
        charges?: {
            current: number;
            maximum: number;
            rechargeTime: string;
        };
    };
    flags: {
        isUnbreakable: boolean;
        isDungeonItem: boolean;
        isCoopSoulbound: boolean;
        isStarred: boolean;
        hasHotPotatoBooks: number;
    };
    modifier?: string;
    runes?: Record<string, number>;
}

const parseInventoryItem = (rawItem: any): InventoryItem | null => {
    if (!rawItem.id || !rawItem.tag?.value) return null;

    const tag = rawItem.tag.value;
    const display = tag.display?.value;
    const extraAttrs = tag.ExtraAttributes?.value;
    const loreLines = display?.Lore?.value?.value || [];

    const cleanFormatting = (text: string): string =>
        text.replace(/§[0-9a-fklmnor]/g, '');

    const extractNumber = (str: string): number => {
        const match = str.match(/[+-]?[\d,]+\.?\d*/);
        return match ? parseFloat(match[0].replace(',', '')) : 0;
    };

    // Stat parsing with regex patterns
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
    } as const;

    const parseStats = (lines: string[]) => {
        const stats: InventoryItem['stats'] = {};

        lines.forEach(line => {
            const cleanLine = cleanFormatting(line);

            // Handle Gear Score separately
            const gearScoreMatch = line.match(/Gear Score: §d(\d+)(?: §8\((\d+)\))?/);
            if (gearScoreMatch) {
                stats.gearScore = {
                    regular: parseInt(gearScoreMatch[1]),
                    ...(gearScoreMatch[2] && { dungeon: parseInt(gearScoreMatch[2]) })
                };
            }

            Object.entries(statPatterns).forEach(([key, prefix]) => {
                if (cleanLine.startsWith(prefix)) {
                    const matches = cleanLine.match(/\+?([\d,]+\.?\d*)(?: §8\(\+([\d,]+\.?\d*)\))?/);
                    if (matches) {
                        stats[key] = {
                            regular: parseFloat(matches[1].replace(',', '')),
                            ...(matches[2] && { dungeon: parseFloat(matches[2].replace(',', '')) })
                        };
                    }
                }
            });
        });

        return Object.keys(stats).length ? stats : undefined;
    };

    const parseAbility = (lines: string[]) => {
        for (let i = 0; i < lines.length; i++) {
            const line = cleanFormatting(lines[i]);
            if (line.includes('Ability: ')) {
                const ability: InventoryItem['ability'] = {
                    name: line.split('Ability: ')[1].split('RIGHT CLICK')[0].trim(),
                    description: '',
                };

                const descriptionLines: string[] = [];

                for (let j = i + 1; j < lines.length; j++) {
                    const subLine = cleanFormatting(lines[j]);

                    if (subLine.includes('Mana Cost:')) {
                        ability.manaCost = extractNumber(subLine);
                    } else if (subLine.includes('Cooldown:')) {
                        ability.cooldown = subLine.split('Cooldown: ')[1];
                    } else if (subLine.includes('Soulflow Cost:')) {
                        ability.soulflowCost = extractNumber(subLine);
                    } else if (subLine.includes('Charges:')) {
                        const chargeMatch = subLine.match(/Charges: (\d+) \/ (\d+)s/);
                        if (chargeMatch) {
                            ability.charges = {
                                current: parseInt(chargeMatch[1]),
                                maximum: parseInt(chargeMatch[2]),
                                rechargeTime: `${chargeMatch[2]}s`,
                            };
                        }
                    } else if (subLine && !subLine.startsWith('§')) {
                        descriptionLines.push(subLine);
                    } else if (subLine === '') {
                        break;
                    }
                }

                ability.description = descriptionLines.join(' ');
                return ability;
            }
        }
        return undefined;
    };

    const determineRarity = (lines: string[]): InventoryItem['rarity'] => {
        const lastLine = lines[lines.length - 1] || '';
        if (lastLine.includes('MYTHIC')) return 'MYTHIC';
        if (lastLine.includes('LEGENDARY')) return 'LEGENDARY';
        if (lastLine.includes('EPIC')) return 'EPIC';
        if (lastLine.includes('RARE')) return 'RARE';
        if (lastLine.includes('UNCOMMON')) return 'UNCOMMON';
        if (lastLine.includes('SPECIAL')) return 'SPECIAL';
        return 'COMMON';
    };

    const determineType = (id: string, lines: string[]): string => {
        if (id.includes('SWORD')) return 'SWORD';
        if (id.includes('BOW')) return 'BOW';
        if (id.includes('HELMET') || id.includes('CHESTPLATE') ||
            id.includes('LEGGINGS') || id.includes('BOOTS')) return 'ARMOR';
        if (lines.some(line => line.includes('ACCESSORY'))) return 'ACCESSORY';
        if (id.includes('POTION') || id.includes('SCROLL')) return 'CONSUMABLE';
        return 'MISC';
    };

    return {
        id: extraAttrs?.id?.value || 'UNKNOWN',
        name: cleanFormatting(display?.Name?.value || 'Unknown Item'),
        rarity: determineRarity(loreLines),
        type: determineType(extraAttrs?.id?.value || '', loreLines),
        count: rawItem.Count.value,
        stats: parseStats(loreLines),
        enchantments: extraAttrs?.enchantments?.value && Object.fromEntries(
            Object.entries(extraAttrs.enchantments.value)
                .map(([name, data]: [string, any]) => [name, data.value])
        ),
        ability: parseAbility(loreLines),
        flags: {
            isUnbreakable: !!tag.Unbreakable?.value,
            isDungeonItem: extraAttrs?.id?.value?.includes('DUNGEON') ||
                loreLines.some((line: string) => line.includes('DUNGEON')),
            isCoopSoulbound: loreLines.some((line: string) => line.includes('Co-op Soulbound')),
            isStarred: display?.Name?.value?.includes('✪'),
            hasHotPotatoBooks: extraAttrs?.hot_potato_count?.value || 0
        },
        ...(extraAttrs?.modifier?.value && { modifier: extraAttrs.modifier.value }),
        ...(extraAttrs?.runes?.value && {
            runes: Object.fromEntries(
                Object.entries(extraAttrs.runes.value)
                    .map(([name, data]: [string, any]) => [name, data.value])
            )
        })
    };
};

export const parseInventory = (rawInventory: any[]): { items: InventoryItem[] } => ({
    items: rawInventory
        .map(parseInventoryItem)
        .filter((item): item is InventoryItem => item !== null)
});