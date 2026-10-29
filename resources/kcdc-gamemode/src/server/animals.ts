/** Bounded animal populations at selected level spawnpoints. */

import { distanceBetween } from "./place.js";
import type { Point3 } from "./place.js";
import { spawnNpc } from "./npc-spawn.js";

export type AnimalSpawnpoint = ReturnType<typeof Npc.animalSpawnpoints>[number];

/**
 * perf-watch's way of timing a part of the round (`perf-watch.ts` puts `__kcdcSection` on the global object while it watches; a bare server and the tests have
 * none, and then nothing is timed). The round's time was mostly engine calls, and which of them could not be told from the outside.
 */
declare const __kcdcSection: ((label: string, took: number) => void) | undefined;
declare const performance: { now(): number } | undefined;

const timing = (): boolean => typeof __kcdcSection === "function";
/** The finest clock there is (a millisecond when there is no `performance`, which still adds up right over many calls). */
const clock = (): number => (typeof performance !== "undefined" && performance !== undefined ? performance.now() : Date.now());
const stamp = (): number => (timing() ? clock() : 0);
const mark = (label: string, began: number): void => {
    if (timing()) (__kcdcSection as (label: string, took: number) => void)(label, clock() - began);
};
/** Runs `run` and times it under `label`. */
function span<R>(label: string, run: () => R): R {
    if (!timing()) return run();
    const began = clock();
    try {
        return run();
    } finally {
        mark(label, began);
    }
}

/** A walk overdue by more than this was put off for want of anybody to see it (`tick`). */
const STALE_WALK_MS = 15_000;

/** The side of the squares the sites are filed in, to find those near a player without measuring them all: at least the distance animals are made at. */
const CELL_M = 200;
const cellOf = (x: number, y: number): number => (Math.floor(x / CELL_M) + 4096) * 8192 + (Math.floor(y / CELL_M) + 4096);

/**
 * The players of one round filed in squares as wide as the farthest the round measures a player from anything (`side`): every player within that distance of
 * a point is in the nine squares around it, so a body or a site is measured against those and not against everybody (2026-10-27, thirty players online: the
 * round measured every body against every player, some twenty thousand distances a second, and every site's checks against all thirty; the round was the
 * heaviest thing of ours, 25 ms a second). What is found is the same: a player out of the nine squares is farther than any distance the round asks about.
 */
export class PlayerGrid<C extends { readonly position: { readonly x: number; readonly y: number } }> {
    private readonly cells = new Map<number, C[]>();

    constructor(
        readonly side: number,
        all: readonly C[],
    ) {
        for (const one of all) {
            const key = this.keyOf(Math.floor(one.position.x / side), Math.floor(one.position.y / side));
            const filed = this.cells.get(key);
            if (filed === undefined) this.cells.set(key, [one]);
            else filed.push(one);
        }
    }

    private keyOf(cx: number, cy: number): number {
        return (cx + 4096) * 8192 + (cy + 4096);
    }

    /** Every player within `side` of the point (and some farther), in no particular order. */
    around(x: number, y: number): C[] {
        const found: C[] = [];
        this.some(x, y, (one) => {
            found.push(one);
            return false;
        });
        return found;
    }

    /** Whether `test` holds for a player of the nine squares around the point: every player within `side` of it is asked, none twice. */
    some(x: number, y: number, test: (one: C) => boolean): boolean {
        const cx = Math.floor(x / this.side);
        const cy = Math.floor(y / this.side);
        for (let dx = -1; dx <= 1; dx += 1) {
            for (let dy = -1; dy <= 1; dy += 1) {
                const filed = this.cells.get(this.keyOf(cx + dx, cy + dy));
                if (filed === undefined) continue;
                for (const one of filed) {
                    if (test(one)) return true;
                }
            }
        }
        return false;
    }
}

/** null enables all populated sites; use GUIDs for selected sites or [] to disable. */
export const animalSpawnpoints: string[] | null = null;

/**
 * How many animals a spawn point keeps, against the herd the level authored there (`point.count`). The user's call
 * (2026-10-16: "mais animais para caça no mapa", "encher com bem mais animais selvagens"): two and a half times the level's
 * herd of game, twice its wolves and wild dogs. The level's numbers were made for a game one man walks through; here the
 * woods are shared by a whole server and hunting is a trade. The farm animals keep the level's own numbers: their pastures
 * are at the villages, and two and a half times their herds put a hundred bodies around Suchdol and its frame rate down.
 */
export const animalDensity = {
    // 2026-10-17, "o spawn tá muito forte": game 1.6 times the level's herd (was 2.5), wolves and dogs 1.3 (was 2); and on
    // 2026-10-18 "a caça tá muito abundante, diminuir um pouco só": 1.3 and 1.1. Hares a third of
    // that again: they were 3,014 of the 8,300 places and, small and quick, the thing the players could least hit ("lebre não
    // tem como matar").
    prey: 1.3,
    predators: 1.1,
    livestock: 1,
    hare: 0.3,
};

const PREDATORS = new Set(["Wolf", "WildDog"]);

