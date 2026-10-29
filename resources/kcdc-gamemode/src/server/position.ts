/**
 * Where a player last stood, so a returning player is put back there instead of at the level's own
 * start point (the castle), which is where every join lands when the server names no place.
 *
 * The place is kept per Steam id on disk, the same pattern as `characters.ts` and `status.ts`. It is
 * written every few seconds while the player is in the world, when they leave, and when the resource
 * stops (a server restart), so a crash costs at most the last few seconds of walking.
 *
 * Two things are never saved, because either would send the player somewhere wrong next time:
 * a pose read before the player has landed (it is still the start point, and would overwrite the
 * real place), and a pose from another virtual world (coordinates that mean something only there).
 */

declare function require(id: string): unknown;

interface NodeFs {
    readFileSync(path: string, encoding: "utf8"): string;
    writeFileSync(path: string, data: string): void;
    mkdirSync(path: string, options: { recursive: true }): void;
}

const fs = require("node:fs") as NodeFs;

const RESOURCE = "kcdc-gamemode";
const DIR = "playerdata";
const FILE = `${DIR}/positions.json`;

/** Whatever is in this world is seen from every other one; it is where players start (see virtual-worlds.md). */
const GLOBAL_WORLD = 4294967295;

const SAVE_EVERY_MS = 20_000;

/** Standing still, or shuffling, does not touch the disk. */
const MOVED_ENOUGH_METRES = 0.5;

/** Nothing in the level is farther from the origin than this, so anything beyond it is garbage. */
const FAR_LIMIT = 100_000;

/** The level's own origin is open air under the map. A pose that close to it is an unread one, not a place. */
const NEAR_ORIGIN_METRES = 1;

export interface SavedPlace {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    /** Degrees around the vertical, as `player.spawn` takes them. */
    readonly yaw: number;
    readonly savedAt: number;
}

let cache: Record<string, SavedPlace> | null = null;

function load(): Record<string, SavedPlace> {
    if (cache) {
        return cache;
    }
    try {
        cache = JSON.parse(fs.readFileSync(FILE, "utf8")) as Record<string, SavedPlace>;
    } catch {
        cache = {};
    }
    return cache;
}

function persist(store: Record<string, SavedPlace>): void {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(store, null, 2));
}

function round(value: number, decimals: number): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

/** A place the server would be willing to send somebody to. */
function sane(place: { x: number; y: number; z: number; yaw: number }): boolean {
    const values = [place.x, place.y, place.z, place.yaw];
    if (!values.every((value) => typeof value === "number" && Number.isFinite(value))) {
        return false;
    }
    if (Math.abs(place.x) > FAR_LIMIT || Math.abs(place.y) > FAR_LIMIT || Math.abs(place.z) > FAR_LIMIT) {
        return false;
    }
    return Math.hypot(place.x, place.y, place.z) >= NEAR_ORIGIN_METRES;
}

/**
 * The heading, in degrees from -180 to 180, of what `entity.rotation` reads. It reads a quaternion; a
 * lean forward or sideways is left out, so the body is put back upright, and Euler degrees (which an
 * assignment accepts) are read the way `spawn` reads them.
 */
export function yawOf(rotation: { x: number; y: number; z: number; w?: number }): number {
    let degrees: number;
    if (typeof rotation.w === "number") {
        const { w, x, y, z } = rotation as { w: number; x: number; y: number; z: number };
        degrees = (Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z)) * 180) / Math.PI;
    } else {
        degrees = rotation.z;
    }
    // Into (-180, 180]: 540 and -180 are the same heading as 180.
    degrees = ((((degrees + 180) % 360) + 360) % 360) - 180;
    return degrees === -180 ? 180 : degrees;
}

export function getSavedPlace(steamId: string): SavedPlace | null {
    if (!steamId) {
        return null;
    }
    return load()[steamId] ?? null;
}

/** Ids of the players who have landed in the world and so have a pose worth keeping. */
const landed = new Set<number>();

/**
 * Forgets the saved place for this player and stops saving them until they next land, so a player stuck
 * somewhere bad is not put straight back there by the next periodic save or by leaving.
 * Returns whether there was a saved place to forget.
 */
export function forgetPlace(player: Player): boolean {
    landed.delete(player.id);
    const store = load();
    if (!player.steamId || !store[player.steamId]) {
        return false;
    }
    delete store[player.steamId];
    persist(store);
    return true;
}

/**
 * For `playerSpawning`: puts a returning player where they last stood. False when there is no place
 * saved for them, which leaves the choice to whatever else answers `playerSpawning`.
 */
export function placeBack(player: Player): boolean {
    const place = getSavedPlace(player.steamId);
    if (!place || !sane(place)) {
        return false;
    }
    // Synchronous on purpose: the answer is sent the moment the handler returns.
    const sent = player.spawn({ x: place.x, y: place.y, z: place.z }, new Vector3(0, 0, place.yaw));
    if (sent) {
        console.log(`${player.nickname}: put back where they stood, at ${place.x}, ${place.y}, ${place.z}`);
    }
    return sent;
}

let hold: (player: Player) => boolean = () => false;

/**
 * Players whose place is not kept for now: seated at a dice table (2026-10-19: a restart put Erik and Elisabeth back on the
 * table's bench, stuck). They come back where they stood before sitting down.
 */
export function setPlaceHold(fn: (player: Player) => boolean): void {
    hold = fn;
}

/** Records where the player stands now, if that is a place worth keeping and not the one already kept. */
function remember(player: Player): boolean {
    if (!player.steamId || !player.ready || player.virtualWorld !== GLOBAL_WORLD || hold(player)) {
        return false;
    }
    const at = player.position;
    const place: SavedPlace = {
        x: round(at.x, 2),
        y: round(at.y, 2),
        z: round(at.z, 2),
        yaw: round(yawOf(player.rotation), 1),
        savedAt: Date.now(),
    };
    if (!sane(place)) {
        return false;
    }

    const store = load();
    const before = store[player.steamId];
    if (before && Math.hypot(before.x - place.x, before.y - place.y, before.z - place.z) < MOVED_ENOUGH_METRES) {
        return false;
    }
    store[player.steamId] = place;
    return true;
}

/** Saves every player who has landed, and says how many places changed. Ids are kept, not handles, and a player who has gone is dropped. */
function saveAll(): number {
    let changed = 0;
    for (const id of [...landed]) {
        const player = Player.getById(id);
        if (!player) {
            landed.delete(id);
            continue;
        }
        if (remember(player)) {
            changed += 1;
        }
    }
    if (changed > 0) {
        persist(load());
    }
    return changed;
}

export function installPosition(): void {
    // `playerSpawned` is when the body stands in the world and the ground under it has loaded. Before
    // it, the pose is still the start point, and saving that would erase the real place.
    Events.on("playerSpawned", (player) => {
        landed.add(player.id);
    });

    // The handle still reads here, and this is the last chance for a player who walked off.
    Events.on("playerDisconnect", (player) => {
        if (landed.delete(player.id) && remember(player)) {
            persist(load());
        }
    });

    const timer = setInterval(saveAll, SAVE_EVERY_MS);

    // A server restart stops the resource first, with its handlers and timers still alive. The line
    // is how the log shows that this really ran in time on a real stop.
    Events.on("resourceStop", (resourceName) => {
        if (resourceName === RESOURCE) {
            const saved = saveAll();
            console.log(`positions: stopping, saved ${saved} changed place(s) from ${landed.size} player(s) in the world`);
            clearInterval(timer);
        }
    });

    console.log(`positions: players are put back where they stood; saved every ${SAVE_EVERY_MS / 1000} s, on leaving and on stop`);
}
