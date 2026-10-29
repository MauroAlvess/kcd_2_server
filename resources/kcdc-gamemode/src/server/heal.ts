/**
 * An administrator's cure (`/curar`): the bleeding stopped and the injuries closed, or everything healed, now for somebody here
 * and at their next entry for somebody away (user, 2026-10-18: "o Maxxtro, retire o sangramento dele"). Waiting cures are kept in
 * `playerdata/heal-on-join.json` by Steam id, and given a few seconds after the body is in the world.
 */

import { ensureDir, read, write } from "./store.js";

const DIR = "playerdata";
const FILE = `${DIR}/heal-on-join.json`;
/** The body is in the world for this long before a waiting cure is given: the game finishes dressing it first. */
export const HEAL_AFTER_SPAWN_MS = 8_000;

export type Cure = "sangramento" | "tudo";

let waiting: Record<string, Cure> | null = null;

function load(): Record<string, Cure> {
    if (waiting === null) {
        const result = read<Record<string, Cure>>(FILE);
        waiting = result.status === "ok" && typeof result.value === "object" && result.value !== null ? { ...result.value } : {};
    }
    return waiting;
}

function persist(): void {
    ensureDir(DIR);
    write(FILE, waiting ?? {});
}

/** Cures a player who is here. False when their client could not be asked. */
export function cure(player: Player, what: Cure): boolean {
    const done = player.heal(what === "tudo" ? {} : { health: false, injuries: true, poisons: false, bleeding: true });
    if (done) {
        try {
            player.clearBuffs("bleed");
        } catch {
            // The family name is the game's; the heal above already stopped the bleeding it knows of.
        }
        console.log(`heal: ${player.nickname} curado (${what})`);
    }
    return done;
}

/** A cure kept for somebody who is away, given at their next entry. */
export function cureLater(steamId: string, what: Cure): void {
    load()[steamId] = what;
    persist();
}

export function installHeal(): void {
    Events.on("playerSpawned", (player) => {
        const what = load()[player.steamId];
        if (what === undefined) {
            return;
        }
        const id = player.id;
        const steamId = player.steamId;
        setTimeout(() => {
            const here = Player.getById(id);
            if (here === null || here.steamId !== steamId || !cure(here, what)) {
                return;
            }
            delete load()[steamId];
            persist();
            Chat.sendToPlayer(here, what === "tudo" ? "Um médico cuidou de você: as feridas foram tratadas." : "Um médico estancou o seu sangramento.");
        }, HEAL_AFTER_SPAWN_MS);
    });
}
