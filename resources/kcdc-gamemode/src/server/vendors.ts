/**
 * The server's trade NPCs: a smith, an apothecary, a tavern keeper, a hunter and a clothier in Suchdol, at the shops the
 * level places there, a pedlar at each of the level's roadside camps, by the fire, and the bath attendants at the baths the
 * level places them at (soap, perfume and bandages).
 *
 * Each sells what its trade needs and nothing else -- forging materials and the smithing books, herbs and the alchemy
 * books, raw meat, hunting gear, plain clothes, and on the roads the odd things a pedlar carries (spectacles, an eye patch,
 * dice and their badges, a brooch, a rosary) -- on the game's own trade screen, at the game's own price for the item
 * (`Inventory.getItemPrice`) plus a margin, or the book's price. Each also buys the goods of its own trade, and only
 * those (`data/vendor-buys.json`, made from the game's tables by `tools/make-vendor-buys.py`; a pedlar buys trinkets), at a
 * share of what the game says they are worth, out of a purse of 500 coins as the game shows them (user, 2026-10-17). A purse comes back
 * full a day after it was last filled, restarts or not (`playerdata/vendor-purses.json`). They cannot be hurt, and one
 * somehow brought down is back a moment later.
 *
 * The framework forgets NPCs and vendors at every restart, so both are made again from this file a little after the
 * server starts, and their stock is put back every few minutes (a row bought out disappears). Where each one's place is
 * can be changed by an administrator standing at the spot (`/vendedor aqui <id>`); the choice is kept in
 * `playerdata/vendors.json`.
 *
 * Their day: free about their place (user, 2026-10-16: "o correto era deixar eles livres ali na vila e eles mesmos
 * decidirem o que fazem"). A server NPC has none of the game's own life in it -- the framework gives it none -- so this is
 * the little that stands for one: a walk to some spot of walkable ground near their place, a while there, another spot;
 * whoever comes near is looked at and greeted, and the vendor stands for them; at bedtime they walk to their house and go
 * in, and they come out of its door in the morning. No stall animations: the game's seller stances lean on a counter and
 * left them sitting in the air. A pedlar and a bath attendant have no house: they keep to their place, day and night. No name and no health bar
 * float over them, like the level's own townsfolk.
 */

import { BOOKS_BY_ID, bookGuid } from "./books.js";
import { listProperties, releaseNpcHomes, reserveForNpc } from "./properties.js";
import type { PropertyInfo } from "./properties.js";
import { ensureDir, read, write } from "./store.js";
import { placeOf, townsperson } from "./townsfolk.js";

declare function require(id: string): unknown;
declare const __dirname: string | undefined;

const DIR = "playerdata";
const FILE = `${DIR}/vendors.json`;
const PURSES_FILE = `${DIR}/vendor-purses.json`;
const RESOURCE = "kcdc-gamemode";

/** The NPCs appear this long after the server starts, so the level and the navigation mesh are up. */
const SPAWN_AFTER_MS = 12_000;

/** How often the shelves are filled again. */
const RESTOCK_EVERY_MS = 15 * 60_000;

/** What a shop charges over the game's own price for an item. */
const MARKUP = 1.2;

/** What a vendor pays for a player's goods: this share of what the game says they are worth. */
export const BUY_SHARE = 0.35;

/** A vendor's purse, in units of the money item. The game shows a tenth of it, so this reads 500 (it read 5.000 until 2026-10-17). */
export const PURSE = 5_000;

/** A purse comes back full this long after it was last filled. */
export const PURSE_REFILL_MS = 24 * 60 * 60_000;

/** The game takes at most this many rows of buy prices per vendor. */
const MAX_BUY_ROWS = 128;

/**
 * The fire a pedlar sits by, lit by the server (the level's own camp fire burns only in its quest): the first of these
 * the game's particle catalog has. The framework's own example, `fires.campfire_a`, is not in it (the first start said so).
 */
const CAMPFIRES = ["WH_Particels.fires.exterior_fireplace", "WH_Particels.fires.fire_firewood", "WH_Particels.fires.campfire_a"];

export type Trade = "ferreiro" | "alquimista" | "taberneiro" | "cacador" | "alfaiate" | "mascate" | "banhista";
export type VendorId = string;

interface StockLine {
    /** A game item name, or a book's registration id. */
    readonly item: string;
    readonly amount: number;
}

interface VendorDef {
    /** Suchdol's keep the plain trade names their saved places are filed under; the pedlars are `mascate-<n>`, the bath attendants `banho-<n>`. */
    readonly id: VendorId;
    /** The village, or for a pedlar where the camp is. */
    readonly village: string;
    readonly trade: Trade;
    readonly npcName: string;
    readonly soul: "townsman" | "townswoman";
    /** A clothing preset GUID from the game's table, or "" for the soul's own clothes. */
    readonly outfit: string;
    /** Their place: the shop for a vendor, a step from the fire for a pedlar. */
    readonly home: Position;
    /** A pedlar's camp fire, which the server lights. */
    readonly fire?: { readonly x: number; readonly y: number; readonly z: number };
    /** Keeps to their place day and night, with no house: a pedlar (by the fire) and a bath attendant (at the baths). */
    readonly stays?: true;
    /** What a pedlar sells, out of the trinkets (the trade's own list for the others). */
    readonly wares?: readonly StockLine[];
}

export interface Position {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly yaw: number;
}

const books = (...ids: string[]): StockLine[] => ids.map((id) => ({ item: `kcdc:book:${id}`, amount: 5 }));

