/**
 * Death is not the end of a character: a player who dies wakes up a few seconds later in the nearest church -- the one,
 * of the eight in the level, whose donation box is nearest where they fell.
 *
 * The framework has no respawn of its own: the body stays down after `playerDied` until something revives it, where it
 * fell, and a revive raises nothing. So, as the framework's guide does it, the player is revived after
 * RESPAWN_DELAY_MS and moved to the church a moment later. A revive that answers false means somebody got them up
 * already (an administrator) or they left; then nothing is moved. The network id can pass to whoever joins next, so the
 * Steam id is checked again at each step.
 *
 * The wait is a screen of its own (2026-10-31, user: "ao morrer vamos add a câmera rodando em volta do corpo devagar, um texto, alguma reza da bíblia, e embaixo um contador de 10 s até voltar
 * à vida"): the server tells the client when the body falls (`death.begin`: the verse, the reference, the line over the counter and the seconds) and when the player is up again
 * (`death.end`); the client turns the camera slowly round the body and counts the ten seconds down (`src/client/death-screen.ts`, `ui/death.html`).
 *
 * The churches are where the game's DLC 2 donation boxes stand (layer `religiousPlaces` of the level), and the player
 * wakes on the floor next to the box when the navigation mesh can say where that floor is.
 *
 * The churches also stand open (user, 2026-10-16: "as portas das igrejas são desativadas?"). In a game of one player the
 * sexton opens a church at dawn and shuts it at night, and some doors are built locked to be kept open from five to nine;
 * here nobody does it, so such a door would stay shut for good. A little after the start every door near a church whose
 * own name says it is a church's, and that the level locked, is unlocked, once. A door of a house beside the church is
 * not touched (the first try opened Grunta's), and a script's lock (a property's, held for a look or a lockpicking) is
 * left alone. The level has no door entity named for a church that the layers show, so the log lists, for each church,
 * the doors within reach and what they are: that is how the real ones are found.
 */

import { screenFor } from "./death-verses.js";
import { cure } from "./heal.js";
import { languageOf } from "./language.js";
import { onKuttenberg } from "./level.js";

const RESOURCE = "kcdc-gamemode";

/** The wait before the body is raised, and the counter of the death screen: ten seconds (2026-10-31; it was eight). */
export const RESPAWN_DELAY_MS = 10_000;
export const DEATH_BEGIN = `${RESOURCE}:death.begin`;
export const DEATH_END = `${RESOURCE}:death.end`;
const MOVE_AFTER_REVIVE_MS = 600;

/**
 * Death is told as a wound one survived (user, 2026-10-18: "quando um jogador morrer, tem que dar a descrição: você foi ferido e
 * sobreviveu, sendo arrastado para X local; procure um médico alquimista o mais rápido para curar suas feridas"), and the body
 * wakes hurt to match: its health brought down to this share of the whole, a moment after it is up.
 */
export const WOUNDED_SHARE = 0.3;
const WOUND_AFTER_SPAWN_MS = 1_500;
/** How near a church's donation box a door is looked at (a village church is some twenty metres long). */
const CHURCH_DOOR_M = 40;
/** What a church door's own name says: the prefab path it stands in. */
const CHURCH_DOOR_NAME = /church|chapel|kostel|parish|sacral|religio|monaster|abbey|cathedral/i;
const CHURCH_DOORS_AFTER_MS = 30_000;

