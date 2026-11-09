/**
 * Seeds from the plants picked in the wild (user, 2026-10-30: "ao coletar plantas deve vir sementes também, senão o agricultor nunca vai plantar as coisas"). The game gives a herb to
 * whoever picks it (`gatheringHarvested`) and no seed; the gardens (`farm.ts`) only take seeds, which came from the farm's own harvests (two harvests of a plant make one seed). So a herb picked that a garden can grow also brings, now and then, a seed of it: one, or two from a good pick. Anybody who picks gets them (a farmer has the beds,
 * and the seeds are a thing to trade); the chance and the size of a good pick are `wildSeedSettings`.
 */

import { FARM_CROPS } from "./craft-data.js";
import { craftItemGuid } from "./craft-items.js";

export const wildSeedSettings = {
    /** The chance that a picked plant brings a seed. */
    chance: 0.6,
    /** A pick of this many plants or more (a better survival skill, or several together) brings two. */
    goodPick: 4,
};

/** The crop each picked item belongs to, by the item's class GUID. */
const BY_HARVEST = new Map(FARM_CROPS.map((crop) => [crop.harvest.toLowerCase(), crop]));

/** How many seeds, and of what, a pick brings: `roll` is a number in [0, 1). Null when the plant grows in no garden or the roll says none. */
export function seedsFor(item: string, amount: number, roll: number): { readonly seed: string; readonly name: string; readonly amount: number } | null {
    const crop = BY_HARVEST.get(item.toLowerCase());
    if (crop === undefined || roll >= wildSeedSettings.chance) {
        return null;
    }
    return { seed: crop.seed, name: crop.name, amount: amount >= wildSeedSettings.goodPick ? 2 : 1 };
}

export function installWildSeeds(random: () => number = Math.random): void {
    // A plant picked that no garden grows is told once in the log, by its class (the first twenty): if the herbs of the gardens came under another GUID than the tables', it would show here.
    const unknown = new Set<string>();
    Events.on("gatheringHarvested", (player, event) => {
        const seeds = seedsFor(event.item, event.amount, random());
        if (seeds === null) {
            if (!BY_HARVEST.has(event.item.toLowerCase()) && unknown.size < 20 && !unknown.has(event.item)) {
                unknown.add(event.item);
                console.log(`wild-seeds: ${player.nickname} colheu ${event.item} (${event.amount}), que nenhuma horta cultiva`);
            }
            return;
        }
        const result = Inventory.add(player, { item: craftItemGuid(seeds.seed) ?? seeds.seed, amount: seeds.amount });
        if (!result.ok) {
            console.log(`wild-seeds: ${player.nickname}: a semente de ${seeds.name} não foi entregue (${result.code})`);
        }
    });
    console.log(`wild-seeds: ${BY_HARVEST.size} plantas das hortas dão semente quando colhidas no campo (${Math.round(wildSeedSettings.chance * 100)}% por colheita)`);
}