/**
 * How much a body of each kind can take (user, 2026-10-17: some of the game animals "estão imortais"). A spawned NPC has the
 * server's ledger of health, which says 100 for anything it is not told, so a hare took a hundred points of a sword and a
 * deer no more than a wolf: a man's blow did not kill what it should. Each kind has its own now, near what the game's own
 * animals have, and `npc.invulnerable` and `frozen` are put right if anything left them on.
 */
export const ANIMAL_HEALTH: Readonly<Record<string, number>> = {
    // 2026-10-18: lowered again, and the deer made to count. The log of the hits (`animals: ... levou golpe`) showed the deer on
    // the default 100 (their classes are RoeDeerHind, RoeDeerBuck, RedDeerDoe and RedDeerStag, which none of these keys matched), a
    // sword taking about 11 a blow. The body of the game goes down before a ledger that high does, and the death of the ledger
    // then found it lying: no fall, and the game's own "F" to finish it. The ledger must be spent first, with the body on its
    // feet, so it dies the way a wolf does (user: "ao morrer deviam dar animação de morte").
    Hare: 8,
    RoeDeer: 28,
    RedDeer: 40,
    Boar: 55,
    Wolf: 55,
    WildDog: 36,
    CattleCow: 90,
    CattleBull: 110,
    SheepEwe: 24,
    SheepRam: 32,
    Pig: 40,
};

/** The health of a kind the table above does not list. */
export const DEFAULT_ANIMAL_HEALTH = 60;

/**
 * The health a game animal really has: the kind's own (the table above). Since 2026-10-18 it is kept apart from the server's
 * ledger (`npc.health`), which stays full: the client draws the body from the ledger, and a body it sees low on health is laid
 * down by the game itself, standing still with "F" to finish it (user: "matei um javali ... ficou parado e apareceu F para
 * matar"), and a death that comes then is not played. Each blow is taken off this health instead, the ledger is put back to
 * full, and the last one holds the animal and kills it a moment later, from its feet.
 */
export function healthOf(actorClass: string): number {
    return ANIMAL_HEALTH[kindOf(actorClass)] ?? DEFAULT_ANIMAL_HEALTH;
}

/** What the tables here call an animal: the game's classes for the deer come as RoeDeerHind, RoeDeerBuck, RedDeerDoe and RedDeerStag. */
export function kindOf(actorClass: string): string {
    return actorClass.startsWith("RoeDeer") ? "RoeDeer" : actorClass.startsWith("RedDeer") ? "RedDeer" : actorClass;
}

/** The prey that runs from a player, and how near a player may come first (a hare lets you nearer than a deer does). */
export const FLEE_FROM_M: Readonly<Record<string, number>> = { Hare: 14, RoeDeer: 24, RedDeer: 26, Boar: 10 };
/** The farthest of those. */
const FLEE_MAX_M = Math.max(...Object.values(FLEE_FROM_M));
/** An animal still near a player is told to flee again this often (its escape runs by itself in between). */
export const FLEE_EVERY_MS = 6_000;
/** The farm animals: they stay in their pastures, while the wild kinds also get herds scattered between the level's points. */
export const LIVESTOCK = new Set(["CattleCow", "CattleBull", "SheepEwe", "SheepRam", "Pig"]);
/** The animals that run rather than walk from one spot to the next: a hare never strolls. */
const RUNNERS = new Set(["Hare"]);

/**
 * The animals one spawn point keeps: its authored herd times the density (and times `share`, for the smaller herds
 * scattered around it), at least one, at most `maxPerPoint`.
 */
export function slotsFor(point: { readonly count: number; readonly actorClass: string }, maxPerPoint: number, share = 1): number {
    const authored = Math.max(0, Math.floor(point.count));
    if (authored === 0) return 0;
    const kind = kindOf(point.actorClass);
    if (kind === "Hare") {
        return Math.min(maxPerPoint, Math.max(1, Math.round(authored * animalDensity.hare * share)));
    }
    const density = PREDATORS.has(kind) ? animalDensity.predators : LIVESTOCK.has(kind) ? animalDensity.livestock : animalDensity.prey;
    return Math.min(maxPerPoint, Math.max(1, Math.round(authored * density * share)));
}

