/**
 * Treasure: what the chests of the world hold (user, 2026-10-17: "configurar seus conteúdos para oferecer recompensas
 * variadas ... comida, minérios, receitas, armaduras, armas ... de acordo com tabelas de recompensas aleatórias ... de maneira
 * coerente com a localização e a dificuldade de acesso").
 *
 * Gear is poor and rare in them (2026-10-20, the user: "os itens que aparecem nos baús avulsos não podem ter armadura e espada muito
 * boas, têm que ser mais raros: armaduras, espadas, coisas de cavalo; senão tira o sentido das profissões"): the smith makes the good
 * weapons and armour and the tailor the good clothes, so a chest holds only plain pieces and, from the farthest and the locked ones,
 * common ones, never a good or an excellent weapon or armour, none at all in the chests near people, and no horse tack ever; and a
 * piece in a chest is worn, of the lowest qualities. Clothes may be good, and now and then, far away.
 *
 * The level's own containers start empty here: the server never rolls the game's loot. So a script fills them. The chests that
 * take part are the level's own that nobody has a claim on: not a property of the catalog (`properties.ts`: a house's chests
 * are its owner's), not a bandit camp's (`bandits.ts` stocks those with the guilds' goods), not a donation box, a grave, a
 * beehive or a vegetable store, and nothing a quest names. Of those, a share (20%, the same chests every start) holds
 * something, so that finding one is a find and not a rule.
 *
 * Fewer and poorer since 2026-10-25 (a player: "o sistema de lootear sacos pelo mapa é incoerente com RP: tudo que existe nas terras é
 * posse do lorde ou de algum proprietário"; the user: "diminuir o rate de drop"): a fifth of the chests hold anything (was two fifths), a chest holds
 * one or two kinds of thing (up to three or four far away), the coins are half, and an emptied chest waits three hours (was one).
 *
 * Where a chest stands says how good its contents are, in three tiers:
 *
 * - tier 1, within 150 m of a village, a church or a roadside camp: food, bandages, a few herbs, scrap iron, crude arrows,
 *   a little coin, plain clothes (no weapons or armour);
 * - tier 2, up to 500 m from them, or a locked chest nearer: the iron and steel the smiths use, arrows for hunting, a
 *   potion, the cheaper recipe books, plain weapons and armour, plain or common clothes, more coin;
 * - tier 3, farther than that, or a locked chest beyond the first tier: Frankfurt and Toledo steel, copper, the dear recipe
 *   books, weapons and armour that are plain or (a third of the time) common, clothes that may be good, the most coin.
 *
 * What is looted is put back, from the same tables, three hours after the chest was found empty and nobody is near. A restart
 * rolls every chest again. `/tesouros` says how it stands, fills, and switches it.
 *
 * The level's food sacks (`sack_apples`, `sack_onions`, `sack_generic`) are not in these tables (2026-10-27, the user: "nos sacos de comida vamos colocar um pouco de comida como
 * frutas, mas pouco"): a sack of apples that held a sword or a purse was no RP. Each holds a little food, by what it is (`rollSack`), in half of them, and is filled again like a chest.
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
    share: 0.2,
    /** The share of the food sacks that hold something (a little: `rollSack`). */
    sackShare: 0.5,
    /** A chest found empty is filled again this long after, with nobody near. */
    refillMs: 3 * 60 * 60_000,
    clearRadiusM: 45,
    tickMs: 5 * 60_000,
    /** The first filling comes this long after the server starts, once the level and the camps are up. */
    spawnAfterMs: 45_000,
    /** From the nearest settlement: below `nearM` a chest is of the first tier, from `farM` on of the third. */
    nearM: 150,
    farM: 500,
};

export type Tier = 1 | 2 | 3;

/** The gear of a horse (saddle, bridle, chanfron, caparison, horseshoes): made and bought, never found in a chest. */
export const HORSE_TACK = /caparison|saddle|bridle|chanfron|horseshoe|horse|barding|stirrup/i;

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

export type GearGroup = "weapons" | "armor" | "clothes";

