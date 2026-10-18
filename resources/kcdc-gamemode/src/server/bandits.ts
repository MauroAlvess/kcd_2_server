/**
 * The bandit camps of the level, peopled again: hard to beat and poor to rob.
 *
 * The camps are the level's own. `Npc.placements()` lists every human the level places, with the layer it sits in,
 * and the ones whose layer or name says bandit ("bandit", Czech "lapka", "zbojník") are grouped by distance into
 * camps: Grunta, Vrchlicko, Kopec Vysoká, Rabštejnsko, Mezholezsko and the hideouts the quests use. Each camp gets a
 * few bandits, one of them an archer where there are three or more.
 *
 * Hard: more health than an ordinary man, a heavier hand (their blows on players are multiplied in `playerHit`), they
 * see you from further off and the whole camp joins in when one of them is hit. Poor: what a bandit wears and carries
 * is plain -- rags, a club or a work axe, a few coins, a crust -- because an NPC's clothes and weapon are its loot,
 * and good gear here would make robbing bandits a better trade than the trades the guilds play. Dead bandits come back
 * after a while, when nobody is near.
 *
 * The chests at each camp are filled with what the guilds work with (iron and steel, herbs, arrows, hides, raw meat)
 * and now and then a piece of clothing, and filled again every hour while nobody is around.
 */

import { propertyOfStash } from "./properties.js";
import { ensureDir, read, write } from "./store.js";

const RESOURCE = "kcdc-gamemode";

export const banditSettings = {
    // The user's call (2026-10-16: "encher com bem mais bandidos"): the level's camps hold up to eight, and the script adds
    // hideouts of its own in the wild, away from every place where the level puts ordinary people.
    maxPerCamp: 8,
    minPerCamp: 5,
    // 2026-10-17: more hideouts along the roads (was 14), the user wanting travellers to meet bandits more often; and the same day
    // "o spawn tá muito forte" with bandits that stood still (dormant, for want of room in the game that was to run them):
    // sixteen hideouts of three to five.
    wildCamps: 16,
    wildMinPerCamp: 3,
    wildMaxPerCamp: 5,
    /** Between two hideouts of the script's. */
    wildSeparationM: 550,
    /** From the level's own camps. */
    wildFromCampsM: 450,
    /** From any place the level puts ordinary people (villages, farms, mills, guard posts). */
    wildFromPeopleM: 300,
    /** How far from its centre a hideout's bandits stand. */
    wildSpotRadius: 7,
    clusterRadius: 45,
    health: 180,
    damageMultiplier: 1.6,
    aggroRadius: 28,
    leashRadius: 60,
    homeRadius: 6,
    activationRadius: 200,
    corpseMs: 10 * 60_000,
    respawnMs: 30 * 60_000,
    respawnClearRadius: 90,
    corpseClearRadius: 50,
    alarmMs: 60_000,
    retryMs: 4_000,
    chestRadius: 35,
    chestRefillMs: 60 * 60_000,
    chestClearRadius: 60,
    spawnAfterMs: 25_000,
    tickMs: 1_000,
};

/**
 * How hard the bandits are, three presets an administrator picks (`/bandidos agressividade`, kept in `playerdata/bandits.json`):
 * how far off they see a player, how heavy their blows are on a player, how long a whole camp stays turned on one. The middle
 * one is how they were before there was a choice.
 */
export type Aggression = "baixa" | "media" | "alta";

export const AGGRESSION: Readonly<Record<Aggression, { readonly label: string; readonly aggroRadius: number; readonly damageMultiplier: number; readonly alarmMs: number; readonly about: string }>> = {
    baixa: { label: "baixa", aggroRadius: 16, damageMultiplier: 1.2, alarmMs: 30_000, about: "só reagem a quem chega perto, batem fraco e o acampamento esquece logo" },
    media: { label: "média", aggroRadius: 28, damageMultiplier: 1.6, alarmMs: 60_000, about: "veem de longe, batem forte e o acampamento todo vai atrás de quem ataca um deles" },
    alta: { label: "alta", aggroRadius: 42, damageMultiplier: 2.0, alarmMs: 120_000, about: "veem de muito longe, batem muito forte e o acampamento persegue por dois minutos" },
};

export const DEFAULT_AGGRESSION: Aggression = "media";

let aggression: Aggression = DEFAULT_AGGRESSION;
const AGGRESSION_FILE = "playerdata/bandits.json";

/** The level the bandits are at. */
export function aggressionLevel(): Aggression {
    return aggression;
}

