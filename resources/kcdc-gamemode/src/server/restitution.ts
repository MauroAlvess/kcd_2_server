/**
 * Items owed to a player by an administrator's decision, handed over when their inventory is ready (2026-10-18: what was robbed
 * from Radovan's chests in the castle of Suchdol goes back to him, "pode retirar todos itens roubados e devolver para o meu
 * personagem Radovan"). `playerdata/restitution.json` holds, by Steam id, the rows and why; what does not fit waits for the next
 * entry.
 */

import { addUnits } from "./inventory-add.js";
import { ensureDir, read, write } from "./store.js";

const DIR = "playerdata";
const FILE = `${DIR}/restitution.json`;

export interface OwedRow {
    readonly item: string;
    readonly amount: number;
    readonly metadata?: Record<string, unknown>;
}

interface Owed {
    rows: OwedRow[];
    readonly reason: string;
}

let owed: Record<string, Owed> | null = null;

function load(): Record<string, Owed> {
    if (owed !== null) {
        return owed;
    }
    const result = read<Record<string, Owed>>(FILE);
    owed = result.status === "ok" && typeof result.value === "object" && result.value !== null ? { ...result.value } : {};
    return owed;
}

function persist(): void {
    ensureDir(DIR);
    write(FILE, owed ?? {});
}

/** What was owed to a deleted character is not handed to the next one (2026-10-25). True when anything was owed. */
export function forgetOwed(steamId: string): boolean {
    const all = load();
    if (all[steamId] === undefined) {
        return false;
    }
    delete all[steamId];
    persist();
    return true;
}

/** Hands a player what is owed to them. How many rows went in. */
export function deliverOwed(player: Player): number {
    const all = load();
    const entry = all[player.steamId];
    if (entry === undefined || entry.rows.length === 0) {
        return 0;
    }
    const left: OwedRow[] = [];
    let given = 0;
    for (const row of entry.rows) {
        let ok = false;
        try {
            ok = addUnits(player, { item: row.item, amount: row.amount, ...(row.metadata ? { metadata: row.metadata } : {}) }).ok;
        } catch {
            ok = false;
        }
        if (ok) {
            given += 1;
        } else {
            left.push(row);
        }
    }
    if (left.length > 0) {
        entry.rows = left;
    } else {
        delete all[player.steamId];
    }
    persist();
    if (given > 0) {
        Chat.sendToPlayer(player, left.length > 0 ? `${entry.reason}: parte voltou para o seu inventário (${given}); o resto volta quando houver espaço.` : `${entry.reason}: tudo voltou para o seu inventário (${given} ${given === 1 ? "item" : "itens"}).`);
        console.log(`restitution: ${player.nickname} recebeu ${given} linha(s) (${entry.reason}); faltam ${left.length}`);
    }
    return given;
}

export function installRestitution(): void {
    Events.on("playerInventoryReady", (player) => {
        deliverOwed(player);
    });
}
