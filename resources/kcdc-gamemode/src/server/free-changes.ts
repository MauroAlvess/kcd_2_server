/**
 * One change of guild and one of citizenship for every player, free (user, 2026-10-19: "vamos dar uma troca free de guilda e
 * cidadania para todos jogadores, não resetar, só permitir que eles possam trocar uma vez"). Nothing chosen is undone: a player who
 * wants another guild or another town takes it once from the panel, and after that the choice is final again, as it was. Kept by
 * Steam id in `playerdata/free-changes.json`; a file that cannot be read is never written over (nobody changes meanwhile).
 *
 * Since 2026-10-26 the free change is the first of many: after it, each change of guild or of citizenship is paid (`CHANGE_PRICE_COINS`).
 */

import { ensureDir, read, write } from "./store.js";

export type FreeChange = "guild" | "citizenship";

/**
 * What every change after the free one costs, in the coins the player reads (user, 2026-10-26: "tanto as guildas como a cidadania, o jogador
 * pode alterar uma vez grátis; depois custa 100 moedas para alterar a guilda ou a cidadania"). The charge itself is `change-fee.ts`.
 */
export const CHANGE_PRICE_COINS = 100;

const FILE = "playerdata/free-changes.json";

let used: Record<string, Partial<Record<FreeChange, number>>> | null = null;
let writable = true;

function load(): Record<string, Partial<Record<FreeChange, number>>> {
    if (used !== null) {
        return used;
    }
    const result = read<{ used?: Record<string, Partial<Record<FreeChange, number>>> }>(FILE);
    if (result.status === "ok" && typeof result.value === "object" && result.value !== null && typeof result.value.used === "object" && result.value.used !== null) {
        used = { ...result.value.used };
    } else {
        if (result.status === "corrupt") {
            writable = false;
            console.log(`free-changes: ${FILE} está ilegível e foi deixado como está: ${result.reason}`);
        }
        used = {};
    }
    return used;
}

/** Whether the player still has their free change of this kind. */
export function freeChangeLeft(steamId: string, kind: FreeChange): boolean {
    return steamId !== "" && writable && typeof load()[steamId]?.[kind] !== "number";
}

/** Spends the player's free change of this kind. False when it was spent already (or cannot be kept). */
export function useFreeChange(steamId: string, kind: FreeChange, now = Date.now()): boolean {
    if (!freeChangeLeft(steamId, kind)) {
        return false;
    }
    const all = load();
    all[steamId] = { ...all[steamId], [kind]: now };
    try {
        ensureDir("playerdata");
        write(FILE, { v: 1, used: all });
    } catch (error: unknown) {
        console.log(`free-changes: não consegui gravar ${FILE}: ${error instanceof Error ? error.message : String(error)}`);
    }
    return true;
}

/** What the panel is told: which free changes the player still has. */
export function freeChangesOf(steamId: string): { readonly guild: boolean; readonly citizenship: boolean } {
    return { guild: freeChangeLeft(steamId, "guild"), citizenship: freeChangeLeft(steamId, "citizenship") };
}

/** A deleted character's changes spent: the next character has its own free changes again (2026-10-25). */
export function forgetFreeChanges(steamId: string): boolean {
    const all = load();
    if (!writable || all[steamId] === undefined) {
        return false;
    }
    delete all[steamId];
    try {
        ensureDir("playerdata");
        write(FILE, { v: 1, used: all });
    } catch (error: unknown) {
        console.log(`free-changes: não consegui gravar ${FILE}: ${error instanceof Error ? error.message : String(error)}`);
    }
    return true;
}

/** For tests: forget what was read. */
export function resetFreeChanges(): void {
    used = null;
    writable = true;
}