export const animalPopulationSettings = {
    maxAnimals: 700,
    maxPerPoint: 10,
    respawnMs: 3 * 60_000,
    respawnJitterMs: 60_000,
    // The wolves and the wild dogs come back far more slowly than the game (user, 2026-10-24: "jogador reportou que spawn de cachorros selvagens: ele
    // mata eles e depois de 1 min já dá spawn de novo"): they are a danger on the roads, not a larder, so a pack that was put down stays down for
    // twenty minutes or so, and not a pack beside it filling the same ground in the next one.
    predatorRespawnMs: 20 * 60_000,
    predatorRespawnJitterMs: 10 * 60_000,
    corpseMs: 90_000,
    retryMs: 15_000,
    hiddenDistance: 60,
    // Bodies are made only where a player's own game can run them. The server gives each body to the nearest client within about
    // 120 m, each client runs a limited number and the rest are dormant (user, 2026-10-17: game animals "ficam estáticos ... e
    // imortais"): a dormant body does not move on its own orders and no blow is simulated on it. So animals are made no further
    // off than that, and no player is given more than `perPlayerBudget` of them within `simulatedRange` (was 350 m, no limit).
    activationDistance: 150,
    simulatedRange: 120,
    // What a game runs is shared by everything near the player: the bandits of a camp, the town's people and the animals. The
    // animals count the others in (user, 2026-10-17: bandits "ficaram estáticos sem se mover nem me atacar" -- dormant, for want
    // of room in the game that was to run them), and take what is left of this.
    perPlayerBudget: 24,
    othersEveryMs: 5_000,
    // The server's ledger every game animal is given, and kept at: far over any blow, so that no blow ends a life on its own and
    // the client never sees a body low on health (see `healthOf`). The death comes this long after the last blow, once the body
    // has been held where it stands.
    ledgerHealth: 1000,
    finishDelayMs: 300,
    roamRadius: 20,
    // A bigger herd needs a little more room around its point.
    spawnRadius: 12,
    aggroRadius: 18,
    leashRadius: 45,
    // A walker and a rider come into new country faster than two animals a second can fill it.
    spawnsPerTick: 4,
    // A spot to wander to is one query of the mesh; with hundreds of bodies, a dozen a second left most of them standing.
    queriesPerTick: 40,
    // Besides the herd at each of the level's wild points, this many smaller ones graze on ground of their own around it,
    // so the woods between the level's points are not bare.
    satellites: 1,
    satelliteShare: 0.6,
    satelliteRadius: 120,
};

interface AnimalSlot {
    id: number | null;
    state: "vacant" | "alive" | "corpse";
    respawnAt: number;
    corpseUntil: number;
    moveAt: number;
    target: number | null;
    /** Not before this is it told to run again. */
    fleeAt?: number;
    /** When its life was last looked over (it must not be invulnerable). */
    checkAt?: number;
    /** Where its body was when last read: what the load of each player's game is counted from, so a body nothing asks anything of is not read at all. */
    at?: Vector3;
}

interface AnimalSite {
    point: AnimalSpawnpoint;
    world: number;
    /** How far from the point's own ground this herd lives (0 for the level's own herd). */
    scatter: number;
    home: Vector3 | null;
    slots: AnimalSlot[];
}

/** The smaller herd that lives around a wild point: the same kind of animal, on ground of its own. */
export function satelliteOf(point: AnimalSpawnpoint, index: number): AnimalSpawnpoint {
    return { ...point, guid: `${point.guid}~${index}` };
}

/** Match MafiaNet visibility: the global world sees and is seen by every world. */
function worldsOverlap(a: number, b: number): boolean {
    return a === b || a === 0xFFFFFFFF || b === 0xFFFFFFFF;
}

export class AnimalPopulation {
    private readonly sites = new Map<string, AnimalSite>();
    /** The sites as the round walks them, made again only when a site is added or they are all cleared (a thousand pairs were copied every second). */
    private siteList: Array<[string, AnimalSite]> | null = null;
    /** The sites by the square their point is in (`cellOf`): the points do not move, so it is filed when a site is added. */
    private readonly cells = new Map<number, AnimalSite[]>();
    private running = true;
    private cursor = 0;
    /** The bodies that are not ours near each player, counted now and then: they take room in the same game. */
    private others = new Map<number, number>();
    private othersAt = Number.NEGATIVE_INFINITY;
    /** The bodies somebody's work holds in place (a cow being milked, `cows.ts`), by id, until when: the round sends them on no walk meanwhile. */
    private readonly held = new Map<number, number>();

    constructor(
        private readonly settings = animalPopulationSettings,
        private readonly now = () => Date.now(),
        private readonly random = () => Math.random(),
        private readonly later: (run: () => void, ms: number) => void = (run, ms) => {
            setTimeout(run, ms);
        },
    ) {}

    /** `scatter` and `share` make a smaller herd that lives that far from the point (see `satelliteOf`). */
    add(point: AnimalSpawnpoint, world: number, scatter = 0, share = 1): boolean {
        const key = `${point.guid}:${world}`;
        const count = slotsFor(point, this.settings.maxPerPoint, share);
        if (!this.running || this.sites.has(key) || count === 0) return false;
        const site: AnimalSite = {
            point, world, scatter, home: null,
            slots: Array.from({ length: count }, () => ({ id: null, state: "vacant", respawnAt: 0, corpseUntil: 0, moveAt: 0, target: null })),
        };
        this.sites.set(key, site);
        this.siteList = null;
        const cell = cellOf(point.position.x, point.position.y);
        const filed = this.cells.get(cell);
        if (filed === undefined) this.cells.set(cell, [site]);
        else filed.push(site);
        return true;
    }