/** What each trade sells. A pedlar's wares are their own (`TRINKETS`, a few of each kind per camp). */
export const STOCK: Readonly<Record<Exclude<Trade, "mascate">, readonly StockLine[]>> = {
    banhista: [
        { item: "soap", amount: 40 },
        { item: "soap_kcd", amount: 20 },
        ...["perfume_longWeak", "perfume_longWeak_medium", "perfume_longWeak_high", "perfume_shortStrong", "perfume_shortStrong_medium", "perfume_shortStrong_high"].map((item) => ({ item, amount: 6 })),
        { item: "bandage_classic", amount: 40 },
        // O sabão e os perfumes dos banhos, para quem quer fazer os seus (2026-10-17).
        ...books("alquimia-perfumaria"),
    ],
    ferreiro: [
        { item: "bsmt_ironBad", amount: 200 },
        { item: "bsmt_ironGood", amount: 120 },
        { item: "bsmt_steelBad", amount: 100 },
        { item: "bsmt_steelNormal", amount: 60 },
        { item: "bsmt_steelGood", amount: 30 },
        { item: "bsmt_hardware", amount: 120 },
        { item: "bsmt_copper", amount: 30 },
        { item: "bsmt_guardSimple", amount: 30 },
        { item: "bsmt_guardStraight", amount: 20 },
        { item: "bsmt_guardStrong", amount: 15 },
        { item: "bsmt_pommelCoin", amount: 30 },
        { item: "bsmt_pommelPear", amount: 20 },
        { item: "bsmt_pommelEight", amount: 15 },
        { item: "bsmt_pommelDecorated", amount: 10 },
        ...books("ferreiro-machados", "ferreiro-ferraduras", "ferreiro-cacadores", "ferreiro-curtas", "ferreiro-sabres", "ferreiro-longas", "ferreiro-nobres", "ferreiro-raras"),
    ],
    alquimista: [
        ...["belladona", "chamomile", "comfrey", "dandelion", "eyewort", "feverfew", "ginger", "hypericum", "marigold", "mint", "nightshade", "paris", "poppy", "salvia", "thistle", "urticaria", "valerian", "wormwood", "elderberrry"].map((herb) => ({ item: `herb_${herb}`, amount: 80 })),
        { item: "special_charcoal", amount: 60 },
        { item: "special_cobweb", amount: 30 },
        { item: "special_teethBoar", amount: 20 },
        ...books("alquimia-tonicos", "alquimia-vigor", "alquimia-cacador", "alquimia-medicina", "alquimia-perfumaria", "alquimia-venenos", "alquimia-astucia", "alquimia-polvora"),
    ],
    taberneiro: [
        { item: "beef", amount: 60 },
        { item: "pigMeat", amount: 60 },
        { item: "lambMeat", amount: 60 },
        { item: "chicken", amount: 60 },
        // O que o jogo ensina de bebida e de remédio de ressaca (2026-10-17): o taberneiro vende esses receituários.
        ...books("alquimia-tonicos", "alquimia-medicina"),
    ],
    cacador: [
        { item: "bow_b", amount: 6 },
        { item: "bow_b_a", amount: 6 },
        { item: "bow_e_a", amount: 3 },
        { item: "arrow_crude", amount: 200 },
        { item: "arrow_normal", amount: 200 },
        { item: "arrow_hunting", amount: 150 },
        { item: "arrow_enh_hunting", amount: 60 },
        // As poções do caçador, e o vigor para a mata (2026-10-17).
        ...books("alquimia-cacador", "alquimia-vigor"),
    ],
    alfaiate: [
        // Men's and everyday clothes, one colour each; the plain ones cost a few groschen, the good ones more.
        ...["TunicLong01_m01_C", "TunicShort01_m01_D", "TunicLong04_m01_D", "TunicLong02_m01_C", "TunicLong03_m01_D", "TunicShort03_m01_D", "TunicShort06_m01_D", "TunicShort08_m01_C"].map((item) => ({ item, amount: 8 })),
        ...["HoseSeparate01_m01_E", "HoseSeparate05_m01_D", "HoseLoose01_m01_C", "HoseJoined01_m01_C"].map((item) => ({ item, amount: 8 })),
        ...["Shoes01_m01_D", "BootsKnee05_m01_C"].map((item) => ({ item, amount: 8 })),
        ...["Coat04_m01_C", "Coat02_m01_D", "Coat05_m01_C"].map((item) => ({ item, amount: 4 })),
        ...["Cap03_m01_E", "Cap27_m01_D", "Cap12_m01_D", "Cap01_m01_C", "Cap11_m01_D", "Hood01_m01_D"].map((item) => ({ item, amount: 8 })),
        // Women's.
        ...["F_SimpleDress01_m01_D", "F_SimpleDress03_m01_C", "F_SimpleDress04_m01_C", "F_SimpleDress05_m01_C"].map((item) => ({ item, amount: 8 })),
        ...["F_Shoes02_m01_B", "F_Hood01_m01_C", "F_Veil05_m01_D", "Cap16_m01_E"].map((item) => ({ item, amount: 8 })),
    ],
};

/**
 * What the pedlars carry, from the game's own tables: dice and the badges of the dice game, things to wear on the face or
 * the chest, and the odd things of a pedlar's tray. The game has no purse a player may own (its purses are quest items).
 */
export const TRINKETS = {
    dice: ["dieLucky", "dieFavourable", "dieOdd", "dieEven", "dieHolyTrinity", "dieBlue", "dieUnbalanced", "dieBalanced", "dieTeeth_a"],
    badges: ["HeadStartDiceBadgePlumb", "NullDiceBadgePlumb", "MultiplierDiceBadgePlumb", "ExtraDiceBadgePlumb", "RerollDiceBadgePlumb", "SetDiceDiceBadgePlumb", "FormationsDiceBadgePlumb", "DoubleTakeDicebadgePlumb", "AntibustDiceBadgePlumb", "BalatroBadgePlumb"],
    wear: ["Spectacles01_m01", "EyepatchZizka_m01", "brooch_silver", "brooch_brass_inscription", "necklace_tin_cross", "necklace_scapular_saint", "necklace_scapular_window", "ring_silver_engraved"],
    odds: ["loot_comb", "loot_flute", "loot_rosary", "loot_rosary_bone", "loot_necklace_jasperBeads"],
} as const;

/** How many of each kind a camp's pedlar has: a different few at every camp, so each has something the others lack. */
const WARES_PER_CAMP = { dice: 3, badges: 2, wear: 3, odds: 2 } as const;

/** The wares of the camp numbered `index`: plain dice always, then a turn of each list starting where the last camp's left off. */
export function waresOf(index: number): StockLine[] {
    const lines: StockLine[] = [{ item: "dieNormal", amount: 12 }];
    for (const [kind, count] of Object.entries(WARES_PER_CAMP) as Array<[keyof typeof TRINKETS, number]>) {
        const list = TRINKETS[kind];
        for (let step = 0; step < count; step += 1) {
            const item = list[(index * count + step) % list.length]!;
            lines.push({ item, amount: kind === "wear" ? 1 : 2 });
        }
    }
    return lines;
}

/** The shop's name, for the log and the trade screen. */
const TITLES: Readonly<Record<Trade, string>> = { ferreiro: "Ferreiro", alquimista: "Boticário", taberneiro: "Taberneiro", cacador: "Caçador", alfaiate: "Alfaiate", mascate: "Mascate", banhista: "Banhos" };

/**
 * The level's roadside camps (its `taboryUCesty` event places, where the game's own wandering merchants pitch by a fire):
 * the camp, and its fire. Read out of the level's layers (`level.pak`).
 */
export const CAMPS: ReadonlyArray<{ readonly place: string; readonly fire: { x: number; y: number; z: number } }> = [
    { place: "Bohounovice, à beira d'água", fire: { x: 1774.96, y: 3695.96, z: 86.45 } },
    { place: "Bylansko, estrada do campo", fire: { x: 1653.95, y: 828.86, z: 114.42 } },
    { place: "Kuklicko, na clareira", fire: { x: 2527.42, y: 2072.19, z: 140.95 } },
    { place: "Lorec, à beira da estrada", fire: { x: 3669.34, y: 1137.16, z: 59.95 } },
    { place: "Malešov, na mata", fire: { x: 756.7, y: 747.55, z: 112.72 } },
    { place: "Miskovicko, estrada da estalagem", fire: { x: 1895.45, y: 1690.68, z: 128.03 } },
    { place: "Miskovicko, à beira da estrada", fire: { x: 1315.65, y: 1854.82, z: 162.72 } },
    { place: "Rabštejnsko, na mata", fire: { x: 779.02, y: 1285.28, z: 120.73 } },
    { place: "Ratboricko, no campo de feno", fire: { x: 1303.77, y: 3476.68, z: 116.73 } },
    { place: "Rozcestí, na encruzilhada", fire: { x: 1207.27, y: 2992.8, z: 159.6 } },
    { place: "Rozcestí, à beira da estrada", fire: { x: 763.6, y: 2711.38, z: 203.54 } },
    { place: "Stará Kutná, à beira da estrada", fire: { x: 3226.48, y: 1158.52, z: 63.05 } },
    { place: "Zikmundovo, à beira da estrada", fire: { x: 1481.4, y: 2363.35, z: 160.04 } },
];