/**
 * The quality of piece a chest of this tier gives, for a draw from 0 to 1. Weapons and armour never pass "common", and that only from the
 * third tier (the farthest and the locked chests), a third of the time; the second tier's are all plain. Clothes go up to "good", from the
 * third tier, one in seven; nothing is ever "excellent".
 */
export function gearQuality(group: GearGroup, tier: Tier, draw: number): "basic" | "common" | "good" {
    if (tier === 1) {
        return "basic";
    }
    if (group === "clothes") {
        return tier === 2 ? (draw < 0.5 ? "basic" : "common") : draw < 0.25 ? "basic" : draw < 0.85 ? "common" : "good";
    }
    return tier === 2 || draw < 0.65 ? "basic" : "common";
}

/**
 * One piece of gear of the quality the tier calls for (`gearQuality`), worn: at quality 1, or 2 from the second tier (weapons and armour),
 * the game refusing a quality a piece is not made in, and the fill trying again without. Weapons and armour are not found in the chests
 * of the first tier at all.
 */
function gearEntry(group: GearGroup, weight: number, gear: Gear): Entry {
    return {
        id: group,
        weight,
        minTier: group === "clothes" ? 1 : 2,
        roll: (tier, random) => {
            const table = gear[group] ?? {};
            const quality = gearQuality(group, tier, random());
            const list = (table[quality] ?? []).filter((item) => !HORSE_TACK.test(item));
            if (list.length === 0) {
                return [];
            }
            const worn = group === "clothes" ? between(random, 1, tier) : between(random, 1, tier === 1 ? 1 : 2);
            return [{ item: pick(random, list), amount: 1, metadata: { quality: worn } }];
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
        // Soap and perfume, which the bath attendants' vendors sold and nobody makes (2026-10-27: "o sabão e o perfume coloque em baús espalhados"): soap in every kind of chest,
        // the plain perfumes in those near people, the better ones the farther the chest stands.
        plain("sabão", 7, 1, ["soap", "soap_kcd"], 1, 3),
        plain("perfume", 4, 1, ["perfume_longWeak", "perfume_shortStrong"], 1, 1),
        plain("perfume bom", 3, 2, ["perfume_longWeak_medium", "perfume_shortStrong_medium"], 1, 1),
        plain("perfume raro", 2, 3, ["perfume_longWeak_high", "perfume_shortStrong_high"], 1, 1),
        plain("ervas", 10, 1, HERBS, 2, 6),
        plain("sucata", 10, 1, ["bsmt_ironBad"], 2, 6),
        plain("flechas", 8, 1, ["arrow_crude", "arrow_normal"], 5, 15),
        {
            id: "moedas",
            weight: 9,
            minTier: 1,
            // The game shows a tenth of the money item's amount: 50 to 300 reads as 5 to 30 coins (halved 2026-10-25).
            roll: (tier, random) => [{ item: "money", amount: between(random, 50 * tier, 300 * tier * tier) }],
        },
        plain("ferro", 8, 2, ["bsmt_ironGood"], 1, 4),
        plain("aço comum", 7, 2, ["bsmt_steelBad", "bsmt_hardware"], 1, 3),
        plain("flechas de caça", 5, 2, ["arrow_hunting"], 5, 10),
        plain("poções", 6, 2, POTIONS, 1, 2),
        plain("aço bom", 5, 3, ["bsmt_steelNormal", "bsmt_steelGood", "bsmt_copper"], 1, 2),
        // The rest of what the guilds' recipes take (2026-10-18): cloth and hides, the kitchen's spices and wine, the alchemist's
        // salts and rare roots, the forge's fine parts.
        plain("panos e couros", 6, 1, ["loot_cloth", "skin_sheep", "special_cowSkin", "special_pigSkin", "special_deerSkin"], 1, 3),
        plain("temperos", 5, 1, ["loot_salt", "driedPepperSpice", "garlic", "honey"], 1, 3),
        plain("vinho", 4, 1, ["wine"], 1, 2),
        plain("carvão", 4, 1, ["special_charcoal"], 1, 4),
        plain("sais", 4, 2, ["special_sulfur", "special_saltpeter", "special_charcoalImproved"], 1, 3),
        plain("ervas raras", 4, 2, ["herb_dried_poppy", "special_mushroomAmanita", "special_cobweb"], 1, 2),
        plain("peças finas", 3, 2, ["bsmt_guardSpecial", "bsmt_woodExotic", "special_attire"], 1, 2),
        plain("raridades", 2, 3, ["maliruvLek_mandrakeRoot", "maliruvLek_freshwaterPearl"], 1, 1),
        bookEntry(5, 2, true),
        bookEntry(3, 3, false),
        // Rare (2026-10-20): a third of what they were for the weapons and the armour, two thirds for the clothes.
        gearEntry("weapons", 2, gear),
        gearEntry("armor", 2, gear),
        gearEntry("clothes", 4, gear),
    ];
}

/** How many rows a chest of this tier holds. */
const ROWS: Readonly<Record<Tier, readonly [number, number]>> = { 1: [1, 2], 2: [1, 3], 3: [2, 4] };

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
    return CONTAINER.test(name) && !NOT_TREASURE.test(name) && sackKindOf(name) === null;
}