    /** The sites whose point is in a square within `radius` of (x, y): a superset of those within `radius`, from the squares and not from all of them. */
    private sitesAround(x: number, y: number, radius: number): AnimalSite[] {
        const reach = Math.max(1, Math.ceil(radius / CELL_M));
        const found: AnimalSite[] = [];
        const cx = Math.floor(x / CELL_M);
        const cy = Math.floor(y / CELL_M);
        for (let dx = -reach; dx <= reach; dx += 1) {
            for (let dy = -reach; dy <= reach; dy += 1) {
                const filed = this.cells.get((cx + dx + 4096) * 8192 + (cy + dy + 4096));
                if (filed !== undefined) found.push(...filed);
            }
        }
        return found;
    }

    /** How many animals stand in the world now, and how many sites there are. */
    standing(): { bodies: number; sites: number } {
        let bodies = 0;
        for (const site of this.sites.values()) {
            bodies += site.slots.filter(slot => slot.id !== null).length;
        }
        return { bodies, sites: this.sites.size };
    }

    /** The bodies of the animals that hunt people (wolves, wild dogs) standing alive now: what a lock-on prefers over a player (`lockon-priority.ts`). */
    predatorIds(): number[] {
        const ids: number[] = [];
        for (const site of this.sites.values()) {
            if (!PREDATORS.has(kindOf(site.point.actorClass))) continue;
            for (const slot of site.slots) {
                if (slot.id !== null && slot.state === "alive") ids.push(slot.id);
            }
        }
        return ids;
    }

    /** How many animals the sites keep in all, by kind of animal. */
    census(): Map<string, number> {
        const kinds = new Map<string, number>();
        for (const site of this.sites.values()) {
            kinds.set(site.point.actorClass, (kinds.get(site.point.actorClass) ?? 0) + site.slots.length);
        }
        return kinds;
    }

    /**
     * The living animals of a kind within `radius` of a point (flat, and within three metres up or down), nearest first: the Agricultores' cows for the milking
     * (`cows.ts`, 2026-10-27). The squares round the point say which herds can be there, the place each body was last read at (`slot.at`, a few metres off at
     * most: see the round) says which could be, and only those are asked of the engine, so that a farmer among a herd costs a handful of reads.
     */
    near(kind: string, from: { readonly x: number; readonly y: number; readonly z: number }, world: number, radius: number): Array<{ id: number; x: number; y: number; z: number; distance: number }> {
        const found: Array<{ id: number; x: number; y: number; z: number; distance: number }> = [];
        for (const site of this.sitesAround(from.x, from.y, radius + this.settings.leashRadius)) {
            if (kindOf(site.point.actorClass) !== kind || !worldsOverlap(world, site.world)) continue;
            for (const slot of site.slots) {
                if (slot.id === null || slot.state !== "alive") continue;
                const was = slot.at ?? site.home ?? site.point.position;
                if (Math.hypot(was.x - from.x, was.y - from.y) > radius + 12) continue;
                const npc = Npc.getById(slot.id);
                if (!npc || !npc.alive) continue;
                const position = npc.position;
                const distance = Math.hypot(position.x - from.x, position.y - from.y);
                if (distance <= radius && Math.abs(position.z - from.z) <= 3) found.push({ id: slot.id, x: position.x, y: position.y, z: position.z, distance });
            }
        }
        return found.sort((a, b) => a.distance - b.distance);
    }

    /** How long a place stays empty after its animal was lost: the predators' is longer (`predatorRespawnMs`). */
    private delay(actorClass: string): number {
        if (PREDATORS.has(kindOf(actorClass))) {
            return (this.settings.predatorRespawnMs ?? this.settings.respawnMs) + this.random() * (this.settings.predatorRespawnJitterMs ?? this.settings.respawnJitterMs);
        }
        return this.settings.respawnMs + this.random() * this.settings.respawnJitterMs;
    }

    /**
     * Holds a living animal where it stands (2026-10-27, the milking: "quando ordenhar uma vaca ela deve ficar parada e só voltar a andar quando terminar"): its walk is
     * stopped and the round gives it no other until `release`, or until `ms` have passed whatever happens to the one who holds it. False when there is no such body.
     */
    hold(id: number, ms: number): boolean {
        const npc = Npc.getById(id);
        if (!npc || !npc.alive) return false;
        this.held.set(id, this.now() + ms);
        npc.hold();
        return true;
    }

    /** Lets a held animal go: it walks again after a moment of its own, as after any rest. */
    release(id: number): void {
        if (!this.held.delete(id)) return;
        for (const site of this.sites.values()) {
            for (const slot of site.slots) {
                if (slot.id === id) slot.moveAt = this.now() + 1_500 + this.random() * 3_000;
            }
        }
    }

    /** Only the first transition starts a cooldown; repeated events do not extend it. */
    lost(id: number, dead: boolean): void {
        if (!this.running) return;
        this.held.delete(id);
        for (const site of this.sites.values()) {
            for (const slot of site.slots) {
                if (slot.id !== id) continue;
                if (slot.state === "alive") {
                    slot.respawnAt = this.now() + this.delay(site.point.actorClass);
                    slot.corpseUntil = this.now() + this.settings.corpseMs;
                    slot.state = dead ? "corpse" : "vacant";
                    slot.target = null;
                }
                if (!dead) {
                    slot.id = null;
                    slot.state = "vacant";
                    delete slot.at;
                }
            }
        }
    }