/**
 * What the game's own wandering merchants wear (`taboryUCesty_shop_*` of `clothing_preset`, by GUID): the pedlars were made with
 * no outfit and stood bare by their fires (user, 2026-10-17). Men: jacob, karol, kramar, mikula, stork, henslin, elbel, andreas,
 * vencl, and the dealers ibrahim and baltazar (stork, henslin and andreas are not in the server's build); women: kramar 1 and 2, karol, jacob, mikula, elbel and henslin's wife.
 */
const PEDLAR_OUTFITS: Readonly<Record<"townsman" | "townswoman", readonly string[]>> = {
    townsman: [
        "1e585153-9e41-4a73-811d-75330812d5a4",
        "2f2a13d4-13eb-4a25-9f56-3f867a6ee8ae",
        "7c39b61f-2088-41c7-b8fd-b7ec6547dc51",
        "3ef9b082-8442-42b6-b6e4-cefbdb0b292f",
        "37063c28-e402-4dca-9112-499a9f25c3f1",
        "3738282c-f9a1-4b59-8e32-9996cdd17908",
        "8595f243-3ab1-4a2a-bf4a-ad29a523ed7f",
        "6bbb366c-d57e-40ae-ba06-39a48cae43d9",
    ],
    townswoman: [
        "b7694961-6673-4a95-8bf0-fb4700a0f74d",
        "172e4b48-86f1-4666-9e58-7a286b1730b3",
        "205785e2-d357-49df-a6e6-4a861b6f6de2",
        "0708606c-5104-4056-8185-3c17acab3c95",
        "0cc353f1-a33c-48eb-ad1d-c71cf43a0a91",
        "901a3804-f2bc-468e-b00d-2042fc777ff5",
        "fd6f8a1c-6858-4782-ab31-8036368e9f9d",
    ],
};

/** The bath maids' and abbesses' presets (`f_bathmaid_01...16`, `f_bathhouseAbbess_01...08`), by GUID. */
const BATH_MAIDS: readonly string[] = [
    "298386c4-69d9-42de-9e1f-f294039372e5",
    "dd915fff-4d37-4362-a4b9-945db98e4bd3",
    "0e81d83d-f27f-4384-bb88-75d4a32e67d9",
    "405614af-a376-486e-bc0d-1e1c89e3f8f4",
    "c5a7de75-5a64-4cbd-ab28-91474059e33c",
    "caaa9b97-33ed-47f9-a8f0-e0e02a2cc0ea",
    "55c002c9-34ac-41f5-86b6-13682159036f",
    "930c35b2-82c3-4cc5-baf7-ed5e73ce3518",
];
const BATH_ABBESSES: readonly string[] = [
    "0dbb0248-9d50-417a-93ec-a473e23223d2",
    "f5a02212-338c-4576-b571-619dbc3316f0",
    "7671a55c-3ea0-48b5-8a45-45bc326271f6",
    "346cf06c-3862-4e5e-ab18-fcb1c3db71a4",
];

/** The outfit of the pedlar at camp `index`: men and women each go through their own list in turn. */
const pedlarOutfit = (index: number): string => {
    const woman = index % 3 === 2;
    const pool = PEDLAR_OUTFITS[woman ? "townswoman" : "townsman"];
    const turn = woman ? Math.floor(index / 3) : index - Math.floor((index + 1) / 3);
    return pool[turn % pool.length] as string;
};

/** A pedlar for each camp, a couple of steps from the fire; every third one a woman. */
const PEDLARS: readonly VendorDef[] = CAMPS.map((camp, index) => ({
    id: `mascate-${index + 1}`,
    village: camp.place,
    trade: "mascate",
    npcName: index % 3 === 2 ? "Bufarinheira" : "Mascate",
    soul: index % 3 === 2 ? "townswoman" : "townsman",
    outfit: pedlarOutfit(index),
    home: { x: camp.fire.x + 2.5, y: camp.fire.y, z: camp.fire.z, yaw: 270 },
    fire: camp.fire,
    stays: true,
    wares: waresOf(index),
}));

/**
 * The people who serve at the baths the level has (user, 2026-10-16: "ative os NPC de banho"): where its own bath maids and
 * bathhouse abbesses stand (`kgru_bathmaid`, `kzik_bathmaid`, `kzik_bathhouseAbess`, `kkut_betasBathmaid_1`,
 * `kkut_spaAdministrator`, `ksuc_bathhouseAbess_1`), and at Malešov, where the level has the tubs and its washerwomen
 * (`kmal_woman_18`). Their trade is what the baths sell: soap, perfume and bandages. They cannot wash a player (the dirt is
 * the game's own and the server cannot touch it): a bar of soap bought here is used from the inventory, in any water.
 */
const BATHS: ReadonlyArray<{ readonly village: string; readonly name: string; readonly x: number; readonly y: number; readonly z: number }> = [
    { village: "Suchdol", name: "Dona dos Banhos", x: 740.83, y: 3347.75, z: 142.12 },
    { village: "Zikmundovo", name: "Dona dos Banhos", x: 1739.89, y: 2805.59, z: 173.4 },
    { village: "Zikmundovo", name: "Banhista", x: 1738.97, y: 2804.82, z: 173.5 },
    { village: "Grunta", name: "Banhista", x: 3207.82, y: 2167.72, z: 94.55 },
    { village: "Grunta", name: "Banhista", x: 3210.27, y: 2166.73, z: 94.48 },
    { village: "Kuttenberg", name: "Administradora dos Banhos", x: 3083.38, y: 465.48, z: 35.58 },
    { village: "Kuttenberg", name: "Banhista", x: 3082.1, y: 465.73, z: 35.49 },
    { village: "Malešov", name: "Banhista", x: 564.33, y: 255.81, z: 109.7 },
];

const ATTENDANTS: readonly VendorDef[] = BATHS.map((bath, index) => ({
    id: `banho-${index + 1}`,
    village: bath.village,
    trade: "banhista",
    npcName: bath.name,
    soul: "townswoman",
    outfit: (/Dona|Administradora/.test(bath.name) ? BATH_ABBESSES : BATH_MAIDS)[index % (/Dona|Administradora/.test(bath.name) ? BATH_ABBESSES.length : BATH_MAIDS.length)] as string,
    home: { x: bath.x, y: bath.y, z: bath.z, yaw: 0 },
    stays: true,
}));

/**
 * The vendors stand where the level has a shop of their trade (its `Shop` entities): Suchdol's tavern and village
 * smithy, and its two market stalls; the clothier between them. The pedlars keep to the roadside camps.
 */
