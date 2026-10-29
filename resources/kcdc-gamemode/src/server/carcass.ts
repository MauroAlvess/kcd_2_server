/**
 * The meat a butchered animal gives (user, 2026-10-22: "vamos diminuir a quantidade de carne que os animais estão dropando, está vindo carne
 * demais"). The game butchers on the hunter's own machine and the server hears that it was done (`npcHarvested`), when the carcass's stock
 * is open for the hunter to take; what is in it is the game's own, authored for a game one man plays through. So at that moment each raw
 * meat and organ in it is cut to a share of what the game put there, never below one of each, and the rest is taken out of the carcass:
 * the hide and everything else stay as they are. The share is `carcassSettings.meatShare`, set by `/animals carne` until the next start.
 */

import { MEATS } from "./cooking-data.js";

export const carcassSettings = {
    /** Half of each meat: a deer's eight cuts are four, a hare's one stays one. */
    meatShare: 0.5,
};

/** The raw meats and organs of the game's animals, by class GUID: what a carcass is trimmed of. */
const MEAT = new Set(MEATS.map((guid) => guid.toLowerCase()));

/** How many units of one row stay when the share is `share` of `amount`: a share of it, rounded, and at least one. */
export function keptOf(amount: number, share: number): number {
    return Math.min(amount, Math.max(1, Math.round(amount * share)));
}

/** What a trimming did: how many units of meat the carcass held and holds now. */
export interface Trimmed {
    readonly before: number;
    readonly after: number;
}

/** Takes the meat of a butchered carcass down to `share`; the rows that are not meat are not touched. Zero and zero when it could not be read. */
export function trimCarcass(carcass: Npc, share: number = carcassSettings.meatShare): Trimmed {
    try {
        const rows = (Inventory.get(carcass)?.items ?? []).filter((row) => MEAT.has(String(row.item).toLowerCase()) && row.amount > 0);
        const before = rows.reduce((sum, row) => sum + row.amount, 0);
        const units = rows.flatMap((row) => {
            const cut = row.amount - keptOf(row.amount, share);
            return cut > 0 ? [{ id: row.id, amount: cut }] : [];
        });
        if (units.length === 0) {
            return { before, after: before };
        }
        if (!Inventory.remove(carcass, { units, notify: false }).ok) {
            return { before, after: before };
        }
        return { before, after: before - units.reduce((sum, unit) => sum + unit.amount, 0) };
    } catch {
        return { before: 0, after: 0 };
    }
}
