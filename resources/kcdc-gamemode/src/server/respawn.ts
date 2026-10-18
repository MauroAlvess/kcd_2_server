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

const RESOURCE = "kcdc-gamemode";

export const RESPAWN_DELAY_MS = 8_000;
const MOVE_AFTER_REVIVE_MS = 600;
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
export const CHURCHES: readonly Church[] = [
    { id: "suchdol", place: "Suchdol", x: 747.97, y: 3246.3, z: 139.49 },
    { id: "wysoka", place: "Wysoka", x: 440.04, y: 2497.2, z: 218.5 },
    { id: "raborsch", place: "Raborsch", x: 1595.67, y: 3846.16, z: 112.94 },
    { id: "santa-barbara", place: "Santa Bárbara, em Kuttenberg", x: 2780.65, y: 941.61, z: 82.95 },
    { id: "arrabalde", place: "Kuttenberg, no arrabalde", x: 3072.62, y: 977.45, z: 66.02 },
    { id: "sao-tiago", place: "São Tiago, em Kuttenberg", x: 3046.69, y: 683.8, z: 52.13 },
    { id: "stara-kutna", place: "Stará Kutná", x: 3058.87, y: 1441.77, z: 105.95 },
    { id: "grunta", place: "Grunta", x: 3197.21, y: 2183.47, z: 95.94 },
];

/** The church nearest a point, on the map (height left out: a church on a hill is no farther for it). */
export function nearestChurch(position: { readonly x: number; readonly y: number }): Church {
    let best = CHURCHES[0]!;
    for (const church of CHURCHES) {
        if (Math.hypot(church.x - position.x, church.y - position.y) < Math.hypot(best.x - position.x, best.y - position.y)) {
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
    tell(player, `Você morreu. Em ${Math.round(RESPAWN_DELAY_MS / 1000)} segundos você acorda ${home !== null ? `em ${home.text}` : `na igreja de ${church.place}`}.`);
    pending.set(
        id,
        setTimeout(() => {
            pending.delete(id);
            const target = stillThere(id, steamId);
            if (target === null || !target.revive()) {
                return;
            }
            const point = (homeOf(steamId) ?? { point: wakePoint(church) }).point;
            const where = home !== null ? home.text : `igreja de ${church.place}`;
            setTimeout(() => {
                const woken = stillThere(id, steamId);
                if (woken !== null && woken.spawn(point)) {
                    tell(woken, `Você acordou ${home !== null ? "em " : "na "}${where}.`);
                    console.log(`respawn: ${woken.nickname} acordou ${home !== null ? "em " : "na "}${where}`);
                }
            }, MOVE_AFTER_REVIVE_MS);
        }, RESPAWN_DELAY_MS),
    );
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
