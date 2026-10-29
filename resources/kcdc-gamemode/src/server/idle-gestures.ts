/**
 * Small things the people of the villages do while they stand about (user, 2026-10-18: the NPCs "estão muito sem vida", "poderem
 * interagir com as coisas"): the game's own variations of a body standing at ease -- the weight shifted, a look round, a stretch
 * (`MotionIdleVAR1`, `MotionIdleVAR2`, `MotionIdleVARdefault`, authored for a man's body and a woman's). One is played now and then,
 * never the one before it twice running, never on a body nobody runs (it would play nothing).
 *
 * Until 2026-10-25 the gestures were looked for by words, and the only ones found were the chest-checking ones (`CheckStash`,
 * `ChestCheckIn`, `ChestCheckOut`, by "check"): bodies opening a chest that was not there, whose animation attaches and detaches an item
 * in the hand -- the sound of handling gear, up to fourteen times a minute round a player (user: "ao ficar parado com menu aberto ou
 * sentado fico escutando barulho de equipando item, parece até que o servidor fica conferindo item"). Those are never played (`NEVER`).
 *
 * What was found is written to the log once.
 */

/** The game's own idle variations, by fragment: the plain variant of each, a man's and a woman's alike. */
const FRAGMENTS: readonly string[] = ["MotionIdleVARdefault", "MotionIdleVAR1", "MotionIdleVAR2"];

/** Never a gesture: a chest or a stash handled, with the sound of the gear in the hand. */
const NEVER = /chest|stash/i;

export const gestures = {
    /** The same body gestures no more often than this, in milliseconds. */
    everyMs: 25_000,
    /** How short a gesture is: seconds. */
    minS: 1.5,
    maxS: 9,
    /** The chance that a pause at a place becomes a gesture. */
    chance: 0.4,
};

let pool: readonly AnimationInfo[] | undefined;
const lastAt = new Map<number, number>();
const lastPlayed = new Map<number, string>();

/** The gestures found in the catalog (searched once). */
export function gesturePool(): readonly AnimationInfo[] {
    if (pool !== undefined) {
        return pool;
    }
    const found: AnimationInfo[] = [];
    try {
        for (const fragment of FRAGMENTS) {
            const rows = Animations.list(fragment).filter(
                (row) => row.fragment.toLowerCase() === fragment.toLowerCase() && row.tags === "" && !NEVER.test(row.fragment) && row.oneShot && row.male && row.female && row.duration >= gestures.minS && row.duration <= gestures.maxS,
            );
            for (const row of rows.slice(0, 3)) {
                if (!found.some((other) => other.fragment === row.fragment && other.tags === row.tags)) {
                    found.push(row);
                }
            }
        }
    } catch (error: unknown) {
        console.log(`gestures: não consegui procurar os gestos: ${error instanceof Error ? error.message : String(error)}`);
    }
    pool = found;
    console.log(`gestures: ${found.length} gesto(s) de pausa achados no catálogo${found.length > 0 ? `: ${found.slice(0, 10).map((row) => row.fragment).join(", ")}` : ""}`);
    return pool;
}

/** Plays one gesture on a body that stands about, with some chance. True when it did (the caller leaves it a moment before its next walk). */
export function maybeGesture(npc: Npc, now: number, random: () => number = Math.random): boolean {
    if (random() >= gestures.chance || npc.status === "running" || !npc.alive) {
        return false;
    }
    if (npc.simulator === null) {
        return false;
    }
    if (now - (lastAt.get(npc.id) ?? Number.NEGATIVE_INFINITY) < gestures.everyMs) {
        return false;
    }
    const all = gesturePool();
    const before = lastPlayed.get(npc.id);
    const choices = all.length > 1 ? all.filter((row) => row.fragment !== before) : all;
    const row = choices[Math.floor(random() * choices.length)];
    if (row === undefined) {
        return false;
    }
    try {
        if (!npc.playAnimation(row.fragment, { tags: row.tags })) {
            return false;
        }
    } catch {
        return false;
    }
    lastAt.set(npc.id, now);
    lastPlayed.set(npc.id, row.fragment);
    return true;
}
