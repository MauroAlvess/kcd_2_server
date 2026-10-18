/** Bounded animal populations at selected level spawnpoints. */

import { distanceBetween } from "./place.js";
import { spawnNpc } from "./npc-spawn.js";

export type AnimalSpawnpoint = ReturnType<typeof Npc.animalSpawnpoints>[number];

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
    // 2026-10-17, "o spawn tá muito forte": game 1.6 times the level's herd (was 2.5), wolves and dogs 1.3 (was 2). Hares a third of
    // that again: they were 3,014 of the 8,300 places and, small and quick, the thing the players could least hit ("lebre não
    // tem como matar").
    prey: 1.6,
    predators: 1.3,
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
    Hare: 12,
    RoeDeer: 45,
    RedDeer: 80,
    Boar: 100,
    Wolf: 70,
    WildDog: 50,
    CattleCow: 140,
    CattleBull: 170,
    SheepEwe: 45,
    SheepRam: 60,
    Pig: 80,
};

/** The prey that runs from a player, and how near a player may come first (a hare lets you nearer than a deer does). */
export const FLEE_FROM_M: Readonly<Record<string, number>> = { Hare: 9, RoeDeer: 16, RedDeer: 18 };
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
    if (point.actorClass === "Hare") {
        return Math.min(maxPerPoint, Math.max(1, Math.round(authored * animalDensity.hare * share)));
    }
    const density = PREDATORS.has(point.actorClass) ? animalDensity.predators : LIVESTOCK.has(point.actorClass) ? animalDensity.livestock : animalDensity.prey;
    return Math.min(maxPerPoint, Math.max(1, Math.round(authored * density * share)));
}

