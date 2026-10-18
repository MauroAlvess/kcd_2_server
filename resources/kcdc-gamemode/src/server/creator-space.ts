/**
 * Room for each character creator (user, 2026-10-17: "durante a criação de personagens, os jogadores podem aparecer uns sobre os
 * outros"). The creator is filmed over the player's own body (`creator.ts`), and everybody who joins spawns at the same
 * place, so two newcomers (or a newcomer and somebody standing at the spawn) stood in each other's picture. The game has no
 * way to hide other players from one player (a virtual world separates nobody who is in the global one, which every player
 * is), so the answer is the user's second one: a minimum distance. A creator who has somebody within `MIN_DISTANCE_M` is
 * taken to the nearest spot of walkable ground that has nobody within it, and is brought back to where they were when the
 * creator is left.
 *
 * Pure: the planning takes where everybody stands and a way to find ground, so it can be tried without a game.
 */

export interface Spot {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

/** The distance at which another body is out of the creator's picture (the camera stands 3.5 m from the player, filming a figure). */
export const MIN_DISTANCE_M = 30;

/** How far from where the creator stands a booth is looked for, ring by ring, and in how many directions on each. */
export const RINGS_M: readonly number[] = [45, 80, 120, 160, 220];
export const BEARINGS = 8;

/** A booth is no higher or lower than this above where the creator stood: not the top of a cliff, not the bottom of a gorge. */
export const MAX_RISE_M = 25;

/** Horizontal distance: a body on another floor of the same house is as much in the way. */
function apart(a: Spot, b: Spot): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Whether somebody stands within `range` of the spot. */
export function crowded(at: Spot, others: readonly Spot[], range: number = MIN_DISTANCE_M): boolean {
    return others.some((other) => apart(at, other) < range);
}

/**
 * Where a creator who is crowded should stand: the first spot, going outwards ring by ring, that `ground` finds walkable
 * ground at, within `MAX_RISE_M` of the height they stand at, and with nobody within `MIN_DISTANCE_M` of it. Null when they
 * are not crowded (they stay) or when no such spot is found (they stay too: better in the picture than in the sea).
 */
export function planBooth(origin: Spot, others: readonly Spot[], ground: (spot: Spot) => Spot | null): Spot | null {
    if (!crowded(origin, others)) {
        return null;
    }
    for (const ring of RINGS_M) {
        for (let bearing = 0; bearing < BEARINGS; bearing += 1) {
            const angle = (bearing / BEARINGS) * 2 * Math.PI;
            const found = ground({ x: origin.x + Math.cos(angle) * ring, y: origin.y + Math.sin(angle) * ring, z: origin.z });
            if (found !== null && Math.abs(found.z - origin.z) <= MAX_RISE_M && !crowded(found, others)) {
                return found;
            }
        }
    }
    return null;
}

/** Whether the creator may be taken back to where they were: nobody is within a few metres of it now. */
export function backFree(origin: Spot, others: readonly Spot[]): boolean {
    return !crowded(origin, others, 3);
}