// ---------------------------------------------------------------------------------------------
// The food sacks: a little food, by what the sack is.

export type SackKind = "apples" | "onions" | "generic";

/** The kind of food sack a container is by the name the level gives it (`Stash3[Stash/sack_apples9_<guid>]`), or null for anything else. A sack in a house's shelves counts too. */
export function sackKindOf(name: string): SackKind | null {
    const found = /sack_(apples|onions|generic)/i.exec(name);
    return found === null ? null : (found[1]?.toLowerCase() as SackKind);
}

/** The game's own food, by item GUID (the same the gardens' harvests are). */
const FRUIT = {
    apple: "2264f217-590e-4c0f-a4c6-f50c6532b9f6",
    pear: "2eeb7bf7-f0ac-4c46-9468-97c2f76cb254",
    plum: "2ac0499c-a18f-425f-ab8c-bc81eaa0142a",
};
const ONION = "4a6fa310-067a-404d-9813-bd1761d1c70d";
const CARROT = "b7ee311c-736b-4f7c-987b-8431ce3b5600";

/**
 * What a food sack holds: little. A sack of apples a few apples (one to three), now and then (one in four) a pear or a plum as well; a sack of onions one to three onions, and
 * now and then (one in five) an apple; a plain sack one thing, mostly fruit, one or two of it.
 */
export function rollSack(kind: SackKind, random: () => number = Math.random): Loot[] {
    if (kind === "apples") {
        const rows: Loot[] = [{ item: FRUIT.apple, amount: between(random, 1, 3) }];
        if (random() < 0.25) {
            rows.push({ item: random() < 0.5 ? FRUIT.pear : FRUIT.plum, amount: between(random, 1, 2) });
        }
        return rows;
    }
    if (kind === "onions") {
        const rows: Loot[] = [{ item: ONION, amount: between(random, 1, 3) }];
        if (random() < 0.2) {
            rows.push({ item: FRUIT.apple, amount: between(random, 1, 2) });
        }
        return rows;
    }
    const plainFood: ReadonlyArray<{ readonly item: string; readonly weight: number }> = [
        { item: FRUIT.apple, weight: 4 },
        { item: FRUIT.pear, weight: 3 },
        { item: FRUIT.plum, weight: 3 },
        { item: "walnuts", weight: 2 },
        { item: CARROT, weight: 2 },
    ];
    let left = random() * plainFood.reduce((sum, food) => sum + food.weight, 0);
    let chosen = plainFood[0] as (typeof plainFood)[number];
    for (const food of plainFood) {
        left -= food.weight;
        if (left <= 0) {
            chosen = food;
            break;
        }
    }
    return [{ item: chosen.item, amount: between(random, 1, 2) }];
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
    /** A food sack, which holds a little food by its kind and not the chests' tables. */
    readonly sack?: SackKind;
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
            const sack = stash.isVirtual || stash.levelGuid === "" ? null : sackKindOf(stash.name);
            if (sack !== null) {
                if (!this.around.claimed(stash.levelGuid) && shareOf(stash.levelGuid) < this.settings.sackShare) {
                    this.slots.set(stash.levelGuid, { guid: stash.levelGuid, tier: 1, sack, emptySince: 0, filledAt: 0 });
                }
                continue;
            }
            if (stash.isVirtual || stash.levelGuid === "" || !isTreasureName(stash.name) || this.around.claimed(stash.levelGuid) || shareOf(stash.levelGuid) >= this.share) {
                continue;
            }
            const here = { x: stash.position.x, y: stash.position.y };
            const distance = settlements.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...settlements.map((place) => flat(place, here)));
            this.slots.set(stash.levelGuid, { guid: stash.levelGuid, tier: tierOf(distance, stash.startsLocked === true, this.settings), emptySince: 0, filledAt: 0 });
        }
    }

    /** Puts a roll into a chest, one row at a time so a name the game does not know costs only itself. True when it holds something now. */
    private fill(stash: Stash, slot: Slot): boolean {
        stash.setInventory({ items: [] });
        let held = 0;
        for (const row of slot.sack === undefined ? rollChest(slot.tier, entries(this.gear), this.random) : rollSack(slot.sack, this.random)) {
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
            if (this.fill(stash, slot)) {
                slot.filledAt = now;
                slot.emptySince = 0;
                count += 1;
            }
        }
        this.filled += count;
        return count;
    }

    status(): { enabled: boolean; share: number; chests: number; sacks: number; byTier: Record<Tier, number>; filled: number; refused: string[] } {
        const byTier: Record<Tier, number> = { 1: 0, 2: 0, 3: 0 };
        let sacks = 0;
        for (const slot of this.slots.values()) {
            if (slot.sack === undefined) {
                byTier[slot.tier] += 1;
            } else {
                sacks += 1;
            }
        }
        return { enabled: this.enabled, share: this.share, chests: this.slots.size - sacks, sacks, byTier, filled: this.filled, refused: [...this.refused] };
    }
}

