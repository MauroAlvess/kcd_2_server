/**
 * Keeps the people of this server where they belong (2026-10-25, user: "alguns jogadores repararam que uns NPC dormem na rua e outros bugam e caem no rio
 * e não voltam ou se trancam em casa e não saem mais"). An NPC decides nothing on its own: a body that slid into a river, walked off a bank, or came out of
 * its door in the morning on the inside of a locked house stayed there, for every order after that was planned from where it stood and came back blocked.
 *
 * Each body of the posts (`townsfolk.ts`) and the vendors (`vendors.ts`) is looked at now and then against its place:
 * - fallen: well below the ground of its place (a river bed, a ditch, under the world);
 * - astray: farther from its place than it ever walks;
 * - off the ground: off the walkable ground for two looks running (in deep water);
 * - shut in: for two looks running, no walk back to its place through doors that are not locked (inside a locked house).
 * One that is any of these is made again at its place, and the log says which and why. A body just made again is left alone a while, so a place that is
 * itself wrong cannot have it made again every few seconds. The checks are cheap and spread out: the place is looked at every `lookEveryMs`, the walk
 * back every `reachEveryMs`.
 */

export const keeperSettings = {
    /** How often a body's place is looked at. */
    lookEveryMs: 10_000,
    /** How often a body is asked whether it can still walk back to its place (a path search). */
    reachEveryMs: 30_000,
    /** A body farther than its roam and this from its place is astray. */
    strayM: 15,
    /** A body this far below its place is fallen. */
    dropM: 6,
    /** Looks in a row off the walkable ground before it is brought back. */
    offLooks: 2,
    /** Looks in a row with no walk back before it is brought back. */
    shutLooks: 2,
    /** Nearer than this to its place, a body is not asked for a walk back: it is there. */
    hereM: 3,
    /** A body just brought back is left alone this long. */
    restMs: 120_000,
};

export type StrayReason = "caiu" | "longe" | "fora do chão" | "preso";

const REASON_TEXT: Readonly<Record<StrayReason, string>> = {
    caiu: "caiu (no rio, num barranco ou para baixo do chão)",
    longe: "foi longe demais do lugar",
    "fora do chão": "estava fora do chão andável (na água funda)",
    preso: "não tinha caminho de volta (preso numa casa trancada ou num canto)",
};

export interface Point {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

/** What the keeper asks of the level's walkable ground. */
export interface Ground {
    readonly ready: boolean;
    onGround(at: Point): boolean;
    canWalk(from: Point, to: Point): boolean;
}

export const levelGround: Ground = {
    get ready(): boolean {
        return Navigation.ready;
    },
    onGround: (at) => Navigation.closestPoint(new Vector3(at.x, at.y, at.z), { searchRadius: 1.5, searchHeight: 2.5, doors: "any" }) !== null,
    canWalk: (from, to) => Navigation.canReach(new Vector3(from.x, from.y, from.z), new Vector3(to.x, to.y, to.z), { searchRadius: 2, searchHeight: 4, doors: "unlocked" }),
};

interface Watch {
    nextLook: number;
    nextReach: number;
    off: number;
    shut: number;
    restUntil: number;
    rescues: number;
}

const flat = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

export class NpcKeeper {
    private readonly watched = new Map<string, Watch>();

    constructor(
        private readonly ground: Ground = levelGround,
        private readonly settings = keeperSettings,
    ) {}

    /**
     * One look at a body: why it must be brought back, or null. `walks` is how far from its place it walks about; `homeward`, a body on its way to its door
     * at night, which is only looked at for falling and leaving the ground (its walk takes it far from its place, and may take it through its door).
     */
    look(id: string, at: Point, place: Point, walks: number, now: number, homeward = false): StrayReason | null {
        let watch = this.watched.get(id);
        if (watch === undefined) {
            // Spread out, so fifty bodies are not all looked at in the same round.
            watch = { nextLook: now + Math.random() * this.settings.lookEveryMs, nextReach: now + this.settings.reachEveryMs * (0.5 + Math.random()), off: 0, shut: 0, restUntil: 0, rescues: 0 };
            this.watched.set(id, watch);
        }
        if (now < watch.restUntil || now < watch.nextLook) {
            return null;
        }
        watch.nextLook = now + this.settings.lookEveryMs;
        if (place.z - at.z > this.settings.dropM) {
            return "caiu";
        }
        const away = flat(at, place);
        if (!homeward && away > walks + this.settings.strayM) {
            return "longe";
        }
        if (!this.ground.ready) {
            return null;
        }
        watch.off = this.ground.onGround(at) ? 0 : watch.off + 1;
        if (watch.off >= this.settings.offLooks) {
            return "fora do chão";
        }
        if (homeward || away <= this.settings.hereM || now < watch.nextReach) {
            return null;
        }
        watch.nextReach = now + this.settings.reachEveryMs;
        watch.shut = this.ground.canWalk(at, place) ? 0 : watch.shut + 1;
        return watch.shut >= this.settings.shutLooks ? "preso" : null;
    }

    /** The body was made again at its place: left alone a while, and counted. */
    rescued(id: string, now: number): number {
        const watch = this.watched.get(id) ?? { nextLook: 0, nextReach: 0, off: 0, shut: 0, restUntil: 0, rescues: 0 };
        watch.off = 0;
        watch.shut = 0;
        watch.restUntil = now + this.settings.restMs;
        watch.nextLook = watch.restUntil;
        watch.nextReach = watch.restUntil + this.settings.reachEveryMs;
        watch.rescues += 1;
        this.watched.set(id, watch);
        return watch.rescues;
    }

    forget(id: string): void {
        this.watched.delete(id);
    }
}

/** The one keeper of every post and vendor. */
export const npcKeeper = new NpcKeeper();

/** The log line of a body made again at its place: who, where, why, and how many times this start. */
export function keeperNote(label: string, name: string, at: Point, place: Point, reason: StrayReason, times: number): string {
    return `npc-keeper: ${label}: ${name} ${REASON_TEXT[reason]}, a ${Math.round(flat(at, place))} m do lugar (${Math.round(at.x)}, ${Math.round(at.y)}, ${Math.round(at.z)}): feito de novo no lugar${times > 1 ? ` (${times}a vez neste início)` : ""}`;
}