    tick(): void {
        if (!this.running || this.sites.size === 0) return;
        const now = this.now();
        const began = stamp();
        // Read native-backed properties once per player, not once per animal.
        // In plain numbers: each `.x` of an engine's vector is a call into the engine, and the loops below measure bodies against players by the thousand (2026-10-28).
        const players = Player.all().filter(player => player.ready).map(player => {
            const at = player.position;
            return { player, position: { x: at.x, y: at.y, z: at.z }, world: player.virtualWorld, canAct: player.canAct };
        });
        const sites = this.siteList ?? (this.siteList = [...this.sites.entries()]);
        let bodies = 0;
        for (const [, site] of sites) {
            for (const slot of site.slots) if (slot.id !== null) bodies += 1;
        }
        const despawnDistance = Math.max(this.settings.activationDistance, this.settings.hiddenDistance);
        // How many animals each player's game would have to run: the bodies within reach of them.
        const load = new Map<number, number>();
        if (now - this.othersAt >= this.settings.othersEveryMs) {
            this.othersAt = now;
            this.others = span("animals.outros", () => this.countOthers(players));
        }
        // The sites a player is near (the animals are made within `activationDistance` of one), found from the squares round each player and not by
        // measuring every site against every player: of a thousand sites, a hundred or so are near anybody, and only those and the ones with bodies
        // still standing need anything done (2026-10-25: the round measured every site against every player every second, 8 ms of pure arithmetic).
        const nearSites = new Set<AnimalSite>();
        for (const candidate of players) {
            for (const site of this.sitesAround(candidate.position.x, candidate.position.y, this.settings.activationDistance)) {
                if (!nearSites.has(site) && worldsOverlap(candidate.world, site.world) && distanceBetween(candidate.position, site.point.position) < this.settings.activationDistance) nearSites.add(site);
            }
        }
        for (const [id, count] of this.others) load.set(id, count);
        // A player can have an animal of a herd to deal with only within its home's leash plus the longest reach of what a body does to a player
        // (an aggro or a flight): past that, nothing a living body does this second depends on that player.
        const attention = this.settings.leashRadius + Math.max(this.settings.aggroRadius, FLEE_MAX_M) + 5;
        // Every distance the round measures a player at is within the grid's side, so the nine squares round a point hold everybody that matters to it.
        const grid = new PlayerGrid(Math.max(CELL_M, this.settings.simulatedRange, despawnDistance, this.settings.hiddenDistance, attention, this.settings.leashRadius + this.settings.aggroRadius), players);
        // Counted from where each body was last seen (`slot.at`), not asked of the engine: every read of a body's position is a call into the engine
        // (700 bodies by 20 players were 14,000 of them a second, then 700 a second even read once, 2026-10-25, when this round was the heaviest thing
        // of ours: 47 ms of every second). A body stays within its herd's ground and its place is read again whenever something is asked of it, so
        // this is off by a few metres at most, which a budget of how many animals a game runs does not mind.
        for (const [, site] of sites) {
            for (const slot of site.slots) {
                if (slot.id === null) continue;
                const at = slot.at ?? site.home ?? site.point.position;
                grid.some(at.x, at.y, (candidate) => {
                    if (worldsOverlap(candidate.world, site.world) && distanceBetween(candidate.position, at) <= this.settings.simulatedRange) {
                        load.set(candidate.player.id, (load.get(candidate.player.id) ?? 0) + 1);
                    }
                    return false;
                });
            }
        }
        const full = (point: Vector3, world: number) => grid.some(point.x, point.y, candidate => worldsOverlap(candidate.world, world) && distanceBetween(candidate.position, point) <= this.settings.simulatedRange && (load.get(candidate.player.id) ?? 0) >= this.settings.perPlayerBudget);
        let spawns = this.settings.spawnsPerTick;
        let queries = this.settings.queriesPerTick;
        mark("animals.preparo", began);
        const sitesBegan = stamp();
        for (let i = 0; i < sites.length; ++i) {
            const [key, site] = sites[(this.cursor + i) % sites.length]!;
            const near = nearSites.has(site);
            // A site no player is near and nobody stands at has nothing to do (a vacant place of it is tried again when a player comes near).
            if (!near && !site.slots.some(slot => slot.id !== null)) continue;
            // The players of the site's world near a point: those of the nine squares round it (every one within the grid's side of it).
            const visibleNear = (point: { readonly x: number; readonly y: number }) => grid.around(point.x, point.y).filter(player => worldsOverlap(player.world, site.world));
            const unseen = (point: Vector3) => !grid.some(point.x, point.y, player => worldsOverlap(player.world, site.world) && distanceBetween(player.position, point) < this.settings.hiddenDistance);
            const canSpawn = near && unseen(site.point.position);
            const home = site.home;
            const watched = home === null || grid.some(home.x, home.y, player => worldsOverlap(player.world, site.world) && distanceBetween(player.position, home) <= attention);
            for (const slot of site.slots) {
                if (!this.running || this.sites.get(key) !== site) break;
                // Nothing is asked of a body that nothing depends on this second: a corpse before its time, or a living animal of a herd with no player
                // within reach of it and no target. Such a herd does not even walk about: nobody sees it, and a walk is a route the server plans on the
                // navigation mesh (2026-10-25, perf-watch: forty of them a second were most of this round); it starts when a player comes near. The death
                // and the removal of a body come as events (`lost`).
                if (slot.id !== null) {
                    if (slot.state === "corpse" ? now < slot.corpseUntil : slot.state === "alive" && near && !watched && slot.target === null) continue;
                }
                let npc = slot.id === null ? null : Npc.getById(slot.id);
                if (slot.id !== null && !npc) {
                    this.lost(slot.id, false);
                    bodies -= 1;
                }
                if (npc && !npc.alive && slot.state === "alive") this.lost(npc.id, true);
                const position = npc?.position;
                if (position) slot.at = position;
                if (npc && position && slot.state === "alive" && !near && !grid.some(position.x, position.y, player => worldsOverlap(player.world, site.world) && distanceBetween(player.position, position) < despawnDistance)) {
                    const distant = npc;
                    slot.id = null;
                    slot.state = "vacant";
                    slot.target = null;
                    slot.respawnAt = now;
                    delete slot.at;
                    bodies -= 1;
                    distant.remove();
                    if (!this.running || this.sites.get(key) !== site) break;
                    continue;
                }
                if (npc && slot.state === "corpse") {
                    if (now < slot.corpseUntil || !unseen(npc.position)) continue;
                    const corpse = npc;
                    // Detach first: npcDestroy fires synchronously from remove.
                    slot.id = null;
                    slot.state = "vacant";
                    delete slot.at;
                    npc = null;
                    bodies -= 1;
                    corpse.remove();
                    if (!this.running || this.sites.get(key) !== site) break;
                }
                if (!npc) {
                    if (now < slot.respawnAt || bodies >= this.settings.maxAnimals || spawns <= 0 || queries <= 0 || !Navigation.ready) continue;
                    // Keep a cooldown even when there is no mesh point or a spawn fails.
                    slot.respawnAt = now + this.settings.retryMs;
                    if (!canSpawn) continue;
                    if (!site.home) {
                        queries -= 1;
                        const anchor = span("animals.malha", () => Navigation.closestPoint(site.point.position, { searchRadius: 12, searchHeight: 20, doors: "none" }));
                        // A scattered herd settles on walkable ground of its own near the level's point, once.
                        site.home = anchor && site.scatter > 0 ? (span("animals.malha", () => Navigation.randomPoint(anchor, site.scatter, { doors: "none" })) ?? anchor) : anchor;
                    }
                    if (!site.home || queries <= 0) continue;
                    queries -= 1;
                    const home = site.home;
                    const position = span("animals.malha", () => Navigation.randomPoint(home, this.settings.spawnRadius, { doors: "none" }));
                    if (!position || !unseen(position) || full(position, site.world)) continue;
                    // Do not stack animals on the same point or a retained corpse.
                    // Only the sites near the spot can have a body within two metres of it: a body keeps to its site's ground (it is called home past
                    // `leashRadius`, and let go past `activationDistance`), so the others are not asked for their positions (every spawn used to ask
                    // for all of them).
                    const occupied = this.sitesAround(position.x, position.y, this.settings.activationDistance).some(other => worldsOverlap(other.world, site.world) && distanceBetween(other.point.position, position) <= this.settings.activationDistance && other.slots.some(entry => {
                        const body = entry.id === null ? null : Npc.getById(entry.id);
                        return body !== null && distanceBetween(body.position, position) < 2;
                    }));
                    if (occupied) continue;
                    spawns -= 1;
                    try {
                        const ledger = this.settings.ledgerHealth;
                        npc = span("animals.nascer", () => spawnNpc({ soul: site.point.soul, class: site.point.actorClass, position, virtualWorld: site.world, nametag: false, interactable: false, lootable: true, health: ledger, maxHealth: ledger }, this.random));
                        // npcSpawn can stop/clear the sample before create returns.
                        if (!this.running || this.sites.get(key) !== site) {
                            npc.remove();
                            break;
                        }
                        slot.id = npc.id;
                        slot.at = position;
                        bodies += 1;
                        for (const candidate of players) {
                            if (worldsOverlap(candidate.world, site.world) && distanceBetween(candidate.position, position) <= this.settings.simulatedRange) {
                                load.set(candidate.player.id, (load.get(candidate.player.id) ?? 0) + 1);
                            }
                        }
                        slot.state = "alive";
                        slot.moveAt = now + 3_000 + this.random() * 7_000;
                        slot.target = null;
                    } catch (error) {
                        console.log(`Animal spawn at ${site.point.guid} failed: ${String(error)}`);
                    }
                    continue;
                }
                if (!npc.alive || !site.home) continue;
                const body = npc;
                const here = position ?? npc.position;
                // Mortal, and free to move: whatever left a body invulnerable or frozen is undone, looked at every ten seconds.
                if (now >= (slot.checkAt ?? 0)) {
                    slot.checkAt = now + 10_000;
                    if (npc.invulnerable) npc.invulnerable = false;
                    if (npc.frozen) npc.frozen = false;
                }
                const predator = PREDATORS.has(kindOf(site.point.actorClass));
                const away = distanceBetween(here, site.home) > this.settings.leashRadius;
                if (predator && !away) {
                    let target: Player | null = null;
                    let nearest = this.settings.aggroRadius;
                    for (const candidate of visibleNear(here)) {
                        if (!candidate.canAct || distanceBetween(candidate.position, site.home) > this.settings.leashRadius) continue;
                        const range = distanceBetween(candidate.position, here);
                        if (candidate.player.id === slot.target && range <= this.settings.leashRadius) {
                            target = candidate.player;
                            break;
                        }
                        if (range <= nearest) {
                            nearest = range;
                            target = candidate.player;
                        }
                    }
                    if (target) {
                        const retry = (npc.status === "blocked" || npc.status === "failed") && now >= slot.moveAt;
                        if (slot.target !== target.id || retry) {
                            const aim = target;
                            if (span("animals.ordens", () => body.attack(aim))) slot.target = aim.id;
                            slot.moveAt = now + this.settings.retryMs;
                        }
                        if (slot.target === target.id) continue;
                    }
                }
                // Prey runs from a player who comes too near.
                const fleeFrom = FLEE_FROM_M[kindOf(site.point.actorClass)];
                if (fleeFrom !== undefined && !away) {
                    let threat: { player: Player; position: Point3 } | null = null;
                    let nearest = fleeFrom;
                    for (const candidate of visibleNear(here)) {
                        const range = distanceBetween(candidate.position, here);
                        if (range <= nearest) {
                            nearest = range;
                            threat = candidate;
                        }
                    }
                    if (threat !== null) {
                        if (now >= (slot.fleeAt ?? 0)) {
                            // KCDC 1.7.0: an animal told to flee from a player runs the game's own escape (its own pace and path, as far as
                            // its kind runs) and keeps it until another order replaces it, so the order is not repeated every few seconds.
                            slot.fleeAt = now + FLEE_EVERY_MS;
                            slot.moveAt = now + 5_000;
                            const fleeing = threat.player;
                            span("animals.ordens", () => body.flee(fleeing, { speed: "run", radius: 30 }));
                        }
                        continue;
                    }
                }
                if (slot.target !== null) {
                    slot.target = null;
                    span("animals.ordens", () => body.hold());
                    slot.moveAt = now;
                }
                // Held by somebody's work: it stands (the hold was ordered when it began) and goes on no walk until it is let go or the time given is up.
                const heldUntil = this.held.get(npc.id);
                if (heldUntil !== undefined) {
                    if (now < heldUntil) continue;
                    this.held.delete(npc.id);
                    slot.moveAt = now + 1_500 + this.random() * 3_000;
                }
                // A walk that fell due long ago, while nobody was near and the herd stood still, is not taken by all of them in the second a player
                // comes: they start over the next ten seconds, each at a time of its own.
                if (now - slot.moveAt > STALE_WALK_MS) slot.moveAt = now + this.random() * 10_000;
                if (now < slot.moveAt || npc.status === "running" || (!away && queries <= 0) || !Navigation.ready) continue;
                const runner = RUNNERS.has(kindOf(site.point.actorClass));
                slot.moveAt = now + (runner ? 3_000 + this.random() * 6_000 : 5_000 + this.random() * 10_000);
                if (!away) queries -= 1;
                const around = site.home;
                const point = away ? around : span("animals.malha", () => Navigation.randomPoint(around, this.settings.roamRadius, { doors: "none" }));
                if (point) span("animals.passeio", () => body.moveTo(point, { speed: runner ? "run" : "walk", pathfinding: "server", radius: 1.5 }));
            }
        }
        mark("animals.sitios", sitesBegan);
        this.cursor = sites.length > 0 ? (this.cursor + 1) % sites.length : 0;
    }

