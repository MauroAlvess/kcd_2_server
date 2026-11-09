/**
 * The dead horses (2026-10-31, user: "depois de um tempo, quando os cavalos morrem, deve ser retirado o cadáver do cavalo"): a horse that dies stays where it fell for good, in the road, in a
 * village, in the meadow of the wild ones -- the game has the body lie there and nothing of ours took it away (the animals' corpses go after ninety seconds, `animals.ts`; the horses' never did).
 * `CORPSE_MS` after the death the body is taken out of the world. Every horse counts, a player's or a wild one or one of the level's. A horse that was brought back to life meanwhile
 * (one whose owner was away is, `spareHorse`) is left alone; one that dies again has its time start over.
 */

/** How long a dead horse lies before it is taken away: long enough for a hunter to butcher it. */
export const corpseSettings = { afterMs: 5 * 60_000 };

const RESOURCE = "kcdc-gamemode";
const waiting = new Map<number, ReturnType<typeof setTimeout>>();

/** Takes the body of a dead horse out of the world. False when there is none to take: it is gone already, or it lives. */
export function removeCorpse(id: number): boolean {
    waiting.delete(id);
    let horse: Horse | null = null;
    try {
        horse = Horse.getById(id);
    } catch {
        return false;
    }
    if (horse === null || horse.alive) {
        return false;
    }
    try {
        horse.destroy();
    } catch {
        return false;
    }
    return true;
}

/** How many dead horses are lying, waiting to be taken away. */
export function corpsesWaiting(): number {
    return waiting.size;
}

export function installHorseCorpses(): void {
    Events.on("horseDeath", (horse) => {
        const id = horse.id;
        const earlier = waiting.get(id);
        if (earlier !== undefined) {
            clearTimeout(earlier);
        }
        waiting.set(
            id,
            setTimeout(() => {
                if (removeCorpse(id)) {
                    console.log(`horse-corpses: o cadáver de um cavalo foi retirado do mundo (${Math.round(corpseSettings.afterMs / 60_000)} min depois da morte)`);
                }
            }, corpseSettings.afterMs),
        );
    });
    // Taken away by somebody else (a kept horse's record, an administrator): nothing left to wait for, and the number may be another body's by the time the timer runs.
    Events.on("horseDestroy", (horse) => {
        const timer = waiting.get(horse.id);
        if (timer !== undefined) {
            clearTimeout(timer);
            waiting.delete(horse.id);
        }
    });
    Events.on("resourceStop", (name) => {
        if (name !== RESOURCE) {
            return;
        }
        for (const timer of waiting.values()) {
            clearTimeout(timer);
        }
        waiting.clear();
    });
}
