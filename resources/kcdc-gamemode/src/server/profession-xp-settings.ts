/**
 * The pace of the trades' XP (`profession-xp.ts`) as the administrators choose it, kept in `playerdata/profession-xp.json` so that it stays across restarts.
 */

import { professionXp, RATE_MAX, RATE_MIN } from "./profession-xp.js";
import { ensureDir, read, write } from "./store.js";

const DIR = "playerdata";
const FILE = `${DIR}/profession-xp.json`;

/** Takes back the pace chosen before the last stop. */
export function installProfessionXp(): void {
    const found = read<{ rate?: unknown }>(FILE);
    if (found.status === "corrupt") {
        console.log(`ofícios: ${FILE} está ilegível e foi deixado como está: ${found.reason}`);
    } else if (found.status === "ok" && typeof found.value.rate === "number" && found.value.rate >= RATE_MIN && found.value.rate <= RATE_MAX) {
        professionXp.rate = found.value.rate;
    }
    console.log(`ofícios: o XP dos ofícios vale ${professionXp.rate} vez(es) o das tabelas`);
}

/** Chooses the pace and keeps it. False for a number outside what is allowed. */
export function chooseRate(rate: number): boolean {
    if (!Number.isFinite(rate) || rate < RATE_MIN || rate > RATE_MAX) {
        return false;
    }
    professionXp.rate = Math.round(rate * 100) / 100;
    try {
        ensureDir(DIR);
        write(FILE, { v: 1, rate: professionXp.rate });
    } catch (error: unknown) {
        console.log(`ofícios: não consegui guardar o ritmo do XP: ${error instanceof Error ? error.message : String(error)}`);
    }
    return true;
}
