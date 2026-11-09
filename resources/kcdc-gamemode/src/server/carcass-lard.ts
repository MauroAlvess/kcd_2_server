/**
 * Lard in the pigs the hunters butcher (user, 2026-11-04: "aos porcos mortos adicione banha de porco, porque tem receita que precisa"): the kitchen's recipes take pork lard (the soups'
 * and the pies', and the fire's own "Banha", two pork for a pot of it) and the only source was the tavern keepers' vendor. When a hunter butchers a pig (`npcHarvested`), the carcass's stock, which is
 * open for them to take, holds some lard beside its meat and hide: one to three from a farm pig, one or two from a wild boar. Anybody who is not a hunter has their carcass emptied as before
 * (`guild-crafts.ts`), so nothing is put into it for them. The same way the cows' milk is found (`cows.ts`).
 */

import { mayCraft } from "./guild-crafts.js";

/** What the game calls a farm pig and a wild boar, and the item the recipes take (the table's name for pork lard). */
export const LARD_ITEM = "special_lard";

export const lardSettings = {
    /** How much lard a carcass holds, by the actor's class. */
    carcass: { Pig: { least: 1, most: 3 }, Boar: { least: 1, most: 2 } } as Readonly<Record<string, { readonly least: number; readonly most: number }>>,
};

/** The lard put into a pig's carcass when a hunter butchers it. How much; 0 for any other body, for one who is not a hunter, or when the stock would not take it. */
export function carcassLard(carcass: Npc, player: Player, random: () => number = Math.random): number {
    const range = lardSettings.carcass[carcass.actorClass];
    if (range === undefined || !mayCraft(player, "abate")) {
        return 0;
    }
    const amount = range.least + Math.floor(random() * (range.most - range.least + 1));
    try {
        const added = Inventory.add(carcass, { item: LARD_ITEM, amount, notify: false });
        if (!added.ok) {
            console.log(`abate: a banha não entrou na carcaça (${added.code})`);
            return 0;
        }
    } catch (error: unknown) {
        console.log(`abate: a banha não entrou na carcaça: ${error instanceof Error ? error.message : String(error)}`);
        return 0;
    }
    console.log(`abate: ${player.nickname} abateu ${carcass.actorClass === "Boar" ? "um javali" : "um porco"}: ${amount}x banha na carcaça`);
    return amount;
}

export function installCarcassLard(): void {
    Events.on("npcHarvested", (npc, player) => {
        carcassLard(npc, player);
    });
    console.log("abate: os porcos e os javalis abatidos pelo caçador trazem banha na carcaça");
}
