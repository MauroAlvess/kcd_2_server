/**
 * "Fiquei preso": the emergency way out of a wall, a rock or a locked house (the Opções section of the panel, and `/preso`).
 * It takes the player to the church nearest where they stand -- the one they would wake in after dying (`respawn.ts`) --
 * and it can be used once every 60 minutes (user, 2026-10-17). The time of the last use is kept by Steam id in
 * `playerdata/stuck.json`, so a restart or a new connection does not give it back; a player with no Steam id is limited
 * for as long as the server runs.
 *
 * It is refused to the dead (they wake in a church by themselves), to a body not yet in the world, and while the
 * cooldown runs, and then it says how many minutes are left, which the panel also shows (`stuck.readyIn` of the status
 * payload, in seconds).
 */

import { nearestChurch, wakePoint } from "./respawn.js";
import { addPayload, notice, sendSocial } from "./status.js";
import { ensureDir, read, write } from "./store.js";

const RESOURCE = "kcdc-gamemode";
const DIR = "playerdata";
const FILE = `${DIR}/stuck.json`;

/** How long after a use the next one is allowed. */
export const STUCK_COOLDOWN_MS = 60 * 60_000;

export interface Outcome {
    readonly ok: boolean;
    readonly message: string;
}

/** Minutes as a player reads them: "1 minuto", "43 minutos"; a started minute counts. */
export function minutesText(ms: number): string {
    const minutes = Math.max(1, Math.ceil(ms / 60_000));
    return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
}

/** The last use of each player, and what is left of the wait. */
export class StuckLog {
    private readonly last = new Map<string, number>();

    constructor(private readonly now: () => number = () => Date.now()) {}

    /** Loads what a file said: a number of milliseconds since 1970 for each key; anything else is dropped. */
    load(saved: unknown): void {
        if (typeof saved !== "object" || saved === null) {
            return;
        }
        for (const [key, at] of Object.entries(saved as Record<string, unknown>)) {
            if (typeof at === "number" && Number.isFinite(at) && at > 0) {
                this.last.set(key, at);
            }
        }
    }

    /** Milliseconds until `key` may use it again; 0 when it may now. */
    remaining(key: string): number {
        const at = this.last.get(key);
        return at === undefined ? 0 : Math.max(0, at + STUCK_COOLDOWN_MS - this.now());
    }

    mark(key: string): void {
        this.last.set(key, this.now());
    }

    /** The log as a file keeps it: the uses still in force are all that is worth keeping. */
    toJSON(): Record<string, number> {
        const kept: Record<string, number> = {};
        for (const [key, at] of this.last) {
            if (at + STUCK_COOLDOWN_MS > this.now()) {
                kept[key] = at;
            }
        }
        return kept;
    }
}

export const stuckLog = new StuckLog();

/** Who is limited: a Steam id when the player has one, else the connection they are on. */
function keyOf(player: Player): string {
    return player.steamId !== "" ? player.steamId : `id:${player.id}`;
}

/** Seconds until the player may use it, for the panel; 0 when it is free. */
export function readyIn(player: Player): number {
    return Math.ceil(stuckLog.remaining(keyOf(player)) / 1000);
}

/** False while the file could not be read: nothing is written over it then. */
let writable = true;

function save(): void {
    if (!writable) {
        return;
    }
    try {
        ensureDir(DIR);
        write(FILE, stuckLog.toJSON());
    } catch (error: unknown) {
        console.log(`stuck: não consegui gravar ${FILE}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/** Takes a player who is stuck to the nearest church, if they may. */
export function unstick(player: Player): Outcome {
    if (!player.ready) {
        return { ok: false, message: "Seu personagem ainda não entrou no mundo; tente de novo em um instante." };
    }
    if (!player.alive) {
        return { ok: false, message: "Você está morto: em instantes você acorda numa igreja, sem precisar disto." };
    }
    const key = keyOf(player);
    const wait = stuckLog.remaining(key);
    if (wait > 0) {
        return { ok: false, message: `Fiquei preso só pode ser usado uma vez a cada 60 minutos. Disponível de novo em ${minutesText(wait)}.` };
    }
    const church = nearestChurch(player.position);
    if (church === null) {
        return { ok: false, message: "Este mapa não tem igrejas para onde levar você: peça a um administrador." };
    }
    const point = wakePoint(church);
    // Out of a cart first: a body seated in one would be left behind by the move.
    for (const cart of Cart.all(player.virtualWorld)) {
        if (cart.seatOf(player) !== null) {
            cart.removePlayer(player);
        }
    }
    if (!player.teleport(new Vector3(point.x, point.y, point.z))) {
        return { ok: false, message: "Não consegui falar com o seu jogo para levar você. Tente de novo." };
    }
    stuckLog.mark(key);
    if (player.steamId !== "") {
        save();
    }
    console.log(`stuck: ${player.nickname} foi levado para a igreja de ${church.place}`);
    return { ok: true, message: `Você foi levado para a igreja de ${church.place}. Só poderá usar isto de novo daqui a 60 minutos.` };
}

export function installStuck(): void {
    const loaded = read<Record<string, unknown>>(FILE);
    if (loaded.status === "ok") {
        stuckLog.load(loaded.value);
    } else if (loaded.status === "corrupt") {
        writable = false;
        console.log(`stuck: ${FILE} está ilegível e foi deixado como está: ${loaded.reason}`);
    }
    addPayload((player) => ({ stuck: { readyIn: readyIn(player) } }));
    Events.onClient(`${RESOURCE}:status.unstick`, (sender) => {
        const player = sender as Player;
        const result = unstick(player);
        notice(player, result.message);
        sendSocial(player);
    });
}
