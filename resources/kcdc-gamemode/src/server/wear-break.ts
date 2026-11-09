/**
 * Worn to nothing, gone (2026-11-04, user: "quando uma roupa, arma ou armadura, qualquer coisa do tipo, chegar a 0 de durabilidade deve quebrar e sumir do inventário do
 * jogador").
 *
 * The game wears a weapon at every blow, an armour or a garment at every hit it takes and a pair of boots on the road, and tells the server of each wear as a
 * `playerInventoryChanged` with the reason `wear`: the rows that changed, each with the condition it had and the one it has. The game itself keeps a piece at 0 in the
 * bag, useless. Here a piece the game's wear left at `BREAK_AT` or below is taken out of the inventory, worn or not, and its owner is told in the chat.
 *
 * Only the game's wear breaks a piece: food spoils to 0 too (a rotten carrot is at 0, and must stay a rotten carrot), and nothing made, found, bought, given, repaired
 * or spoiled comes through here. `wear-ease.ts` gives back part of every wear, and gives nothing back to a piece worn to nothing (it is this module's).
 *
 * The pieces that were at 0 before the rule (96 in 67 characters that day, 69 of them boots and shoes; the user, asked whether to take them all: "sim") go at the owner's
 * next entry (`sweepBroken`, `SWEEP_AFTER_SPAWN_MS` after the spawn, once a session): only the game's equippable classes (`Inventory.classes()`: armour, clothes, hoods,
 * helmets, weapons -- never food, which lies at 0 when it is rotten), and never a quest piece.
 */

import { itemName } from "./item-names.js";

/** A condition at or below this is nothing left (the game's reads carry some noise around 0). The same in `wear-ease.ts`. */
export const BREAK_AT = 0.0005;

export interface WornRow {
    readonly item: string;
    readonly name?: string;
    readonly amount: number;
    readonly condition?: number;
    readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface WearChange {
    readonly reason: string;
    readonly items: ReadonlyArray<{ readonly id: string; readonly before: WornRow | null; readonly after: WornRow | null }>;
}

/** The rows of a change that the game's wear left with nothing: a wear, on a row that was there before and is still there, at `BREAK_AT` or below now. */
export function brokenRows(change: WearChange): Array<{ readonly id: string; readonly row: WornRow }> {
    if (change.reason !== "wear") {
        return [];
    }
    const broken: Array<{ readonly id: string; readonly row: WornRow }> = [];
    for (const entry of change.items) {
        const after = entry.after;
        if (entry.before === null || entry.before === undefined || after === null || after === undefined) {
            continue;
        }
        const condition = typeof after.condition === "number" ? after.condition : after.metadata?.["condition"];
        if (typeof condition === "number" && Number.isFinite(condition) && condition <= BREAK_AT) {
            broken.push({ id: entry.id, row: after });
        }
    }
    return broken;
}

/** What the owner is told when a piece breaks. */
export function brokeText(name: string): string {
    return `${name} quebrou de tanto uso e sumiu do seu inventário.`;
}

/**
 * Takes out of the player's inventory every piece a wear left with nothing, and tells them. Returns how many rows went. A row the server would not take (gone already, or
 * changed again in the same moment) is left to the next wear.
 */
export function breakWornOut(player: Player, change: WearChange): number {
    let gone = 0;
    for (const { id, row } of brokenRows(change)) {
        const name = itemName(row);
        try {
            const result = Inventory.remove(player, { units: [{ id, amount: Math.max(1, row.amount) }] });
            if (!result.ok) {
                console.log(`wear: ${player.nickname}: ${name} chegou a 0 de durabilidade, mas não saiu do inventário (${result.code})`);
                continue;
            }
        } catch (error: unknown) {
            console.log(`wear: ${player.nickname}: ${name} chegou a 0 de durabilidade, mas não saiu do inventário (${error instanceof Error ? error.message : String(error)})`);
            continue;
        }
        gone += 1;
        console.log(`wear: ${player.nickname}: ${name} (${row.name ?? row.item}) quebrou com o uso e saiu do inventário`);
        Chat.sendToPlayer(player, brokeText(name));
    }
    return gone;
}

/** How long after a spawn the bag is looked at for pieces at 0: the saved inventory is long back by then (it is put back before the spawn). */
export const SWEEP_AFTER_SPAWN_MS = 15_000;

/** What the owner is told when pieces at 0 are taken at the entry. */
export function sweptText(names: readonly string[]): string {
    return `Peças que estavam com 0 de durabilidade quebraram e sumiram do seu inventário: ${names.join(", ")}.`;
}

/** The game's equippable classes by GUID (lower case), and whether each is a quest piece; read once. */
let equippable: Map<string, boolean> | null = null;

function equippableClasses(): Map<string, boolean> {
    if (equippable === null || equippable.size === 0) {
        equippable = new Map();
        try {
            for (const entry of Inventory.classes()) {
                equippable.set(String(entry.id).toLowerCase(), entry.quest === true);
            }
        } catch (error: unknown) {
            console.log(`wear: a lista de classes do jogo não veio: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    return equippable;
}

/**
 * Takes out of the player's bag every equippable piece already at 0 (not a quest piece, never food or a material), and tells them in one line. Returns how many rows went.
 */
export function sweepBroken(player: Player): number {
    const state = Inventory.get(player);
    if (state === null) {
        return 0;
    }
    const classes = equippableClasses();
    const gone: string[] = [];
    for (const row of state.items) {
        const quest = classes.get(String(row.item).toLowerCase());
        if (quest === undefined || quest) {
            continue;
        }
        const condition = typeof row.condition === "number" ? row.condition : row.metadata?.["condition"];
        if (typeof condition !== "number" || !Number.isFinite(condition) || condition > BREAK_AT) {
            continue;
        }
        try {
            if (Inventory.remove(player, { units: [{ id: row.id, amount: Math.max(1, row.amount) }] }).ok) {
                gone.push(itemName(row));
            }
        } catch {
            // Gone already, or changed in the same moment: the next entry looks again.
        }
    }
    if (gone.length > 0) {
        console.log(`wear: ${player.nickname}: ${gone.length} peça(s) com 0 de durabilidade saíram do inventário na entrada: ${gone.join(", ")}`);
        Chat.sendToPlayer(player, sweptText(gone));
    }
    return gone.length;
}

/** The players whose bag was looked at this session. */
const swept = new Set<number>();

export function installWearBreak(): void {
    Events.on("playerInventoryChanged", (player, change) => {
        if (change.reason === "wear") {
            breakWornOut(player, change as unknown as WearChange);
        }
    });
    Events.on("playerSpawned", (player) => {
        if (swept.has(player.id)) {
            return;
        }
        swept.add(player.id);
        const id = player.id;
        setTimeout(() => {
            const again = Player.getById(id);
            if (again !== null && again.ready && swept.has(id)) {
                sweepBroken(again);
            }
        }, SWEEP_AFTER_SPAWN_MS);
    });
    Events.on("playerDisconnect", (player) => {
        swept.delete(player.id);
    });
    console.log("wear: o que o uso leva a 0 de durabilidade (roupa, arma, armadura) quebra e sai do inventário; o que já estava em 0 sai na entrada");
}
