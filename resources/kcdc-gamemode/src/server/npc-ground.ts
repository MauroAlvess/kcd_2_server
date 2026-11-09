/**
 * What is really under a body the server made (2026-11-01, user: "alguns NPCs ativos e posicionados no mapa, os jogadores relataram que ficam no ar voando"). A body is put on the
 * level's navigation mesh (`townsfolk.ts` `placeOf`), and the mesh was baked with the game's whole world: where the players' games have less of it (a stall, a scaffold or a floor of one
 * of the game's story layers, something the World Builder took away), or where the mesh passes over the ground, the body stood on air. The game of a player near the body is asked what
 * is under its feet (the game's own ground trace, `World.raycastAll`), and a body standing more than `liftM` over it, or sunk into it, is set on it.
 *
 * Only a player's game can say what is there (the server has no world of its own), so it is a player's word; it only ever moves a body of ours a few metres up or down.
 */

export const groundSettings = {
    /** A player this near the body is asked: their game has the place, and what stands on it, loaded. */
    askM: 40,
    /** The trace starts this far over the feet (a body sunk as much is found) and reaches this far under them. */
    upM: 0.6,
    downM: 12,
    /** A body more than this over what is under it is set down; one sunk more than `sinkM` into it is lifted. */
    liftM: 0.3,
    sinkM: 0.15,
    /** A gap greater than this is not trusted (the game had not loaded the place): the body is left as it is, and the log says so. */
    mostM: 10,
    /** A trace that got no answer is asked again after this. */
    retryMs: 30_000,
};

/** One thing the trace met under the feet, nearest first. */
export interface UnderHit {
    readonly z: number;
    readonly kind: string;
    readonly category: string | null;
    readonly entityClass: string | null;
}

export type GroundVerdict =
    | { readonly kind: "right"; readonly gap: number }
    | { readonly kind: "move"; readonly gap: number; readonly z: number }
    | { readonly kind: "far"; readonly gap: number }
    | { readonly kind: "nothing" };

/** A body is no floor (the trace may meet the very body it looks under), nor is a tree's crown or a bush. */
const LIVING = /^NPC|Player|Horse/i;

/** What to do with a body whose feet are at `feetZ`, from what a trace down through them met (`gap` is how far the feet are over the floor; under it, less than zero). */
export function judgeGround(feetZ: number, hits: readonly UnderHit[], settings = groundSettings): GroundVerdict {
    const floor = hits.find((hit) => !LIVING.test(hit.entityClass ?? "") && hit.category !== "tree" && hit.category !== "bush");
    if (floor === undefined) {
        return { kind: "nothing" };
    }
    const gap = feetZ - floor.z;
    if (gap > settings.mostM) {
        return { kind: "far", gap };
    }
    if (gap > settings.liftM || gap < -settings.sinkM) {
        return { kind: "move", gap, z: floor.z };
    }
    return { kind: "right", gap };
}

/** What a player's game finds under `at`: what a trace down through it met, nearest first, or null when that game did not answer. */
export async function groundUnder(reader: Player, at: { readonly x: number; readonly y: number; readonly z: number }, settings = groundSettings): Promise<UnderHit[] | null> {
    const trace = await World.raycastAll(reader, new Vector3(at.x, at.y, at.z + settings.upM), new Vector3(at.x, at.y, at.z - settings.downM), { mode: "ground", maxHits: 4 });
    if (!trace.answered) {
        return null;
    }
    return trace.hits.map((hit) => ({ z: hit.position.z, kind: hit.kind, category: hit.category, entityClass: hit.entityClass }));
}