    private ours(): Set<number> {
        const ids = new Set<number>();
        for (const site of this.sites.values()) {
            for (const slot of site.slots) {
                if (slot.id !== null) ids.add(slot.id);
            }
        }
        return ids;
    }

    /** How many live bodies that are not ours (bandits, townsfolk, vendors) each player's game has within reach. */
    private countOthers(players: ReadonlyArray<{ player: Player; position: Point3; world: number }>): Map<number, number> {
        const counts = new Map<number, number>();
        if (typeof Npc.all !== "function" || players.length === 0) return counts;
        const ours = this.ours();
        for (const body of Npc.all()) {
            if (ours.has(body.id)) continue;
            const place = body.position;
            const where = { x: place.x, y: place.y, z: place.z };
            // Whether it lives is asked only of a body that is near somebody: most are not.
            let alive: boolean | null = null;
            for (const candidate of players) {
                if (distanceBetween(candidate.position, where) <= this.settings.simulatedRange) {
                    alive ??= body.alive;
                    if (!alive) break;
                    counts.set(candidate.player.id, (counts.get(candidate.player.id) ?? 0) + 1);
                }
            }
        }
        return counts;
    }

    /** Whether this body is one of the animals this module keeps. */
    owns(id: number): boolean {
        return this.ours().has(id);
    }

