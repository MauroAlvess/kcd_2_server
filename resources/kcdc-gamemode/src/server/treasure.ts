/**
 * Treasure: what the chests of the world hold (user, 2026-10-17: "configurar seus conteúdos para oferecer recompensas
 * variadas ... comida, minérios, receitas, armaduras, armas ... de acordo com tabelas de recompensas aleatórias ... de maneira
 * coerente com a localização e a dificuldade de acesso").
 *
 * The level's own containers start empty here: the server never rolls the game's loot. So a script fills them. The chests that
 * take part are the level's own that nobody has a claim on: not a property of the catalog (`properties.ts`: a house's chests
 * are its owner's), not a bandit camp's (`bandits.ts` stocks those with the guilds' goods), not a donation box, a grave, a
 * beehive or a vegetable store, and nothing a quest names. Of those, a share (40%, the same chests every start) holds
 * something, so that finding one is a find and not a rule.
 *
 * Where a chest stands says how good its contents are, in three tiers:
 *
 * - tier 1, within 150 m of a village, a church or a roadside camp: food, bandages, a few herbs, scrap iron, crude arrows,
 *   a little coin, plain gear;
 * - tier 2, up to 500 m from them, or a locked chest nearer: the iron and steel the smiths use, arrows for hunting, a
 *   potion, the cheaper recipe books, common gear, more coin;
 * - tier 3, farther than that, or a locked chest beyond the first tier: Frankfurt and Toledo steel, copper, the dear recipe
 *   books, good and now and then excellent gear, the most coin.
 *
 * What is looted is put back, from the same tables, an hour after the chest was found empty and nobody is near. A restart
 * rolls every chest again. `/tesouros` says how it stands, fills, and switches it.
 */

import { BOOKS, bookGuid } from "./books.js";
import { ensureDir, read, write } from "./store.js";

declare function require(id: string): unknown;
declare const __dirname: string | undefined;

const RESOURCE = "kcdc-gamemode";
const DIR = "playerdata";
const FILE = `${DIR}/treasure.json`;

export const treasureSettings = {
    /** The share of the eligible chests that hold something. */
    share: 0.4,
    /** A chest found empty is filled again this long after, with nobody near. */
    refillMs: 60 * 60_000,
    clearRadiusM: 45,
    tickMs: 5 * 60_000,
    /** The first filling comes this long after the server starts, once the level and the camps are up. */
    spawnAfterMs: 45_000,
    /** From the nearest settlement: below `nearM` a chest is of the first tier, from `farM` on of the third. */
    nearM: 150,
    farM: 500,
};

export type Tier = 1 | 2 | 3;

/** The containers worth a loot table, and the ones that are not: the same words the camps' chests are found by. */
const CONTAINER = /chest|stash|sack|crate|box|barrel/i;
const NOT_TREASURE = /bee|hive|corpse|deadbody|cin_|quest|dlc|donation|vegetabl|shooting|grave|tomb|ossuar|tournament|reward|musovaTruhla|poklad|gunpowder|spizovaci|archery|brothers|minci|nemcu|relikvie|mill|miller|bath|fireplace|dice/i;

/** A place where people live: where a chest is safe, and so poor. */
export interface Place {
    readonly x: number;
    readonly y: number;
}

export interface Loot {
    readonly item: string;
    readonly amount: number;
    readonly metadata?: Record<string, unknown>;
}

type Gear = Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;

// ---------------------------------------------------------------------------------------------
// The tables.

const FOOD = ["bread", "apple", "carrot", "salamiDried", "beefDried", "cheeseQuarterDried", "walnuts"];
const RAW_MEAT = ["beef", "pigMeat", "lambMeat", "chicken"];
const HERBS = ["herb_belladona", "herb_chamomile", "herb_comfrey", "herb_dandelion", "herb_eyewort", "herb_hypericum", "herb_marigold", "herb_mint", "herb_poppy", "herb_salvia", "herb_thistle", "herb_urticaria", "herb_valerian", "herb_wormwood"];
const POTIONS = ["potion_marigold", "potion_stamina", "potion_aquaVitalis", "potion_saviourSchnapps", "potion_chamomile_decoction", "potion_antidote"];

interface Entry {
    readonly id: string;
    readonly weight: number;
    readonly minTier: Tier;
    /** What one roll of this entry gives at this tier. */
    roll(tier: Tier, random: () => number): Loot[];
}

const between = (random: () => number, min: number, max: number): number => min + Math.floor(random() * (max - min + 1));
const pick = <T>(random: () => number, list: readonly T[]): T => list[Math.floor(random() * list.length)] as T;

