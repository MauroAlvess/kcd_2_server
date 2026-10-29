/**
 * Putting a big stack into an inventory. `Inventory.add` (and `Stash.addItem`, which is the same) takes 1 to 10,000 units of a class per call ("1 to 10000 at a
 * time" in the API); more comes back `invalidAmount` and nothing moves. The game's money counts in tenths of a coin, so 10,000 units are only 1,000 coins:
 * a player who put 2,410 coins on the trade's table and cancelled got back 28 (the little row) and was owed the rest, which every later attempt refused for the
 * same reason (user, 2026-10-25: Kael de Borova). So whatever hands a row back goes through here, a call at a time, all of it or none of it.
 */

/** The most one call can add. */
export const ADD_MAX = 10_000;

export interface AddRequest {
    readonly item: string;
    readonly amount: number;
    readonly metadata?: Record<string, unknown>;
    readonly notify?: boolean;
}

export interface AddResult {
    readonly ok: boolean;
    readonly code: string;
    readonly revision: number;
    readonly items: InventoryUnit[];
}

/** One way of adding to somewhere, and of taking back what was added (the rows `items` of its answers). */
export interface Target {
    add(request: AddRequest): AddResult;
    remove(units: InventoryUnit[]): { readonly ok: boolean };
}

/**
 * Adds `request.amount` units in calls of at most `ADD_MAX`. If a call is refused, the ones before it are taken out again and the refusal is the answer: a row is
 * never half-given. The game's "You received" toast, when it is wanted, comes once, with the first call.
 */
export function addInChunks(target: Target, request: AddRequest): AddResult {
    if (!(request.amount > ADD_MAX)) {
        return target.add(request);
    }
    const given: Array<{ id: string; amount: number }> = [];
    let left = request.amount;
    let last: AddResult | null = null;
    while (left > 0) {
        const part = Math.min(left, ADD_MAX);
        const result = target.add({ ...request, amount: part, ...(request.notify === false || given.length > 0 ? { notify: false } : {}) });
        if (!result.ok) {
            if (given.length > 0) {
                target.remove(given.map((unit) => ({ id: unit.id, amount: unit.amount })));
            }
            return result;
        }
        const row = result.items[0];
        if (row === undefined) {
            // The game said yes and named no row: there is no way to take it back, so the rest is not tried.
            return result;
        }
        given.push({ id: row.id, amount: part });
        last = result;
        left -= part;
    }
    return { ok: true, code: "", revision: last?.revision ?? 0, items: given.map((unit) => ({ id: unit.id, amount: unit.amount })) };
}

/** `Inventory.add` of a player or an NPC, in chunks. */
export function addUnits(owner: Player | Npc, request: AddRequest): AddResult {
    return addInChunks({ add: (part) => Inventory.add(owner, part), remove: (units) => Inventory.remove(owner, { units, notify: false }) }, request);
}

/** `Stash.addItem` of a container, in chunks. */
export function addUnitsToStash(stash: Stash, request: AddRequest): AddResult {
    const { notify: _notify, ...part } = request;
    return addInChunks({ add: (next) => stash.addItem({ item: next.item, amount: next.amount, ...(next.metadata === undefined ? {} : { metadata: next.metadata }) }), remove: (units) => stash.removeItem({ units }) }, part);
}