// ---------------------------------------------------------------------------------------------

/** The gear table without any horse tack in it, whatever the data file lists. */
export function withoutTack(gear: Gear): Gear {
    const out: Record<string, Record<string, readonly string[]>> = {};
    for (const [group, byQuality] of Object.entries(gear)) {
        out[group] = Object.fromEntries(Object.entries(byQuality).map(([quality, items]) => [quality, items.filter((item) => !HORSE_TACK.test(item))]));
    }
    return out;
}

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
                return withoutTack(parsed as Gear);
            }
        } catch {
            // Not here; the next place.
        }
    }
    console.log("treasure: data/treasure-gear.json não foi encontrado; os baús não terão armas, armaduras nem roupas");
    return {};
}

/** The places people live or pass, from what this server already knows of the map: the churches, the villages and what belongs to them, the pedlars' camps. */
export function knownSettlements(): Place[] {
    // Imported here, not at the top: vendors and respawn are big modules, and only a running server needs them.
    const respawn = require("./respawn.js") as { CHURCHES: readonly Place[] };
    type Boxed = { minX: number; maxX: number; minY: number; maxY: number };
    const properties = require("./properties.js") as { REGIONS: readonly (Boxed & { wild?: boolean; compounds?: readonly { box: Boxed; wild?: boolean }[] })[] };
    const middle = (box: Boxed): Place => ({ x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 });
    const vendors = require("./vendors.js") as { CAMPS: ReadonlyArray<{ fire: Place }> };
    return [
        ...respawn.CHURCHES.map((church) => ({ x: church.x, y: church.y })),
        // The villages, and the inns and farms that are a property of one (2026-10-26); a camp in the wild (`wild`: the Devil's Den, a place of Minas) is nobody's home.
        ...properties.REGIONS.filter((region) => region.wild !== true).flatMap((region) => [middle(region), ...(region.compounds ?? []).filter((compound) => compound.wild !== true).map((compound) => middle(compound.box))]),
        ...vendors.CAMPS.map((camp) => ({ x: camp.fire.x, y: camp.fire.y })),
    ];
}

export let treasure: Treasure | null = null;

export function installTreasure(claimedBy: (guid: string) => boolean): Treasure {
    const around: Surroundings = {
        settlements: knownSettlements,
        claimed: claimedBy,
        playersNear: (place, radius) => Player.all().some((player) => player.ready && player.alive && (player.virtualWorld === 0 || player.virtualWorld === 0xffffffff) && flat(player.position, place) <= radius),
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