function plain(id: string, weight: number, minTier: Tier, items: readonly string[], min: number, max: number): Entry {
    return { id, weight, minTier, roll: (_tier, random) => [{ item: pick(random, items), amount: between(random, min, max) }] };
}

/** One piece of gear of the quality the tier calls for, at quality 1 to the tier's best (the game refuses a tier a piece is not made in: the fill tries again without). */
function gearEntry(group: "weapons" | "armor" | "clothes", weight: number, gear: Gear): Entry {
    return {
        id: group,
        weight,
        minTier: 1,
        roll: (tier, random) => {
            const table = gear[group] ?? {};
            const draw = random();
            const quality = tier === 1 ? "basic" : tier === 2 ? (draw < 0.4 ? "basic" : "common") : draw < 0.3 ? "common" : draw < 0.85 ? "good" : "excellent";
            const list = table[quality] ?? [];
            return list.length === 0 ? [] : [{ item: pick(random, list), amount: 1, metadata: { quality: between(random, 1, tier + 1) } }];
        },
    };
}

/** A recipe book of a price the tier suits: the cheap ones from the second tier, the dear ones only from the third. */
function bookEntry(weight: number, minTier: Tier, cheap: boolean): Entry {
    return {
        id: cheap ? "receitas" : "receitas raras",
        weight,
        minTier,
        roll: (_tier, random) => {
            const books = BOOKS.filter((book) => (book.price <= 2000) === cheap);
            const book = pick(random, books);
            const guid = book === undefined ? null : bookGuid(book.id);
            return guid === null ? [] : [{ item: guid, amount: 1 }];
        },
    };
}

/** The tables, with the gear the data file lists. Exported for the tests. */
export function entries(gear: Gear): readonly Entry[] {
    return [
        plain("comida", 14, 1, FOOD, 1, 4),
        plain("carne crua", 6, 1, RAW_MEAT, 1, 2),
        plain("ataduras", 8, 1, ["bandage_classic"], 1, 3),
        plain("sabão", 3, 1, ["soap"], 1, 2),
        plain("ervas", 10, 1, HERBS, 2, 6),
        plain("sucata", 10, 1, ["bsmt_ironBad"], 2, 6),
        plain("flechas", 8, 1, ["arrow_crude", "arrow_normal"], 5, 15),
        {
            id: "moedas",
            weight: 9,
            minTier: 1,
            // The game shows a tenth of the money item's amount: 100 to 600 reads as 10 to 60 coins.
            roll: (tier, random) => [{ item: "money", amount: between(random, 100 * tier, 600 * tier * tier) }],
        },
        plain("ferro", 8, 2, ["bsmt_ironGood"], 1, 4),
        plain("aço comum", 7, 2, ["bsmt_steelBad", "bsmt_hardware"], 1, 3),
        plain("flechas de caça", 5, 2, ["arrow_hunting"], 5, 10),
        plain("poções", 6, 2, POTIONS, 1, 2),
        plain("aço bom", 5, 3, ["bsmt_steelNormal", "bsmt_steelGood", "bsmt_copper"], 1, 2),
        bookEntry(5, 2, true),
        bookEntry(3, 3, false),
        gearEntry("weapons", 6, gear),
        gearEntry("armor", 6, gear),
        gearEntry("clothes", 6, gear),
    ];
}

/** How many rows a chest of this tier holds. */
const ROWS: Readonly<Record<Tier, readonly [number, number]>> = { 1: [1, 3], 2: [2, 4], 3: [3, 5] };

/** What one chest of the tier holds: a few different kinds, none twice. */
export function rollChest(tier: Tier, table: readonly Entry[], random: () => number = Math.random): Loot[] {
    const open = table.filter((entry) => entry.minTier <= tier);
    const total = open.reduce((sum, entry) => sum + entry.weight, 0);
    const wanted = between(random, ROWS[tier][0], ROWS[tier][1]);
    const rows: Loot[] = [];
    const used = new Set<string>();
    for (let guard = 0; rows.length < wanted && guard < 60; guard += 1) {
        let left = random() * total;
        let entry = open[0] as Entry;
        for (const candidate of open) {
            left -= candidate.weight;
            if (left <= 0) {
                entry = candidate;
                break;
            }
        }
        for (const row of entry.roll(tier, random)) {
            if (!used.has(row.item)) {
                used.add(row.item);
                rows.push(row);
            }
        }
    }
    return rows;
}