export const VENDORS: VendorDef[] = [
    // Suchdol, at the shops the level itself places.
    { id: "ferreiro", village: "Suchdol", trade: "ferreiro", npcName: "Mestre Ferreiro", soul: "townsman", outfit: "12468c7d-7ab1-4afc-b102-b0e74c144e8c", home: { x: 662.34, y: 3258.94, z: 145.39, yaw: 0 } }, // blacksmith_01
    { id: "alquimista", village: "Suchdol", trade: "alquimista", npcName: "Boticário", soul: "townsman", outfit: "6d7407c7-7504-4432-9695-01567ffed4a6", home: { x: 612.3, y: 3285.57, z: 146.02, yaw: 0 } }, // alchemist_01
    { id: "taberneiro", village: "Suchdol", trade: "taberneiro", npcName: "Taberneiro", soul: "townsman", outfit: "9084ce28-b604-411a-9a7e-f3750a27a5b0", home: { x: 604.01, y: 3277.69, z: 146.74, yaw: 0 } }, // innkeeper_03
    { id: "cacador", village: "Suchdol", trade: "cacador", npcName: "Mestre Caçador", soul: "townsman", outfit: "54cec4c4-ad5a-4d48-8bad-5c98b528b0b0", home: { x: 577.06, y: 3275.52, z: 147.28, yaw: 0 } }, // tvid_huntsman
    { id: "alfaiate", village: "Suchdol", trade: "alfaiate", npcName: "Costureira", soul: "townswoman", outfit: "", home: { x: 590.5, y: 3276.6, z: 147.0, yaw: 0 } },
    ...PEDLARS,
    ...ATTENDANTS,
];

// ---------------------------------------------------------------------------------------------
// The other villages (user, 2026-10-17: "adicionar, em cada vila já mapeada, ferreiro, taverneiro e alquimista, cada um com
// uma residência e um ciclo de vida"). Until then only Suchdol had them, at the shops the level places; the other villages have
// no shop of the game's, so these stand outside a house of the village and keep the same day (`liveDay`): about the place by
// day, greeting whoever comes near, and home to bed at night. A village is a mapped region of the property catalog with at
// least three houses of the census ("Casa 01"...); Suchdol has its own.

/** The trades each village gets, and the Suchdol vendor whose outfit and name they take. */
const VILLAGE_TRADES: readonly Trade[] = ["ferreiro", "alquimista", "taberneiro"];

/** Houses a village's tavern keeper is known to keep, by the level's own innkeeper (Malešov's `kmal_innkeeper` stands at its tavern by 601, 279). */
const TAVERN_HINTS: Readonly<Record<string, string>> = { "Malešov": "malesov-casa-06" };

/** How many census houses make a village. */
export const VILLAGE_MIN_HOUSES = 3;

/** What a village vendor's id ends in: the village's name, plain. */
const slug = (text: string): string => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** The ids of the village vendors added, so a second start of the list takes them out first. */
let villageIds: string[] = [];

/**
 * A spot just outside the entrance of a house: walkable ground a few metres from its door that is not inside the building, and
 * the way to face the door from it. Falls back to the door's own place when nothing around it qualifies.
 */
export function outsideDoor(property: PropertyInfo): Position {
    const door = property.doorGuid === "" ? null : Door.find(property.doorGuid);
    const origin = door !== null ? door.position : { x: property.x, y: property.y, z: property.z };
    const areas = door !== null ? door.areas : [];
    const facing = (from: { x: number; y: number }): number => (Math.atan2(-(origin.x - from.x), origin.y - from.y) * 180) / Math.PI;
    for (const radius of [2.5, 3.5, 5]) {
        for (let bearing = 0; bearing < 12; bearing += 1) {
            const angle = (bearing / 12) * 2 * Math.PI;
            const raw = new Vector3(origin.x + Math.cos(angle) * radius, origin.y + Math.sin(angle) * radius, origin.z);
            const spot = placeOf(raw);
            if (Navigation.ready && flat(spot, raw) > 1.5) {
                continue;
            }
            if (areas.some((area) => area.contains(spot))) {
                continue;
            }
            return { x: spot.x, y: spot.y, z: spot.z, yaw: facing(spot) };
        }
    }
    return { x: origin.x, y: origin.y, z: origin.z, yaw: 0 };
}

/**
 * The village vendors a catalog calls for: for each village, a smith, an apothecary and a tavern keeper, each standing outside
 * a house of the village that is free (nobody owns it, no vendor took it), the nearest to the middle of the village first, the
 * tavern keeper at the house the level's own innkeeper stands by where it is known. A vendor with no free house left stands
 * outside one that is somebody's: they have no home to go to, and keep their place night and day.
 */
export function villageVendors(catalog: readonly PropertyInfo[], standAt: (property: PropertyInfo) => Position = outsideDoor): VendorDef[] {
    const made: VendorDef[] = [];
    const regions = [...new Set(catalog.map((property) => property.region))].filter((region) => region !== "Suchdol");
    for (const village of regions.sort((a, b) => a.localeCompare(b, "pt"))) {
        const houses = catalog.filter((property) => property.region === village && property.kind === "house" && property.parentId === "" && /^Casa\b/i.test(property.name));
        if (houses.length < VILLAGE_MIN_HOUSES) {
            continue;
        }
        const middle = { x: houses.reduce((sum, house) => sum + house.x, 0) / houses.length, y: houses.reduce((sum, house) => sum + house.y, 0) / houses.length };
        const byMiddle = (a: PropertyInfo, b: PropertyInfo): number => flat(a, middle) - flat(b, middle) || a.id.localeCompare(b.id);
        const free = houses.filter((house) => house.ownerSteamId === "" && house.npc === undefined).sort(byMiddle);
        const owned = houses.filter((house) => !free.includes(house)).sort(byMiddle);
        const taken = new Set<string>();
        VILLAGE_TRADES.forEach((trade, index) => {
            const model = VENDORS.find((def) => def.id === trade && def.village === "Suchdol");
            if (model === undefined) {
                return;
            }
            const hint = trade === "taberneiro" ? free.find((house) => house.id === TAVERN_HINTS[village]) : undefined;
            const house = hint ?? free.find((candidate) => !taken.has(candidate.id)) ?? null;
            if (house !== null) {
                taken.add(house.id);
            }
            const beside = house ?? owned[index % Math.max(1, owned.length)] ?? free[index % Math.max(1, free.length)] ?? houses[0]!;
            const spot = standAt(beside);
            made.push({
                id: `${trade}-${slug(village)}`,
                village,
                trade,
                npcName: model.npcName,
                soul: model.soul,
                outfit: model.outfit,
                home: spot,
                // No house to go to: they keep to their place.
                ...(house === null ? { stays: true as const } : {}),
            });
        });
    }
    return made;
}

/** Puts the village vendors of the catalog into the list, in place of those a former call put there. */
export function addVillageVendors(): number {
    for (const id of villageIds) {
        const at = VENDORS.findIndex((def) => def.id === id);
        if (at >= 0) {
            VENDORS.splice(at, 1);
        }
    }
    let catalog: readonly PropertyInfo[] = [];
    try {
        catalog = listProperties();
    } catch {
        catalog = [];
    }
    const added = villageVendors(catalog);
    VENDORS.push(...added);
    villageIds = added.map((def) => def.id);
    return added.length;
}

/** What a vendor's house is called once it is theirs (only a house that still has the census's name is renamed). */
function homeNameOf(def: VendorDef): string {
    const names: Readonly<Record<Trade, string>> = {
        ferreiro: "Casa do Ferreiro",
        alquimista: "Casa do Boticário",
        taberneiro: `Taverna de ${def.village}`,
        cacador: "Casa do Caçador",
        alfaiate: "Casa da Costureira",
        mascate: "",
        banhista: "",
    };
    return names[def.trade];
}

