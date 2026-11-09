/**
 * The pace of the trades' XP (`profession-xp.ts`) as the administrators choose it, kept in `playerdata/profession-xp.json` so that it stays across restarts, and the day's ledger
 * (what each player has earned of each track today, for the day's limit) in `playerdata/profession-day.json`.
 */

import { DAILY_MAX, dayOf, ledgerHooks, ledgerSnapshot, professionXp, RATE_MAX, RATE_MIN, restoreLedger } from "./profession-xp.js";
import { ensureDir, read, write } from "./store.js";

const DIR = "playerdata";
const FILE = `${DIR}/profession-xp.json`;
const DAY_FILE = `${DIR}/profession-day.json`;

/** The tracks by the name a player knows them by. */
const TRACK_WORDS: Readonly<Record<string, string>> = {
    craftsmanship: "ofício manual (forja e costura)",
    survival: "sobrevivência",
    alchemy: "alquimia",
    drinking: "bebida",
    strength: "força",
};

/** The words of a track, for the chat. */
export const trackWord = (track: string): string => TRACK_WORDS[track] ?? track;

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function saveDaySoon(): void {
    if (saveTimer !== null) {
        return;
    }
    saveTimer = setTimeout(() => {
        saveTimer = null;
        try {
            ensureDir(DIR);
            write(DAY_FILE, { v: 1, players: ledgerSnapshot() });
        } catch (error: unknown) {
            console.log(`ofícios: não consegui guardar o XP do dia: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, 5_000);
}

function crossed(who: string, track: string): void {
    const player = Player.all().find((one) => one.steamId === who);
    const name = player?.nickname ?? "?";
    console.log(`ofícios: ${name} passou hoje de ${professionXp.dailyFull} XP de ${track}: até a meia-noite (Brasília) cada obra rende ${Math.round(professionXp.overShare * 100)}%`);
    if (player === undefined) {
        return;
    }
    try {
        Chat.sendToPlayer(
            player,
            `Você já fez hoje o XP cheio de ${trackWord(track)} (${professionXp.dailyFull.toLocaleString("pt-BR")}). Até a meia-noite, cada obra rende ${Math.round(professionXp.overShare * 100)}% do XP: o ritmo dos ofícios é o mesmo para todos.`,
        );
    } catch {
        // Gone already.
    }
}

/** Takes back the pace chosen before the last stop, and today's ledger. */
export function installProfessionXp(): void {
    const found = read<{ v?: unknown; rate?: unknown; dailyFull?: unknown }>(FILE);
    if (found.status === "corrupt") {
        console.log(`ofícios: ${FILE} está ilegível e foi deixado como está: ${found.reason}`);
    } else if (found.status === "ok") {
        const kept = found.value;
        // The first file (2026-10-27) kept the times of the tables, 4 by default: the standard of 2026-11-03 is that 4 for the gardens, so what it kept is read against it.
        const rate = typeof kept.rate === "number" ? (kept.v === 2 ? kept.rate : kept.rate / 4) : 1;
        if (Number.isFinite(rate) && rate >= RATE_MIN && rate <= RATE_MAX) {
            professionXp.rate = Math.round(rate * 100) / 100;
        }
        if (kept.v === 2 && typeof kept.dailyFull === "number" && Number.isFinite(kept.dailyFull) && kept.dailyFull >= 0 && kept.dailyFull <= DAILY_MAX) {
            professionXp.dailyFull = Math.round(kept.dailyFull);
        }
    }
    const day = read<{ players?: unknown }>(DAY_FILE);
    const players = day.status === "ok" ? restoreLedger(day.value.players) : 0;
    ledgerHooks.changed = saveDaySoon;
    ledgerHooks.crossed = crossed;
    console.log(
        `ofícios: o XP dos ofícios vale ${professionXp.rate} vez(es) o padrão; ${professionXp.dailyFull > 0 ? `${professionXp.dailyFull} XP por habilidade e por dia rendem inteiros, depois ${Math.round(professionXp.overShare * 100)}%` : "sem limite diário"}; ${players} jogador(es) já trabalharam hoje (${dayOf(Date.now())})`,
    );
}

function keep(): void {
    try {
        ensureDir(DIR);
        write(FILE, { v: 2, rate: professionXp.rate, dailyFull: professionXp.dailyFull });
    } catch (error: unknown) {
        console.log(`ofícios: não consegui guardar o ritmo do XP: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/** Chooses the factor and keeps it. False for a number outside what is allowed. */
export function chooseRate(rate: number): boolean {
    if (!Number.isFinite(rate) || rate < RATE_MIN || rate > RATE_MAX) {
        return false;
    }
    professionXp.rate = Math.round(rate * 100) / 100;
    keep();
    return true;
}

/** Chooses the day's limit (0 for none) and keeps it. False for a number outside what is allowed. */
export function chooseDailyFull(xp: number): boolean {
    if (!Number.isFinite(xp) || xp < 0 || xp > DAILY_MAX) {
        return false;
    }
    professionXp.dailyFull = Math.round(xp);
    keep();
    return true;
}
