/**
 * Where a trade's work is done, for its animation (`craft-animation.ts`): the station the body turns to -- the nearest smithery, alchemy
 * table, fire, smokehouse or rack, the level's own or the World Builder's -- whether a fire is an open one or a cauldron's, and whether the
 * body is a woman's (some of the game's work is authored only for a man's).
 */

import { getCharacter } from "./characters.js";
import { stationPoints } from "./cooking.js";
import type { CraftStation } from "./craft-data.js";
import type { WorkSpot } from "./craft.js";
import { craftPlacesWithin } from "./craft-places.js";

/** Stations farther than this from the body are not the one it works at. */
const SPOT_M = 4;

/** A fire with a cooking pot this near is a cauldron; any other is an open fire. */
const POT_M = 3;

interface Point {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

const flat = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

function nearest(points: readonly Point[], at: Point): Point | null {
    let best: Point | null = null;
    let range = SPOT_M;
    for (const point of points) {
        const d = flat(point, at);
        if (d <= range && Math.abs(point.z - at.z) <= 3) {
            range = d;
            best = point;
        }
    }
    return best;
}

function stationsOf(kind: "alchemy" | "smithing"): Point[] {
    try {
        return Crafting.stations(kind).map((station) => station.position);
    } catch {
        return [];
    }
}

export function workSpot(player: Player, station: CraftStation): WorkSpot {
    const female = getCharacter(player.steamId)?.appearance?.gender === "female";
    const at = player.position;
    let point: Point | null = null;
    let campfire = false;
    try {
        if (station === "forja" || station === "alquimia") {
            const own = craftPlacesWithin(at, SPOT_M).filter((place) => place.kind === station);
            point = nearest([...own, ...stationsOf(station === "forja" ? "smithing" : "alchemy")], at);
        } else if (station === "fogo" || station === "defumador" || station === "secador") {
            point = nearest(stationPoints(at, SPOT_M).filter((entry) => entry[0] === station).map((entry) => ({ x: entry[1], y: entry[2], z: entry[3] })), at);
            if (station === "fogo" && point !== null) {
                const fire = point;
                campfire = !CookPot.all().some((pot) => flat(pot.position, fire) <= POT_M);
            }
        }
    } catch {
        point = null;
    }
    return { point, campfire, female };
}
