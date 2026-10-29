/**
 * Our own items for the trades (`craft-data.ts`, `CUSTOM_ITEMS`): flour, malt, hops, thread and bow wood, which the game does not
 * have, and (2026-10-20) the tavern keepers' soups, which it has no item for either; a soup has an action in the bag ("Comer"), which
 * `soups.ts` answers. Registered with the game when the server starts, each under a GUID of its own; the recipes and the vendors'
 * lists name them by our ids ("kcdc-craft:farinha"), and this says which class of the inventory each one is.
 */

import { CUSTOM_ITEMS } from "./craft-data.js";

const registered = new Map<string, string>();

/** Registers our own ingredients with the game. */
export function registerCraftItems(): void {
    for (const [id, [name, description, visual, weight, price, useLabel]] of Object.entries(CUSTOM_ITEMS)) {
        try {
            registered.set(id, Items.register(id, useLabel === undefined ? { name, description, visual, weight, price } : { name, description, visual, weight, price, usable: true, useLabel }));
        } catch (error: unknown) {
            console.log(`craft: não consegui registrar ${id}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    // The GUID each is registered under is stable but is in no table: an item of ours that turns up in a log by its class (a ground item, say) is told by this line.
    console.log(`craft: ${registered.size} itens próprios registrados: ${[...registered].map(([id, guid]) => `${id}=${guid}`).join(" ")}`);
}

/** The GUID one of ours was registered under, or null for anything else. */
export function craftItemGuid(id: string): string | null {
    return registered.get(id) ?? null;
}

/** The class an inventory row of this recipe item is: a game item's GUID, or the GUID ours was registered under. */
export function classOf(item: string): string {
    return (registered.get(item) ?? item).toLowerCase();
}
