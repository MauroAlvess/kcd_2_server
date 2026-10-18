/**
 * The dogs and cats of the villages (user, 2026-10-17: "ativar a presença de gatos e cachorros nas vilas que já estão
 * mapeadas ... com comportamentos e rotinas compatíveis com o ambiente").
 *
 * The game's own village dogs and cats are not here: the framework suppresses the game's default dog and mammal spawning, so
 * a village that is not given them has none. They are made again from the game's own souls (`ksuc_dog_1`, `kmal_dog_4`,
 * `kvys_dog_2`, `krat_dog_1`: every village has a pool of dogs of its own) at the places the level puts them
 * (`data/village-pets.json`, made by `tools/make-village-pets.py` from the level's `Dog` and `CatHolder` entities), and where
 * the level puts none -- Wysoka and Raborsch -- beside the houses of the census.
 *
 * A village is a mapped region of the property catalog with at least three houses of the census. It has dogs in proportion
 * to its houses (two to six). A cat is made only if the game's animal catalog (`Npc.animals()`) has one: this build's does not
 * say, so it is looked for by name at the start and the log says what was found.
 *
 * Their day: by day each wanders to a walkable spot within 18 m of where it lives, stands a while there, and goes on;
 * from 22 h to 6 h it stays within 4 m of home and moves seldom, the way a village's dog sleeps by its door. Nobody can hurt
 * them, nobody can loot them, they are not offered a prompt, and no name floats over them. One somehow brought down is back a
 * moment later.
 */

import { ensureDir, read, write } from "./store.js";
import { placeOf } from "./townsfolk.js";
import type { PropertyInfo } from "./properties.js";

declare function require(id: string): unknown;
declare const __dirname: string | undefined;

const RESOURCE = "kcdc-gamemode";