interface Live {
    /** The vendor's body, or 0 while they sleep at home. */
    npcId: number;
    vendor: number;
}

const live = new Map<VendorId, Live>();
const byNpc = new Map<number, VendorId>();
const byVendor = new Map<number, VendorId>();
const fires: Vfx[] = [];
let chosen: Partial<Record<VendorId, Position>> = {};

function defOf(id: VendorId): VendorDef | undefined {
    return VENDORS.find((def) => def.id === id);
}

function homeOf(def: VendorDef): Position {
    return chosen[def.id] ?? def.home;
}

function loadChosen(): void {
    const loaded = read<Record<string, Position>>(FILE);
    if (loaded.status !== "ok") {
        return;
    }
    for (const def of VENDORS) {
        const spot = loaded.value[def.id];
        if (spot && [spot.x, spot.y, spot.z, spot.yaw].every((value) => typeof value === "number" && Number.isFinite(value))) {
            chosen[def.id] = spot;
        }
    }
}

function saveChosen(): void {
    ensureDir(DIR);
    write(FILE, chosen);
}

/** The stock rows a vendor sells now, priced. An item the game does not know is left out and said once. */
function stockFor(def: VendorDef): VendorStockRow[] {
    const rows: VendorStockRow[] = [];
    for (const line of def.wares ?? (def.trade === "mascate" ? [] : STOCK[def.trade])) {
        const book = BOOKS_BY_ID.get(line.item);
        if (book !== undefined) {
            const guid = bookGuid(book.id);
            if (guid !== null) {
                rows.push({ item: guid, amount: line.amount, price: book.price });
            }
            continue;
        }
        const worth = Inventory.getItemPrice(line.item);
        if (worth === null) {
            console.log(`vendors: ${def.id}: o item '${line.item}' não existe neste servidor; ficou fora da loja`);
            continue;
        }
        rows.push({ item: line.item, amount: line.amount, price: Math.max(1, Math.round(worth.pristine * MARKUP)) });
    }
    return rows;
}

// ---------------------------------------------------------------------------------------------
// What they buy, and the purse they pay out of.

let buyLists: Partial<Record<Trade, readonly string[]>> | null = null;

/** The goods each trade buys, from `data/vendor-buys.json` (server-only, like `data/item-names.json`); a pedlar buys trinkets. */
function loadBuyLists(): Partial<Record<Trade, readonly string[]>> {
    if (buyLists !== null) {
        return buyLists;
    }
    buyLists = { mascate: Object.values(TRINKETS).flat(), banhista: STOCK.banhista.filter((line) => !BOOKS_BY_ID.has(line.item)).map((line) => line.item) };
    const fs = require("node:fs") as { readFileSync(path: string, encoding: "utf8"): string };
    const places = [typeof __dirname === "string" ? `${__dirname}/../../data/vendor-buys.json` : "", "resources/kcdc-gamemode/data/vendor-buys.json", "data/vendor-buys.json"];
    for (const place of places) {
        if (place === "") {
            continue;
        }
        try {
            const parsed = JSON.parse(fs.readFileSync(place, "utf8")) as unknown;
            if (typeof parsed === "object" && parsed !== null) {
                for (const [trade, names] of Object.entries(parsed as Record<string, unknown>)) {
                    if (Array.isArray(names)) {
                        buyLists[trade as Trade] = names.filter((name): name is string => typeof name === "string");
                    }
                }
                return buyLists;
            }
        } catch {
            // Not here; the next place.
        }
    }
    console.log("vendors: data/vendor-buys.json não foi encontrado; os vendedores da vila não compram nada");
    return buyLists;
}

/** What a vendor pays for each of its trade's goods: a share of the game's own worth, the item's first 128 kinds. */
export function buyRowsFor(trade: Trade): VendorBuyRow[] {
    const rows: VendorBuyRow[] = [];
    for (const item of loadBuyLists()[trade] ?? []) {
        const worth = Inventory.getItemPrice(item);
        if (worth === null) {
            continue;
        }
        rows.push({ item, price: Math.max(1, Math.round(worth.pristine * BUY_SHARE)) });
        if (rows.length === MAX_BUY_ROWS) {
            break;
        }
    }
    return rows;
}

interface PurseState {
    purse: number;
    refilledAt: number;
}

let purses: Record<VendorId, PurseState> = {};
let purseSave: ReturnType<typeof setTimeout> | null = null;

function loadPurses(): void {
    const loaded = read<Record<string, PurseState>>(PURSES_FILE);
    if (loaded.status !== "ok") {
        return;
    }
    for (const [id, state] of Object.entries(loaded.value)) {
        if (state && typeof state.purse === "number" && Number.isFinite(state.purse) && typeof state.refilledAt === "number") {
            // A purse saved when the purse was bigger comes down to the new one.
            purses[id] = { purse: Math.min(PURSE, Math.max(0, Math.round(state.purse))), refilledAt: state.refilledAt };
        }
    }
}

