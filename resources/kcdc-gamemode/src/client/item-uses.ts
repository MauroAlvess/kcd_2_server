/**
 * Inventory actions the server takes over. The game's own action for an item (reading a book, and whatever else the
 * server lists) happens on this machine and the server never hears of it, so the server lists the items it wants to
 * handle itself and the action named with them; each gets this handler in place of the game's, which asks the server to
 * do it (`<use>` with the item, its row and the inventory revision). The server checks all of it again.
 */

const RESOURCE = "kcdc-gamemode";

export function installItemUses(): void {
    const taken = new Set<string>();

    Events.on(`${RESOURCE}:itemuses`, (payload) => {
        let use = "";
        let refused = 0;
        try {
            const list = (typeof payload === "string" ? JSON.parse(payload) : payload) as { use?: unknown; items?: unknown };
            use = typeof list.use === "string" ? list.use : "";
            for (const guid of Array.isArray(list.items) ? list.items : []) {
                try {
                    if (use !== "" && typeof guid === "string" && !taken.has(guid)) {
                        Inventory.onUse(guid, (it) => Events.emitServer(`${RESOURCE}:${use}`, JSON.stringify({ item: it.item, id: it.id, revision: it.revision })));
                        taken.add(guid);
                    }
                } catch {
                    refused += 1;
                }
            }
        } catch {
            return;
        }
        console.log(`item-uses: ${use}: ${taken.size} item(ns) tomado(s) pelo servidor, ${refused} recusado(s)`);
    });
}