export interface Spot {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

export type Kind = "dog" | "cat";

export interface PetPlan {
    readonly id: string;
    readonly kind: Kind;
    readonly soul: string;
    readonly village: string;
    readonly home: Spot;
}

export interface LevelPet extends Spot {
    readonly name: string;
}

/** Each village's own dogs, in the game's own souls. */
export const DOG_POOLS: Readonly<Record<string, readonly string[]>> = {
    Suchdol: ["ksuc_dog_1", "ksuc_dog_2", "ksuc_dog_3", "ksuc_dog_4", "ksuc_dog_5", "ksuc_dog_6"],
    "Malešov": ["kmal_dog_1", "kmal_dog_2", "kmal_dog_3", "kmal_dog_4"],
    Wysoka: ["kvys_dog_1", "kvys_dog_2", "kvys_dog_3", "kvys_dog_4"],
    Raborsch: ["krat_dog_1", "krat_dog_2", "krat_dog_3"],
};

/** The generic dog, for a village with no pool or a pool that is used up. */
export const GENERIC_DOG = "animal_dog";

export const petSettings = {
    /** How many census houses make a village (the same as the vendors'). */
    minHouses: 3,
    minDogs: 2,
    maxDogs: 6,
    spawnAfterMs: 70_000,
    tickMs: 4_000,
    dayRoamM: 18,
    nightRoamM: 4,
    dayPauseMs: [12_000, 40_000] as readonly [number, number],
    nightPauseMs: [40_000, 120_000] as readonly [number, number],
    bedtime: 22,
    wakeup: 6,
    reviveMs: 15_000,
};

/** The villages of a catalog: the regions with enough houses of the census, by name. */
export function villagesOf(catalog: readonly PropertyInfo[]): Array<{ name: string; houses: PropertyInfo[] }> {
    const byRegion = new Map<string, PropertyInfo[]>();
    for (const property of catalog) {
        if (property.kind === "house" && property.parentId === "" && /^(Casa|Taverna|Oficina)\b/i.test(property.name)) {
            byRegion.set(property.region, [...(byRegion.get(property.region) ?? []), property]);
        }
    }
    return [...byRegion.entries()]
        .filter(([, houses]) => houses.length >= petSettings.minHouses)
        .map(([name, houses]) => ({ name, houses: houses.sort((a, b) => a.id.localeCompare(b.id)) }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt"));
}

/** How many dogs a village of this many houses has. */
export function dogsFor(houses: number): number {
    return Math.min(petSettings.maxDogs, Math.max(petSettings.minDogs, Math.round(houses / 2)));
}

/**
 * The pets a catalog calls for. `levelDogs` and `levelCats` are where the level puts them; `standAt` gives a spot beside a house
 * (`vendors.ts` `outsideDoor`); `catSoul` is the game's cat, or null when it has none.
 */
export function planPets(catalog: readonly PropertyInfo[], level: { dogs: readonly LevelPet[]; cats: readonly LevelPet[] }, standAt: (house: PropertyInfo) => Spot, catSoul: string | null): PetPlan[] {
    const plans: PetPlan[] = [];
    for (const village of villagesOf(catalog)) {
        const xs = village.houses.map((house) => house.x);
        const ys = village.houses.map((house) => house.y);
        // The village's ground: the box of its houses, a good way wider.
        const inside = (spot: Spot): boolean => spot.x >= Math.min(...xs) - 120 && spot.x <= Math.max(...xs) + 120 && spot.y >= Math.min(...ys) - 120 && spot.y <= Math.max(...ys) + 120;
        const pool = [...(DOG_POOLS[village.name] ?? [])];
        const want = dogsFor(village.houses.length);
        const dogs: PetPlan[] = [];
        // The level's own dogs first: where the game has them.
        for (const dog of level.dogs.filter(inside).slice(0, want)) {
            const own = pool.indexOf(dog.name);
            const soul = own >= 0 ? (pool.splice(own, 1)[0] as string) : (pool.shift() ?? GENERIC_DOG);
            dogs.push({ id: `dog-${village.name}-${dogs.length + 1}`, kind: "dog", soul, village: village.name, home: { x: dog.x, y: dog.y, z: dog.z } });
        }
        // The rest beside houses spread through the village.
        for (let index = 0; dogs.length < want; index += 1) {
            const house = village.houses[(index * 5 + 2) % village.houses.length] as PropertyInfo;
            dogs.push({ id: `dog-${village.name}-${dogs.length + 1}`, kind: "dog", soul: pool.shift() ?? GENERIC_DOG, village: village.name, home: standAt(house) });
        }
        plans.push(...dogs);
        if (catSoul !== null) {
            const wanted = Math.max(1, Math.floor(want / 3));
            const placed = level.cats.filter(inside);
            for (let index = 0; index < wanted; index += 1) {
                const there = placed[index];
                const house = village.houses[(index * 3 + 1) % village.houses.length] as PropertyInfo;
                plans.push({ id: `cat-${village.name}-${index + 1}`, kind: "cat", soul: catSoul, village: village.name, home: there !== undefined ? { x: there.x, y: there.y, z: there.z } : standAt(house) });
            }
        }
    }
    return plans;
}

/** The game's cat among the animals the catalog offers, by name; null when it has none. */
export function findCatSoul(animals: ReadonlyArray<{ name: string; soul: string; actorClass: string }>): string | null {
    const cat = animals.find((row) => /\bcat\b|kitten|kocka|kočka|feline/i.test(`${row.name} ${row.actorClass}`));
    return cat === undefined ? null : cat.soul;
}

interface Living {
    readonly plan: PetPlan;
    npcId: number;
    next: number;
}

export class VillagePets {
    private readonly living = new Map<string, Living>();
    private readonly byNpc = new Map<number, string>();
    private plans: PetPlan[] = [];

    constructor(
        private readonly now: () => number = () => Date.now(),
        private readonly random: () => number = () => Math.random(),
    ) {}

    /** Makes every pet of the plan. Returns how many stand. */
    spawnAll(plans: readonly PetPlan[]): number {
        this.plans = [...plans];
        for (const plan of plans) {
            this.make(plan);
        }
        return this.living.size;
    }

    private make(plan: PetPlan): boolean {
        const souls = plan.soul === GENERIC_DOG ? [GENERIC_DOG] : [plan.soul, GENERIC_DOG];
        for (const soul of souls) {
            try {
                const npc = Npc.create({
                    soul,
                    position: placeOf(plan.home),
                    rotation: new Vector3(0, 0, this.random() * 360),
                    name: "",
                    nametag: false,
                    interactable: false,
                    invulnerable: true,
                    lootable: false,
                });
                npc.setNametagHealthVisible(false);
                const entry: Living = { plan, npcId: npc.id, next: this.now() + 2_000 + this.random() * 8_000 };
                this.living.set(plan.id, entry);
                this.byNpc.set(npc.id, plan.id);
                return true;
            } catch (error: unknown) {
                console.log(`village-pets: ${plan.id}: o jogo não aceitou a alma ${soul}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        return false;
    }

    /** One step of every pet's day. */
    tick(hour: number): void {
        const now = this.now();
        const night = hour >= petSettings.bedtime || hour < petSettings.wakeup;
        for (const entry of this.living.values()) {
            const npc = Npc.getById(entry.npcId);
            if (npc === null || now < entry.next || npc.status === "running") {
                continue;
            }
            const [low, high] = night ? petSettings.nightPauseMs : petSettings.dayPauseMs;
            entry.next = now + low + this.random() * (high - low);
            if (!Navigation.ready) {
                continue;
            }
            const point = Navigation.randomPoint(placeOf(entry.plan.home), night ? petSettings.nightRoamM : petSettings.dayRoamM, { doors: "none" });
            if (point !== null) {
                npc.moveTo(point, { speed: "walk", pathfinding: "server", radius: 1.5 });
            }
        }
    }

    /** A pet that somehow fell is made again, a moment later. */
    died(npcId: number, later: (fn: () => void, ms: number) => unknown = (fn, ms) => setTimeout(fn, ms)): boolean {
        const id = this.byNpc.get(npcId);
        const entry = id === undefined ? undefined : this.living.get(id);
        if (entry === undefined) {
            return false;
        }
        this.byNpc.delete(npcId);
        this.living.delete(entry.plan.id);
        later(() => {
            Npc.getById(npcId)?.remove();
            this.make(entry.plan);
        }, petSettings.reviveMs);
        return true;
    }

    count(kind?: Kind): number {
        return [...this.living.values()].filter((entry) => kind === undefined || entry.plan.kind === kind).length;
    }

    describe(): string[] {
        return this.plans.map((plan) => {
            const entry = this.living.get(plan.id);
            return `  ${plan.id} -- ${plan.kind === "dog" ? "cão" : "gato"} ${plan.soul} (${plan.village}), em ${plan.home.x.toFixed(0)} ${plan.home.y.toFixed(0)} ${plan.home.z.toFixed(0)} -- ${entry === undefined ? "ausente" : "na vila"}`;
        });
    }

    stop(): void {
        for (const entry of this.living.values()) {
            Npc.getById(entry.npcId)?.remove();
        }
        this.living.clear();
        this.byNpc.clear();
    }
}

// ---------------------------------------------------------------------------------------------

function readLevelPets(): { dogs: LevelPet[]; cats: LevelPet[] } {
    const fs = require("node:fs") as { readFileSync(path: string, encoding: "utf8"): string };
    const places = [typeof __dirname === "string" ? `${__dirname}/../../data/village-pets.json` : "", "resources/kcdc-gamemode/data/village-pets.json", "data/village-pets.json"];
    for (const place of places) {
        if (place === "") {
            continue;
        }
        try {
            const parsed = JSON.parse(fs.readFileSync(place, "utf8")) as { dogs?: LevelPet[]; cats?: LevelPet[] };
            return { dogs: Array.isArray(parsed.dogs) ? parsed.dogs : [], cats: Array.isArray(parsed.cats) ? parsed.cats : [] };
        } catch {
            // Not here; the next place.
        }
    }
    console.log("village-pets: data/village-pets.json não foi encontrado; os cães ficam ao lado das casas");
    return { dogs: [], cats: [] };
}

const DIR = "playerdata";
const FILE = `${DIR}/village-pets.json`;

export let villagePets: VillagePets | null = null;
let enabled = true;

export function petsEnabled(): boolean {
    return enabled;
}

/** Switches the village pets on or off for good (an administrator's `/animais vila`): kept in a file, read at the next start. */
export function setPetsEnabled(on: boolean): void {
    enabled = on;
    try {
        ensureDir(DIR);
        write(FILE, { enabled: on });
    } catch (error: unknown) {
        console.log(`village-pets: não consegui salvar: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!on) {
        villagePets?.stop();
    }
}

export function installVillagePets(): VillagePets {
    const made = new VillagePets();
    villagePets = made;
    const loaded = read<{ enabled?: unknown }>(FILE);
    if (loaded.status === "ok" && typeof loaded.value.enabled === "boolean") {
        enabled = loaded.value.enabled;
    }

    const start = setTimeout(() => {
        if (!enabled) {
            console.log("village-pets: desligados");
            return;
        }
        // Imported here: properties and vendors are big modules, and only a running server needs them.
        const properties = require("./properties.js") as { listProperties(): readonly PropertyInfo[] };
        const vendors = require("./vendors.js") as { outsideDoor(property: PropertyInfo): Spot };
        let catSoul: string | null = null;
        try {
            catSoul = findCatSoul(Npc.animals());
        } catch {
            catSoul = null;
        }
        const plans = planPets(properties.listProperties(), readLevelPets(), (house) => vendors.outsideDoor(house), catSoul);
        const standing = made.spawnAll(plans);
        console.log(`village-pets: ${made.count("dog")} cão(ães) e ${made.count("cat")} gato(s) nas vilas (${standing} de ${plans.length}); ${catSoul === null ? "o catálogo de animais do jogo não tem gato, então só há cães" : `o gato é a alma ${catSoul}`}`);
    }, petSettings.spawnAfterMs);

    const timer = setInterval(() => {
        if (enabled) {
            made.tick(World.hour);
        }
    }, petSettings.tickMs);

    Events.on("npcDeath", (npc) => {
        made.died(npc.id);
    });
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearTimeout(start);
            clearInterval(timer);
            made.stop();
        }
    });
    return made;
}
