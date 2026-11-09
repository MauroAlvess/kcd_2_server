/**
 * E at a wild horse: the hooks the wild horses (`wild-horses.ts`) use to give a tamer a menu at a horse that is no one's.
 *
 * A horse a player keeps has no menu of ours any more (user, 2026-11-09: "vai ficar sem menu interativo o cavalo total ao apertar E, só monta direto nele"): E at it is the game's own
 * "Montar", and `horses.ts` refuses whoever may not ride it, with its own word. What is left here is the part of the old menu that served the wild horses: the client is told which wild
 * horse stands within reach of a Domador (`horse.near`), and its own E, heard at the same moment as the game's, asks the server for the taming menu (`horse.menu`), which `wild-horses.ts`
 * answers (`nearExtras`, `askExtras`).
 */

import { allowedTo, EDGE_M, reachTo } from "./reach.js";

const RESOURCE = "kcdc-gamemode";

export const horseMenu = {
    /**
     * How near a horse the client is told of it (for the E), and how near the player's E must be to be believed: the one reach of our E prompts to a horse's point, which is its middle
     * (`reach.ts`, 2026-10-22).
     */
    nearM: reachTo(EDGE_M.horse),
    askM: allowedTo(EDGE_M.horse),
    /** The client is told of the horse near it this often. */
    nearEveryMs: 500,
};

/**
 * Horses that have a menu of their own at a player: `wild-horses.ts` adds itself here. `near` answers, for a player, the horse (and its kind: `w` is a wild one, for the client's word on E) within
 * `reachM` of them that their E would open a menu for, or null; `ask` opens that menu for the horse the client named and says whether it did. The round's number (`round`) lets a module read
 * what it needs of its own horses once a round and not once for every player (2026-10-27, thirty players: the wild horses were read again for each Domador, eight reads a horse, twice a second);
 * `here` is where the player is, when the caller has read it. Called without them, a module reads everything afresh. An answer may say where the horse is and how far (`x`, `y`, `z`, `distance`),
 * which spares reading it again.
 */
export interface NearExtraFound {
    readonly horse: Horse;
    readonly w: boolean;
    readonly x?: number;
    readonly y?: number;
    readonly z?: number;
    readonly distance?: number;
}
export const nearExtras: Array<(player: Player, reachM: number, here?: { readonly x: number; readonly y: number; readonly z: number }, round?: number) => NearExtraFound | null> = [];
export const askExtras: Array<(player: Player, horse: Horse) => boolean | null> = [];

/** The number of the near look's round, for `nearExtras`. */
let nearRound = 0;
/** What each client was last told, so that a word is sent only when it changes. */
const told = new Map<number, string>();

const flat = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

/** The player's E, heard by their client at a horse: the menu of the module that has one for it, if any. */
export function askMenu(player: Player, horseId: unknown): boolean {
    const horse = typeof horseId === "number" ? Horse.getById(horseId) : null;
    if (horse === null || player.horse) {
        return false;
    }
    for (const ask of askExtras) {
        const answered = ask(player, horse);
        if (answered !== null) {
            return answered;
        }
    }
    return false;
}

/** Tells each client of the horse that stands within reach of its player and has a menu for them, so that its E can ask for it. */
function tellNear(): void {
    if (nearExtras.length === 0) {
        return;
    }
    nearRound += 1;
    const round = nearRound;
    for (const player of Player.all()) {
        if (!player.ready) {
            continue;
        }
        let best: Horse | null = null;
        let bestAt: { readonly x: number; readonly y: number; readonly z: number } | null = null;
        let wild = false;
        let nearest = horseMenu.nearM;
        // The player's own place is read by a module only once it knows the player may have a menu at all: most players are no tamers, and each read is a call into the engine.
        for (const extra of nearExtras) {
            const found = extra(player, nearest, undefined, round);
            if (found !== null) {
                const at = found.x !== undefined && found.y !== undefined && found.z !== undefined ? { x: found.x, y: found.y, z: found.z } : found.horse.position;
                const range = found.distance ?? flat(at, player.position);
                if (range <= nearest) {
                    nearest = range;
                    best = found.horse;
                    bestAt = at;
                    wild = found.w;
                }
            }
        }
        if (best !== null && (!player.alive || player.horse)) {
            best = null;
        }
        let text = "";
        if (best !== null && bestAt !== null) {
            const at = bestAt;
            text = JSON.stringify({ id: best.id, x: Math.round(at.x * 10) / 10, y: Math.round(at.y * 10) / 10, z: Math.round(at.z * 10) / 10, ...(wild ? { w: 1 } : {}) });
        }
        if ((told.get(player.id) ?? "") !== text) {
            told.set(player.id, text);
            player.emit(`${RESOURCE}:horse.near`, text === "" ? JSON.stringify({ id: 0 }) : text);
        }
    }
}

export function installHorseMenu(): void {
    Events.onClient(`${RESOURCE}:horse.menu`, (sender, payload) => {
        let id: unknown;
        try {
            id = ((typeof payload === "string" ? JSON.parse(payload) : payload) as { id?: unknown } | null)?.id;
        } catch {
            return;
        }
        askMenu(sender as Player, id);
    });
    Events.on("playerDisconnect", (player) => {
        told.delete(player.id);
    });
    const timer = setInterval(tellNear, horseMenu.nearEveryMs);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearInterval(timer);
        }
    });
}
