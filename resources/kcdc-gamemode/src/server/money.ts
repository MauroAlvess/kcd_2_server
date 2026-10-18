/**
 * Coins in a player's (or an NPC's) inventory.
 *
 * The game's money is the item `money`, and the screen shows a tenth of its amount: 1,000 of the item reads "100".
 * Everything here counts in units of the item; `coins` turns that into what the player reads.
 */

export const MONEY_ITEM = "money";
export const MONEY_GUID = "5ef63059-322e-4e1b-abe8-926e100c770e";
/** The game shows a tenth of the money item's amount. */
export const MONEY_UNIT = 10;

const isMoney = (row: InventoryRow): boolean => row.item === MONEY_GUID || row.name === MONEY_ITEM;

/** "1 moeda", "12 moedas", "2,5 moedas". */
export function coins(units: number): string {
    const amount = units / MONEY_UNIT;
    const shown = Number.isInteger(amount) ? String(amount) : amount.toFixed(1).replace(".", ",");
    return `${shown} ${amount === 1 ? "moeda" : "moedas"}`;
}

/** How much money the holder carries, in units of the item. */
export function moneyOf(holder: Player | Npc): number {
    return (Inventory.get(holder)?.items ?? []).filter(isMoney).reduce((sum, row) => sum + row.amount, 0);
}

/** Takes exactly `units`, or nothing at all. */
export function takeMoney(holder: Player | Npc, units: number): boolean {
    if (units <= 0) {
        return true;
    }
    const taken: InventoryUnit[] = [];
    let left = units;
    for (const row of (Inventory.get(holder)?.items ?? []).filter(isMoney)) {
        if (left <= 0) {
            break;
        }
        const amount = Math.min(row.amount, left);
        taken.push({ id: row.id, amount });
        left -= amount;
    }
    return left <= 0 && Inventory.remove(holder, { units: taken }).ok;
}

export function giveMoney(holder: Player | Npc, units: number): boolean {
    return units <= 0 || Inventory.add(holder, { item: MONEY_ITEM, amount: units }).ok;
}