export const animalPopulationSettings = {
    maxAnimals: 700,
    maxPerPoint: 10,
    respawnMs: 3 * 60_000,
    respawnJitterMs: 60_000,
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
    // A game animal hurt past this share of its health is finished at once, with the game's own death: left standing, the body
    // stayed still and the game offered "F" to kill it (user, 2026-10-17).
    finishAt: 0.35,
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
    private running = true;
    private cursor = 0;
    /** The bodies that are not ours near each player, counted now and then: they take room in the same game. */
    private others = new Map<number, number>();
    private othersAt = Number.NEGATIVE_INFINITY;

    constructor(private readonly settings = animalPopulationSettings, private readonly now = () => Date.now(), private readonly random = () => Math.random()) {}

    /** `scatter` and `share` make a smaller herd that lives that far from the point (see `satelliteOf`). */
    add(point: AnimalSpawnpoint, world: number, scatter = 0, share = 1): boolean {
        const key = `${point.guid}:${world}`;
        const count = slotsFor(point, this.settings.maxPerPoint, share);
        if (!this.running || this.sites.has(key) || count === 0) return false;
        this.sites.set(key, {
            point, world, scatter, home: null,
            slots: Array.from({ length: count }, () => ({ id: null, state: "vacant", respawnAt: 0, corpseUntil: 0, moveAt: 0, target: null })),
        });
        return true;
    }

    /** How many animals stand in the world now, and how many sites there are. */
    standing(): { bodies: number; sites: number } {
        let bodies = 0;
        for (const site of this.sites.values()) {
            bodies += site.slots.filter(slot => slot.id !== null).length;
        }
        return { bodies, sites: this.sites.size };
    }

    /** How many animals the sites keep in all, by kind of animal. */
    census(): Map<string, number> {
        const kinds = new Map<string, number>();
        for (const site of this.sites.values()) {
            kinds.set(site.point.actorClass, (kinds.get(site.point.actorClass) ?? 0) + site.slots.length);
        }
        return kinds;
    }

    private delay(): number {
        return this.settings.respawnMs + this.random() * this.settings.respawnJitterMs;
    }

    /** Only the first transition starts a cooldown; repeated events do not extend it. */
    lost(id: number, dead: boolean): void {
        if (!this.running) return;
        for (const site of this.sites.values()) {
            for (const slot of site.slots) {
                if (slot.id !== id) continue;
                if (slot.state === "alive") {
                    slot.respawnAt = this.now() + this.delay();
                    slot.corpseUntil = this.now() + this.settings.corpseMs;
                    slot.state = dead ? "corpse" : "vacant";
                    slot.target = null;
                }
                if (!dead) {
                    slot.id = null;
                    slot.state = "vacant";
                }
            }
        }
    }

    tick(): void {
        if (!this.running || this.sites.size === 0) return;
        const now = this.now();
        // Read native-backed properties once per player, not once per animal.
        const players = Player.all().filter(player => player.ready).map(player => ({ player, position: player.position, world: player.virtualWorld, canAct: player.canAct }));
        const sites = [...this.sites.entries()];
        let bodies = sites.reduce((sum, [, site]) => sum + site.slots.reduce((count, slot) => count + Number(slot.id !== null), 0), 0);
        const despawnDistance = Math.max(this.settings.activationDistance, this.settings.hiddenDistance);
        // How many animals each player's game would have to run: the bodies within reach of them.
        const load = new Map<number, number>();
        if (now - this.othersAt >= this.settings.othersEveryMs) {
            this.othersAt = now;
            this.others = this.countOthers(players);
        }
        for (const [id, count] of this.others) load.set(id, count);
        for (const [, site] of sites) {
            for (const slot of site.slots) {
                const body = slot.id === null ? null : Npc.getById(slot.id);
                if (body === null) continue;
                for (const candidate of players) {
                    if (worldsOverlap(candidate.world, site.world) && distanceBetween(candidate.position, body.position) <= this.settings.simulatedRange) {
                        load.set(candidate.player.id, (load.get(candidate.player.id) ?? 0) + 1);
                    }
                }
            }
        }
        const full = (point: Vector3, world: number) => players.some(candidate => worldsOverlap(candidate.world, world) && distanceBetween(candidate.position, point) <= this.settings.simulatedRange && (load.get(candidate.player.id) ?? 0) >= this.settings.perPlayerBudget);
        let spawns = this.settings.spawnsPerTick;
        let queries = this.settings.queriesPerTick;
        for (let i = 0; i < sites.length; ++i) {
            const [key, site] = sites[(this.cursor + i) % sites.length]!;
            const visiblePlayers = players.filter(player => worldsOverlap(player.world, site.world));
            const unseen = (point: Vector3) => visiblePlayers.every(player => distanceBetween(player.position, point) >= this.settings.hiddenDistance);
            const near = visiblePlayers.some(player => distanceBetween(player.position, site.point.position) < this.settings.activationDistance);
            const canSpawn = near && unseen(site.point.position);
            for (const slot of site.slots) {
                if (!this.running || this.sites.get(key) !== site) break;
                let npc = slot.id === null ? null : Npc.getById(slot.id);
                if (slot.id !== null && !npc) {
                    this.lost(slot.id, false);
                    bodies -= 1;
                }
                if (npc && !npc.alive && slot.state === "alive") this.lost(npc.id, true);
                const position = npc?.position;
                if (npc && position && slot.state === "alive" && !near && visiblePlayers.every(player => distanceBetween(player.position, position) >= despawnDistance)) {
                    const distant = npc;
                    slot.id = null;
                    slot.state = "vacant";
                    slot.target = null;
                    slot.respawnAt = now;
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
                        const anchor = Navigation.closestPoint(site.point.position, { searchRadius: 12, searchHeight: 20, doors: "none" });
                        // A scattered herd settles on walkable ground of its own near the level's point, once.
                        site.home = anchor && site.scatter > 0 ? (Navigation.randomPoint(anchor, site.scatter, { doors: "none" }) ?? anchor) : anchor;
                    }
                    if (!site.home || queries <= 0) continue;
                    queries -= 1;
                    const position = Navigation.randomPoint(site.home, this.settings.spawnRadius, { doors: "none" });
                    if (!position || !unseen(position) || full(position, site.world)) continue;
                    // Do not stack animals on the same point or a retained corpse.
                    const occupied = [...this.sites.values()].some(other => worldsOverlap(other.world, site.world) && other.slots.some(entry => {
                        const body = entry.id === null ? null : Npc.getById(entry.id);
                        return body !== null && distanceBetween(body.position, position) < 2;
                    }));
                    if (occupied) continue;
                    spawns -= 1;
                    try {
                        const health = ANIMAL_HEALTH[site.point.actorClass];
                        npc = spawnNpc({ soul: site.point.soul, class: site.point.actorClass, position, virtualWorld: site.world, nametag: false, interactable: false, lootable: true, ...(health === undefined ? {} : { health, maxHealth: health }) }, this.random);
                        // npcSpawn can stop/clear the sample before create returns.
                        if (!this.running || this.sites.get(key) !== site) {
                            npc.remove();
                            break;
                        }
                        slot.id = npc.id;
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
                // Mortal, and free to move: whatever left a body invulnerable or frozen is undone, looked at every ten seconds.
                if (now >= (slot.checkAt ?? 0)) {
                    slot.checkAt = now + 10_000;
                    if (npc.invulnerable) npc.invulnerable = false;
                    if (npc.frozen) npc.frozen = false;
                }
                const predator = site.point.actorClass === "Wolf" || site.point.actorClass === "WildDog";
                const away = distanceBetween(npc.position, site.home) > this.settings.leashRadius;
                if (predator && !away) {
                    let target: Player | null = null;
                    let nearest = this.settings.aggroRadius;
                    const position = npc.position;
                    for (const candidate of visiblePlayers) {
                        if (!candidate.canAct || distanceBetween(candidate.position, site.home) > this.settings.leashRadius) continue;
                        const range = distanceBetween(candidate.position, position);
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
                            if (npc.attack(target)) slot.target = target.id;
                            slot.moveAt = now + this.settings.retryMs;
                        }
                        if (slot.target === target.id) continue;
                    }
                }
                // Prey runs from a player who comes too near.
                const fleeFrom = FLEE_FROM_M[site.point.actorClass];
                if (fleeFrom !== undefined && !away) {
                    let threat: { player: Player; position: Vector3 } | null = null;
                    let nearest = fleeFrom;
                    for (const candidate of visiblePlayers) {
                        const range = distanceBetween(candidate.position, npc.position);
                        if (range <= nearest) {
                            nearest = range;
                            threat = candidate;
                        }
                    }
                    if (threat !== null) {
                        if (now >= (slot.fleeAt ?? 0)) {
                            slot.fleeAt = now + 3_000;
                            slot.moveAt = now + 5_000;
                            npc.flee(threat.position, { speed: "run", radius: 30 });
                        }
                        continue;
                    }
                }
                if (slot.target !== null) {
                    slot.target = null;
                    npc.hold();
                    slot.moveAt = now;
                }
                if (now < slot.moveAt || npc.status === "running" || (!away && queries <= 0) || !Navigation.ready) continue;
                const runner = RUNNERS.has(site.point.actorClass);
                slot.moveAt = now + (runner ? 3_000 + this.random() * 6_000 : 5_000 + this.random() * 10_000);
                if (!away) queries -= 1;
                const point = away ? site.home : Navigation.randomPoint(site.home, this.settings.roamRadius, { doors: "none" });
                if (point) npc.moveTo(point, { speed: runner ? "run" : "walk", pathfinding: "server", radius: 1.5 });
            }
        }
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
    private countOthers(players: ReadonlyArray<{ player: Player; position: Vector3; world: number }>): Map<number, number> {
        const counts = new Map<number, number>();
        if (typeof Npc.all !== "function" || players.length === 0) return counts;
        const ours = this.ours();
        for (const body of Npc.all()) {
            if (ours.has(body.id) || !body.alive) continue;
            const where = body.position;
            for (const candidate of players) {
                if (distanceBetween(candidate.position, where) <= this.settings.simulatedRange) {
                    counts.set(candidate.player.id, (counts.get(candidate.player.id) ?? 0) + 1);
                }
            }
        }
        return counts;
    }

    /** A game animal that took a blow: one hurt past `finishAt` of its health is killed outright, so it falls with the game's own death. */
    wounded(npc: Npc, attacker: Player | Npc | null): void {
        if (!this.running || !npc.alive || npc.maxHealth <= 0 || npc.health > npc.maxHealth * this.settings.finishAt || !this.ours().has(npc.id)) return;
        const by = attacker !== null && typeof (attacker as Player).steamId === "string" ? (attacker as Player) : undefined;
        npc.kill(by);
    }

    clear(): void {
        const ids = [...this.sites.values()].flatMap(site => site.slots.flatMap(slot => slot.id === null ? [] : [slot.id]));
        this.sites.clear();
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
            if (!LIVESTOCK.has(point.actorClass) && point.actorClass !== "Hare") {
                for (let index = 1; index <= satellites; index += 1) animalPopulation.add(satelliteOf(point, index), 0, satelliteRadius, satelliteShare);
            }
        } else console.log(`Animal spawnpoint ${guid} is not in this level.`);
    }
    // Which animals the level offers is the only thing that decides what roams: say it, so nobody has to guess.
    const slots = animalPopulation.census();
    console.log(`animals: ${catalog.size} pontos de nascimento; vagas por espécie: ${[...slots].map(([name, count]) => `${name} ${count}`).join(", ") || "nenhuma"}; no máximo ${animalPopulationSettings.maxAnimals} animais ao mesmo tempo`);
    const timer = setInterval(() => animalPopulation.tick(), 1000);
    Events.on("npcDamage", (npc, attacker) => animalPopulation.wounded(npc, attacker));
    Events.on("npcDeath", npc => animalPopulation.lost(npc.id, true));
    Events.on("npcDestroy", npc => animalPopulation.lost(npc.id, false));
    Events.on("resourceStop", name => {
        if (name !== "kcdc-gamemode") return;
        clearInterval(timer);
        animalPopulation.stop();
    });
}
