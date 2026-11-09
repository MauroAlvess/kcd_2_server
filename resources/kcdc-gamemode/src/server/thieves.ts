/**
 * The thief's mark (user, 2026-10-18): first "qualquer jogador que roubar itens de outros jogadores deve receber a marca de ladrão,
 * que fica durante 7 dias", then, the same day, "roubou mais de 3 baús em curto período, fica com título de ladrão por 1 dia".
 * Since 2026-11-01 it comes from picking locks only, and since 2026-11-02 not at the first ("esse título só deve ser dado depois do
 * jogador arrombar 3 coisas, exemplo portão, baú, porta ou baú, baú, porta"): whoever picks the locks of `BREAKINS_FOR_MARK` doors,
 * gates or chests of other players (`property-menu.ts`, which leaves a relative's out) within `BREAKIN_WINDOW_MS` is marked for a day,
 * and the mark is over their head ("Ladrão", or "Ladra") until it runs out, in place of any title (`titles.ts` `applyNametag`). The
 * marks are kept in `playerdata/thieves.json` and the break-ins counted in `playerdata/thief-breakins.json`, so a restart washes
 * neither off.
 */

import { ensureDir, read, write } from "./store.js";

const DIR = "playerdata";
const FILE = `${DIR}/thieves.json`;
const BREAKINS_FILE = `${DIR}/thief-breakins.json`;

/**
 * How long the mark lasts, from the last theft (2026-10-18, the user's second word on it: "roubou mais de 3 baús em curto período,
 * fica com título de ladrão por 1 dia"; it was 7 days for any one chest until then).
 */
export const MARK_DAYS = 1;
const DAY_MS = 24 * 60 * 60 * 1000;
/** The break-in that marks a thief: this many locks of other players' doors, gates or chests, each counted once, within `BREAKIN_WINDOW_MS`. */
export const BREAKINS_FOR_MARK = 3;
export const BREAKIN_WINDOW_MS = 3 * DAY_MS;

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

/** A lock picked: which part (its level GUID), what it was called for the reason of a mark, and when. */
interface BreakIn {
    readonly part: string;
    readonly what: string;
    readonly at: number;
}

/** The break-ins each player made lately, by Steam id. */
let breakins: Record<string, BreakIn[]> | null = null;

function loadBreakins(): Record<string, BreakIn[]> {
    if (breakins !== null) {
        return breakins;
    }
    const result = read<Record<string, unknown>>(BREAKINS_FILE);
    breakins = {};
    if (result.status === "ok" && typeof result.value === "object" && result.value !== null) {
        for (const [steamId, list] of Object.entries(result.value)) {
            if (Array.isArray(list)) {
                breakins[steamId] = list.filter((one): one is BreakIn => typeof one === "object" && one !== null && typeof one.part === "string" && typeof one.what === "string" && typeof one.at === "number");
            }
        }
    }
    return breakins;
}

function persistBreakins(): void {
    ensureDir(DIR);
    write(BREAKINS_FILE, breakins ?? {});
}

/**
 * A lock of another player's door, gate or chest picked (`property-menu.ts`). Each part counts once within `BREAKIN_WINDOW_MS`; the
 * mark comes with the `BREAKINS_FOR_MARK`th, and every break-in after it within the window renews it. `count` is how many are counted
 * now; `mark` the mark given or renewed now, or null.
 */
export function noteBreakIn(steamId: string, name: string, part: string, what: string, now: number = Date.now()): { readonly count: number; readonly mark: ThiefMark | null } {
    if (steamId === "") {
        return { count: 0, mark: null };
    }
    const all = loadBreakins();
    const kept = (all[steamId] ?? []).filter((one) => now - one.at < BREAKIN_WINDOW_MS && one.part !== part);
    kept.push({ part, what, at: now });
    all[steamId] = kept;
    // Nobody's old break-ins are kept past the window.
    for (const [other, list] of Object.entries(all)) {
        if (other !== steamId && list.every((one) => now - one.at >= BREAKIN_WINDOW_MS)) {
            delete all[other];
        }
    }
    persistBreakins();
    const count = kept.length;
    if (count < BREAKINS_FOR_MARK) {
        console.log(`thieves: ${name} arrombou ${what} (${count} de ${BREAKINS_FOR_MARK} para a marca de ladrão)`);
        return { count, mark: null };
    }
    const list = kept.slice(-BREAKINS_FOR_MARK).map((one) => one.what).join(", ");
    return { count, mark: markThief(steamId, name, `arrombou ${count} fechaduras de outros jogadores: ${list}`, now) };
}

/** How many break-ins count against a player now, for `/ladrao`. */
export function breakInsOf(steamId: string, now: number = Date.now()): number {
    return (loadBreakins()[steamId] ?? []).filter((one) => now - one.at < BREAKIN_WINDOW_MS).length;
}

/**
 * Takes a mark off (an administrator's pardon), and the break-ins counted against the player with it. True when there was anything to take off: a mark (running or not) or break-ins
 * still counted (2026-11-06, the user: "remover título de ladrão do Shakran": his mark had run out but four break-ins were still counted, so the next one would have marked him again).
 */
export function clearThief(steamId: string): boolean {
    const all = load();
    const counted = loadBreakins();
    let cleared = false;
    if (counted[steamId] !== undefined) {
        delete counted[steamId];
        persistBreakins();
        cleared = true;
    }
    if (all[steamId] !== undefined) {
        delete all[steamId];
        persist();
        cleared = true;
        // The head is drawn again, also for a mark that had run out: a label left on it is gone.
        refresh(steamId);
    }
    return cleared;
}

/**
 * Every account with something recorded against it, a mark (running or run out) or break-ins counted within the window, for a pardon to find: the name the mark was given under (the account's
 * nickname) when it has one, and how many break-ins count.
 */
export function recorded(now: number = Date.now()): Array<{ readonly steamId: string; readonly name: string | null; readonly breakIns: number }> {
    const marks = load();
    const counted = loadBreakins();
    const ids = new Set([...Object.keys(marks), ...Object.keys(counted)]);
    return [...ids]
        .map((steamId) => ({ steamId, name: marks[steamId]?.name ?? null, breakIns: (counted[steamId] ?? []).filter((one) => now - one.at < BREAKIN_WINDOW_MS).length }))
        .filter((row) => marks[row.steamId] !== undefined || row.breakIns > 0);
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