function savePursesSoon(): void {
    if (purseSave !== null) {
        return;
    }
    purseSave = setTimeout(() => {
        purseSave = null;
        try {
            ensureDir(DIR);
            write(PURSES_FILE, purses);
        } catch (error: unknown) {
            console.log(`vendors: não consegui gravar ${PURSES_FILE}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, 3_000);
}

/** The purse a vendor opens with: what was left in it, unless a day has passed since it was filled. */
function purseFor(id: VendorId, now: number): number {
    const state = purses[id];
    if (state !== undefined && now - state.refilledAt < PURSE_REFILL_MS) {
        return state.purse;
    }
    purses[id] = { purse: PURSE, refilledAt: now };
    savePursesSoon();
    return PURSE;
}

/** A day after its last filling, a purse is full again. */
export function refillPurses(now: number = Date.now()): number {
    let refilled = 0;
    for (const def of VENDORS) {
        const entry = live.get(def.id);
        const state = purses[def.id];
        if (entry === undefined || state === undefined || now - state.refilledAt < PURSE_REFILL_MS) {
            continue;
        }
        purses[def.id] = { purse: PURSE, refilledAt: now };
        Vendor.setPurse(entry.vendor, PURSE);
        refilled += 1;
    }
    if (refilled > 0) {
        savePursesSoon();
    }
    return refilled;
}

/** A deal changes what is in the purse: kept, so a restart does not fill it early. */
function traded(vendor: number): void {
    const id = byVendor.get(vendor);
    const state = id === undefined ? undefined : purses[id];
    const purse = Vendor.getPurse(vendor);
    if (state === undefined || purse === null) {
        return;
    }
    state.purse = purse;
    savePursesSoon();
}

// ---------------------------------------------------------------------------------------------
// A vendor's day.

/** Hours by the game's clock: about from `open`, home from `bed` until `open`. */
export interface Hours {
    readonly open: number;
    readonly bed: number;
}

export const DAY_HOURS: Hours = { open: 6, bed: 22 };

/** The tavern opens late and goes to bed with the village. */
export const TAVERN_HOURS: Hours = { open: 9, bed: 22 };

export type Phase = "day" | "night";

export function phaseAt(hours: Hours, hour: number): Phase {
    const h = ((hour % 24) + 24) % 24;
    return h >= hours.open && h < hours.bed ? "day" : "night";
}

export const vendorLife = {
    tickMs: 2_000,
    /** About the village: they walk to walkable ground this far from their place at most (a pedlar, this far from the fire). */
    roamM: 30,
    campRoamM: 10,
    /** And stay a short while at each spot (user, 2026-10-17: "estão muito sem vida"). */
    pauseMs: 6_000,
    pauseJitterMs: 14_000,
    /** A customer this close is looked at, greeted once in a while, and has the vendor stand for them. */
    greetM: 5,
    greetAgainMs: 10 * 60_000,
    lookAgainMs: 4_000,
    /** A home is an empty house of the village this close to their place. */
    homeRadius: 250,
    arriveM: 2,
    /** A walk home that does not get there in this long is finished in one step; with nobody near, after a few seconds. */
    walkTimeoutMs: 180_000,
    unseenAfterMs: 20_000,
    unseenM: 80,
    /** A body that somehow falls is back after this. */
    reviveMs: 10_000,
};

/** The emote wheel's greetings (docs: Resources/animation-props.md). */
const GREETINGS = ["nod", "waveSmall", "nodSubmissive"];

/** What each trade calls out to a customer. */
const PITCH: Readonly<Record<Trade, readonly string[]>> = {
    ferreiro: ["Ferro e aço da melhor qualidade.", "Precisa de uma lâmina afiada?", "Ferraduras, guardas e pomos, é só escolher."],
    alquimista: ["Ervas frescas e poções, viajante.", "Um remédio para cada mal.", "Colhidas hoje de manhã."],
    taberneiro: ["Carne fresca para a sua panela!", "Fome? Tenho do que você precisa.", "Bebida e carne, a bom preço."],
    cacador: ["Flechas, arcos e o que mais a caça pedir.", "A floresta anda cheia de caça.", "Traga peles e carne, que eu compro."],
    alfaiate: ["Roupas boas e baratas, venha ver!", "Um pano que dura, para o inverno.", "Tenho do simples ao de festa."],
    mascate: ["Chegue perto do fogo, viajante. Tenho coisas que não se acham na vila.", "Dados, insígnias, uns óculos... olhe à vontade.", "Coisas de longe, a bom preço."],
    banhista: ["Sabão e perfume, para quem quer chegar limpo.", "Um banho faz bem a quem anda na estrada. Leve um sabão.", "Perfume de menta ou de leão, e ataduras também."],
};

function greetingWord(hour: number): string {
    const h = ((hour % 24) + 24) % 24;
    return h >= 5 && h < 12 ? "Bom dia!" : h >= 12 && h < 19 ? "Boa tarde!" : "Boa noite!";
}

type Mode = "about" | "home" | "asleep";

interface Day {
    mode: Mode;
    /** Where they are walking to, or null while they stand. */
    target: Vector3 | null;
    started: number;
    /** Walks home that came back blocked. */
    tries: number;
    /** The next walk about. */
    next: number;
    lookingAt: number;
    lookedAt: number;
    readonly greeted: Map<number, number>;
    house: PropertyInfo | null;
}

const days = new Map<VendorId, Day>();

const newDay = (): Day => ({ mode: "about", target: null, started: 0, tries: 0, next: 0, lookingAt: 0, lookedAt: 0, greeted: new Map(), house: null });

function hoursOf(def: VendorDef): Hours {
    return def.trade === "taberneiro" ? TAVERN_HOURS : DAY_HOURS;
}

const flat = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);
const between = (base: number, jitter: number): number => base + Math.random() * jitter;

/** The vendor's body, made where it is asked for. */
function makeBody(def: VendorDef, position: Vector3, yaw: number): Npc {
    return townsperson(def.soul, def.npcName, position, yaw, def.outfit);
}

/** Takes the vendor's body out of the world (for the night, or to make it again), keeping the shop. */
function dropBody(id: VendorId): void {
    const entry = live.get(id);
    if (entry === undefined || entry.npcId === 0) {
        return;
    }
    byNpc.delete(entry.npcId);
    Npc.getById(entry.npcId)?.remove();
    entry.npcId = 0;
}

function giveBody(def: VendorDef, position: Vector3, yaw: number): Npc | null {
    const entry = live.get(def.id);
    if (entry === undefined) {
        return null;
    }
    dropBody(def.id);
    const npc = makeBody(def, position, yaw);
    entry.npcId = npc.id;
    byNpc.set(npc.id, def.id);
    return npc;
}

/**
 * An empty house of the village near their place for each vendor: the tavern for its keeper when there is one, otherwise
 * the nearest house that nobody owns and no other vendor took. A house given to a player since is given up, and another
 * found. A pedlar and a bath attendant keep to their place and have none.
 */
function findHomes(): void {
    const taken = new Set<string>();
    let catalog: readonly PropertyInfo[] = [];
    try {
        catalog = listProperties();
    } catch {
        catalog = [];
    }
    // A vendor goes back to the house that is already theirs in the catalog, wherever their place is now.
    const reserved = (def: VendorDef): PropertyInfo | undefined =>
        catalog.find((property) => property.npc === def.npcName && property.kind === "house" && property.parentId === "" && property.ownerSteamId === "" && property.region === def.village);
    for (const def of VENDORS) {
        const day = days.get(def.id);
        if (day === undefined || def.stays === true) {
            continue;
        }
        const stall = homeOf(def);
        const free = (property: PropertyInfo): boolean =>
            property.kind === "house" && property.parentId === "" && property.ownerSteamId === "" && property.region === def.village && !taken.has(property.id) && flat(property, stall) <= vendorLife.homeRadius;
        const current = day.house;
        const keep = reserved(def) ?? (current !== null ? (catalog.find((property) => property.id === current.id && free(property)) ?? null) : null);
        const byDistance = (a: PropertyInfo, b: PropertyInfo): number => flat(a, stall) - flat(b, stall);
        const tavern = def.trade === "taberneiro" ? catalog.filter((property) => free(property) && /taverna/i.test(property.name)).sort(byDistance)[0] : undefined;
        const house = keep ?? tavern ?? catalog.filter((property) => free(property) && /^casa\b/i.test(property.name)).sort(byDistance)[0] ?? null;
        day.house = house;
        if (house !== null) {
            taken.add(house.id);
            // Theirs in the catalog: named for them, and never given to a player (properties.ts).
            try {
                reserveForNpc(house.id, def.npcName, homeNameOf(def));
            } catch (error: unknown) {
                console.error(`vendors: a casa de ${def.npcName} não pôde ser marcada: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    // The houses as the catalog has them now: a house that was just named for its vendor goes by that name.
    try {
        const fresh = listProperties();
        for (const def of VENDORS) {
            const day = days.get(def.id);
            const kept = day?.house ?? null;
            if (day !== undefined && kept !== null) {
                day.house = fresh.find((property) => property.id === kept.id) ?? kept;
            }
        }
    } catch {
        // The catalog went away: the houses found a moment ago are still right.
    }
    try {
        const released = releaseNpcHomes(taken);
        if (released > 0) {
            console.log(`vendors: ${released} casa(s) de vendedores que não moram mais nelas voltaram a ficar livres`);
        }
    } catch {
        // The catalog is not there: nothing was kept for anybody.
    }
}

function playersNear(point: { x: number; y: number }, radius: number): Player[] {
    return Player.all().filter((player) => player.ready && player.virtualWorld === 0 && flat(player.position, point) < radius);
}

/** Walks the vendor there along a route the server plans around walls and houses. */
function walkTo(npc: Npc, day: Day, target: Vector3, now: number): void {
    day.target = target;
    day.started = now;
    day.tries = 0;
    npc.moveTo(target, { speed: "walk", radius: 1.5, pathfinding: Navigation.ready ? "server" : "game" });
}

/** Stands still where they are, and takes their time before the next walk. */
function standAround(day: Day, now: number): void {
    day.target = null;
    day.next = now + between(vendorLife.pauseMs, vendorLife.pauseJitterMs);
}

/** About their place: a walk to some spot of walkable ground near it, a while there, another spot. */
function stroll(def: VendorDef, npc: Npc, day: Day, now: number): void {
    const radius = def.stays === true ? vendorLife.campRoamM : vendorLife.roamM;
    const spot = Navigation.ready ? Navigation.randomPoint(placeOf(homeOf(def)), radius, { doors: "none" }) : null;
    if (spot === null) {
        standAround(day, now);
        return;
    }
    walkTo(npc, day, spot, now);
}

/** Whoever comes near is looked at, greeted once in a while, and has the vendor stand for them. */
function attend(def: VendorDef, npc: Npc, day: Day, customer: Player, now: number): void {
    if (day.target !== null) {
        npc.hold();
    }
    standAround(day, now);
    if (day.lookingAt !== customer.id || now - day.lookedAt >= vendorLife.lookAgainMs) {
        npc.lookAt(customer);
        day.lookingAt = customer.id;
        day.lookedAt = now;
    }
    if (now - (day.greeted.get(customer.id) ?? Number.NEGATIVE_INFINITY) >= vendorLife.greetAgainMs) {
        day.greeted.set(customer.id, now);
        npc.playAnimation("GreetingsUpperBody", { tags: GREETINGS[Math.floor(Math.random() * GREETINGS.length)] });
        const pitch = PITCH[def.trade];
        npc.say(`${greetingWord(World.hour)} ${pitch[Math.floor(Math.random() * pitch.length)]}`);
    }
}

/** Whether a walk home is over by time: long enough, or long enough with nobody near to see it finish. */
function overdue(npc: Npc, day: Day, now: number): boolean {
    if (day.target === null || now - day.started >= vendorLife.walkTimeoutMs) {
        return true;
    }
    return now - day.started >= vendorLife.unseenAfterMs && playersNear(npc.position, vendorLife.unseenM).length === 0 && playersNear(day.target, vendorLife.unseenM).length === 0;
}

/** At the door: in, to bed. */
function goIn(def: VendorDef, day: Day): void {
    dropBody(def.id);
    day.mode = "asleep";
    day.target = null;
}

/** What a vendor's game reported about their last order. */
export function intentDone(npcId: number, status: string, now: number = Date.now()): void {
    const id = byNpc.get(npcId);
    const def = id === undefined ? undefined : defOf(id);
    const day = id === undefined ? undefined : days.get(id);
    const npc = Npc.getById(npcId);
    if (def === undefined || day === undefined || npc === null || day.target === null) {
        return;
    }
    if (day.mode === "about") {
        // There, or not: either way a while here, and then another spot.
        standAround(day, now);
        return;
    }
    if (status === "reached") {
        goIn(def, day);
        return;
    }
    // The way home blocked: once more by the game's own steering, and then the rest of the way in one step.
    day.tries += 1;
    if (day.tries < 2) {
        npc.moveTo(day.target, { speed: "walk", radius: 1.5, pathfinding: "game" });
        return;
    }
    goIn(def, day);
}

/** One step of every vendor's day. */
export function liveDay(now: number = Date.now()): void {
    for (const def of VENDORS) {
        const entry = live.get(def.id);
        const day = days.get(def.id);
        if (entry === undefined || day === undefined) {
            continue;
        }
        const phase = phaseAt(hoursOf(def), World.hour);

        if (day.mode === "asleep") {
            if (phase === "day" || day.house === null) {
                // Morning: out of the door, or at their place when they have no house.
                const body = giveBody(def, day.house === null ? placeOf(homeOf(def)) : placeOf(day.house), homeOf(def).yaw);
                if (body !== null) {
                    day.mode = "about";
                    day.next = now + between(2_000, 4_000);
                }
            }
            continue;
        }
        const npc = entry.npcId === 0 ? null : Npc.getById(entry.npcId);
        if (npc === null) {
            continue;
        }

        if (day.mode === "home") {
            if (overdue(npc, day, now)) {
                goIn(def, day);
            }
            continue;
        }
        if (phase === "night" && day.house !== null) {
            day.mode = "home";
            walkTo(npc, day, placeOf(day.house), now);
            continue;
        }

        const customer = playersNear(npc.position, vendorLife.greetM).sort((a, b) => flat(a.position, npc.position) - flat(b.position, npc.position))[0];
        if (customer !== undefined) {
            attend(def, npc, day, customer, now);
            continue;
        }
        day.lookingAt = 0;
        if (day.target !== null && now - day.started >= vendorLife.walkTimeoutMs) {
            standAround(day, now);
        }
        if (day.target === null && now >= day.next) {
            stroll(def, npc, day, now);
        }
    }
}

/** A vendor and their shop, made again: at their place by day (a pedlar, always), at home (not in the world) at night. */
function spawnOne(def: VendorDef): void {
    const old = live.get(def.id);
    if (old !== undefined) {
        dropBody(def.id);
        byVendor.delete(old.vendor);
        Vendor.destroy(old.vendor);
        live.delete(def.id);
    }

    const vendor = Vendor.create({ name: `${TITLES[def.trade]} (${def.village})`, purse: purseFor(def.id, Date.now()), buys: true });
    Vendor.setStock(vendor, stockFor(def));
    const buying = buyRowsFor(def.trade);
    if (!Vendor.setBuyPrices(vendor, buying)) {
        console.log(`vendors: ${def.id}: o jogo recusou a lista de ${buying.length} itens que ele compra`);
    }
    live.set(def.id, { npcId: 0, vendor });
    byVendor.set(vendor, def.id);

    const day = days.get(def.id) ?? newDay();
    days.set(def.id, day);
    if (phaseAt(hoursOf(def), World.hour) === "night" && day.house !== null) {
        day.mode = "asleep";
        return;
    }
    if (giveBody(def, placeOf(homeOf(def)), homeOf(def).yaw) !== null) {
        day.mode = "about";
        standAround(day, Date.now());
    }
}

/** The pedlars' fires, lit where the level has a camp fire. */
function lightFires(): void {
    const known = new Set(Vfx.list("WH_Particels.fires"));
    const effect = CAMPFIRES.find((name) => known.has(name));
    if (effect === undefined) {
        console.log(`vendors: nenhuma fogueira do catálogo de partículas serve; o catálogo tem ${[...known].join(", ")}`);
        return;
    }
    for (const def of VENDORS) {
        if (def.fire === undefined) {
            continue;
        }
        try {
            fires.push(Vfx.spawn(effect, new Vector3(def.fire.x, def.fire.y, def.fire.z), { prime: true }));
        } catch (error: unknown) {
            console.log(`vendors: a fogueira de ${def.village} não acendeu: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

function spawnAll(): void {
    try {
        const added = addVillageVendors();
        console.log(`vendors: ${added} vendedor(es) de vilas (ferreiro, boticário e taberneiro de cada uma): ${villageIds.join(", ") || "nenhuma vila com casas suficientes"}`);
    } catch (error: unknown) {
        console.error(`vendors: não consegui montar os vendedores das vilas: ${error instanceof Error ? error.message : String(error)}`);
    }
    for (const def of VENDORS) {
        days.set(def.id, days.get(def.id) ?? newDay());
    }
    findHomes();
    for (const def of VENDORS) {
        try {
            spawnOne(def);
        } catch (error: unknown) {
            console.error(`vendors: não consegui criar ${def.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    if (fires.length === 0) {
        lightFires();
    }
    for (const village of new Set(VENDORS.filter((def) => def.stays !== true).map((def) => def.village))) {
        const villagers = VENDORS.filter((def) => def.village === village && def.stays !== true);
        const homes = villagers.map((def) => `${def.trade} ${days.get(def.id)?.house?.name ?? "sem casa"}`).join(", ");
        console.log(`vendors: ${village}: ${villagers.filter((def) => live.has(def.id)).length} vendedores; casas: ${homes}`);
    }
    console.log(`vendors: ${PEDLARS.filter((def) => live.has(def.id)).length} mascate(s) nas fogueiras de beira de estrada, ${fires.length} fogueira(s) acesa(s)`);
    console.log(`vendors: ${ATTENDANTS.filter((def) => live.has(def.id)).length} banhista(s) nos banhos: ${[...new Set(ATTENDANTS.map((def) => def.village))].join(", ")}`);
}

function restock(): void {
    for (const def of VENDORS) {
        const entry = live.get(def.id);
        if (entry !== undefined) {
            Vendor.setStock(entry.vendor, stockFor(def));
        }
    }
}

// ---------------------------------------------------------------------------------------------
// What an administrator can do.

export function vendorIds(): readonly VendorId[] {
    return VENDORS.map((def) => def.id);
}

export function isVendorId(value: string): value is VendorId {
    return VENDORS.some((def) => def.id === value);
}

export function describeVendors(): string[] {
    return VENDORS.map((def) => {
        const spot = homeOf(def);
        const entry = live.get(def.id);
        const day = days.get(def.id);
        const doing = entry === undefined || day === undefined ? "ausente" : day.mode === "asleep" ? "dormindo em casa" : day.mode === "home" ? "indo para casa" : def.fire !== undefined ? "junto da fogueira" : def.stays === true ? "nos banhos" : "andando pela vila";
        const house = day?.house ? `, mora em ${day.house.name}` : day !== undefined && def.stays !== true ? ", sem casa" : "";
        const purse = entry === undefined ? null : Vendor.getPurse(entry.vendor);
        const coins = purse === null ? "" : `, bolsa ${Math.round(purse / 10)} moedas`;
        return `  ${def.id} -- ${def.npcName} (${def.village}), lugar em ${spot.x.toFixed(0)} ${spot.y.toFixed(0)} ${spot.z.toFixed(0)}${chosen[def.id] ? " (escolhido)" : ""}${house}${coins} -- ${doing}`;
    });
}

/** Moves a vendor's place to where an administrator stands, facing the way they face. */
export function moveVendor(id: VendorId, position: { x: number; y: number; z: number }, yaw: number): void {
    chosen[id] = { x: position.x, y: position.y, z: position.z, yaw };
    saveChosen();
    const def = defOf(id);
    if (def !== undefined) {
        findHomes();
        spawnOne(def);
    }
}

export function resetVendors(): void {
    chosen = {};
    saveChosen();
    spawnAll();
}

export function restockNow(): void {
    restock();
}

export function installVendors(): void {
    loadChosen();
    loadPurses();

    Events.on("npcInteract", (npc, player) => {
        const id = byNpc.get(npc.id);
        const entry = id === undefined ? undefined : live.get(id);
        if (entry === undefined) {
            return;
        }
        npc.lookAt(player);
        Vendor.open(entry.vendor, player.id, npc.id);
    });

    Events.on("npcIntentDone", (npc, status) => {
        // A body taken out of the world between its order ending and this handler running is no error (the log was full of them).
        try {
            intentDone(npc.id, status);
        } catch (error: unknown) {
            if (!/is not valid/.test(String(error))) {
                console.log(`vendors: npcIntentDone: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    });
    Events.on("vendorTrade", (vendor) => traded(vendor));

    // They cannot be hurt; one brought down all the same is back at their place a moment later.
    Events.on("npcDeath", (npc) => {
        const id = byNpc.get(npc.id);
        const def = id === undefined ? undefined : defOf(id);
        if (def === undefined) {
            return;
        }
        setTimeout(() => {
            const entry = live.get(def.id);
            const day = days.get(def.id);
            if (entry === undefined || day === undefined || entry.npcId !== npc.id) {
                return;
            }
            if (giveBody(def, placeOf(homeOf(def)), homeOf(def).yaw) !== null) {
                day.mode = "about";
                standAround(day, Date.now());
            }
        }, vendorLife.reviveMs);
    });

    const spawnTimer = setTimeout(spawnAll, SPAWN_AFTER_MS);
    const restockTimer = setInterval(restock, RESTOCK_EVERY_MS);
    const purseTimer = setInterval(() => refillPurses(), 10 * 60_000);
    const dayTimer = setInterval(() => {
        try {
            liveDay();
        } catch (error: unknown) {
            console.error(`vendors: o dia dos vendedores tropeçou: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, vendorLife.tickMs);
    // A house given to a player since is given up for another, at the next look. The first look after the start comes
    // once the census has filed a new village's houses (`properties.ts` maps them 20 s after the start).
    const homesTimer = setInterval(findHomes, 5 * 60_000);
    const homesSoon = setTimeout(findHomes, 45_000);

    Events.on("resourceStop", (name) => {
        if (name !== RESOURCE) {
            return;
        }
        clearTimeout(spawnTimer);
        clearInterval(restockTimer);
        clearInterval(purseTimer);
        clearInterval(dayTimer);
        clearInterval(homesTimer);
        clearTimeout(homesSoon);
        if (purseSave !== null) {
            clearTimeout(purseSave);
            purseSave = null;
        }
        // What is left in each purse, for the next start.
        for (const def of VENDORS) {
            const entry = live.get(def.id);
            const purse = entry === undefined ? null : Vendor.getPurse(entry.vendor);
            const state = purses[def.id];
            if (state !== undefined && purse !== null) {
                state.purse = purse;
            }
        }
        try {
            ensureDir(DIR);
            write(PURSES_FILE, purses);
        } catch {
            // The next start fills them, at worst.
        }
        for (const entry of live.values()) {
            Npc.getById(entry.npcId)?.remove();
            Vendor.destroy(entry.vendor);
        }
        fires.splice(0).forEach((fire) => fire.destroy());
        live.clear();
        byNpc.clear();
        byVendor.clear();
    });

    console.log(`vendors: ${VENDORS.length - PEDLARS.length - ATTENDANTS.length} vendedores (Suchdol), ${PEDLARS.length} mascates nas fogueiras de beira de estrada e ${ATTENDANTS.length} banhistas nos banhos; aparecem ${SPAWN_AFTER_MS / 1000} s depois de o servidor subir`);
}