    private logged = 0;
    private loggedAt = 0;

    /** What each game animal that was hurt has left of its own health (`healthOf`); the ledger stays full. */
    private readonly wounds = new Map<number, number>();

    /** What a game animal that took a blow looked like, in the log (at most thirty lines a minute): who runs it, what it was doing. */
    private describe(npc: Npc, amount: number, left: number): void {
        const now = this.now();
        if (now - this.loggedAt > 60_000) {
            this.loggedAt = now;
            this.logged = 0;
        }
        if (this.logged >= 30) return;
        this.logged += 1;
        const runner = npc.simulator;
        console.log(`animals: ${npc.actorClass} ${npc.id} levou golpe de ${Math.round(amount)}: vida ${Math.max(0, Math.round(left))}/${healthOf(npc.actorClass)}${left <= 0 ? " (morre)" : ""}, ${npc.status}, ${runner === null || runner === undefined ? "PARADO (nenhum jogo o roda)" : `rodado por ${runner.nickname}`}`);
    }

    /**
     * A game animal that took a blow: the blow comes off its own health (`healthOf`) and the ledger is put back to full; the one
     * that leaves nothing holds it where it stands and kills it a moment later, so it falls with the game's own death.
     */
    wounded(npc: Npc, attacker: Player | Npc | null, amount: number): void {
        if (!this.running || !npc.alive || !this.ours().has(npc.id)) return;
        const left = (this.wounds.get(npc.id) ?? healthOf(npc.actorClass)) - Math.max(0, Number.isFinite(amount) ? amount : 0);
        this.describe(npc, amount, left);
        npc.health = npc.maxHealth;
        if (left > 0) {
            this.wounds.set(npc.id, left);
            return;
        }
        this.wounds.delete(npc.id);
        const by = attacker !== null && typeof (attacker as Player).steamId === "string" ? (attacker as Player) : undefined;
        try {
            npc.hold();
        } catch {
            // It is gone.
        }
        this.later(() => {
            if (npc.alive && this.ours().has(npc.id)) npc.kill(by);
        }, this.settings.finishDelayMs);
    }

