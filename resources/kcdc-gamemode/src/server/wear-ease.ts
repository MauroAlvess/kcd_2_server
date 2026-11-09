/**
 * Wear that is gentler (2026-10-31, user: "a durabilidade dos itens está quebrando muito rápido, vamos melhorar um pouco e deixar no médio").
 *
 * The game wears a weapon at every blow and an armour at every hit it takes, in the player's own game, and the KCDC server hears of each wear as a
 * `playerInventoryChanged` with the reason `wear` (the rows that changed, each with the condition it had and the one it has). The framework has no setting for
 * how fast things wear, so the server gives back part of what the game took: of every point of condition the game took off, only `share` stays taken, the rest
 * is put back on the row at once (`Inventory.setProperties`, the way `sharpen-log.ts` undoes a sharpening). `share` is 1 for the game's own wear and 0 for
 * none; the server starts at `DEFAULT_SHARE`, a little over half of it ("no médio"), and an administrator changes it with `/desgaste` (kept in
 * `playerdata/wear-ease.json`). What the server itself wears (the Coletores' axe and pick, `gather.ts`) follows it too.
 *
 * Only the wear is eased: repairs, sharpening and the condition an item is made or found with are not touched, and an item that took no wear is left alone.
 */

import { ensureDir, read, write } from "./store.js";

const DIR = "playerdata";
const FILE = `${DIR}/wear-ease.json`;

/** The share of the game's wear that is kept: 0.55 is a little over half (about 45% less wear than the game's own, which the players found too fast). */
export const DEFAULT_SHARE = 0.55;
/** An administrator may go from nearly no wear to the game's own, and no further either way. */
export const MIN_SHARE = 0.05;
export const MAX_SHARE = 1;

/** A condition that moved by less than this is not a wear worth the call (the game's reads carry some noise). */
const LEAST_LOSS = 0.0005;
/** At or below this a piece is worn to nothing and breaks (`wear-break.ts`'s `BREAK_AT`, kept apart so that neither module needs the other). */
const NOTHING_LEFT = 0.0005;

export const wearEase = { share: DEFAULT_SHARE };

/** What an administrator reads of the setting. */
export function describeWear(): string {
    const eased = Math.round((1 - wearEase.share) * 100);
    return wearEase.share >= MAX_SHARE ? "Desgaste: o do jogo, sem amenizar." : `Desgaste: o dos itens é ${Math.round(wearEase.share * 100)}% do que o jogo tira (${eased}% a menos).`;
}

/** Puts the share between its limits (anything that is not a number is the default). */
export function clampShare(value: unknown): number {
    const wanted = typeof value === "number" && Number.isFinite(value) ? value : DEFAULT_SHARE;
    return Math.min(MAX_SHARE, Math.max(MIN_SHARE, Math.round(wanted * 1000) / 1000));
}

/** Sets the share and keeps it for the next start. */
export function setWearShare(value: unknown): number {
    wearEase.share = clampShare(value);
    try {
        ensureDir(DIR);
        write(FILE, { v: 1, share: wearEase.share });
    } catch (error: unknown) {
        console.log(`wear: não consegui guardar o desgaste: ${error instanceof Error ? error.message : String(error)}`);
    }
    return wearEase.share;
}

interface Row {
    readonly condition?: number;
    readonly metadata?: Record<string, unknown>;
}

interface Change {
    readonly reason: string;
    readonly items: ReadonlyArray<{ readonly id: string; readonly before: Row | null; readonly after: Row | null }>;
}

/**
 * Gives back to each row of a wear what the setting says. Returns how many rows were eased. Pure of the framework but for `Inventory`, so that a test can run it.
 */
export function easeWear(player: Player, change: Change): number {
    if (change.reason !== "wear" || wearEase.share >= MAX_SHARE) {
        return 0;
    }
    let eased = 0;
    for (const row of change.items) {
        const before = row.before?.condition;
        const after = row.after?.condition;
        if (row.after === null || row.after === undefined || typeof before !== "number" || typeof after !== "number") {
            continue;
        }
        const loss = before - after;
        // Worn to nothing, the piece breaks and goes (`wear-break.ts`, 2026-11-04): nothing is given back to it.
        if (!(loss > LEAST_LOSS) || after <= NOTHING_LEFT) {
            continue;
        }
        const condition = Math.min(1, Math.max(0, before - loss * wearEase.share));
        // The row as it is now, with the condition alone changed: `health` and `condition` must not disagree, so only one is given.
        const metadata: Record<string, unknown> = { ...row.after.metadata };
        delete metadata["health"];
        metadata["condition"] = Math.round(condition * 10_000) / 10_000;
        try {
            if (Inventory.setProperties(player, { id: row.id, metadata }).ok) {
                eased += 1;
            }
        } catch {
            // The row went with the item (a piece that broke or was dropped in the same moment).
        }
    }
    return eased;
}

export function installWearEase(): void {
    const loaded = read<{ share?: unknown }>(FILE);
    if (loaded.status === "ok" && typeof loaded.value === "object" && loaded.value !== null) {
        wearEase.share = clampShare(loaded.value.share);
    }
    Events.on("playerInventoryChanged", (player, change) => {
        if (change.reason === "wear") {
            easeWear(player, change as unknown as Change);
        }
    });
    console.log(`wear: ${describeWear()}`);
}
