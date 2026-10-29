/**
 * The thief's mark (user, 2026-10-18): first "qualquer jogador que roubar itens de outros jogadores deve receber a marca de ladrão,
 * que fica durante 7 dias", then, the same day, "roubou mais de 3 baús em curto período, fica com título de ladrão por 1 dia".
 * Whoever robs more than three chests that are somebody else's within an hour (the "Roubar" of a chest's menu, or things taken from
 * one: `property-menu.ts`, which leaves a relative's chest out) is marked for a day, and the mark is over their head ("Ladrão", or
 * "Ladra") until it runs out, in place of any title (`titles.ts` `applyNametag`). The marks are kept in `playerdata/thieves.json`,
 * so a restart does not wash them off; the count of chests is kept in memory only.
 */

import { ensureDir, read, write } from "./store.js";

const DIR = "playerdata";
const FILE = `${DIR}/thieves.json`;

/**
 * How long the mark lasts, from the last theft (2026-10-18, the user's second word on it: "roubou mais de 3 baús em curto período,
 * fica com título de ladrão por 1 dia"; it was 7 days for any one chest until then).
 */
export const MARK_DAYS = 1;
/** More than this many different chests robbed within `THEFT_WINDOW_MS` and the thief is marked. */
export const THEFTS_ALLOWED = 3;
export const THEFT_WINDOW_MS = 60 * 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ThiefMark {
    readonly name: string;
    /** When the mark runs out (ms). */
    readonly until: number;
    /** What they did, for the log and the administrators. */
    readonly reason: string;
    readonly at: number;
}

let marks: Record<string, ThiefMark> | null = null;

function load(): Record<string, ThiefMark> {
    if (marks !== null) {
        return marks;
    }
    const result = read<Record<string, ThiefMark>>(FILE);
    marks = result.status === "ok" && typeof result.value === "object" && result.value !== null ? { ...result.value } : {};
    return marks;
}

function persist(): void {
    ensureDir(DIR);
    write(FILE, marks ?? {});
}

/** The mark a player wears now, or null. */
export function thiefMark(steamId: string, now: number = Date.now()): ThiefMark | null {
    if (steamId === "") {
        return null;
    }
    const mark = load()[steamId];
    return mark !== undefined && mark.until > now ? mark : null;
}

/** Marks a player a thief for `MARK_DAYS` from now (a new theft starts the count again). */
export function markThief(steamId: string, name: string, reason: string, now: number = Date.now(), days: number = MARK_DAYS): ThiefMark | null {
    if (steamId === "") {
        return null;
    }
    const mark: ThiefMark = { name, until: now + days * DAY_MS, reason, at: now };
    load()[steamId] = mark;
    persist();
    console.log(`thieves: ${name} marcado como ladrão até ${new Date(mark.until).toISOString().slice(0, 16).replace("T", " ")} UTC: ${reason}`);
    refresh(steamId);
    return mark;
}

/** The chests each player robbed lately, by Steam id: the chest's level GUID and when. Kept in memory: a restart forgets them. */
const recent = new Map<string, Map<string, number>>();

/**
 * A chest robbed (`property-menu.ts`: Roubar, or things taken from a chest that is somebody else's). Counted once per chest; the
 * mark comes with the fourth different chest within the hour, and every theft after it while it is on renews it. `count` is how
 * many different chests are counted now; `mark` the mark given or renewed now, or null.
 */
export function noteTheft(steamId: string, name: string, chest: string, reason: string, now: number = Date.now()): { readonly count: number; readonly mark: ThiefMark | null } {
    if (steamId === "") {
        return { count: 0, mark: null };
    }
    const chests = recent.get(steamId) ?? new Map<string, number>();
    for (const [guid, at] of chests) {
        if (now - at >= THEFT_WINDOW_MS) {
            chests.delete(guid);
        }
    }
    const fresh = !chests.has(chest);
    chests.set(chest, now);
    recent.set(steamId, chests);
    const count = chests.size;
    if (count <= THEFTS_ALLOWED || (!fresh && thiefMark(steamId, now) !== null)) {
        return { count, mark: null };
    }
    return { count, mark: markThief(steamId, name, `${reason} (${count} baús em menos de uma hora)`, now) };
}

/** Takes a mark off (an administrator's pardon). */
export function clearThief(steamId: string): boolean {
    const all = load();
    if (all[steamId] === undefined) {
        return false;
    }
    delete all[steamId];
    recent.delete(steamId);
    persist();
    refresh(steamId);
    return true;
}

/** Every mark still running, for `/ladrao`. */
export function thieves(now: number = Date.now()): Array<{ readonly steamId: string; readonly mark: ThiefMark }> {
    return Object.entries(load())
        .filter(([, mark]) => mark.until > now)
        .map(([steamId, mark]) => ({ steamId, mark }));
}

/** What redraws a player's nametag (`titles.ts` sets it: this module cannot import it without a cycle). */
let redraw: (player: Player) => void = () => undefined;

export function onThiefChange(fn: (player: Player) => void): void {
    redraw = fn;
}

function refresh(steamId: string): void {
    for (const player of Player.all()) {
        if (player.steamId === steamId) {
            redraw(player);
        }
    }
}

/** Marks that ran out come off the heads they were on, once a minute. */
export function installThieves(): void {
    const shown = new Set<string>();
    setInterval(() => {
        const now = Date.now();
        for (const player of Player.all()) {
            const marked = thiefMark(player.steamId, now) !== null;
            if (shown.has(player.steamId) && !marked) {
                shown.delete(player.steamId);
                redraw(player);
            } else if (marked) {
                shown.add(player.steamId);
            }
        }
    }, 60_000);
}