// ---------------------------------------------------------------------------------------------
// Which chests, and how good.

/** A number from a chest's GUID, the same at every start: which chests are the ones that hold something. */
export function shareOf(guid: string): number {
    let hash = 0x811c9dc5;
    for (let index = 0; index < guid.length; index += 1) {
        hash ^= guid.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return (hash % 10_000) / 10_000;
}

/** The tier a chest of this distance from the nearest settlement, locked or not, is of. */
export function tierOf(distance: number, locked: boolean, settings = treasureSettings): Tier {
    const byDistance: Tier = distance < settings.nearM ? 1 : distance < settings.farM ? 2 : 3;
    return locked && byDistance < 3 ? ((byDistance + 1) as Tier) : byDistance;
}

export function isTreasureName(name: string): boolean {
    return CONTAINER.test(name) && !NOT_TREASURE.test(name);
}

const flat = (a: Place, b: Place): number => Math.hypot(a.x - b.x, a.y - b.y);

export interface Surroundings {
    /** The places people live or pass: villages, churches, roadside camps. */
    settlements(): readonly Place[];
    /** The chests that are not up for treasure (a house's, a camp's): by level GUID. */
    claimed(guid: string): boolean;
    playersNear(place: Place, radius: number): boolean;
}

interface Slot {
    readonly guid: string;
    readonly tier: Tier;
    /** When it was first seen empty since it was last filled, or 0. */
    emptySince: number;
    filledAt: number;
}

export class Treasure {
    enabled = true;
    share: number;
    private slots = new Map<string, Slot>();
    private scanned = false;
    private readonly refused = new Set<string>();
    private filled = 0;

    constructor(
        private readonly gear: Gear,
        private readonly around: Surroundings,
        private readonly settings = treasureSettings,
        private readonly now: () => number = () => Date.now(),
        private readonly random: () => number = () => Math.random(),
    ) {
        this.share = settings.share;
    }

    load(): void {
        const loaded = read<{ enabled?: unknown; share?: unknown }>(FILE);
        if (loaded.status !== "ok") {
            return;
        }
        if (typeof loaded.value.enabled === "boolean") {
            this.enabled = loaded.value.enabled;
        }
        if (typeof loaded.value.share === "number" && loaded.value.share >= 0 && loaded.value.share <= 1) {
            this.share = loaded.value.share;
        }
    }

    private save(): void {
        try {
            ensureDir(DIR);
            write(FILE, { enabled: this.enabled, share: this.share });
        } catch (error: unknown) {
            console.log(`treasure: não consegui salvar: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        this.save();
    }

    setShare(share: number): void {
        this.share = Math.min(1, Math.max(0, share));
        this.scanned = false;
        this.slots = new Map();
        this.save();
    }

    /** The level's chests that take part, and the tier of each. Done once, when the level is up. */
    private scan(): void {
        this.scanned = true;
        this.slots = new Map();
        const settlements = this.around.settlements();
        for (const stash of Stash.all()) {
            if (stash.isVirtual || stash.levelGuid === "" || !isTreasureName(stash.name) || this.around.claimed(stash.levelGuid) || shareOf(stash.levelGuid) >= this.share) {
                continue;
            }
            const here = { x: stash.position.x, y: stash.position.y };
            const distance = settlements.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...settlements.map((place) => flat(place, here)));
            this.slots.set(stash.levelGuid, { guid: stash.levelGuid, tier: tierOf(distance, stash.startsLocked === true, this.settings), emptySince: 0, filledAt: 0 });
        }
    }

    /** Puts a roll into a chest, one row at a time so a name the game does not know costs only itself. True when it holds something now. */
    private fill(stash: Stash, tier: Tier): boolean {
        stash.setInventory({ items: [] });
        let held = 0;
        for (const row of rollChest(tier, entries(this.gear), this.random)) {
            if (this.refused.has(row.item)) {
                continue;
            }
            let result = stash.addItem({ item: row.item, amount: row.amount, ...(row.metadata === undefined ? {} : { metadata: row.metadata }) });
            if (!result.ok && row.metadata !== undefined) {
                result = stash.addItem({ item: row.item, amount: row.amount });
            }
            if (result.ok) {
                held += 1;
            } else if (result.code === "unknownItemClass" || result.code === "invalidItem" || result.code === "questItem") {
                this.refused.add(row.item);
            }
        }
        return held > 0;
    }

    /** Fills every chest that has none yet and every one found empty for long enough. Returns how many were filled. */
    run(force = false): number {
        if (!this.enabled && !force) {
            return 0;
        }
        if (!this.scanned) {
            this.scan();
        }
        const now = this.now();
        let count = 0;
        for (const slot of this.slots.values()) {
            const stash = Stash.find(slot.guid);
            if (stash === null || stash.isOpen) {
                continue;
            }
            const empty = (stash.getInventory()?.items.length ?? 0) === 0;
            if (!empty) {
                slot.emptySince = 0;
                continue;
            }
            if (slot.filledAt === 0) {
                // The first filling: the chests start empty, and nobody has looted any of this.
            } else {
                if (slot.emptySince === 0) {
                    slot.emptySince = now;
                }
                const waited = now - slot.emptySince >= this.settings.refillMs;
                const here = { x: stash.position.x, y: stash.position.y };
                if (!force && (!waited || this.around.playersNear(here, this.settings.clearRadiusM))) {
                    continue;
                }
            }
            if (this.fill(stash, slot.tier)) {
                slot.filledAt = now;
                slot.emptySince = 0;
                count += 1;
            }
        }
        this.filled += count;
        return count;
    }

    status(): { enabled: boolean; share: number; chests: number; byTier: Record<Tier, number>; filled: number; refused: string[] } {
        const byTier: Record<Tier, number> = { 1: 0, 2: 0, 3: 0 };
        for (const slot of this.slots.values()) {
            byTier[slot.tier] += 1;
        }
        return { enabled: this.enabled, share: this.share, chests: this.slots.size, byTier, filled: this.filled, refused: [...this.refused] };
    }
}

// ---------------------------------------------------------------------------------------------

function readGear(): Gear {
    const fs = require("node:fs") as { readFileSync(path: string, encoding: "utf8"): string };
    const places = [typeof __dirname === "string" ? `${__dirname}/../../data/treasure-gear.json` : "", "resources/kcdc-gamemode/data/treasure-gear.json", "data/treasure-gear.json"];
    for (const place of places) {
        if (place === "") {
            continue;
        }
        try {
            const parsed = JSON.parse(fs.readFileSync(place, "utf8")) as unknown;
            if (typeof parsed === "object" && parsed !== null) {
                return parsed as Gear;
            }
        } catch {
            // Not here; the next place.
        }
    }
    console.log("treasure: data/treasure-gear.json não foi encontrado; os baús não terão armas, armaduras nem roupas");
    return {};
}

/** The places people live or pass, from what this server already knows of the map. */
export function knownSettlements(): Place[] {
    // Imported here, not at the top: vendors and respawn are big modules, and only a running server needs them.
    const respawn = require("./respawn.js") as { CHURCHES: readonly Place[] };
    const properties = require("./properties.js") as { REGIONS: readonly { minX: number; maxX: number; minY: number; maxY: number }[] };
    const vendors = require("./vendors.js") as { CAMPS: ReadonlyArray<{ fire: Place }> };
    return [
        ...respawn.CHURCHES.map((church) => ({ x: church.x, y: church.y })),
        ...properties.REGIONS.map((region) => ({ x: (region.minX + region.maxX) / 2, y: (region.minY + region.maxY) / 2 })),
        ...vendors.CAMPS.map((camp) => ({ x: camp.fire.x, y: camp.fire.y })),
    ];
}

export let treasure: Treasure | null = null;

export function installTreasure(claimedBy: (guid: string) => boolean): Treasure {
    const around: Surroundings = {
        settlements: knownSettlements,
        claimed: claimedBy,
        playersNear: (place, radius) => Player.all().some((player) => player.ready && player.alive && player.virtualWorld === 0 && flat(player.position, place) <= radius),
    };
    const made = new Treasure(readGear(), around);
    treasure = made;
    made.load();
    const first = setTimeout(() => {
        const filled = made.run();
        const status = made.status();
        console.log(`treasure: ${status.chests} baú(s) do mundo com tesouro (nível 1: ${status.byTier[1]}, 2: ${status.byTier[2]}, 3: ${status.byTier[3]}); ${filled} abastecido(s) agora; ${made.enabled ? "ligado" : "desligado"}`);
        if (status.refused.length > 0) {
            console.log(`treasure: o jogo não conhece: ${status.refused.join(", ")}`);
        }
    }, treasureSettings.spawnAfterMs);
    const timer = setInterval(() => made.run(), treasureSettings.tickMs);
    Events.on("resourceStop", (name) => {
        if (name === RESOURCE) {
            clearTimeout(first);
            clearInterval(timer);
        }
    });
    return made;
}