/** Sets the bandits' hardness for good: the settings change at once, and the choice is kept for the next start. */
export function setAggression(level: Aggression): void {
    aggression = level;
    const preset = AGGRESSION[level];
    banditSettings.aggroRadius = preset.aggroRadius;
    banditSettings.damageMultiplier = preset.damageMultiplier;
    banditSettings.alarmMs = preset.alarmMs;
    try {
        ensureDir("playerdata");
        write(AGGRESSION_FILE, { aggression: level });
    } catch (error: unknown) {
        console.log(`bandits: não consegui salvar a agressividade: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function loadAggression(): void {
    const loaded = read<{ aggression?: unknown }>(AGGRESSION_FILE);
    if (loaded.status === "ok" && typeof loaded.value.aggression === "string" && loaded.value.aggression in AGGRESSION) {
        aggression = loaded.value.aggression as Aggression;
        const preset = AGGRESSION[aggression];
        banditSettings.aggroRadius = preset.aggroRadius;
        banditSettings.damageMultiplier = preset.damageMultiplier;
        banditSettings.alarmMs = preset.alarmMs;
    }
}

/** What a bandit shouts when he sees somebody to fight, when the camp is roused, and when he is struck (user, 2026-10-17: the NPCs should speak when the moment is theirs). */
export const BARKS = {
    sight: ["Ei, você! Largue o que tem!", "Aqui não é lugar de gente de bem!", "Um viajante! Peguem-no!", "Quem mandou entrar no nosso acampamento?"],
    alarm: ["Às armas! Estão nos atacando!", "Todos aqui! Rápido!", "Peguem esse desgraçado!"],
    hurt: ["Maldito!", "Você vai pagar por isso!", "Ah, seu porco!"],
};

/** How long a bandit is quiet after shouting. */
export const BARK_EVERY_MS = 20_000;

const PATTERN = /bandit|lapk|zbojn/i;
const CONTAINER = /chest|stash|sack|crate|box|barrel/i;
/** Containers that are not a camp's stores: beehives, bodies, and anything a quest or a cutscene owns. */
const NOT_STORES = /bee|hive|corpse|deadbody|cin_|quest|dlc/i;

/** Region codes of the level's layers, as people say them. */
const REGIONS: Readonly<Record<string, string>> = {
    grunta: "Grunta",
    vrchlicko: "Vrchlicko",
    kopecVysoka: "Kopec Vysoká",
    rabstejnsko: "Rabštejnsko",
    mezholezsko: "Mezholezsko",
    zikmundovo: "Zikmundovo",
    malesov: "Malešov",
    kutnaHora: "Kutná Hora",
    bohounovice: "Bohounovice",
    kuklicko: "Kuklicko",
    naBylance: "Na Bylance",
};

/**
 * Where the camps were in the level data when this was written, for a server whose catalog lists no bandits (a
 * different level build). Only used when `Npc.placements()` finds none.
 */
const FALLBACK_CAMPS: ReadonlyArray<{ name: string; x: number; y: number; z: number }> = [
    { name: "Grunta", x: 3311.4, y: 2533.7, z: 89.9 },
    { name: "Vrchlicko (moinho)", x: 1575.5, y: 224.7, z: 56.1 },
    { name: "Kopec Vysoká", x: 1065.9, y: 2443.0, z: 192.6 },
    { name: "Rabštejnsko", x: 598.1, y: 1380.1, z: 118.4 },
    { name: "Mezholezsko", x: 211.3, y: 1472.6, z: 133.2 },
];

// ---------------------------------------------------------------------------------------------
// What they wear and carry, and what the camp chests hold. Item names from the game's own tables.

const TUNICS = ["TunicLong04_m01_D", "TunicLong05_m01_E", "TunicLong04_m02_D"];
const HOSE = ["HoseSeparate01_m01_E", "HoseSeparate04_m01_E"];
const HEADS = ["Hood04_m01_E", "Cap03_m01_E", "Hood04_m03_E"];
const COATS = ["Coat03_m01_E", "Coat03_m02_E"];
const MELEE = ["axeWork01", "maceClub", "shortswordCleaver"];
const BOW = "bow_b";
const ARROWS = "arrow_crude";
const FOOD = ["bread", "apple", "carrot"];

const HERBS = ["herb_belladona", "herb_chamomile", "herb_comfrey", "herb_dandelion", "herb_eyewort", "herb_hypericum", "herb_marigold", "herb_mint", "herb_poppy", "herb_salvia", "herb_thistle", "herb_urticaria", "herb_valerian", "herb_wormwood"];
const CLOTHES = ["TunicLong01_m01_C", "TunicShort01_m01_D", "TunicLong02_m01_C", "TunicShort03_m01_D", "HoseSeparate05_m01_D", "HoseLoose01_m01_C", "Shoes01_m01_D", "Coat02_m01_D", "Cap27_m01_D", "Hood01_m01_D", "F_SimpleDress01_m01_D", "F_Hood01_m01_C"];

interface LootEntry {
    readonly items: readonly string[];
    readonly min: number;
    readonly max: number;
    readonly weight: number;
}

/** Guild work: the smith's metal, the alchemist's herbs, the hunter's arrows and hides, the cook's meat. */
export const CHEST_LOOT: readonly LootEntry[] = [
    { items: ["bsmt_ironBad"], min: 2, max: 6, weight: 12 },
    { items: ["bsmt_ironGood"], min: 1, max: 3, weight: 6 },
    { items: ["bsmt_steelBad"], min: 1, max: 3, weight: 6 },
    { items: ["bsmt_hardware"], min: 1, max: 3, weight: 6 },
    { items: ["bsmt_guardSimple", "bsmt_pommelCoin"], min: 1, max: 1, weight: 3 },
    { items: HERBS, min: 2, max: 6, weight: 14 },
    { items: ["special_charcoal"], min: 1, max: 3, weight: 5 },
    { items: ["special_cobweb"], min: 1, max: 2, weight: 3 },
    { items: ["arrow_crude", "arrow_normal"], min: 5, max: 15, weight: 10 },
    { items: ["special_deerSkin", "special_pigSkin", "special_cowSkin"], min: 1, max: 2, weight: 6 },
    { items: ["beef", "pigMeat", "lambMeat", "chicken"], min: 1, max: 2, weight: 6 },
];

// ---------------------------------------------------------------------------------------------

type Point = { x: number; y: number; z: number };

interface Spot {
    readonly position: Point;
    readonly soul: string;
}

interface Slot {
    readonly spot: Spot;
    readonly archer: boolean;
    npcId: number | null;
    state: "vacant" | "alive" | "dead";
    deathAt: number;
    target: number | null;
    retryAt: number;
    /** Not before this may he shout again. */
    barkAt?: number;
}

type Row = { item: string; amount: number; equipped?: number };
/** A row whose `item` is the class GUID, with the name it was asked for kept for the log. */
type Classed = Row & { name: string };

/** Every item name this module hands out, to be turned into class GUIDs once. */
const ITEM_NAMES: readonly string[] = [...TUNICS, ...HOSE, ...HEADS, ...COATS, ...MELEE, BOW, ARROWS, ...FOOD, "money", ...CLOTHES, ...CHEST_LOOT.flatMap((entry) => entry.items)];

/**
 * Item names to class GUIDs. `Inventory.set` and `setInventory` take only GUIDs (a name is refused as `invalidItem`,
 * or as `invalidEquipment` on a worn row), while `addItem` takes either. The worn things come from
 * `Inventory.classes()`; any other name is put in a scratch stash, and the row it makes says its GUID. A name the game
 * does not know is left out of the map.
 */
export function resolveItems(names: readonly string[]): Map<string, string> {
    const guids = new Map<string, string>();
    for (const entry of Inventory.classes()) {
        guids.set(entry.name.toLowerCase(), entry.id);
    }
    const missing = [...new Set(names)].filter((name) => !guids.has(name.toLowerCase()));
    if (missing.length === 0) {
        return guids;
    }
    const scratch = Stash.createVirtual();
    try {
        for (const name of missing) {
            if (scratch.setInventory({ items: [] }).ok && scratch.addItem({ item: name, amount: 1 }).ok) {
                const row = scratch.getInventory()?.items[0];
                if (row !== undefined) {
                    guids.set(name.toLowerCase(), row.item);
                }
            }
        }
    } finally {
        scratch.destroy();
    }
    return guids;
}

export interface Camp {
    readonly id: number;
    readonly name: string;
    readonly center: Point;
    readonly slots: Slot[];
    chests: string[];
    /** Whether the containers around the camp have been looked for. */
    scanned: boolean;
    chestsFilledAt: number;
    alarm: { targetId: number; until: number } | null;
}

export type Placement = ReturnType<typeof Npc.placements>[number];

const flat = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** A stable number out of a name (FNV-1a), so the same level always gets the same hideouts. */
export function stableHash(text: string): number {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
}

/** Points in square cells, to ask whether any lies within a radius without looking at all of them. */
class Crowd {
    private readonly cells = new Map<string, Point[]>();

    constructor(private readonly cell: number) {}

    private key(x: number, y: number): string {
        return `${Math.floor(x / this.cell)},${Math.floor(y / this.cell)}`;
    }

    add(point: Point): void {
        const key = this.key(point.x, point.y);
        const list = this.cells.get(key);
        if (list === undefined) {
            this.cells.set(key, [point]);
        } else {
            list.push(point);
        }
    }

    /** Whether any point lies closer than `radius` (at most one cell) to `at`. */
    near(at: Point, radius: number): boolean {
        const column = Math.floor(at.x / this.cell);
        const row = Math.floor(at.y / this.cell);
        for (let dx = -1; dx <= 1; dx += 1) {
            for (let dy = -1; dy <= 1; dy += 1) {
                if (this.cells.get(`${column + dx},${row + dy}`)?.some((point) => flat(point, at) < radius) === true) {
                    return true;
                }
            }
        }
        return false;
    }
}

/** A place the script may hide bandits at: a marker of the level and a name to sort it by. */
export interface WildCandidate {
    readonly guid: string;
    readonly position: Point;
}

/** What the navigation mesh says about a place; the game's own is `NAVIGATION`. */
export interface Reach {
    /** The walkable point nearest a marker, or null when there is none. */
    project(point: Point): Point | null;
    /** A walkable point at random within `radius` of a centre, or null. */
    around(centre: Point, radius: number): Point | null;
}

const NAVIGATION: Reach = {
    project(point) {
        if (!Navigation.ready) {
            return null;
        }
        const found = Navigation.closestPoint(new Vector3(point.x, point.y, point.z), { searchRadius: 12, searchHeight: 20, doors: "none" });
        return found === null ? null : { x: found.x, y: found.y, z: found.z };
    },
    around(centre, radius) {
        if (!Navigation.ready) {
            return null;
        }
        const found = Navigation.randomPoint(new Vector3(centre.x, centre.y, centre.z), radius, { doors: "none" });
        return found === null ? null : { x: found.x, y: found.y, z: found.z };
    },
};

/**
 * Where the script adds hideouts: spread across the wild, the same ones on every start. The candidates are taken in an
 * order fixed by their names, and one is kept when it can be walked to, is not near any place the level puts ordinary
 * people (`people`), is clear of the level's own camps and of the hideouts kept before it.
 */
export function chooseWildSites(
    candidates: readonly WildCandidate[],
    people: readonly Point[],
    camps: readonly Point[],
    reach: Reach,
    settings = banditSettings,
): Array<{ readonly candidate: WildCandidate; readonly centre: Point }> {
    const crowd = new Crowd(settings.wildFromPeopleM);
    people.forEach((point) => crowd.add(point));
    const ordered = [...candidates].sort((a, b) => stableHash(a.guid) - stableHash(b.guid) || (a.guid < b.guid ? -1 : 1));
    const chosen: Array<{ candidate: WildCandidate; centre: Point }> = [];
    for (const candidate of ordered) {
        if (chosen.length >= settings.wildCamps) {
            break;
        }
        const at = candidate.position;
        if (crowd.near(at, settings.wildFromPeopleM) || camps.some((camp) => flat(camp, at) < settings.wildFromCampsM) || chosen.some((other) => flat(other.centre, at) < settings.wildSeparationM)) {
            continue;
        }
        const centre = reach.project(at);
        if (centre !== null && !crowd.near(centre, settings.wildFromPeopleM)) {
            chosen.push({ candidate, centre });
        }
    }
    return chosen;
}

/** One archer for every four bandits in a camp of three or more. */
export function archersFor(count: number): number {
    return count >= 3 ? Math.max(1, Math.floor(count / 4)) : 0;
}

function regionName(layer: string): string | null {
    const match = /Main\/k[a-z]{3}_([A-Za-z]+)\//.exec(layer);
    const code = match?.[1];
    return code === undefined ? null : (REGIONS[code] ?? null);
}

export class BanditCamps {
    readonly camps: Camp[] = [];
    /** Worn items the game would not put on a bandit, with how many times. */
    readonly refusedGear = new Map<string, number>();
    /** Goods a camp chest would not take. */
    readonly refusedLoot = new Set<string>();
    /** Why bandits or chests got nothing at all, by the game's code, with how many times. */
    readonly failures = new Map<string, number>();
    /** Names the game's tables do not have. */
    readonly unknownNames = new Set<string>();
    private readonly bySlot = new Map<number, { camp: Camp; slot: Slot }>();
    private guids: Map<string, string> | null = null;
    private running = true;

    constructor(
        private readonly settings = banditSettings,
        private readonly now: () => number = () => Date.now(),
        private readonly random: () => number = () => Math.random(),
        private readonly resolve: (names: readonly string[]) => Map<string, string> = resolveItems,
    ) {}

    /** Rows by name to rows by class GUID, which is all `Inventory.set` and `setInventory` take. */
    private byClass(rows: readonly Row[]): Classed[] {
        if (this.guids === null) {
            this.guids = this.resolve(ITEM_NAMES);
        }
        const out: Classed[] = [];
        for (const row of rows) {
            const guid = this.guids.get(row.item.toLowerCase());
            if (guid === undefined) {
                this.unknownNames.add(row.item);
            } else {
                out.push({ ...row, item: guid, name: row.item });
            }
        }
        return out;
    }

    private pick<T>(list: readonly T[]): T {
        return list[Math.floor(this.random() * list.length)] ?? list[0]!;
    }

    private between(min: number, max: number): number {
        return min + Math.floor(this.random() * (max - min + 1));
    }

    /** Groups the level's bandit placements into camps. Returns how many it made. */
    discover(placements: readonly Placement[]): number {
        const picks = placements.filter((p) => (PATTERN.test(p.layer) || PATTERN.test(p.name)) && !/cinematic/i.test(p.layer));
        const clusters: Array<{ center: Point; members: Placement[] }> = [];
        for (const p of picks) {
            const position = { x: p.position.x, y: p.position.y, z: p.position.z };
            const cluster = clusters.find((c) => flat(c.center, position) < this.settings.clusterRadius);
            if (cluster === undefined) {
                clusters.push({ center: position, members: [p] });
                continue;
            }
            cluster.members.push(p);
            const n = cluster.members.length;
            cluster.center = {
                x: cluster.members.reduce((s, m) => s + m.position.x, 0) / n,
                y: cluster.members.reduce((s, m) => s + m.position.y, 0) / n,
                z: cluster.members.reduce((s, m) => s + m.position.z, 0) / n,
            };
        }

        if (clusters.length === 0) {
            for (const fallback of FALLBACK_CAMPS) {
                this.addCamp(fallback.name, fallback, [{ position: fallback, soul: "bandit" }]);
            }
            return this.camps.length;
        }

        clusters.sort((a, b) => b.members.length - a.members.length || a.center.x - b.center.x);
        const regions = clusters.map((cluster) => {
            const layer = cluster.members[0]?.layer ?? "";
            return /_quest\//.test(layer) ? null : regionName(layer);
        });
        // A region with more than one camp numbers them from west to east: "Vrchlicko 1", "Vrchlicko 2".
        const numbers = new Map<number, number>();
        for (const region of new Set(regions)) {
            const indexes = regions.flatMap((other, index) => (region !== null && other === region ? [index] : []));
            if (indexes.length > 1) {
                indexes.sort((a, b) => clusters[a]!.center.x - clusters[b]!.center.x).forEach((clusterIndex, order) => numbers.set(clusterIndex, order + 1));
            }
        }
        let hideouts = 0;
        clusters.forEach((cluster, index) => {
            const region = regions[index] ?? null;
            const number = numbers.get(index);
            let name: string;
            if (region === null) {
                hideouts += 1;
                name = `Esconderijo ${hideouts}`;
            } else {
                name = number === undefined ? region : `${region} ${number}`;
            }
            this.addCamp(name, cluster.center, cluster.members.map((m) => ({ position: { x: m.position.x, y: m.position.y, z: m.position.z }, soul: m.soul })));
        });
        return this.camps.length;
    }

    private addCamp(name: string, center: Point, spots: readonly Spot[], min = this.settings.minPerCamp, max = this.settings.maxPerCamp): void {
        const count = Math.max(min, Math.min(max, spots.length));
        const archers = archersFor(count);
        const slots: Slot[] = [];
        for (let index = 0; index < count; index += 1) {
            const base = spots[index % spots.length]!;
            // A spot used a second time is moved a little, so two bandits do not stand in one another.
            const lap = Math.floor(index / spots.length);
            const position = lap === 0 ? base.position : { x: base.position.x + 1.5 * lap, y: base.position.y + 1.5 * lap, z: base.position.z };
            slots.push({ spot: { position, soul: base.soul }, archer: index >= count - archers, npcId: null, state: "vacant", deathAt: 0, target: null, retryAt: 0 });
        }
        this.camps.push({ id: this.camps.length + 1, name, center, slots, chests: [], scanned: false, chestsFilledAt: 0, alarm: null });
    }

    /**
     * Adds hideouts in the wild, on top of the level's camps (`chooseWildSites` says where). Each is a few bandits standing
     * about a point of the walkable ground, in the souls the level's own bandits come in. `people` are the places where the
     * level puts ordinary people, which a hideout keeps away from. Returns how many hideouts were added.
     */
    addWild(candidates: readonly WildCandidate[], people: readonly Point[], reach: Reach = NAVIGATION): number {
        const chosen = chooseWildSites(candidates, people, this.camps.map((camp) => camp.center), reach, this.settings);
        const souls = this.souls();
        let hideouts = this.camps.filter((camp) => camp.name.startsWith("Esconderijo")).length;
        for (const { centre } of chosen) {
            const count = this.between(this.settings.wildMinPerCamp, this.settings.wildMaxPerCamp);
            const spots: Spot[] = [];
            for (let index = 0; index < count; index += 1) {
                // Walkable ground about the centre; failing that, a ring round it.
                const angle = (index / count) * 2 * Math.PI;
                const ring = { x: centre.x + 3 * Math.cos(angle), y: centre.y + 3 * Math.sin(angle), z: centre.z };
                spots.push({ position: reach.around(centre, this.settings.wildSpotRadius) ?? ring, soul: this.pick(souls) });
            }
            hideouts += 1;
            this.addCamp(`Esconderijo ${hideouts}`, centre, spots, this.settings.wildMinPerCamp, this.settings.wildMaxPerCamp);
        }
        return chosen.length;
    }

    /** What one bandit wears and carries: plain clothes, a cheap weapon, a few coins and a bite to eat. */
    inventoryFor(archer: boolean): Row[] {
        const items: Row[] = [
            { item: this.pick(TUNICS), amount: 1, equipped: 1 },
            { item: this.pick(HOSE), amount: 1, equipped: 1 },
            { item: this.pick(HEADS), amount: 1, equipped: 1 },
        ];
        if (this.random() < 0.4) {
            items.push({ item: this.pick(COATS), amount: 1, equipped: 1 });
        }
        if (archer) {
            const arrows = this.between(10, 20);
            items.push({ item: BOW, amount: 1, equipped: 1 }, { item: ARROWS, amount: arrows, equipped: arrows });
        } else {
            items.push({ item: this.pick(MELEE), amount: 1, equipped: 1 });
        }
        // The game shows a tenth of the item's amount: 50 to 200 reads as 5 to 20 coins.
        items.push({ item: "money", amount: this.between(50, 200) });
        items.push({ item: this.pick(FOOD), amount: 1 });
        return items;
    }

    /** Three to six different kinds of guild goods, and sometimes a piece of clothing. */
    chestLoot(): { item: string; amount: number }[] {
        const rows: { item: string; amount: number }[] = [];
        const wanted = this.between(3, 6);
        const total = CHEST_LOOT.reduce((sum, entry) => sum + entry.weight, 0);
        for (let guard = 0; rows.length < wanted && guard < 40; guard += 1) {
            let left = this.random() * total;
            let entry = CHEST_LOOT[0]!;
            for (const candidate of CHEST_LOOT) {
                left -= candidate.weight;
                if (left <= 0) {
                    entry = candidate;
                    break;
                }
            }
            const item = this.pick(entry.items);
            if (!rows.some((row) => row.item === item)) {
                rows.push({ item, amount: this.between(entry.min, entry.max) });
            }
        }
        if (this.random() < 0.4) {
            rows.push({ item: this.pick(CLOTHES), amount: 1 });
        }
        return rows;
    }

    private failed(code: string): void {
        this.failures.set(code, (this.failures.get(code) ?? 0) + 1);
    }

    /**
     * Offers rows one at a time, keeping those the game takes. Each try replaces the whole stock and a refused one
     * changes nothing, so what stays is the last lot that was taken. Returns the rows kept and the ones refused.
     */
    private oneByOne<T>(rows: readonly T[], take: (rows: T[]) => boolean): { kept: T[]; refused: T[] } {
        const kept: T[] = [];
        const refused: T[] = [];
        for (const row of rows) {
            if (take([...kept, row])) {
                kept.push(row);
            } else {
                refused.push(row);
            }
        }
        return { kept, refused };
    }

    /**
     * Dresses and stocks a new bandit. When the game refuses the lot (a garment that body cannot wear, two in one
     * place), the worn things are offered one by one and the bandit goes without the ones refused. When it takes none
     * of them the bandit is left in the clothes its soul came with rather than stripped.
     */
    private stock(npc: Npc, archer: boolean): void {
        const rows = this.byClass(this.inventoryFor(archer));
        const send = (list: readonly Classed[]): InventoryResult =>
            Inventory.set(npc, { items: list.map(({ item, amount, equipped }) => (equipped === undefined ? { item, amount } : { item, amount, equipped })), harvested: false });
        const whole = send(rows);
        if (whole.ok) {
            return;
        }
        const worn = rows.filter((row) => (row.equipped ?? 0) > 0);
        const loose = rows.filter((row) => (row.equipped ?? 0) === 0);
        const { kept, refused } = this.oneByOne(worn, (list) => send(list).ok);
        if (kept.length === 0) {
            this.failed(`roupa e arma: ${whole.code}`);
            return;
        }
        for (const row of refused) {
            this.refusedGear.set(row.name, (this.refusedGear.get(row.name) ?? 0) + 1);
        }
        const result = send([...kept, ...loose]);
        if (!result.ok) {
            this.failed(`dinheiro e comida: ${result.code}`);
        }
    }

    /** Dresses and arms a bandit made elsewhere (the road's, `ambush.ts`) as the camps' own are. */
    dress(npc: Npc, archer: boolean): void {
        this.stock(npc, archer);
    }

    /** The souls the level gives its bandits, to make more of them; the generic one when it gives none. */
    souls(): string[] {
        const found = [...new Set(this.camps.flatMap((camp) => camp.slots.map((slot) => slot.spot.soul)).filter((soul) => soul !== ""))];
        return found.length > 0 ? found : ["bandit"];
    }

    /** Fills one camp chest. Goods the game will not take are left out, and left out of later fills too. */
    private fill(stash: Stash): boolean {
        const rows = this.byClass(this.chestLoot().filter((row) => !this.refusedLoot.has(row.item)));
        if (rows.length === 0) {
            this.failed("baú: nada que o jogo conheça");
            return false;
        }
        const send = (list: readonly Classed[]): InventoryResult => stash.setInventory({ items: list.map(({ item, amount }) => ({ item, amount })) });
        const whole = send(rows);
        if (whole.ok) {
            return true;
        }
        const { kept, refused } = this.oneByOne(rows, (list) => send(list).ok);
        if (kept.length === 0) {
            this.failed(`baú: ${whole.code}`);
            return false;
        }
        refused.forEach((row) => this.refusedLoot.add(row.name));
        return true;
    }

    /** What the game refused since the start, for the log. */
    report(): string[] {
        const lines: string[] = [];
        if (this.unknownNames.size > 0) {
            lines.push(`nomes que o jogo não conhece: ${[...this.unknownNames].join(", ")}`);
        }
        if (this.refusedGear.size > 0) {
            lines.push(`o jogo não vestiu: ${[...this.refusedGear].map(([item, times]) => `${item} (${times}x)`).join(", ")}`);
        }
        if (this.refusedLoot.size > 0) {
            lines.push(`os baús não aceitaram: ${[...this.refusedLoot].join(", ")}`);
        }
        if (this.failures.size > 0) {
            lines.push(`recusado por inteiro: ${[...this.failures].map(([code, times]) => `${code} (${times}x)`).join(", ")}`);
        }
        return lines;
    }

    private snap(point: Point): Vector3 {
        const raw = new Vector3(point.x, point.y, point.z);
        if (Navigation.ready) {
            const snapped = Navigation.closestPoint(raw, { searchRadius: 6, searchHeight: 10, doors: "none" });
            if (snapped !== null) {
                return snapped;
            }
        }
        return raw;
    }

    /** Puts a bandit in a slot. True when it stands there now. */
    spawn(camp: Camp, slot: Slot): boolean {
        try {
            const npc = Npc.create({
                soul: slot.spot.soul || "bandit",
                position: this.snap(slot.spot.position),
                rotation: new Vector3(0, 0, this.random() * 360),
                name: slot.archer ? "Bandido arqueiro" : "Bandido",
                nametag: false,
                interactable: false,
                lootable: true,
                health: this.settings.health,
                maxHealth: this.settings.health,
            });
            this.stock(npc, slot.archer);
            slot.npcId = npc.id;
            slot.state = "alive";
            slot.target = null;
            slot.retryAt = 0;
            this.bySlot.set(npc.id, { camp, slot });
            return true;
        } catch (error: unknown) {
            console.log(`bandits: ${camp.name}: não consegui criar um bandido: ${error instanceof Error ? error.message : String(error)}`);
            slot.state = "dead";
            slot.deathAt = this.now();
            return false;
        }
    }

    spawnAll(): number {
        let spawned = 0;
        for (const camp of this.camps) {
            for (const slot of camp.slots) {
                if (slot.state === "vacant" && this.spawn(camp, slot)) {
                    spawned += 1;
                }
            }
        }
        return spawned;
    }

    /** Finds each camp's containers once, then fills them. Returns how many containers were filled. */
    stockChests(force = false): number {
        let filled = 0;
        const stashes = this.camps.some((camp) => !camp.scanned) ? Stash.all() : [];
        for (const camp of this.camps) {
            if (!camp.scanned) {
                camp.scanned = true;
                camp.chests = stashes
                    .filter((stash) => stash.levelGuid !== "" && CONTAINER.test(stash.name) && !NOT_STORES.test(stash.name) && flat(stash.position, camp.center) <= this.settings.chestRadius && propertyOfStash(stash.levelGuid) === null)
                    .map((stash) => stash.levelGuid);
            }
            if (!force && this.now() - camp.chestsFilledAt < this.settings.chestRefillMs) {
                continue;
            }
            if (!force && this.playersNear(camp.center, this.settings.chestClearRadius)) {
                continue;
            }
            for (const guid of camp.chests) {
                const stash = Stash.find(guid);
                if (stash === null) {
                    this.failed("baú: não encontrado");
                } else if (!stash.isOpen && this.fill(stash)) {
                    filled += 1;
                }
            }
            camp.chestsFilledAt = this.now();
        }
        return filled;
    }

    private players(): Array<{ player: Player; position: Point }> {
        return Player.all()
            .filter((player) => player.ready && player.alive && player.virtualWorld === 0)
            .map((player) => ({ player, position: player.position }));
    }

    private playersNear(point: Point, radius: number): boolean {
        return this.players().some((entry) => flat(entry.position, point) <= radius);
    }

    // -----------------------------------------------------------------------------------------
    // Events.

    isBandit(npcId: number): boolean {
        return this.bySlot.has(npcId);
    }

    died(npcId: number): void {
        const entry = this.bySlot.get(npcId);
        if (entry !== undefined && entry.slot.state === "alive") {
            entry.slot.state = "dead";
            entry.slot.deathAt = this.now();
            entry.slot.target = null;
        }
    }

    removed(npcId: number): void {
        const entry = this.bySlot.get(npcId);
        if (entry === undefined) {
            return;
        }
        this.bySlot.delete(npcId);
        if (entry.slot.npcId === npcId) {
            if (entry.slot.state === "alive") {
                entry.slot.deathAt = this.now();
            }
            entry.slot.state = "dead";
            entry.slot.npcId = null;
        }
    }

    /** A bandit was hit by a player: the whole camp turns on them for a while, and he curses. */
    hit(npcId: number, attacker: Player): void {
        const entry = this.bySlot.get(npcId);
        if (entry !== undefined) {
            entry.camp.alarm = { targetId: attacker.id, until: this.now() + this.settings.alarmMs };
            this.bark(entry.slot, BARKS.hurt);
        }
    }

    /** A bandit shouts one of `lines`, no oftener than every `BARK_EVERY_MS`. */
    private bark(slot: Slot, lines: readonly string[]): void {
        const now = this.now();
        if (slot.npcId === null || now < (slot.barkAt ?? 0)) {
            return;
        }
        const npc = Npc.getById(slot.npcId);
        if (npc !== null && npc.alive) {
            slot.barkAt = now + BARK_EVERY_MS;
            npc.say(lines[Math.floor(this.random() * lines.length)] ?? "");
        }
    }

    // -----------------------------------------------------------------------------------------

    tick(): void {
        if (!this.running) {
            return;
        }
        const now = this.now();
        const players = this.players().filter((entry) => entry.player.canAct);
        for (const camp of this.camps) {
            const near = players.filter((entry) => flat(entry.position, camp.center) <= this.settings.activationRadius);
            const alarm = camp.alarm !== null && camp.alarm.until > now ? camp.alarm : null;
            if (camp.alarm !== null && alarm === null) {
                camp.alarm = null;
            }

            for (const slot of camp.slots) {
                if (slot.state !== "alive") {
                    this.tendDead(camp, slot, now);
                    continue;
                }
                const npc = slot.npcId === null ? null : Npc.getById(slot.npcId);
                if (npc === null) {
                    continue;
                }
                if (!npc.alive) {
                    this.died(npc.id);
                    continue;
                }
                if (near.length === 0) {
                    continue;
                }
                const inLeash = (entry: { position: Point }): boolean => flat(entry.position, camp.center) <= this.settings.leashRadius;
                const position = npc.position;

                let target = slot.target === null ? undefined : near.find((entry) => entry.player.id === slot.target && inLeash(entry));
                if (target === undefined && alarm !== null) {
                    target = near.find((entry) => entry.player.id === alarm.targetId && inLeash(entry));
                }
                if (target === undefined) {
                    let best = this.settings.aggroRadius;
                    for (const entry of near) {
                        const range = flat(entry.position, position);
                        if (range <= best && inLeash(entry)) {
                            best = range;
                            target = entry;
                        }
                    }
                }

                if (target !== undefined) {
                    const stuck = npc.status === "failed" || npc.status === "blocked";
                    if (slot.target !== target.player.id || (stuck && now >= slot.retryAt)) {
                        const first = slot.target !== target.player.id;
                        // An archer whose bow the game would not put on fights hand to hand instead.
                        if ((slot.archer && npc.attack(target.player, { weapon: "bow" })) || npc.attack(target.player)) {
                            slot.target = target.player.id;
                            if (first) {
                                this.bark(slot, alarm !== null && alarm.targetId === target.player.id ? BARKS.alarm : BARKS.sight);
                            }
                        }
                        slot.retryAt = now + this.settings.retryMs;
                    }
                    // Anyone in the camp who sees a fight joins it.
                    if (camp.alarm === null || camp.alarm.until <= now) {
                        camp.alarm = { targetId: target.player.id, until: now + this.settings.alarmMs };
                    }
                    continue;
                }

                if (slot.target !== null) {
                    slot.target = null;
                    npc.hold();
                    slot.retryAt = 0;
                }
                if (flat(position, slot.spot.position) > this.settings.homeRadius && npc.status !== "running" && now >= slot.retryAt) {
                    npc.moveTo(slot.spot.position, { speed: "walk", radius: 2, pathfinding: "server" });
                    slot.retryAt = now + 10_000;
                }
            }
        }
    }

    private tendDead(camp: Camp, slot: Slot, now: number): void {
        if (slot.npcId !== null) {
            const corpse = Npc.getById(slot.npcId);
            if (corpse === null) {
                this.bySlot.delete(slot.npcId);
                slot.npcId = null;
            } else if (now - slot.deathAt >= this.settings.corpseMs && !this.playersNear(corpse.position, this.settings.corpseClearRadius)) {
                const id = slot.npcId;
                slot.npcId = null;
                this.bySlot.delete(id);
                corpse.remove();
            }
        }
        if (slot.npcId === null && now - slot.deathAt >= this.settings.respawnMs && !this.playersNear(camp.center, this.settings.respawnClearRadius)) {
            slot.state = "vacant";
            this.spawn(camp, slot);
        }
    }

    /** Every dead bandit back, now, and every chest filled; for an administrator. */
    restockNow(): { spawned: number; chests: number } {
        let spawned = 0;
        for (const camp of this.camps) {
            for (const slot of camp.slots) {
                if (slot.state !== "alive") {
                    if (slot.npcId !== null) {
                        const id = slot.npcId;
                        slot.npcId = null;
                        this.bySlot.delete(id);
                        Npc.getById(id)?.remove();
                    }
                    slot.state = "vacant";
                    if (this.spawn(camp, slot)) {
                        spawned += 1;
                    }
                }
            }
        }
        return { spawned, chests: this.stockChests(true) };
    }

    describe(): string[] {
        return this.camps.map((camp) => {
            const alive = camp.slots.filter((slot) => slot.state === "alive").length;
            return `  ${camp.id}. ${camp.name} em ${camp.center.x.toFixed(0)} ${camp.center.y.toFixed(0)} ${camp.center.z.toFixed(0)}: ${alive}/${camp.slots.length} vivos, ${camp.chests.length} baú(s)`;
        });
    }

    stop(): void {
        this.running = false;
        for (const id of [...this.bySlot.keys()]) {
            Npc.getById(id)?.remove();
        }
        this.bySlot.clear();
    }
}

export const banditCamps = new BanditCamps();

/** The animals whose markers say the wild (a forest, a meadow), not a pasture or a yard. */
const WILD_ANIMALS = /^(Boar|Hare|RoeDeer|RedDeer|Wolf|WildDog)/;
/** How many times, ten seconds apart, the hideouts wait for the navigation mesh before giving up. */
const WILD_TRIES = 12;

export function installBandits(): void {
    loadAggression();
    const placements = Npc.placements();
    const camps = banditCamps.discover(placements);

    Events.on("npcDeath", (npc) => banditCamps.died(npc.id));
    Events.on("npcDestroy", (npc) => banditCamps.removed(npc.id));

    // The heavier hand: a bandit's blow on a player is worth more than an ordinary man's.
    Events.on("playerHit", (_victim, attacker, hit) => {
        if (attacker !== null && typeof attacker === "object" && banditCamps.isBandit(attacker.id) && !("steamId" in attacker)) {
            hit.damage *= banditSettings.damageMultiplier;
        }
    });

    Events.on("npcDamage", (npc, attacker) => {
        if (attacker !== null && "steamId" in attacker && banditCamps.isBandit(npc.id)) {
            banditCamps.hit(npc.id, attacker);
        }
    });

    // The hideouts in the wild need the navigation mesh to put them on walkable ground, which may not be ready yet.
    let wildTimer: ReturnType<typeof setTimeout> | null = null;
    const placeWild = (attempt: number): void => {
        wildTimer = null;
        if (!Navigation.ready) {
            if (attempt >= WILD_TRIES) {
                console.log("bandits: a malha de navegação não ficou pronta: sem esconderijos na mata");
            } else {
                wildTimer = setTimeout(() => placeWild(attempt + 1), 10_000);
            }
            return;
        }
        const wild = Npc.animalSpawnpoints()
            .filter((point) => point.count > 0 && WILD_ANIMALS.test(point.actorClass))
            .map((point) => ({ guid: point.guid, position: { x: point.position.x, y: point.position.y, z: point.position.z } }));
        const people = placements
            .filter((place) => !((PATTERN.test(place.layer) || PATTERN.test(place.name)) && !/cinematic/i.test(place.layer)))
            .map((place) => place.position);
        const before = banditCamps.camps.length;
        const added = banditCamps.addWild(wild, people);
        const spawned = banditCamps.spawnAll();
        console.log(`bandits: ${added} esconderijo(s) na mata, a pelo menos ${banditSettings.wildFromPeopleM} m de qualquer lugar com gente; ${spawned} bandido(s) a mais`);
        banditCamps.describe().slice(before).forEach((line) => console.log(`bandits: ${line.trim()}`));
    };

    let timer: ReturnType<typeof setInterval> | null = null;
    const start = setTimeout(() => {
        const spawned = banditCamps.spawnAll();
        const chests = banditCamps.stockChests(true);
        console.log(`bandits: ${spawned} bandido(s) em ${camps} acampamento(s); ${chests} baú(s) de acampamento abastecido(s)`);
        banditCamps.describe().forEach((line) => console.log(`bandits: ${line.trim()}`));
        banditCamps.report().forEach((line) => console.log(`bandits: ${line}`));
        timer = setInterval(() => {
            banditCamps.tick();
            banditCamps.stockChests();
        }, banditSettings.tickMs);
        placeWild(0);
    }, banditSettings.spawnAfterMs);

    Events.on("resourceStop", (name) => {
        if (name !== RESOURCE) {
            return;
        }
        clearTimeout(start);
        if (wildTimer !== null) {
            clearTimeout(wildTimer);
        }
        if (timer !== null) {
            clearInterval(timer);
        }
        banditCamps.stop();
    });

    console.log(`bandits: ${camps} acampamento(s) de bandidos encontrados no nível; aparecem ${banditSettings.spawnAfterMs / 1000} s depois de o servidor subir`);
}
