/**
 * A restart announced before it comes (user, 2026-10-19: Erik and Elisabeth were playing dice when the server restarted for an
 * update; they came back stuck at the table and her six dice were lost: "precisa precaver esse tipo de coisa").
 *
 * The deploy script writes `playerdata/restart-notice.json` (`{ "at": <epoch ms> }`) a minute ahead and stops the server at
 * that moment. Meanwhile:
 * - everybody is told, at about 60, 30 and 10 seconds;
 * - no new dice match and no new trade starts (`restartPending`);
 * - `SETTLE_BEFORE_MS` before, the dice matches are stopped (stakes and dice handed back, as at any end), open trades are
 *   undone, and a moment later every character is saved, so what came back is on disk before the server goes.
 */

import { read } from "./store.js";

const RESOURCE = "kcdc-gamemode";
export const NOTICE_FILE = "playerdata/restart-notice.json";
const LOOK_EVERY_MS = 2_000;
/** How long before the restart the games are settled. */
export const SETTLE_BEFORE_MS = 8_000;
/** How long after the settling the characters are saved: what was handed back has landed by then. */
export const SAVE_AFTER_SETTLE_MS = 3_000;
/** A notice whose moment passed this long ago, with the server still up, is stale: the restart did not happen. */
const STALE_AFTER_MS = 2 * 60_000;
const WARN_AT_S = [60, 30, 10] as const;

let restartAt = 0;

/** Whether a restart is announced and not yet past. */
export function restartPending(now = Date.now()): boolean {
    return restartAt > 0 && now <= restartAt + STALE_AFTER_MS;
}

/** "1 minuto", "30 segundos". */
export function inWords(seconds: number): string {
    if (seconds >= 60) {
        const minutes = Math.round(seconds / 60);
        return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
    }
    return `${seconds} ${seconds === 1 ? "segundo" : "segundos"}`;
}

export function warningText(seconds: number, note = ""): string {
    const text = `O servidor vai reiniciar em ${inWords(seconds)} para uma atualização. Terminem os dados e as negociações: o que estiver em jogo volta para cada um.`;
    return note === "" ? text : `${text} ${note}`;
}

interface Settlers {
    /** Stops what is being played and undoes what is pending; says what it did, for the log. */
    readonly games: Array<() => string>;
    /** Saves what must be on disk before the stop; says how many. */
    readonly save: Array<() => string>;
}

const settlers: Settlers = { games: [], save: [] };

/** Something to stop or undo before an announced restart (a dice match, a trade). */
export function onRestartSettle(fn: () => string): void {
    settlers.games.push(fn);
}

/** Something to save a moment after the settling (the characters). */
export function onRestartSave(fn: () => string): void {
    settlers.save.push(fn);
}

function runAll(list: Array<() => string>): void {
    for (const fn of list) {
        try {
            console.log(`restart-notice: ${fn()}`);
        } catch (error: unknown) {
            console.log(`restart-notice: um preparo falhou: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

function tellEverybody(text: string): void {
    for (const player of Player.all()) {
        try {
            Chat.sendToPlayer(player, text);
            player.emit(`${RESOURCE}:notify`, JSON.stringify({ text }));
        } catch {
            // Leaving meanwhile.
        }
    }
}

/** One look at the notice file: warn, settle and save as its moment comes. Exported for the tests. */
export function look(now = Date.now()): void {
    const loaded = read<{ at?: unknown; note?: unknown }>(NOTICE_FILE);
    // A line the deploy adds to the warning (a new game version, say: "feche o jogo e abra o launcher").
    state.note = loaded.status === "ok" && loaded.value !== null && typeof loaded.value === "object" && typeof loaded.value.note === "string" ? loaded.value.note.slice(0, 300) : "";
    const at = loaded.status === "ok" && loaded.value !== null && typeof loaded.value === "object" && typeof loaded.value.at === "number" && Number.isFinite(loaded.value.at) ? loaded.value.at : 0;
    if (at !== restartAt) {
        restartAt = at;
        state.warned = new Set();
        state.settled = false;
        if (at > now) {
            console.log(`restart-notice: reinício anunciado para daqui a ${Math.round((at - now) / 1000)} s`);
        }
    }
    if (at === 0 || now > at + STALE_AFTER_MS || now >= at) {
        return;
    }
    const left = Math.ceil((at - now) / 1000);
    // Only the nearest mark crossed is said: a notice found late is not three warnings at once.
    const crossed = WARN_AT_S.filter((mark) => left <= mark && !state.warned.has(mark));
    if (crossed.length > 0) {
        crossed.forEach((mark) => state.warned.add(mark));
        tellEverybody(warningText(left, state.note));
    }
    if (!state.settled && at - now <= SETTLE_BEFORE_MS) {
        state.settled = true;
        runAll(settlers.games);
        setTimeout(() => runAll(settlers.save), SAVE_AFTER_SETTLE_MS);
    }
}

const state = { warned: new Set<number>(), settled: false, note: "" };

export function installRestartNotice(): void {
    const timer = setInterval(() => look(), LOOK_EVERY_MS);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
        }
    });
}