    /** Forgets what a body that died or went had left of its health. */
    forgetWounds(id: number): void {
        this.wounds.delete(id);
    }

    clear(): void {
        const ids = [...this.sites.values()].flatMap(site => site.slots.flatMap(slot => slot.id === null ? [] : [slot.id]));
        this.sites.clear();
        this.siteList = null;
        this.cells.clear();
        for (const id of ids) Npc.getById(id)?.remove();
    }

    stop(): void {
        this.running = false;
        this.clear();
    }
}

export const animalPopulation = new AnimalPopulation();

export function installAnimalPopulation(): void {
    const catalog = new Map(Npc.animalSpawnpoints().map(point => [point.guid, point]));
    const { satellites, satelliteShare, satelliteRadius } = animalPopulationSettings;
    for (const guid of animalSpawnpoints ?? catalog.keys()) {
        const point = catalog.get(guid);
        if (point) {
            animalPopulation.add(point, 0);
            // The wild kinds also graze on ground of their own around the level's point; the farm animals stay in their pastures.
            if (!LIVESTOCK.has(kindOf(point.actorClass)) && kindOf(point.actorClass) !== "Hare") {
                for (let index = 1; index <= satellites; index += 1) animalPopulation.add(satelliteOf(point, index), 0, satelliteRadius, satelliteShare);
            }
        } else console.log(`Animal spawnpoint ${guid} is not in this level.`);
    }
    // Which animals the level offers is the only thing that decides what roams: say it, so nobody has to guess.
    const slots = animalPopulation.census();
    console.log(`animals: ${catalog.size} pontos de nascimento; vagas por espécie: ${[...slots].map(([name, count]) => `${name} ${count}`).join(", ") || "nenhuma"}; no máximo ${animalPopulationSettings.maxAnimals} animais ao mesmo tempo`);
    const timer = setInterval(() => animalPopulation.tick(), 1000);
    Events.on("npcDamage", (npc, attacker, amount) => animalPopulation.wounded(npc, attacker, amount));
    // Nothing is ordered to a corpse: `hold` "leaves it standing where it is", which is the last thing a dead body wants.
    Events.on("npcDeath", npc => {
        animalPopulation.forgetWounds(npc.id);
        animalPopulation.lost(npc.id, true);
    });
    Events.on("npcDestroy", npc => {
        animalPopulation.forgetWounds(npc.id);
        animalPopulation.lost(npc.id, false);
    });
    Events.on("resourceStop", name => {
        if (name !== "kcdc-gamemode") return;
        clearInterval(timer);
        animalPopulation.stop();
    });
}