export interface Church {
    readonly id: string;
    /** How the player is told where they wake: "na igreja de <place>". */
    readonly place: string;
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

/** The donation box of each church in the level. */
const KUTTENBERG_CHURCHES: readonly Church[] = [
    { id: "suchdol", place: "Suchdol", x: 747.97, y: 3246.3, z: 139.49 },
    { id: "wysoka", place: "Wysoka", x: 440.04, y: 2497.2, z: 218.5 },
    { id: "raborsch", place: "Raborsch", x: 1595.67, y: 3846.16, z: 112.94 },
    { id: "santa-barbara", place: "Santa Bárbara, em Kuttenberg", x: 2780.65, y: 941.61, z: 82.95 },
    { id: "arrabalde", place: "Kuttenberg, no arrabalde", x: 3072.62, y: 977.45, z: 66.02 },
    { id: "sao-tiago", place: "São Tiago, em Kuttenberg", x: 3046.69, y: 683.8, z: 52.13 },
    { id: "stara-kutna", place: "Stará Kutná", x: 3058.87, y: 1441.77, z: 105.95 },
    { id: "grunta", place: "Minas", x: 3197.21, y: 2183.47, z: 95.94 },
];

/**
 * The churches of the level: the eight of Kuttenberg's, and none on any other level (2026-11-09: the coordinates above are Kuttenberg's, and a body woken there on another map would stand in the air).
 * With none, whoever dies wakes where they fell.
 */
export const CHURCHES: readonly Church[] = onKuttenberg() ? KUTTENBERG_CHURCHES : [];

/** The church nearest a point, on the map (height left out: a church on a hill is no farther for it). Null when the level has none. */
export function nearestChurch(position: { readonly x: number; readonly y: number }): Church | null {
    let best: Church | null = null;
    for (const church of CHURCHES) {
        if (best === null || Math.hypot(church.x - position.x, church.y - position.y) < Math.hypot(best.x - position.x, best.y - position.y)) {
            best = church;
        }
    }
    return best;
}

/** Where in the church the player wakes: the walkable floor next to the donation box, or just above the box's spot. */
export function wakePoint(church: Church): { x: number; y: number; z: number } {
    if (Navigation.ready) {
        const floor = Navigation.closestPoint({ x: church.x, y: church.y, z: church.z }, { searchRadius: 4, searchHeight: 3, doors: "any" });
        if (floor !== null) {
            return { x: floor.x, y: floor.y, z: floor.z };
        }
    }
    return { x: church.x, y: church.y, z: church.z + 0.3 };
}

function tell(player: Player, text: string): void {
    Chat.sendToPlayer(player, text);
    player.emit(`${RESOURCE}:notify`, JSON.stringify({ text }));
}

/** The death screen is asked of the client, or taken off it: a word to the player's own machine, never a reason to stop the rest. */
function screen(player: Player, name: string, payload: unknown): void {
    try {
        player.emit(name, JSON.stringify(payload));
    } catch {
        // Leaving meanwhile.
    }
}

const pending = new Map<number, ReturnType<typeof setTimeout>>();

function forget(id: number): void {
    const timer = pending.get(id);
    if (timer !== undefined) {
        clearTimeout(timer);
        pending.delete(id);
    }
}

/** The same person still on this network id, or null. */
function stillThere(id: number, steamId: string): Player | null {
    const player = Player.getById(id);
    return player !== null && player.steamId === steamId ? player : null;
}

/** Where somebody wakes besides a church: their town's (`citizenship.ts`). Null for somebody who has none. */
export interface Home {
    readonly place: string;
    readonly point: { x: number; y: number; z: number };
    /** How the player is told where they wake: "Suchdol, a sua cidade". */
    readonly text: string;
}

let homeOf: (steamId: string) => Home | null = () => null;

export function setHomeResolver(resolver: (steamId: string) => Home | null): void {
    homeOf = resolver;
}

export function onDeath(player: Player): void {
    const id = player.id;
    const steamId = player.steamId;
    const church = nearestChurch(player.position);
    const home = homeOf(steamId);
    forget(id);
    tell(player, `Você caiu gravemente ferido. Em ${Math.round(RESPAWN_DELAY_MS / 1000)} segundos ${home !== null ? `você é levado para ${home.text}` : church !== null ? `você é levado para a igreja de ${church.place}` : "você se levanta onde caiu"}.`);
    screen(player, DEATH_BEGIN, screenFor(languageOf(player), Math.round(RESPAWN_DELAY_MS / 1000)));
    pending.set(
        id,
        setTimeout(() => {
            pending.delete(id);
            const target = stillThere(id, steamId);
            if (target === null || !target.revive()) {
                // Somebody got them up already (an administrator): the screen goes too.
                if (target !== null) {
                    screen(target, DEATH_END, {});
                }
                return;
            }
            const resting = homeOf(steamId);
            // No church on this level and no town: the body gets up where it fell (`revive` leaves it there).
            const point = resting !== null ? resting.point : church !== null ? wakePoint(church) : null;
            const where = home !== null ? home.text : church !== null ? `igreja de ${church.place}` : "o lugar onde caiu";
            setTimeout(() => {
                const woken = stillThere(id, steamId);
                const moved = woken !== null && (point === null || woken.spawn(point));
                // The screen goes once the body is where it wakes (or could not be taken there): the camera glides back to the eyes of whoever stands up.
                if (woken !== null) {
                    screen(woken, DEATH_END, {});
                }
                if (woken !== null && moved) {
                    tell(woken, point === null ? "Você foi ferido e sobreviveu: levantou-se onde caiu. Procure um médico alquimista o mais rápido possível para curar as suas feridas." : `Você foi ferido e sobreviveu: foi arrastado até ${home !== null ? "" : "a "}${where}. Procure um médico alquimista o mais rápido possível para curar as suas feridas.`);
                    console.log(`respawn: ${woken.nickname} acordou ${point === null ? "onde caiu" : home !== null ? "em " + where : "na " + where}`);
                    setTimeout(() => wound(id, steamId), WOUND_AFTER_SPAWN_MS);
                }
            }, MOVE_AFTER_REVIVE_MS);
        }, RESPAWN_DELAY_MS),
    );
}

/** Brings a body just woken down to `WOUNDED_SHARE` of its health, never up. */
function wound(id: number, steamId: string): void {
    const woken = stillThere(id, steamId);
    if (woken === null || typeof woken.setStat !== "function") {
        return;
    }
    // A body that died bleeding woke bleeding and died again, three times in ten minutes (Garcia, 2026-10-19 21:32): it wakes hurt,
    // not bleeding.
    try {
        cure(woken, "sangramento");
    } catch {
        // The cure is a kindness; the wound below is the rule.
    }
    const whole = Number.isFinite(woken.maxHealth) && woken.maxHealth > 0 ? woken.maxHealth : 100;
    const target = Math.round(whole * WOUNDED_SHARE);
    if (woken.health > target) {
        try {
            woken.setStat("health", target);
        } catch {
            // A body that went away meanwhile.
        }
    }
}

/** Unlocks the church doors the level locked. Returns how many it unlocked. */
export function openChurches(): number {
    const doors = Door.all();
    let opened = 0;
    for (const church of CHURCHES) {
        const near = doors.filter((door) => Math.hypot(church.x - door.position.x, church.y - door.position.y) <= CHURCH_DOOR_M && Math.abs(church.z - door.position.z) <= 10);
        const mine = near.filter((door) => door.locked && !door.lockedByServer && CHURCH_DOOR_NAME.test(door.name));
        mine.forEach((door) => {
            door.locked = false;
        });
        opened += mine.length;
        console.log(`respawn: igreja de ${church.place}: ${near.length} porta(s) a ${CHURCH_DOOR_M} m, ${mine.length} de igreja destrancada(s)${near.length > 0 ? ` (${near.slice(0, 4).map((door) => `${door.locked ? "trancada" : "aberta"} ${door.name.slice(0, 50)}`).join("; ")})` : ""}`);
    }
    return opened;
}

export function installRespawn(): void {
    const churches = setTimeout(openChurches, CHURCH_DOORS_AFTER_MS);
    Events.on("playerDied", (player) => onDeath(player));
    Events.on("playerDisconnect", (player) => forget(player.id));
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearTimeout(churches);
            for (const id of [...pending.keys()]) {
                forget(id);
            }
        }
    });
}
