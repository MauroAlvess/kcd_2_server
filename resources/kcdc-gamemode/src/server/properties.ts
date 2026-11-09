/**
 * Named properties -- a house, a workshop, a chest -- each with a real key item, for the "Chaves" page (an administrator
 * hands properties and keys out) and the "Propriedades" page (an owner sees theirs, renames and describes them, and makes
 * keys for other players) of the status panel, and for the `/propriedade` and `/chave` commands.
 *
 * Nobody maps these by hand. The server already knows every door and every container the level places
 * (`Door.all()`, `Stash.all()`), and which doors belong to which building (`Area.doors`, the links the game itself
 * uses for crime), so `mapRegion` walks them inside a region's box and files each building and each chest, with a
 * name from its type and a number ("Casa 07", "Baú 23"). Suchdol is mapped first, on the first start, and an
 * administrator can map it again, or rename, find and teleport to any property with `/propriedade`.
 *
 * Each property has its own key item, made with `Items.register` the first time a key is handed out (every client is
 * sent each type it is registered, so a hundred and eighty unused ones are not made). Nobody is handed keys with a
 * property: its owner takes them from the panel one at a time, as they need them (the user, 2026-10-15: a castle gave
 * one player 59 keys at once).
 *
 * The lock is this server's, not the world's (see Locks below): every door and chest of a property stands unlocked in the
 * game, which then offers a single "Abrir" at it, and `property-menu.ts` decides what that press does.
 *
 * A property can have an owner (a player's Steam id and the name they had when last seen). The owner renames it,
 * describes it and may make keys of it for other players, up to a limit; an administrator hands properties out and
 * takes them back. A chest inside a house is filed under it (`parentId`) and has the house's owner; the lists show the
 * house with its chests under it, not a hundred "Baú 1". The door and chest prompts show `labelFor`.
 *
 * Kept on disk by GUID, written so a crash cannot leave half a file (`store.ts`).
 */

import { nameOf } from "./acquaintances.js";
import { onKuttenberg } from "./level.js";
import { ensureDir, read, write } from "./store.js";
import { allowedTo, EDGE_M } from "./reach.js";

const DIR = "playerdata";
const FILE = `${DIR}/properties.json`;

/** An existing, plain key item's model, reused as the visual for every key this mints (see custom-assets.md: `visual` must name an existing item). */
const KEY_VISUAL = "poi_opustenaChalupa_key";

export const NAME_MIN = 2;
export const NAME_MAX = 60;
export const DESCRIPTION_MAX = 240;
export const REGION_MIN = 2;
export const REGION_MAX = 40;

/** Keys an owner may have made of one property, in all; an administrator is not held to it. */
export const OWNER_KEY_LIMIT = 8;
/**
 * How many players an owner may give access to one property (2026-10-28, the user: "ao invés de chaves vamos usar algo como dar acesso: o dono escolhe um jogador e dá acesso,
 * e no painel Propriedades ficam duas abas, as propriedades dele e as que ele tem acesso"). Access is the key without the item: whoever has it opens, locks and unlocks the
 * property's doors and chests (and those of its house, for a chest), and is no thief for taking from them.
 */
export const ACCESS_LIMIT = 12;

/** What stands between a house's name and its chest's own ("Casa 03 · Baú 1"). */
const CHEST_SEPARATOR = " · ";

/**
 * What the census files besides the level's chests (2026-11-09, user: "mapear todas propriedades, baús e armários"): the furniture that holds things, a shelf, a cabinet, a wardrobe. Barrels, sacks,
 * baskets, hives, fish traps and the piles of goods along a wall are not properties.
 */
const FURNITURE_STASH = /cabinet|shelf|wardrobe|cupboard|closet/i;
const isFiledStash = (name: string): boolean => /chest/i.test(name) || FURNITURE_STASH.test(name);
/** What a filed container is called: a chest ("Baú 07"), or a piece of furniture ("Armário 07"). */
const nounOfStash = (name: string): "Baú" | "Armário" => (FURNITURE_STASH.test(name) && !/chest/i.test(name) ? "Armário" : "Baú");
/** The noun of a name the census gave, with or without its house ("Casa 01 · Armário 2"): Baú for any other. */
const nounOfName = (name: string): "Baú" | "Armário" => (/(?:^|· )Armário \d/.test(name) ? "Armário" : "Baú");

/** How far from a chest a player may stand to use its key (`reach.ts`). */
const CHEST_REACH = allowedTo(EDGE_M.chest);

/** A door or chest the level has not reported at start is tried again this often, this many times. */
const RELOCK_EVERY_MS = 5_000;
const RELOCK_ATTEMPTS = 24;

/** How often the world is put back in line with the server's locks (`sweepWorld`). */
const SWEEP_EVERY_MS = 5_000;
/** How many parts the catalog is swept in: each turn of the sweep takes one. */
const SWEEP_PARTS = 5;

export type PropertyKind = "house" | "chest" | "door";

export interface PropertyInfo {
    readonly id: string;
    name: string;
    /** Where it is, as a free name an administrator can change; the lists are grouped and filtered by it. */
    region: string;
    readonly kind: PropertyKind;
    /** The entrance door. Empty for a chest. */
    readonly doorGuid: string;
    /** Every door the key locks: a house's entrance and storage doors. Empty for a chest. */
    readonly doors: readonly string[];
    /** A chest's level GUID. Empty for a door or a house. */
    readonly stashGuid: string;
    /** This property's own item class GUID, as `Inventory.add`/`player.giveItem` take it. Empty until its key type is first registered. */
    keyItem: string;
    /**
     * Keys that open one door of the house and nothing else, by the door's GUID: the item class registered for it the first
     * time such a key is handed out (the house's own key, `keyItem`, opens all its doors). Absent until then.
     */
    doorKeys?: Record<string, string>;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly createdAt: number;
    readonly createdBy: string;
    /** Found by the census rather than registered by hand. */
    readonly auto: boolean;
    /** Keys handed out so far. */
    keys: number;
    /** Whether this is kept shut. For a house, whether every one of its doors is. Read only once `lockSet`. */
    locked: boolean;
    /**
     * The lock was set on purpose -- from the menu, the panel, `/chave`, or before this by keys handed out -- so the record
     * says what is locked. Absent, the level's own lock does (`startsLocked`).
     */
    lockSet?: boolean;
    /**
     * Where the doors of a house are not all alike: each door's own mark (true shut, false open), set from the panel one
     * door at a time. Absent while they all follow `locked`.
     */
    doorLocks?: Record<string, boolean>;
    /** The players the owner gave access to (`grantAccess`): of a house and its chests, or of a chest or a door that stands alone. Absent while there are none; cleared when the owner changes. */
    access?: AccessGrant[];
    /** The house a chest stands in, or empty. Such a chest has no owner of its own: it is the house's. */
    parentId: string;
    /** Steam id of the owner, or empty. */
    ownerSteamId: string;
    /** What the owner was called when last seen. */
    ownerName: string;
    /** A vendor of the village lives here (`vendors.ts`): their name. Never given to a player while it is set. */
    npc?: string;
    /** A few lines the owner or an administrator wrote about it. */
    description: string;
}

/** One player's access to a property. */
export interface AccessGrant {
    readonly steamId: string;
    /** What they were called when it was given or they were last seen. */
    name: string;
    readonly at: number;
}

export type RegisterResult = { readonly ok: true; readonly property: PropertyInfo } | { readonly ok: false; readonly reason: string };
export type KeyActionResult = { readonly ok: boolean; readonly message: string };

export interface Box {
    readonly minX: number;
    readonly maxX: number;
    readonly minY: number;
    readonly maxY: number;
}

export interface Region extends Box {
    readonly id: string;
    readonly name: string;
    /** A fortress inside the region: its own doors are the castle's, not houses, and are filed only when asked for. */
    readonly fortress?: Box;
    /**
     * The names the level's map gives the place (`Area.location`, in English). When an area of the level carries one,
     * its bounds, a little wider, are the region; the box above is only for a level that has none.
     */
    readonly locations?: readonly string[];
    /** Doors with no building of their own are filed too, without being asked: Raborsch is mostly its fortress. */
    readonly looseDoors?: boolean;
    /** Places of the region that are each ONE property, wherever they stand (an inn on the road, a stud farm, a camp): see `Compound`. */
    readonly compounds?: readonly Compound[];
    /** Nobody lives here (a camp in the wild): it is no settlement for what depends on how near people are, the world's chests. */
    readonly wild?: boolean;
    /**
     * The place of the map the panel tells this region by (`Area.location`, in English), where the nearest village is not the one a person would name:
     * Minas is "ao norte de Stará Kutná" (user, 2026-10-26). Left out, it is the nearest village, town or camp of the map that is not the region itself.
     */
    readonly near?: string;
}

/**
 * A group of buildings filed as ONE property of a region, with every door inside it and every chest under it (user, 2026-10-26: "a estalagem de
 * Pschitoky é uma propriedade de Pschitoky e não uma região própria"; "a Toca do Diabo é uma propriedade de Minas"; the stud farm south of Malešov).
 * It is the way a castle is one property (`mapCastle`), for places that are no castle and may lie away from their village.
 */
export interface Compound {
    readonly id: string;
    /** The property's name: "Estalagem de Pschitoky". */
    readonly name: string;
    /** Where it stands, in the level's own coordinates; the map's own outline of `locations` takes its place when the level has one. */
    readonly box: Box;
    readonly locations?: readonly string[];
    /** Nobody lives here (the Devil's Den): it is no settlement for what depends on how near people are, the world's chests. */
    readonly wild?: boolean;
}

/**
 * The regions that can be mapped, as boxes in the level's own coordinates (the ones `/tp` reports). Suchdol's covers
 * the village, the fortress and the mill, and nothing of any other settlement; the fortress is the box of its walls.
 * Wysoka's and Raborsch's boxes come from the level's own placements (Wysoka's homes around 390, 2455; Raborsch's
 * fortress around 1430, 3845 and its village square, where the town crier calls, around 1588, 3820), and give way to
 * the map's own outline of the place when the level has one.
 */
export const KUTTENBERG_REGIONS: readonly Region[] = [
    { id: "suchdol", name: "Suchdol", minX: 430, maxX: 900, minY: 3140, maxY: 3480, fortress: { minX: 725, maxX: 825, minY: 3325, maxY: 3395 } },
    { id: "wysoka", name: "Wysoka", minX: 250, maxX: 540, minY: 2320, maxY: 2600, locations: ["Wysoka", "Vysoka", "Vysoká"] },
    { id: "raborsch", name: "Raborsch", minX: 1340, maxX: 1720, minY: 3720, maxY: 3980, fortress: { minX: 1400, maxX: 1460, minY: 3805, maxY: 3870 }, locations: ["Raborsch", "Ratbor", "Ratboř"], looseDoors: true },
    // The village east, the castle on the rise to the west (the level's layer `kmal_malesov`, 2026-10-16).
    // The stud farm 450 m south of the village (the level's `kmal_courtStudFarmArea`: a house, two barns and a stable, with chests), one property of Malešov
    // (2026-10-26: "um haras próximo a Malešov, como propriedade de Malešov").
    {
        id: "malesov",
        name: "Malešov",
        minX: 430,
        maxX: 660,
        minY: 225,
        maxY: 410,
        fortress: { minX: 440, maxX: 500, minY: 344, maxY: 402 },
        locations: ["Maleshov", "Malešov", "Malesov"],
        compounds: [{ id: "haras-malesov", name: "Haras de Malešov", box: { minX: 395, maxX: 485, minY: 700, maxY: 775 } }],
    },
    // Two villages with no castle (2026-10-20: "vamos mapear Bylany e Bohunowitz"): the boxes are the level's own centres, the places the game
    // sends a fast traveller to (`kbyl_village` 1705, 1027; `kboh_villageCenter` 1994, 3437), a hundred and forty metres round, and give way
    // to the map's own outline of the place when the level has one.
    { id: "bylany", name: "Bylany", minX: 1560, maxX: 1850, minY: 880, maxY: 1175, locations: ["Bylany", "Bylan"] },
    { id: "bohunowitz", name: "Bohunowitz", minX: 1850, maxX: 2140, minY: 3290, maxY: 3585, locations: ["Bohunowitz", "Bohunovice", "Bohunowice"] },
    // The rest of the map (2026-10-20: "vamos aproveitar e mapear o resto inteiro logo"): every other place the level has doors in. The boxes
    // are where the level's own doors are (scanned out of `level.pak`, a margin of 25 m round them), and give way to the map's own outline of
    // the place when the level has one under one of the names the game gives it in English (`/propriedade locais` lists them). Kuttenberg
    // is the great town (about 630 doors); the army camp, which has tents and no doors, is left out, and the Devil's Den is a place of Minas.
    // The wagoners' inn 585 m south-west of the town (the level's "Old Kutna Wagoners' Inn": nineteen doors and twenty-nine chests, the map's own outline 106 by 101 m round 2726, 1125) is one
    // property of Kuttenberg, as Pschitoky's is (2026-10-27, user: "um alojamento próximo a Kuttenberg, uma taverna que não está mapeada, pode mapear").
    {
        id: "kuttenberg",
        name: "Kuttenberg",
        minX: 2850,
        maxX: 3385,
        minY: 370,
        maxY: 1010,
        locations: ["Kuttenberg", "Kutna Hora", "Kutná Hora"],
        compounds: [{ id: "estalagem-stara-kutna", name: "Estalagem de Stará Kutná", box: { minX: 2670, maxX: 2782, minY: 1070, maxY: 1180 }, locations: ["Old Kutna Wagoners' Inn"] }],
    },
    { id: "miskowitz", name: "Miskowitz", minX: 1425, maxX: 1610, minY: 1845, maxY: 2050, locations: ["Miskowitz", "Miskovice", "Miškovice"] },
    // Pschitoky has a small fortress (`pritoky_fortress1`, seven doors and five chests) and, on the road 330 m south, the wagoners' inn, which is one property
    // of the village and not a region of its own (2026-10-26: "um castelo em Pschitoky que não foi mapeado"; "a estalagem é uma propriedade de Pschitoky").
    {
        id: "pschitoky",
        name: "Pschitoky",
        minX: 2235,
        maxX: 2375,
        minY: 1755,
        maxY: 1875,
        fortress: { minX: 2240, maxX: 2279, minY: 1792, maxY: 1822 },
        locations: ["Pschitoky", "Pritoky", "Přítoky"],
        compounds: [{ id: "estalagem-pschitoky", name: "Estalagem de Pschitoky", box: { minX: 2130, maxX: 2215, minY: 1440, maxY: 1550 }, locations: ["Pschitoky Wagoners' Inn"] }],
    },
    // The game's map calls Grund "Minas" (its own text, `location_grunta`; user, 2026-10-26: "no mapa se chama Minas em português, que fica acima de Stará Kutná"). The id
    // stays the one the census, the coach stop and the gardens have always had. The Devil's Den, 770 m to the north-west (the level's Čertovka: an inn, barns and a stable
    // of mercenaries, with its chests), is one property of it ("a Toca do Diabo é uma propriedade de Minas"): nobody lives there, so it counts for no settlement.
    {
        id: "grunta",
        name: "Minas",
        minX: 3130,
        maxX: 3285,
        minY: 2130,
        maxY: 2290,
        locations: ["Grund", "Grunta", "Minas"],
        near: "Old Kutna",
        compounds: [
            { id: "toca-do-diabo", name: "Toca do Diabo", box: { minX: 2850, maxX: 2975, minY: 2890, maxY: 2990 }, locations: ["Devil's Den"], wild: true },
        ],
    },
    { id: "horschan", name: "Horschan", minX: 2540, maxX: 2620, minY: 2590, maxY: 2655, locations: ["Horschan", "Horany", "Hořany"] },
    { id: "stara-kutna", name: "Stará Kutná", minX: 3030, maxX: 3115, minY: 1300, maxY: 1425, locations: ["Old Kutna", "Stara Kutna", "Stará Kutná"] },
    { id: "stara-lhota", name: "Stará Lhota", minX: 585, maxX: 715, minY: 895, maxY: 960, locations: ["Old Lhota", "Stara Lhota", "Stará Lhota"] },
    { id: "danemark", name: "Danemark", minX: 1525, maxX: 1590, minY: 180, maxY: 255, locations: ["Danemark"] },
    { id: "rabstein", name: "Rabstein", minX: 945, maxX: 1015, minY: 1020, maxY: 1100, locations: ["Rabstein", "Rabstejn"] },
    { id: "opatowitz", name: "Opatowitz", minX: 1780, maxX: 1915, minY: 2960, maxY: 3050, locations: ["Opatowitz", "Opatovice"] },
];

/**
 * The places of the Trosky level (`trosecko`, the server's map since 2026-11-09), by the names its own map gives them (`Area.location`, read by a probe on a throwaway copy of the server:
 * seventeen of them) and the outline of each, widened as `regionFor` widens it; the boxes here stand only where the level has no outline. The user's list was Semine, Nebakov's fortress, the
 * nomads' camp, Zhelejov, Troskowitz, Tachov, Trosky's castle and Apollonia; Slatego, Schdiar and Vidlak are the villages the map names or the doors make besides, filed too (they are no
 * town of the Cidadania). A castle (`fortress`) is ONE property, with every door inside its walls and every chest under it; the mills, the inn and the farms are each ONE property of their village
 * (`compounds`), as Pschitoky's inn is. What stands apart and has no name on the map (a hut at Kopanina, a house east of Troskowitz, a shed by Semine) is left for the user to name.
 */
export const TROSKY_REGIONS: readonly Region[] = [
    // The citadel on the east side of the village, with the house beside it; the mill 270 m to the west, down the stream.
    {
        id: "semine",
        name: "Semine",
        minX: 1384,
        maxX: 1676,
        minY: 1447,
        maxY: 1635,
        fortress: { minX: 1628, maxX: 1646, minY: 1554, maxY: 1568 },
        locations: ["Semine"],
        compounds: [{ id: "moinho-baixo-semine", name: "Moinho do Baixo Semine", box: { minX: 1059, maxX: 1191, minY: 1314, maxY: 1460 }, locations: ["Lower Semine Mill"] }],
    },
    // The castle's own rooms (the kitchen and the hall) are the fortress; the watchtower, the smithy and the house are buildings of the village. The mill east of it has a house of its own beside it.
    {
        id: "nebakov",
        name: "Nebakov",
        minX: 1752,
        maxX: 2001,
        minY: 1077,
        maxY: 1311,
        fortress: { minX: 1888, maxX: 1912, minY: 1198, maxY: 1216 },
        locations: ["Nebakov Fortress"],
        compounds: [{ id: "moinho-de-nebakov", name: "Moinho de Nebakov", box: { minX: 2040, maxX: 2150, minY: 1255, maxY: 1400 } }],
    },
    // Trosky's castle on its rock, the houses inside its walls and the village at its foot.
    { id: "trosky", name: "Trosky", minX: 2308, maxX: 2584, minY: 2467, maxY: 2708, fortress: { minX: 2355, maxX: 2535, minY: 2552, maxY: 2645 }, locations: ["Trosky Castle"] },
    { id: "acampamento-nomade", name: "Acampamento nômade", minX: 992, maxX: 1152, minY: 1840, maxY: 1989, locations: ["Nomads' Camp"] },
    {
        id: "zhelejov",
        name: "Zhelejov",
        minX: 1668,
        maxX: 1852,
        minY: 1893,
        maxY: 2041,
        locations: ["Zhelejov"],
        compounds: [{ id: "estalagem-zhelejov", name: "Estalagem de Zhelejov", box: { minX: 1595, maxX: 1721, minY: 2111, maxY: 2245 }, locations: ["Zhelejov Wagoners' Inn"] }],
    },
    { id: "troskowitz", name: "Troskowitz", minX: 2185, maxX: 2498, minY: 1903, maxY: 2122, locations: ["Troskowitz"] },
    { id: "tachov", name: "Tachov", minX: 1925, maxX: 2083, minY: 2435, maxY: 2623, locations: ["Tachov"] },
    { id: "apolonia", name: "Apolônia", minX: 2644, maxX: 3009, minY: 2082, maxY: 2739, locations: ["Apollonia"] },
    { id: "slatego", name: "Slatego", minX: 2462, maxX: 2657, minY: 1427, maxY: 1657, locations: ["Slatego"] },
    // The valley and its two farms, each of the farms one property of it.
    {
        id: "schdiar",
        name: "Schdiar",
        minX: 2064,
        maxX: 2335,
        minY: 1329,
        maxY: 1798,
        locations: ["Schdiar Valley"],
        compounds: [
            { id: "fazenda-leste-schdiar", name: "Fazenda leste de Schdiar", box: { minX: 2381, maxX: 2556, minY: 1660, maxY: 1807 }, locations: ["Schdiar - East Farm"] },
            { id: "fazenda-oeste-schdiar", name: "Fazenda oeste de Schdiar", box: { minX: 1933, maxX: 2111, minY: 1465, maxY: 1609 }, locations: ["Schdiar - West Farm"] },
        ],
    },
    // The hamlet round Vidlak's pond (the map names only the pond): the huntsman's house, the fisher's, a workshop and a row of houses; a box of its own.
    { id: "vidlak", name: "Vidlak", minX: 1195, maxX: 1465, minY: 2540, maxY: 2760 },
];

/** The regions of the level the server runs: Kuttenberg's, or Trosky's (`level.ts`). */
export const REGIONS: readonly Region[] = onKuttenberg() ? KUTTENBERG_REGIONS : TROSKY_REGIONS;

/** How far around the map's own outline of a place the census still looks. */
const LOCATION_MARGIN_M = 25;

const fold = (text: string): string => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** The places the level's map names, with the box around the areas that carry each name. */
export function mapLocations(): Array<{ name: string; box: Box; areas: number }> {
    const found = new Map<string, { name: string; box: { minX: number; maxX: number; minY: number; maxY: number }; areas: number }>();
    for (const area of Area.all("level")) {
        if (typeof area.location !== "string" || area.location === "") {
            continue;
        }
        const key = fold(area.location);
        const { min, max } = area.bounds;
        const entry = found.get(key);
        if (entry === undefined) {
            found.set(key, { name: area.location, box: { minX: min.x, maxX: max.x, minY: min.y, maxY: max.y }, areas: 1 });
        } else {
            entry.box.minX = Math.min(entry.box.minX, min.x);
            entry.box.maxX = Math.max(entry.box.maxX, max.x);
            entry.box.minY = Math.min(entry.box.minY, min.y);
            entry.box.maxY = Math.max(entry.box.maxY, max.y);
            entry.areas += 1;
        }
    }
    return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Every region of `REGIONS`, each with the map's own outline where the level has one under one of its names (widened the way `regionFor`
 * widens it, the box above standing where it has none). The level is scanned once for all of them: what a caller that asks about every
 * region at once uses, the chat's reach (`local-chat.ts`) among them.
 */
export function mappedRegions(): Region[] {
    const places = safeLocations();
    const regions = REGIONS.map((listed) => {
        const names = (listed.locations ?? []).map(fold);
        const place = places.find((candidate) => names.includes(fold(candidate.name)));
        if (place === undefined) {
            return listed;
        }
        return {
            ...listed,
            minX: place.box.minX - LOCATION_MARGIN_M,
            maxX: place.box.maxX + LOCATION_MARGIN_M,
            minY: place.box.minY - LOCATION_MARGIN_M,
            maxY: place.box.maxY + LOCATION_MARGIN_M,
        };
    });
    // A compound away from its region's box (the inn, the stud farm) is a zone of its own, as the inn was a region before it became a property.
    const zones: Region[] = [];
    regions.forEach((region, at) => {
        for (const compound of REGIONS[at]?.compounds ?? []) {
            const box = compoundBoxIn(compound, places);
            if (!withinBox(region, { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 })) {
                zones.push({ id: compound.id, name: compound.name, ...box });
            }
        }
    });
    return [...regions, ...zones];
}

/** The places the map names, or none when the level cannot say. */
function safeLocations(): Array<{ name: string; box: Box; areas: number }> {
    try {
        return mapLocations();
    } catch {
        return [];
    }
}

/** A compound's box: the map's own outline of its place, a little wider, where the level has one; the box of the list where it has none. */
function compoundBoxIn(compound: Compound, places: ReadonlyArray<{ name: string; box: Box }>): Box {
    const names = (compound.locations ?? []).map(fold);
    const place = names.length === 0 ? undefined : places.find((candidate) => names.includes(fold(candidate.name)));
    if (place === undefined) {
        return compound.box;
    }
    return { minX: place.box.minX - LOCATION_MARGIN_M, maxX: place.box.maxX + LOCATION_MARGIN_M, minY: place.box.minY - LOCATION_MARGIN_M, maxY: place.box.maxY + LOCATION_MARGIN_M };
}

export function compoundBox(compound: Compound): Box {
    return compoundBoxIn(compound, safeLocations());
}

/**
 * The region a name stands for: one of `REGIONS` (by id or name, with or without accents), taking the map's outline of
 * the place when the level has one, or any other place the map names, as it is. Null for a name nothing answers to.
 */
export function regionFor(query: string): Region | null {
    const wanted = fold(query);
    const listed = REGIONS.find((region) => region.id === wanted || fold(region.name) === wanted || (region.locations ?? []).some((name) => fold(name) === wanted));
    let places: Array<{ name: string; box: Box; areas: number }> = [];
    try {
        places = mapLocations();
    } catch {
        places = [];
    }
    const names = listed !== undefined ? (listed.locations ?? []).map(fold) : [wanted];
    const place = places.find((candidate) => names.includes(fold(candidate.name)));
    if (place === undefined) {
        return listed ?? null;
    }
    const box = { minX: place.box.minX - LOCATION_MARGIN_M, maxX: place.box.maxX + LOCATION_MARGIN_M, minY: place.box.minY - LOCATION_MARGIN_M, maxY: place.box.maxY + LOCATION_MARGIN_M };
    if (listed !== undefined) {
        return { ...listed, ...box };
    }
    return { id: wanted.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), name: place.name, ...box };
}

export interface CensusReport {
    readonly region: string;
    readonly doorsInside: number;
    readonly areasWithDoors: number;
    readonly housesAdded: number;
    readonly chestsSeen: number;
    readonly chestsAdded: number;
    readonly looseDoorsSeen: number;
    readonly looseDoorsAdded: number;
    readonly fortressDoorsLeftOut: number;
    readonly alreadyKnown: number;
    readonly samples: readonly string[];
    readonly looseSamples: readonly string[];
}

let cache: Record<string, PropertyInfo> | null = null;
/** Chests were linked to their houses while loading and the file does not say so yet. */
let migrated = false;
/** Doors and containers to the property they belong to, for the prompt labels; rebuilt after any change. */
interface Lookup {
    byDoor: Map<string, PropertyInfo>;
    byStash: Map<string, PropertyInfo>;
}
let index: Lookup | null = null;

function toNumber(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** A record from disk with every field present: the ones written before houses and chests had no kind, doors list or lock state. */
function normalize(raw: unknown): PropertyInfo | null {
    if (typeof raw !== "object" || raw === null) {
        return null;
    }
    const r = raw as Record<string, unknown>;
    if (typeof r["id"] !== "string" || typeof r["name"] !== "string" || typeof r["keyItem"] !== "string") {
        return null;
    }
    const doorGuid = typeof r["doorGuid"] === "string" ? r["doorGuid"] : "";
    const doors = Array.isArray(r["doors"]) ? r["doors"].filter((guid): guid is string => typeof guid === "string") : doorGuid !== "" ? [doorGuid] : [];
    const kind: PropertyKind = r["kind"] === "chest" || r["kind"] === "house" || r["kind"] === "door" ? r["kind"] : "door";
    return {
        id: r["id"],
        name: r["name"],
        region: typeof r["region"] === "string" && r["region"] !== "" ? r["region"] : "Sem região",
        kind,
        doorGuid: doorGuid !== "" ? doorGuid : (doors[0] ?? ""),
        doors,
        stashGuid: typeof r["stashGuid"] === "string" ? r["stashGuid"] : "",
        keyItem: r["keyItem"],
        x: toNumber(r["x"]),
        y: toNumber(r["y"]),
        z: toNumber(r["z"]),
        createdAt: toNumber(r["createdAt"]),
        createdBy: typeof r["createdBy"] === "string" ? r["createdBy"] : "",
        auto: r["auto"] === true,
        keys: toNumber(r["keys"]),
        // A property registered by hand was locked on the spot; the older records carry no flag.
        locked: typeof r["locked"] === "boolean" ? r["locked"] : true,
        parentId: typeof r["parentId"] === "string" ? r["parentId"] : "",
        ownerSteamId: typeof r["ownerSteamId"] === "string" ? r["ownerSteamId"] : "",
        ownerName: typeof r["ownerName"] === "string" ? r["ownerName"] : "",
        description: typeof r["description"] === "string" ? r["description"].slice(0, DESCRIPTION_MAX) : "",
        ...(typeof r["npc"] === "string" && r["npc"] !== "" ? { npc: r["npc"] } : {}),
        ...doorMarks(r["doorLocks"], doors),
        ...doorKeysOf(r["doorKeys"], doors),
        ...accessKept(r["access"]),
        // Set on purpose: said so, or kept shut, or with keys out, or with doors marked one by one (all from before the flag).
        ...(r["lockSet"] === true || r["locked"] !== false || toNumber(r["keys"]) > 0 || (typeof r["doorLocks"] === "object" && r["doorLocks"] !== null) ? { lockSet: true } : {}),
    };
}

/** The access list of a stored record: players by their Steam id (any text, like an owner's), each once, up to the limit. */
function accessKept(raw: unknown): { access?: AccessGrant[] } {
    if (!Array.isArray(raw)) {
        return {};
    }
    const seen = new Set<string>();
    const list: AccessGrant[] = [];
    for (const row of raw) {
        const r = typeof row === "object" && row !== null ? (row as Record<string, unknown>) : {};
        const steamId = r["steamId"];
        if (typeof steamId !== "string" || steamId === "" || steamId.length > 32 || seen.has(steamId) || list.length >= ACCESS_LIMIT) {
            continue;
        }
        seen.add(steamId);
        list.push({ steamId, name: typeof r["name"] === "string" ? r["name"].slice(0, NAME_MAX) : "", at: toNumber(r["at"]) });
    }
    return list.length > 0 ? { access: list } : {};
}

/** The per-door keys of a stored record: only for doors the property has, each an item class. */
function doorKeysOf(raw: unknown, doors: readonly string[]): { doorKeys?: Record<string, string> } {
    if (typeof raw !== "object" || raw === null) {
        return {};
    }
    const keys: Record<string, string> = {};
    for (const guid of doors) {
        const item = (raw as Record<string, unknown>)[guid];
        if (typeof item === "string" && item !== "") {
            keys[guid] = item;
        }
    }
    return Object.keys(keys).length > 0 ? { doorKeys: keys } : {};
}

/** The per-door marks of a stored record: only for doors the property has, and only when they are not all the same. */
function doorMarks(raw: unknown, doors: readonly string[]): { doorLocks?: Record<string, boolean> } {
    if (typeof raw !== "object" || raw === null) {
        return {};
    }
    const marks: Record<string, boolean> = {};
    for (const guid of doors) {
        const mark = (raw as Record<string, unknown>)[guid];
        if (typeof mark === "boolean") {
            marks[guid] = mark;
        }
    }
    return Object.keys(marks).length === doors.length && doors.length > 1 && new Set(Object.values(marks)).size > 1 ? { doorLocks: marks } : {};
}

/**
 * A chest filed before houses had chests under them is named "<house> · Baú 1": find the house by that name, in the
 * same region, so the lists can put the chest under it. Returns how many were linked.
 */
function linkChests(store: Record<string, PropertyInfo>): number {
    const houses = Object.values(store).filter((property) => property.kind !== "chest");
    let linked = 0;
    for (const chest of Object.values(store)) {
        const cut = chest.name.indexOf(CHEST_SEPARATOR);
        if (chest.kind !== "chest" || chest.parentId !== "" || cut < 0) {
            continue;
        }
        const prefix = chest.name.slice(0, cut);
        const house = houses.find((candidate) => candidate.region === chest.region && candidate.name === prefix);
        if (house !== undefined) {
            chest.parentId = house.id;
            linked += 1;
        }
    }
    return linked;
}

/**
 * Regions the catalog filed under a name the game's own map does not use: the old name is read as the new one, in the region of every property and in the
 * names that carry it ("Taverna de Grunta"), and the file says so at its next write (2026-10-26: the map says "Minas" where the census said "Grunta", and the
 * Devil's Den, filed as the property of a "Minas" of its own, is now one of the real Minas).
 */
const RENAMED_REGIONS: ReadonlyArray<readonly [from: string, to: string]> = [["Grunta", "Minas"]];

function renameRegions(store: Record<string, PropertyInfo>): number {
    let renamed = 0;
    for (const property of Object.values(store)) {
        for (const [from, to] of RENAMED_REGIONS) {
            const name = property.name.split(` de ${from}`).join(` de ${to}`);
            if (property.region === from || name !== property.name) {
                property.region = property.region === from ? to : property.region;
                property.name = name;
                renamed += 1;
            }
        }
    }
    return renamed;
}

function load(): Record<string, PropertyInfo> {
    if (cache) {
        return cache;
    }
    cache = {};
    const loaded = read<Record<string, unknown>>(FILE);
    if (loaded.status === "ok") {
        for (const [id, raw] of Object.entries(loaded.value)) {
            const property = normalize(raw);
            if (property !== null) {
                cache[id] = property;
            }
        }
        if (linkChests(cache) > 0 || renameRegions(cache) > 0) {
            // Written at the first change, with the rest: nothing here is worth a write of its own.
            migrated = true;
        }
    } else if (loaded.status === "corrupt") {
        console.error(`properties: ${FILE} está ilegível e foi deixado como está: ${loaded.reason}`);
    }
    return cache;
}

function persist(): void {
    index = null;
    migrated = false;
    ensureDir(DIR);
    write(FILE, load());
}

function slugify(name: string, taken: Record<string, PropertyInfo>): string {
    const base =
        name
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 40) || "propriedade";
    if (!taken[base]) {
        return base;
    }
    let attempt = 2;
    while (taken[`${base}-${attempt}`]) {
        attempt += 1;
    }
    return `${base}-${attempt}`;
}

export function listProperties(): readonly PropertyInfo[] {
    return Object.values(load()).sort((a, b) => a.region.localeCompare(b.region) || a.name.localeCompare(b.name));
}

export function getProperty(id: string): PropertyInfo | null {
    return load()[id] ?? null;
}

// By the index, not by sorting the whole catalog for each question: with 1131 properties (2026-10-21, 17 regions) a sort per lookup stalled the
// first filling of the world's chests for five seconds at every start (`treasure.ts` asks `propertyOfStash` of every level container).
function findByDoor(doorGuid: string): PropertyInfo | null {
    return lookup().byDoor.get(doorGuid) ?? null;
}

function findByStash(stashGuid: string): PropertyInfo | null {
    return stashGuid === "" ? null : (lookup().byStash.get(stashGuid) ?? null);
}

function lookup(): Lookup {
    if (index === null) {
        const built: Lookup = { byDoor: new Map(), byStash: new Map() };
        for (const property of Object.values(load())) {
            property.doors.forEach((guid) => built.byDoor.set(guid, property));
            if (property.stashGuid !== "") {
                built.byStash.set(property.stashGuid, property);
            }
        }
        index = built;
    }
    return index;
}

// ---------------------------------------------------------------------------------------------
// Names, owners and what a chest has under it.

/** A chest's own part of its name: "Baú 1" of "Casa 03 · Baú 1". Anything else is its whole name. */
export function shortName(property: PropertyInfo): string {
    if (property.kind !== "chest" || property.parentId === "") {
        return property.name;
    }
    const cut = property.name.lastIndexOf(CHEST_SEPARATOR);
    return cut < 0 ? property.name : property.name.slice(cut + CHEST_SEPARATOR.length);
}

/** What a door's own name in the level says it is, in a word: the first that fits. A plain village door says nothing. */
const DOOR_WORDS: ReadonlyArray<readonly [RegExp, string]> = [
    [/gate|fence|wicket|brana|plot\b/i, "portão"],
    [/toilet|latrin|outhouse|privy|\bwc\b/i, "latrina"],
    [/cellar|basement|sklep/i, "porão"],
    [/barn|stodol/i, "celeiro"],
    [/stabl|stall|st[aá]j/i, "estábulo"],
    [/church|chapel|kostel/i, "igreja"],
    [/mill|mlyn/i, "moinho"],
    [/workshop|forge|smith/i, "oficina"],
    [/shed|\bhut\b/i, "barracão"],
];

/** Buildings are named with a feminine word ("a Casa", "a Taverna", "a Oficina") or a masculine one ("o Celeiro"). */
const FEMININE_BUILDING = /^(casa|taverna|oficina|igreja|capela|estalagem|forja|torre|ponte)\b/i;
/** A door this close to a building is "junto" of it; farther, it says how far. */
const BESIDE_M = 8;
/** Farther than this from every building, a door has nothing near to say. */
const SAY_NEAR_WITHIN_M = 80;

/** The word the level's name for a door gives it, or empty (the plain `door_village_left12` of a village). */
export function doorWordOf(levelName: string): string {
    return DOOR_WORDS.find(([pattern]) => pattern.test(levelName))?.[1] ?? "";
}

/** The note a loose door is read with: "portão, junto da Casa 06", "a 27 m da Casa 11", or empty when there is nothing to say. */
export function looseDoorNote(property: PropertyInfo): string {
    const parts: string[] = [];
    let levelName = "";
    try {
        levelName = typeof Door === "undefined" ? "" : (Door.find(property.doorGuid)?.name ?? "");
    } catch {
        levelName = "";
    }
    const word = doorWordOf(levelName);
    if (word !== "") {
        parts.push(word);
    }
    let nearest: { readonly name: string; readonly metres: number } | null = null;
    for (const other of Object.values(load())) {
        if (other.kind !== "house" || other.parentId !== "" || other.id === property.id) {
            continue;
        }
        const metres = Math.hypot(other.x - property.x, other.y - property.y);
        if (metres <= SAY_NEAR_WITHIN_M && (nearest === null || metres < nearest.metres)) {
            nearest = { name: other.name, metres };
        }
    }
    if (nearest !== null) {
        const of = FEMININE_BUILDING.test(nearest.name) ? "da" : "do";
        parts.push(nearest.metres <= BESIDE_M ? `junto ${of} ${nearest.name}` : `a ${Math.round(nearest.metres)} m ${of} ${nearest.name}`);
    }
    return parts.join(", ");
}

/**
 * The name a player reads: a chest in a house is "<house> · Baú 1" with the house's present name, and a door that is a
 * property of its own says what it is and what it stands by: "Porta 08 (junto da Casa 06)".
 */
export function displayName(property: PropertyInfo): string {
    if (property.kind === "door") {
        const note = looseDoorNote(property);
        return note === "" ? property.name : `${property.name} (${note})`;
    }
    const house = property.parentId === "" ? null : getProperty(property.parentId);
    return house === null || property.kind !== "chest" ? property.name : `${house.name}${CHEST_SEPARATOR}${shortName(property)}`;
}

export function childrenOf(id: string): PropertyInfo[] {
    return listProperties().filter((property) => property.parentId === id);
}

export interface Owner {
    readonly steamId: string;
    readonly name: string;
}

/** Who owns it: a chest in a house has its house's owner. Null for a property nobody has been given. */
export function ownerOf(property: PropertyInfo): Owner | null {
    const source = property.parentId === "" ? property : (getProperty(property.parentId) ?? property);
    return source.ownerSteamId === "" ? null : { steamId: source.ownerSteamId, name: source.ownerName || "dono" };
}

/** A name the census gave a building ("Casa 05", "Taverna 01"), as against one somebody chose. */
const CENSUS_BUILDING_NAME = /^(Casa|Taverna|Oficina|Celeiro|Edifício|Moinho|Estábulo) \d+$/;

/** The vendor who lives in this house (a chest: in its house), or null. */
export function npcOf(property: PropertyInfo): string | null {
    const house = property.parentId === "" ? property : (getProperty(property.parentId) ?? property);
    return house.npc ?? null;
}

/**
 * Keeps a house for a vendor of the village: the lists say whose it is, and it is never given to a player. A house that
 * still has the census's name ("Casa 05") takes the vendor's ("Casa do Ferreiro"). True when anything changed.
 */
export function reserveForNpc(id: string, npcName: string, homeName: string): boolean {
    const store = load();
    const property = store[id];
    if (property === undefined) {
        return false;
    }
    const rename = homeName !== "" && property.name !== homeName && CENSUS_BUILDING_NAME.test(property.name);
    if (property.npc === npcName && !rename) {
        return false;
    }
    store[id] = { ...property, npc: npcName };
    persist();
    if (rename) {
        renameProperty(id, homeName);
    }
    return true;
}

/** Gives back to the catalog every vendor's house that is not in `keep`: the vendor is gone, or lives elsewhere now. */
export function releaseNpcHomes(keep: ReadonlySet<string>): number {
    const store = load();
    let released = 0;
    for (const property of Object.values(store)) {
        if (property.npc !== undefined && !keep.has(property.id)) {
            const { npc: _npc, ...rest } = property;
            store[property.id] = rest;
            released += 1;
        }
    }
    if (released > 0) {
        persist();
    }
    return released;
}

export function isOwner(player: Player, property: PropertyInfo): boolean {
    return player.steamId !== "" && ownerOf(property)?.steamId === player.steamId;
}

/** What a door or chest prompt adds: "Casa 03 - Fulano", or just the name when nobody owns it. Empty for anything else. */
export function labelFor(guid: string): string {
    const found = lookup();
    const property = found.byDoor.get(guid) ?? found.byStash.get(guid);
    if (property === undefined) {
        return "";
    }
    const owner = ownerOf(property);
    const index = property.doors.length > 1 ? property.doors.indexOf(guid) : -1;
    const name = index >= 0 ? `${displayName(property)}${CHEST_SEPARATOR}${doorName(property, index)}` : displayName(property);
    return owner === null ? name : `${name} - ${owner.name}`;
}

/** What belongs to a player: their houses and chests, and the chests of their houses. */
export function propertiesOwnedBy(steamId: string): PropertyInfo[] {
    return steamId === "" ? [] : listProperties().filter((property) => ownerOf(property)?.steamId === steamId);
}

/** The regions that have a property in them, by name. */
export function regionNames(): string[] {
    return [...new Set(Object.values(load()).map((property) => property.region))].sort((a, b) => a.localeCompare(b, "pt", { numeric: true }));
}

/** The property a level container is, or null. Exported for `chest-state.ts`, which keeps what such chests hold. */
export function propertyOfStash(stashGuid: string): PropertyInfo | null {
    return findByStash(stashGuid);
}

/** Registers the key type of one property. Safe to repeat; a rename in the same run keeps the old label until the next start. */
function registerKey(property: PropertyInfo): string {
    try {
        return Items.register(`kcdc-property:${property.id}`, {
            name: `Chave: ${displayName(property)}`,
            description: property.kind === "chest" ? `Abre o baú ${displayName(property)}.` : `Abre as portas de ${property.name}.`,
            visual: KEY_VISUAL,
            weight: 0.05,
            stackable: false,
        });
    } catch {
        // Already registered under a different label this run (renamed): the type itself is what matters.
        return property.keyItem;
    }
}

/** Makes sure the key type of a property exists, registering it the first time it is needed. */
function ensureKey(property: PropertyInfo): string {
    if (property.keyItem === "") {
        property.keyItem = registerKey(property);
    }
    return property.keyItem;
}

/** Registers the key type of one door of a house. Safe to repeat. */
function registerDoorKey(property: PropertyInfo, index: number): string {
    const label = `${displayName(property)}${CHEST_SEPARATOR}${doorName(property, index)}`;
    try {
        return Items.register(`kcdc-property:${property.id}:door${index + 1}`, {
            name: `Chave: ${label}`,
            description: `Abre só ${doorName(property, index)} de ${property.name}.`,
            visual: KEY_VISUAL,
            weight: 0.05,
            stackable: false,
        });
    } catch {
        return property.doorKeys?.[property.doors[index] ?? ""] ?? "";
    }
}

/** Makes sure the key type of one door exists, registering it the first time it is needed. "" for a door the property does not have. */
function ensureDoorKey(property: PropertyInfo, index: number): string {
    const guid = property.doors[index];
    if (guid === undefined) {
        return "";
    }
    const known = property.doorKeys?.[guid];
    if (known !== undefined && known !== "") {
        return known;
    }
    const item = registerDoorKey(property, index);
    if (item !== "") {
        property.doorKeys = { ...property.doorKeys, [guid]: item };
    }
    return item;
}

// ---------------------------------------------------------------------------------------------
// Locks.
//
// The lock of a property is the game's own (user, 2026-10-19: "o E é apenas abrir, o F destrancar ou trancar ... assim fica bem
// mais simples e podemos retirar um código complexo de abrir e fechar"). A part locked or unlocked on purpose (`lockSet`: with F,
// from the panel, `/chave`) stands so in the world as its record says -- each door by its own mark (`doorLocks`), else `locked`
// -- and the game does the rest: E opens what is open, and at a locked one offers nothing at the keyhole but its own lockpick
// (hold E, with a lockpick). A part nobody locked on purpose is the level's, as the level built it, and what players do to it
// there (a level key, a lockpick, a bolt drawn from inside) is the game's too. The framework refuses a hand on a lock a script
// set, so the bolt of a part locked on purpose is drawn from inside by this server (`property-menu.ts`); a part it locked that
// the game reports unlocked was picked (`sweepWorld`), and the record follows.

/** The parts this server has locked in the world: one of them the game reports unlocked was picked. */
const lockedHere = new Set<string>();

function doorsOf(property: PropertyInfo): Door[] {
    return property.doors.flatMap((guid) => {
        const door = Door.find(guid);
        return door === null ? [] : [door];
    });
}

function stashOf(property: PropertyInfo): Stash | null {
    return property.stashGuid === "" ? null : Stash.find(property.stashGuid);
}

/** How many doors and containers one property is made of. */
function partsOf(property: PropertyInfo): number {
    return property.doors.length + (property.stashGuid === "" ? 0 : 1);
}

/** Whether a door of the property is locked: by its record on a property locked on purpose, else as the world has it (the level). */
function doorMeant(property: PropertyInfo, guid: string): boolean {
    if (property.lockSet === true) {
        return property.doorLocks?.[guid] ?? property.locked;
    }
    return Door.find(guid)?.locked === true;
}

/** Whether the chest of a chest property is locked: by its record, else as the world has it. */
function chestMeant(property: PropertyInfo): boolean {
    if (property.lockSet === true) {
        return property.locked;
    }
    return property.stashGuid !== "" && Stash.find(property.stashGuid)?.locked === true;
}

/** Whether a door or chest of a property is locked. Null for anything that is no property. */
export function lockedNow(guid: string): boolean | null {
    const property = propertyOfGuid(guid);
    if (property === null) {
        return null;
    }
    return property.doors.includes(guid) ? doorMeant(property, guid) : chestMeant(property);
}

/**
 * Puts a property's record on the world: on a property locked on purpose each part stands locked or unlocked as the record says;
 * one nobody locked on purpose is left as the level has it. How many parts the level has reported.
 */
function applyLocks(property: PropertyInfo): number {
    let reached = 0;
    const parts: Array<Door | Stash> = [...doorsOf(property)];
    const stash = stashOf(property);
    if (stash !== null) {
        parts.push(stash);
    }
    for (const part of parts) {
        reached += 1;
        if (property.lockSet !== true) {
            continue;
        }
        const guid = part === stash ? property.stashGuid : (part as Door).guid;
        const meant = part === stash ? chestMeant(property) : doorMeant(property, guid);
        if (part.locked !== meant) {
            part.locked = meant;
        }
        if (meant) {
            lockedHere.add(guid);
        } else {
            lockedHere.delete(guid);
        }
    }
    return reached;
}

/** Closes the doors of a property that stand open (only `guid`, when given): a lock is turned on a shut door. */
function shutDoors(property: PropertyInfo, guid?: string): void {
    for (const door of doorsOf(property)) {
        if ((guid === undefined || door.guid === guid) && door.open === true && typeof door.setOpen === "function") {
            door.setOpen(false);
        }
    }
}

/** The property a level door or container belongs to, whichever it is, or null. */
export function propertyOfGuid(guid: string): PropertyInfo | null {
    const found = lookup();
    return found.byDoor.get(guid) ?? found.byStash.get(guid) ?? null;
}

/**
 * Whether `player` holds the key item of this very property -- and, when a door of it is named, the key of that one door
 * as well. A door's own key opens that door and no other, nor the house's chests, nor the house's other doors.
 *
 * A chest of a house opens with the house's own key too (user, 2026-10-18 night: "mesmo tendo a chave do baú não conseguia
 * abrir o baú trancado"; Erik carried the key of the Castelo de Raborsch, and its chests' own keys had never been made).
 */
export function holdsKeyOf(player: Player, property: PropertyInfo, doorGuid?: string): boolean {
    // The access an owner gave stands for the key (2026-10-28); the keys already made go on working.
    if (hasAccess(player.steamId, property)) {
        return true;
    }
    if (holdsKey(player, property.keyItem)) {
        return true;
    }
    if (property.kind === "chest" && property.parentId !== "") {
        const house = getProperty(property.parentId);
        if (house !== null && holdsKey(player, house.keyItem)) {
            return true;
        }
    }
    const own = doorGuid === undefined ? undefined : property.doorKeys?.[doorGuid];
    return own !== undefined && holdsKey(player, own);
}

/** Where a door or container stands, for checking how near somebody is. Null when the server does not know it. */
export function placeOfGuid(guid: string): { x: number; y: number; z: number } | null {
    const door = Door.find(guid);
    if (door !== null) {
        return door.position;
    }
    const stash = Stash.find(guid);
    return stash === null ? null : stash.position;
}

/**
 * Inside the building a door closes: in one of the level areas that link the door as theirs (`door.areas`, the game's own
 * `crime_door`s). Null when no area claims the door, so it has no inside to tell. The game's own word on the side of a
 * door (`keySide` of `doorInteract`) comes first; this is for when there is none.
 */
export function insideOf(player: Player, guid: string): boolean | null {
    const door = Door.find(guid);
    if (door === null || door.areas.length === 0) {
        return null;
    }
    return door.areas.some((area) => area.containsPlayer(player));
}

/** Whether a door of a property stands open right now. False for a chest, and for a door the server does not know. */
export function doorStandsOpen(guid: string): boolean {
    return Door.find(guid)?.open === true;
}

/** Swings a door open, so the player can walk in (it unlocks it in the world, as the game's own Open does). False for a container or a door that was already open. */
export function swingOpen(guid: string): boolean {
    const door = Door.find(guid);
    return door !== null && typeof door.setOpen === "function" ? door.setOpen(true) : false;
}

/**
 * A door or chest got open without its key: picked, or its bolt drawn from inside. A property locked on purpose keeps that in its
 * record (one door of several on its own); on one whose lock is the level's the game has unlocked it itself.
 */
export function unlockPart(guid: string): void {
    const property = propertyOfGuid(guid);
    if (property === null || property.lockSet !== true) {
        return;
    }
    lockedHere.delete(guid);
    const index = property.doors.indexOf(guid);
    if (index >= 0 && property.doors.length > 1) {
        setDoorLocked(property.id, index, false);
    } else {
        setLocked(property.id, false);
    }
}

/**
 * Puts the world back in line, for the properties locked on purpose: a part the level reported late takes its lock; a part this
 * server locked that the game reports unlocked was picked (the record follows: it stays open, and the caller tells the owner);
 * a door that stands open while it is locked is shut. The doors it shut, and the parts that were picked.
 */
/** A part of the catalog: the `index`th of `of` equal shares of its properties, by their place in the list. */
export interface CatalogPart {
    readonly index: number;
    readonly of: number;
}

/** The properties of one part of the catalog (all of them when no part is given). */
function propertiesOf(part: CatalogPart | undefined): PropertyInfo[] {
    const all = Object.values(load());
    return part === undefined ? all : all.filter((_, at) => at % part.of === part.index);
}

export function sweepWorld(part?: CatalogPart): { closed: string[]; picked: string[] } {
    const picked: string[] = [];
    for (const property of propertiesOf(part)) {
        if (property.lockSet !== true) {
            continue;
        }
        for (const guid of [...property.doors, property.stashGuid]) {
            const part = guid === "" ? null : (Door.find(guid) ?? Stash.find(guid));
            if (part !== null && part.locked === false && lockedHere.has(guid) && lockedNow(guid) === true) {
                picked.push(guid);
            }
        }
    }
    for (const guid of picked) {
        unlockPart(guid);
    }
    const closed: string[] = [];
    for (const property of propertiesOf(part)) {
        applyLocks(property);
        if (property.lockSet !== true) {
            continue;
        }
        for (const door of doorsOf(property)) {
            if (door.open === true && doorMeant(property, door.guid) && typeof door.setOpen === "function" && door.setOpen(false)) {
                closed.push(door.guid);
            }
        }
    }
    return { closed, picked };
}

/** Called with each part the sweep found picked (`property-menu.ts` tells the owner and the picker). */
export const lockPicked: Array<(guid: string) => void> = [];

/** How long an open door of a property may stand with nobody near before it is closed again, and what "near" is. */
export const idleDoors = { closeAfterMs: 120_000, nearM: 12, nearUpM: 6 };

const openSince = new Map<string, number>();

/**
 * Closes the doors of properties that were left open with nobody about. A door's pose is the server's last word on it, and a
 * client that comes near finds it posed that way, but a client whose door was not in sync (the KCDC door dispatcher
 * bug) keeps its own: castle doors a lord opened stayed open for some players and shut for the rest (user, 2026-10-17,
 * Malešov and Raborsch). Left alone they only drift further apart, so a door nobody is near for two minutes is closed for
 * everybody, which is how every door of the level begins. The doors it closed.
 */
export function closeIdleDoors(now: number = Date.now(), bodies: ReadonlyArray<{ readonly position: { readonly x: number; readonly y: number; readonly z: number } }> = typeof Player === "undefined" ? [] : Player.all(), part?: CatalogPart): string[] {
    const closed: string[] = [];
    // Where the bodies are, in plain numbers and only once an open door asks: each `.x` of an engine's vector is a call into the engine, and every open door
    // measured every player by six of them (2026-10-28).
    let standing: Array<{ x: number; y: number; z: number }> | null = null;
    const bodiesAt = (): Array<{ x: number; y: number; z: number }> => (standing ??= bodies.map((body) => {
        const at = body.position;
        return { x: at.x, y: at.y, z: at.z };
    }));
    for (const property of propertiesOf(part)) {
        for (const door of doorsOf(property)) {
            if (door.open !== true) {
                openSince.delete(door.guid);
                continue;
            }
            if (typeof door.setOpen !== "function") {
                continue;
            }
            const doorAt = door.position;
            const about = bodiesAt().some((body) => Math.hypot(body.x - doorAt.x, body.y - doorAt.y) <= idleDoors.nearM && Math.abs(body.z - doorAt.z) <= idleDoors.nearUpM);
            if (about) {
                openSince.delete(door.guid);
                continue;
            }
            const since = openSince.get(door.guid);
            if (since === undefined) {
                openSince.set(door.guid, now);
            } else if (now - since >= idleDoors.closeAfterMs && door.setOpen(false)) {
                openSince.delete(door.guid);
                closed.push(door.guid);
            }
        }
    }
    return closed;
}

export function setLocked(id: string, locked: boolean): KeyActionResult {
    const property = getProperty(id);
    if (!property) {
        return { ok: false, message: `Nenhuma propriedade '${id}'.` };
    }
    property.lockSet = true;
    property.locked = locked;
    delete property.doorLocks;
    if (locked) {
        shutDoors(property);
    }
    const reached = applyLocks(property);
    persist();
    return { ok: true, message: `${property.name}: ${locked ? "trancada" : "destrancada"} (${reached} ${reached === 1 ? "peça" : "peças"}).` };
}

/**
 * Doors the census left out of a house, joined to it at every start (2026-11-04, user: "na casa do caçador em Suchdol ficou faltando mapear duas portas"). The census files only the
 * entrance of a building (and its storage doors) and counts the rest of the doors the level links to the building as "owned", never filing them: the hunter's house
 * (`troskovice_10_house1`, area `0b269954d21a988f`) has the entrance and three more doors the level links to it, 9, 14 and 15 m south of the entrance (the last two side by side:
 * the two leaves of a double door), and none of the three was in any property, so none could be locked with the house's key. By house id.
 */
export const MISSED_DOORS: Readonly<Record<string, readonly string[]>> = {
    "suchdol-casa-03": ["4c8bec9ae70b75e0", "4d19407bf0d84fa8", "48942897dc0d5aae"],
};

export interface AttachReport {
    readonly ok: boolean;
    readonly message: string;
    /** The doors that joined. */
    readonly added: readonly string[];
}

/**
 * Joins doors of the level to a house: they are its doors from now on, locked or not as the house is (a house locked on purpose locks them too). A door that is another property's, one
 * the level does not have, or one the house has already is left out and said. Nothing joins to a chest.
 */
export function attachDoors(id: string, guids: readonly string[]): AttachReport {
    const store = load();
    const property = store[id];
    if (property === undefined) {
        return { ok: false, message: `Nenhuma propriedade '${id}'.`, added: [] };
    }
    if (property.kind === "chest") {
        return { ok: false, message: `${property.name} é um baú: porta não entra nele.`, added: [] };
    }
    const added: string[] = [];
    const left: string[] = [];
    for (const guid of guids) {
        const holder = findByDoor(guid);
        if (property.doors.includes(guid)) {
            continue;
        }
        if (holder !== null && holder.id !== property.id) {
            left.push(`${guid} já é de ${holder.name}`);
            continue;
        }
        let known = false;
        try {
            known = Door.find(guid) !== null;
        } catch {
            known = false;
        }
        if (!known) {
            left.push(`${guid}: o nível não tem essa porta`);
            continue;
        }
        added.push(guid);
    }
    if (added.length > 0) {
        const joined: PropertyInfo = { ...property, doors: [...property.doors, ...added] };
        store[id] = joined;
        persist();
        applyLocks(joined);
    }
    const said = added.length === 0 ? "nenhuma porta nova" : `${added.length} porta(s) nova(s)`;
    return { ok: left.length === 0 || added.length > 0, message: `${property.name}: ${said}${left.length > 0 ? `; deixei de fora: ${left.join("; ")}` : ""}.`, added };
}

// ---------------------------------------------------------------------------------------------
// One door at a time: the doors of a house are listed under it like its chests, each with its own lock.

/** The name a door goes by in the lists and on the prompt: the entrance, or its number among the house's doors. */
export function doorName(property: PropertyInfo, index: number): string {
    const guid = property.doors[index];
    return guid !== undefined && guid === property.doorGuid ? "Entrada" : `Porta ${index + 1}`;
}

/** The property that holds a door of the level, or null: the door is nobody's. */
export function propertyOfDoor(guid: string): PropertyInfo | null {
    return findByDoor(guid);
}

/** Which door of the property this is, or -1. */
export function doorIndexOf(property: PropertyInfo, guid: string): number {
    return property.doors.indexOf(guid);
}

export interface DoorLine {
    readonly name: string;
    /** Locked, by the record (`doorMeant`), or as the level has it on a property nobody locked on purpose. */
    readonly locked: boolean;
}

/** The doors of a house, in order, as the panel reads them. Empty for a chest. */
export function doorLines(property: PropertyInfo): DoorLine[] {
    return property.doors.map((guid, index) => ({ name: doorName(property, index), locked: doorMeant(property, guid) }));
}

/** How a property stands as a whole: every part shut, none, or some. */
export function lockState(property: PropertyInfo): "all" | "none" | "part" {
    if (property.doors.length === 0) {
        return chestMeant(property) ? "all" : "none";
    }
    const shut = property.doors.filter((guid) => doorMeant(property, guid)).length;
    return shut === property.doors.length ? "all" : shut === 0 ? "none" : "part";
}

/** Locks or unlocks one door of a house, leaving the others as they are. */
export function setDoorLocked(id: string, index: number, locked: boolean): KeyActionResult {
    const property = getProperty(id);
    if (!property) {
        return { ok: false, message: "Propriedade não encontrada." };
    }
    const guid = property.doors[index];
    if (guid === undefined) {
        return { ok: false, message: "Essa porta não existe." };
    }
    // Read before the record takes over: a house whose lock was the level's keeps each door as it stood.
    const marks: Record<string, boolean> = {};
    for (const door of property.doors) {
        marks[door] = doorMeant(property, door);
    }
    marks[guid] = locked;
    property.lockSet = true;
    if (new Set(Object.values(marks)).size === 1) {
        delete property.doorLocks;
    } else {
        property.doorLocks = marks;
    }
    property.locked = property.doors.every((door) => marks[door] === true);
    if (locked) {
        shutDoors(property, guid);
    }
    applyLocks(property);
    persist();
    return { ok: true, message: `${doorName(property, index)} de ${property.name}: ${locked ? "trancada" : "destrancada"}.` };
}

// ---------------------------------------------------------------------------------------------
// Registering and removing by hand.

/** Stands the player at the door to register it; the name must be free text, 2 to 60 characters. */
export async function registerProperty(player: Player, name: string, region: string): Promise<RegisterResult> {
    const trimmed = name.trim();
    if (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX) {
        return { ok: false, reason: `O nome precisa ter entre ${NAME_MIN} e ${NAME_MAX} caracteres.` };
    }

    const answer = await Door.queryNearest(player);
    if (!answer.found || !answer.door) {
        return { ok: false, reason: `Nenhuma porta por perto: ${answer.reason}.` };
    }
    if (findByDoor(answer.door.guid)) {
        return { ok: false, reason: "Essa porta já é uma propriedade registrada." };
    }

    const store = load();
    const id = slugify(trimmed, store);
    const position = answer.door.position;
    const property: PropertyInfo = {
        id,
        name: trimmed,
        region: region.trim() || "Sem região",
        kind: "house",
        doorGuid: answer.door.guid,
        doors: [answer.door.guid],
        stashGuid: "",
        keyItem: "",
        x: position.x,
        y: position.y,
        z: position.z,
        createdAt: Date.now(),
        createdBy: player.steamId,
        auto: false,
        keys: 0,
        // Registered by hand, on the spot: the administrator is standing at the door and means it shut.
        locked: true,
        lockSet: true,
        parentId: "",
        ownerSteamId: "",
        ownerName: "",
        description: "",
    };
    const registered: PropertyInfo = { ...property, keyItem: registerKey(property) };
    store[id] = registered;
    persist();
    return { ok: true, property: registered };
}

/** Does not touch the door's lock: an unregistered property is just no longer tracked, not thrown open. */
export function removeProperty(id: string): PropertyInfo | null {
    const store = load();
    const property = store[id];
    if (!property) {
        return null;
    }
    delete store[id];
    persist();
    return property;
}

/** Players see the new label at once; the type itself keeps the label it was registered with until the next start. */
function refreshKeyNames(property: PropertyInfo): void {
    for (const piece of [property, ...childrenOf(property.id)]) {
        if (piece.keyItem === "") {
            continue;
        }
        try {
            Inventory.setItemName(piece.keyItem, `Chave: ${displayName(piece)}`);
        } catch (error: unknown) {
            console.log(`properties: não consegui trocar o nome da chave de ${piece.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

/** One line of text with the characters a name must not carry taken out: the separator, and any run of blanks. */
function tidy(text: string): string {
    return text.replace(/·/g, "-").replace(/\s+/g, " ").trim();
}

export function renameProperty(id: string, name: string): KeyActionResult {
    const property = getProperty(id);
    if (!property) {
        return { ok: false, message: `Nenhuma propriedade '${id}'.` };
    }
    const trimmed = tidy(name);
    if (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX) {
        return { ok: false, message: `O nome precisa ter entre ${NAME_MIN} e ${NAME_MAX} caracteres.` };
    }
    property.name = trimmed;
    persist();
    refreshKeyNames(property);
    return { ok: true, message: `Agora se chama '${trimmed}'.` };
}

export function describeProperty(id: string, text: string): KeyActionResult {
    const property = getProperty(id);
    if (!property) {
        return { ok: false, message: `Nenhuma propriedade '${id}'.` };
    }
    const trimmed = text.replace(/\s+/g, " ").trim();
    if (trimmed.length > DESCRIPTION_MAX) {
        return { ok: false, message: `A descrição pode ter até ${DESCRIPTION_MAX} caracteres.` };
    }
    property.description = trimmed;
    persist();
    return { ok: true, message: trimmed === "" ? "Descrição apagada." : "Descrição salva." };
}

/** Moves a property, and the chests it has under it, to a region. The name is free: that is how regions are made. */
export function setRegion(id: string, region: string): KeyActionResult {
    const property = getProperty(id);
    if (!property) {
        return { ok: false, message: `Nenhuma propriedade '${id}'.` };
    }
    if (property.parentId !== "") {
        return { ok: false, message: "Um baú segue a região da casa em que está." };
    }
    const trimmed = tidy(region);
    if (trimmed.length < REGION_MIN || trimmed.length > REGION_MAX) {
        return { ok: false, message: `O nome da região precisa ter entre ${REGION_MIN} e ${REGION_MAX} caracteres.` };
    }
    const moved = [property, ...childrenOf(id)];
    moved.forEach((piece) => {
        piece.region = trimmed;
    });
    persist();
    return { ok: true, message: `${property.name} agora é da região ${trimmed}${moved.length > 1 ? ` (com ${moved.length - 1} baú(s))` : ""}.` };
}

// ---------------------------------------------------------------------------------------------
// Keys.

/** Gives the key of a property to `target` (the administrator themselves by default). Whether it is locked is not the key's business. */
export function grantKey(admin: Player, propertyId: string, target: Player = admin): KeyActionResult {
    const property = getProperty(propertyId);
    if (!property) {
        return { ok: false, message: "Propriedade não encontrada." };
    }
    const result = Inventory.add(target, { item: ensureKey(property), amount: 1 });
    if (!result.ok) {
        return { ok: false, message: `O inventário recusou a chave: ${result.code}.` };
    }
    property.keys += 1;
    persist();
    const whom = target === admin ? "no seu bolso" : `com ${target.nickname}`;
    return { ok: true, message: `Chave de ${displayName(property)} ${whom}.` };
}

/**
 * A key made on somebody's request: the administrator's own word is enough; an owner may make keys of what is theirs,
 * for themselves or another player, until the property has had `OWNER_KEY_LIMIT` of them.
 */
export function issueKey(giver: Player, propertyId: string, target: Player, admin: boolean): KeyActionResult {
    const property = getProperty(propertyId);
    if (!property) {
        return { ok: false, message: "Propriedade não encontrada." };
    }
    if (!admin) {
        if (!isOwner(giver, property)) {
            return { ok: false, message: "Só o dono pode fazer chaves dessa propriedade." };
        }
        if (property.keys >= OWNER_KEY_LIMIT) {
            return { ok: false, message: `Já foram feitas ${property.keys} chaves de ${displayName(property)}, o limite. Fale com um administrador.` };
        }
    }
    return grantKey(giver, propertyId, target);
}

/**
 * A key to one door of a house, made on somebody's request: the same rule as `issueKey` (an administrator at will, an owner up
 * to the limit of keys of the property, door keys and house keys counted together). It opens that door and nothing else.
 */
export function issueDoorKey(giver: Player, propertyId: string, doorIndex: number, target: Player, admin: boolean): KeyActionResult {
    const property = getProperty(propertyId);
    if (!property) {
        return { ok: false, message: "Propriedade não encontrada." };
    }
    if (property.doors.length === 0 || !Number.isInteger(doorIndex) || property.doors[doorIndex] === undefined) {
        return { ok: false, message: "Essa porta não existe." };
    }
    if (!admin) {
        if (!isOwner(giver, property)) {
            return { ok: false, message: "Só o dono pode fazer chaves dessa propriedade." };
        }
        if (property.keys >= OWNER_KEY_LIMIT) {
            return { ok: false, message: `Já foram feitas ${property.keys} chaves de ${displayName(property)}, o limite. Fale com um administrador.` };
        }
    }
    const item = ensureDoorKey(property, doorIndex);
    if (item === "") {
        return { ok: false, message: "Não consegui fazer a chave dessa porta." };
    }
    const result = Inventory.add(target, { item, amount: 1 });
    if (!result.ok) {
        return { ok: false, message: `O inventário recusou a chave: ${result.code}.` };
    }
    property.keys += 1;
    persist();
    const whom = target === giver ? "no seu bolso" : `com ${target.nickname}`;
    return { ok: true, message: `Chave de ${doorName(property, doorIndex)} de ${displayName(property)} ${whom}: abre só essa porta.` };
}

// ---------------------------------------------------------------------------------------------
// Access.

/** The property whose access list covers this one: a chest in a house is the house's, a house, a chest or a door of its own is its own. */
function accessHolder(property: PropertyInfo): PropertyInfo {
    return property.parentId !== "" ? (getProperty(property.parentId) ?? property) : property;
}

/** Whether a player was given access to a property (or to the house it is a part of). */
export function hasAccess(steamId: string, property: PropertyInfo): boolean {
    return steamId !== "" && (accessHolder(property).access ?? []).some((grant) => grant.steamId === steamId);
}

/** The players who were given access to a property, as the owner sees them (a chest in a house: the house's). */
export function accessOf(property: PropertyInfo): readonly AccessGrant[] {
    return accessHolder(property).access ?? [];
}

/** What a player was given access to: the properties that stand on their own, with the chests of each following them. */
export function propertiesSharedWith(steamId: string): PropertyInfo[] {
    if (steamId === "") {
        return [];
    }
    const store = Object.values(load());
    const homes = store.filter((property) => property.parentId === "" && property.npc === undefined && (property.access ?? []).some((grant) => grant.steamId === steamId));
    const ids = new Set(homes.map((property) => property.id));
    return [...homes, ...store.filter((property) => property.parentId !== "" && ids.has(property.parentId))].sort((a, b) => a.region.localeCompare(b.region) || a.name.localeCompare(b.name));
}

export type AccessResult = KeyActionResult & { readonly steamId?: string; readonly name?: string };

/**
 * Gives a player access to a property: its owner, or an administrator, chooses a player who is here. The chests of a house are the house's, so the access to one of them
 * is the house's. Never a vendor's house, never the owner, never twice, and only up to `ACCESS_LIMIT` players.
 */
export function grantAccess(giver: Player, propertyId: string, target: Player, admin: boolean): AccessResult {
    const found = getProperty(propertyId);
    if (!found) {
        return { ok: false, message: "Propriedade não encontrada." };
    }
    const property = accessHolder(found);
    if (!admin && !isOwner(giver, property)) {
        return { ok: false, message: "Só o dono pode dar acesso a essa propriedade." };
    }
    if (property.npc !== undefined) {
        return { ok: false, message: `${property.name} é a casa de ${property.npc} (NPC): não se dá acesso a ela.` };
    }
    if (target.steamId === "") {
        return { ok: false, message: `${target.nickname} não tem identificação Steam, então não pode receber acesso.` };
    }
    if (isOwner(target, property)) {
        return { ok: false, message: `${nameOf(target)} já é o dono de ${displayName(property)}.` };
    }
    if (hasAccess(target.steamId, property)) {
        return { ok: false, message: `${nameOf(target)} já tem acesso a ${displayName(property)}.` };
    }
    const list = property.access ?? [];
    if (list.length >= ACCESS_LIMIT) {
        return { ok: false, message: `${displayName(property)} já tem ${list.length} pessoas com acesso, o limite. Tire o de alguém antes.` };
    }
    property.access = [...list, { steamId: target.steamId, name: nameOf(target), at: Date.now() }];
    persist();
    return { ok: true, message: `${nameOf(target)} agora tem acesso a ${displayName(property)}: abre, tranca e destranca as portas e os baús.`, steamId: target.steamId, name: nameOf(target) };
}

/**
 * Takes the access of the player at `index` in the list (the name is checked too: a list that moved is looked at by name): the owner, or an administrator. The result says
 * whose it was, so they can be told.
 */
export function revokeAccess(giver: Player, propertyId: string, index: number, name: string, admin: boolean): AccessResult {
    const found = getProperty(propertyId);
    if (!found) {
        return { ok: false, message: "Propriedade não encontrada." };
    }
    const property = accessHolder(found);
    if (!admin && !isOwner(giver, property)) {
        return { ok: false, message: "Só o dono pode tirar o acesso." };
    }
    const list = property.access ?? [];
    let at = Number.isInteger(index) && list[index]?.name === name ? index : list.findIndex((grant) => grant.name === name);
    if (at < 0 && Number.isInteger(index) && list[index] !== undefined && name === "") {
        at = index;
    }
    const grant = list[at];
    if (grant === undefined) {
        return { ok: false, message: "Essa pessoa não tem mais acesso." };
    }
    const rest = list.filter((_, position) => position !== at);
    if (rest.length > 0) {
        property.access = rest;
    } else {
        delete property.access;
    }
    persist();
    return { ok: true, message: `${grant.name} não tem mais acesso a ${displayName(property)}.`, steamId: grant.steamId, name: grant.name };
}

/** A player lets go of the access they were given. */
export function leaveAccess(steamId: string, propertyId: string): AccessResult {
    const found = getProperty(propertyId);
    if (!found) {
        return { ok: false, message: "Propriedade não encontrada." };
    }
    const property = accessHolder(found);
    const grant = (property.access ?? []).find((entry) => entry.steamId === steamId);
    if (grant === undefined) {
        return { ok: false, message: "Você não tem acesso a essa propriedade." };
    }
    const rest = (property.access ?? []).filter((entry) => entry.steamId !== steamId);
    if (rest.length > 0) {
        property.access = rest;
    } else {
        delete property.access;
    }
    persist();
    return { ok: true, message: `Você deixou de ter acesso a ${displayName(property)}.`, steamId, name: grant.name };
}

/**
 * Gives a house (or a chest that stands alone) to a player: they become its owner. No key goes with it: the owner takes
 * the ones they want from the panel, one at a time.
 */
export function assignOwner(_giver: Player, propertyId: string, target: Player): KeyActionResult {
    const property = getProperty(propertyId);
    if (!property) {
        return { ok: false, message: "Propriedade não encontrada." };
    }
    if (property.parentId !== "") {
        return { ok: false, message: `${displayName(property)} é parte de ${getProperty(property.parentId)?.name ?? "uma casa"}: dê a casa.` };
    }
    if (property.npc !== undefined) {
        return { ok: false, message: `${property.name} é a casa de ${property.npc} (NPC): dê outra ao jogador.` };
    }
    if (target.steamId === "") {
        return { ok: false, message: `${target.nickname} não tem identificação Steam, então não pode ser dono de nada.` };
    }
    property.ownerSteamId = target.steamId;
    property.ownerName = nameOf(target);
    // The access the old owner gave went with them: the new one gives their own.
    delete property.access;
    persist();
    return { ok: true, message: `${property.name} agora é de ${target.nickname}. Quem o novo dono quiser deixar entrar, escolhe no painel (Propriedades), em Dar acesso.` };
}

/**
 * Everything of the catalog a deleted character held (2026-10-25, user: "ao apagar o personagem deve perder os cavalos, carroças e tudo, até apoiador"): the houses and chests it owned go
 * back to nobody, and the regions ceded to it go back to the Crown. What it kept in its own chests goes too: their level GUIDs are
 * returned, for `chest-state.ts` to empty. The keys handed to others stay with whoever holds them, as when an owner is taken off.
 *
 * Not every chest is the deleted character's alone (2026-10-31, user: "jogadores de Suchdol ao trocar o lorde da região relataram que todos itens dos baús sumiram"): two lords deleted
 * their characters in one night and 270 chests were emptied with them, among them the castle's and the houses of the villagers, who kept their things there. A chest keeps what it holds
 * (`kept` counts them) when its house is in a region the character was the lord of, or when somebody else was given access to the house: those are shared, and what is in them is
 * not all the character's. Only the chests of a house nobody else used are emptied.
 */
export function releaseAllOf(steamId: string): { readonly properties: number; readonly regions: number; readonly chests: string[]; readonly kept: number } {
    if (steamId === "") {
        return { properties: 0, regions: 0, chests: [], kept: 0 };
    }
    const store = load();
    const lorded = new Set(Object.entries(loadLords()).filter(([, lord]) => lord.steamId === steamId).map(([region]) => region));
    const owned = Object.values(store).filter((property) => property.parentId === "" && property.ownerSteamId === steamId);
    const chests: string[] = [];
    let kept = 0;
    for (const property of owned) {
        const shared = lorded.has(property.region) || (property.access ?? []).some((grant) => grant.steamId !== steamId);
        for (const chest of Object.values(store)) {
            if (chest.kind === "chest" && chest.stashGuid !== "" && (chest.id === property.id || chest.parentId === property.id)) {
                if (shared) {
                    kept += 1;
                } else {
                    chests.push(chest.stashGuid);
                }
            }
        }
        property.ownerSteamId = "";
        property.ownerName = "";
        delete property.access;
    }
    // What they were given access to, in other people's properties, goes too.
    let lost = 0;
    for (const property of Object.values(store)) {
        if (property.access?.some((grant) => grant.steamId === steamId) === true) {
            const rest = property.access.filter((grant) => grant.steamId !== steamId);
            if (rest.length > 0) {
                property.access = rest;
            } else {
                delete property.access;
            }
            lost += 1;
        }
    }
    if (owned.length > 0 || lost > 0) {
        persist();
    }
    const lords = loadLords();
    let regions = 0;
    for (const [region, lord] of Object.entries(lords)) {
        if (lord.steamId === steamId) {
            delete lords[region];
            regions += 1;
        }
    }
    if (regions > 0) {
        persistLords();
    }
    return { properties: owned.length, regions, chests, kept };
}

/** Takes the owner off a property. The keys already handed out stay with whoever holds them. */
export function clearOwner(propertyId: string): KeyActionResult {
    const property = getProperty(propertyId);
    if (!property) {
        return { ok: false, message: "Propriedade não encontrada." };
    }
    if (property.parentId !== "") {
        return { ok: false, message: "O dono de um baú é o da casa." };
    }
    if (property.ownerSteamId === "") {
        return { ok: false, message: `${property.name} já está sem dono.` };
    }
    const was = property.ownerName;
    property.ownerSteamId = "";
    property.ownerName = "";
    delete property.access;
    persist();
    return { ok: true, message: `${property.name} deixou de ser de ${was}. O acesso que foi dado acabou; as chaves já entregues continuam com quem as tem.` };
}

/** How many days without entering make an owner's house, in a region ceded to a lord, the lord's to take back (2026-11-02). */
export const LORD_RECLAIM_DAYS = 7;
const DAY_MS = 24 * 60 * 60_000;

/** Whole days since a player was last in the game (`seen`, from `lastSeenAt`); one with no character at all is long gone. */
export function daysAway(seen: number | null, now = Date.now()): number {
    return seen === null ? 999 : Math.max(0, Math.floor((now - seen) / DAY_MS));
}

/**
 * A house of a region ceded to a lord, taken back from an owner who stopped coming (2026-11-02, the user: "Malak disse que não consegue remover casas de antigos jogadores da região de
 * Suchdol"; taking an owner off was the administrator's alone, `clearOwner`, and a lord could only look at the houses of others in their lands). A house that stands on its own, not a
 * vendor's, of somebody else who has not entered for `LORD_RECLAIM_DAYS`: it becomes the lord's, with its chests and what is in them, and the access its owner gave ends (as with a house
 * given on). An owner who still comes is an administrator's to take off. `seenAt` says when a player was last here (`character-state.ts`, `lastSeenAt`).
 */
export function reclaimHouse(lord: Player, propertyId: string, seenAt: (steamId: string) => number | null, now = Date.now()): KeyActionResult {
    const property = getProperty(propertyId);
    if (!property) {
        return { ok: false, message: "Propriedade não encontrada." };
    }
    if (property.parentId !== "") {
        return { ok: false, message: "Um baú vai com a casa: retome a casa." };
    }
    if (lord.steamId === "" || !regionsLordedBy(lord.steamId).includes(property.region)) {
        return { ok: false, message: `${property.name} não está numa região sua.` };
    }
    if (property.npc !== undefined) {
        return { ok: false, message: `${property.name} é a casa de ${property.npc} (NPC).` };
    }
    const owner = ownerOf(property);
    if (owner === null) {
        return { ok: false, message: `${property.name} não tem dono.` };
    }
    if (owner.steamId === lord.steamId) {
        return { ok: false, message: `${property.name} já é sua.` };
    }
    const away = daysAway(seenAt(owner.steamId), now);
    if (away < LORD_RECLAIM_DAYS) {
        return { ok: false, message: `${owner.name} entrou há ${away === 1 ? "1 dia" : `${away} dias`}: você só retoma ${property.name} depois de ${LORD_RECLAIM_DAYS} dias sem ${owner.name} entrar. Antes disso, só um administrador.` };
    }
    property.ownerSteamId = lord.steamId;
    property.ownerName = nameOf(lord);
    delete property.access;
    persist();
    const since = away >= 999 ? "não tem mais personagem" : `não entrava havia ${away} dias`;
    console.log(`properties: ${nameOf(lord)}, senhor de ${property.region}, retomou ${property.name} de ${owner.name} (${since})`);
    return { ok: true, message: `${property.name} voltou para as suas mãos: ${owner.name} ${since}. A casa e os baús, com o que houver neles, são seus agora; para dá-la a outro, use Ceder.` };
}

// ---------------------------------------------------------------------------------------------
// A region ceded whole.

const LORDS_FILE = `${DIR}/regions.json`;

export interface RegionLord {
    readonly steamId: string;
    /** What they were called when the region was ceded or they were last seen. */
    readonly name: string;
    readonly at: number;
    /** The administrator who ceded it. */
    readonly by: string;
}

let lordCache: Record<string, RegionLord> | null = null;

function loadLords(): Record<string, RegionLord> {
    if (lordCache !== null) {
        return lordCache;
    }
    lordCache = {};
    const loaded = read<Record<string, unknown>>(LORDS_FILE);
    if (loaded.status === "ok") {
        for (const [region, raw] of Object.entries(loaded.value)) {
            const entry = raw as Partial<RegionLord> | null;
            if (entry !== null && typeof entry === "object" && typeof entry.steamId === "string" && entry.steamId !== "") {
                lordCache[region] = { steamId: entry.steamId, name: typeof entry.name === "string" ? entry.name : "", at: toNumber(entry.at), by: typeof entry.by === "string" ? entry.by : "" };
            }
        }
    } else if (loaded.status === "corrupt") {
        console.error(`properties: ${LORDS_FILE} está ilegível e foi deixado como está: ${loaded.reason}`);
    }
    return lordCache;
}

function persistLords(): void {
    ensureDir(DIR);
    write(LORDS_FILE, loadLords());
}

/** The player a region was ceded to, or null. */
export function regionLordOf(region: string): RegionLord | null {
    return loadLords()[region] ?? null;
}

/** The regions ceded whole to a player. */
export function regionsLordedBy(steamId: string): string[] {
    return steamId === "" ? [] : Object.entries(loadLords()).filter(([, lord]) => lord.steamId === steamId).map(([region]) => region);
}

/** A region of the catalog by the name an administrator typed, without minding accents or case. */
export function regionNamed(query: string): string | null {
    const wanted = fold(query);
    return wanted === "" ? null : (regionNames().find((name) => fold(name) === wanted) ?? null);
}

export interface CedeReport {
    readonly ok: boolean;
    readonly message: string;
    /** Properties that became the player's (a house with its chests counts once). */
    readonly given: number;
    /** The chests that went with those houses. */
    readonly chests: number;
    /** Houses kept by the vendor who lives in them. */
    readonly npc: number;
    /** Properties somebody else already owned, which stay theirs. */
    readonly kept: number;
}

/** How many properties of a region would pass to `steamId`, and how many would not: what the confirmation shows. */
export function previewRegion(region: string, steamId: string): { given: number; chests: number; npc: number; kept: number } {
    let given = 0;
    let chests = 0;
    let npc = 0;
    let kept = 0;
    for (const property of listProperties()) {
        if (property.region !== region || property.parentId !== "") {
            continue;
        }
        if (property.npc !== undefined) {
            npc += 1;
        } else if (property.ownerSteamId === "") {
            given += 1;
            chests += childrenOf(property.id).length;
        } else if (property.ownerSteamId !== steamId) {
            kept += 1;
        }
    }
    return { given, chests, npc, kept };
}

/**
 * Cedes a whole region to a player: every property of it that nobody owns becomes theirs, and they decide what to do
 * with it (name it, lock it, make keys, give it on). No key is made for each: an owner needs none, and a hundred key
 * types would go to every client. A vendor's house is never given, and a property somebody already owns stays theirs;
 * both show in the new lord's list as part of the domain, which they may look at and not touch.
 */
export function cedeRegion(giver: Player, query: string, target: Player): CedeReport {
    const none = { given: 0, chests: 0, npc: 0, kept: 0 };
    const region = regionNamed(query);
    if (region === null) {
        return { ok: false, message: `Não conheço a região '${query}'.`, ...none };
    }
    if (target.steamId === "") {
        return { ok: false, message: `${target.nickname} não tem identificação Steam, então não pode ser senhor de uma região.`, ...none };
    }
    const result = cedeRegionTo(region, { steamId: target.steamId, name: nameOf(target) }, giver.nickname);
    const tail = [result.npc > 0 ? `${result.npc} ${result.npc === 1 ? "casa" : "casas"} de NPC ${result.npc === 1 ? "continua" : "continuam"} dos moradores` : "", result.kept > 0 ? `${result.kept} já ${result.kept === 1 ? "tinha" : "tinham"} dono e não ${result.kept === 1 ? "mudou" : "mudaram"}` : ""].filter((part) => part !== "");
    return {
        ok: true,
        message: `${region} agora é de ${target.nickname}: ${result.given} ${result.given === 1 ? "propriedade" : "propriedades"} (e ${result.chests} ${result.chests === 1 ? "baú" : "baús"})${tail.length > 0 ? `; ${tail.join("; ")}` : ""}.`,
        ...result,
    };
}

/** Called with the name of a region right after it was ceded, to whoever it was (the citizenship hands a seat's lands the seat's lord, `citizenship.ts`). */
export const regionCeded: Array<(region: string) => void> = [];

/**
 * The work of ceding a region of the catalog (a name `regionNamed` gave) to a lord who may be away: what an administrator's "Ceder a região inteira" does, and what the
 * lands that follow their seat's lord get when they are handed over (2026-10-29). Every property of it that nobody owns becomes theirs, the title is written down.
 */
export function cedeRegionTo(region: string, lord: { readonly steamId: string; readonly name: string }, by: string): { given: number; chests: number; npc: number; kept: number } {
    const result = previewRegion(region, lord.steamId);
    for (const property of Object.values(load())) {
        if (property.region === region && property.parentId === "" && property.npc === undefined && property.ownerSteamId === "") {
            property.ownerSteamId = lord.steamId;
            delete property.access;
            property.ownerName = lord.name;
        }
    }
    loadLords()[region] = { steamId: lord.steamId, name: lord.name, at: Date.now(), by };
    persistLords();
    if (result.given > 0) {
        persist();
    }
    for (const fn of regionCeded) {
        try {
            fn(region);
        } catch (error: unknown) {
            console.log(`properties: ao ceder ${region}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    return result;
}

export interface ReleaseReport {
    readonly ok: boolean;
    readonly message: string;
    /** Who held the region, or null when nobody did. */
    readonly lord: RegionLord | null;
    /** Properties of the region that were the lord's and go back to nobody (a house with its chests counts once). */
    readonly released: number;
    /** Properties of the region that somebody else owns: they stay as they are. */
    readonly kept: number;
}

/** What taking a region off its lord would do: who loses it, how many of the region's properties are theirs, how many are somebody else's. */
export function previewRelease(region: string): { lord: RegionLord | null; released: number; kept: number } {
    const lord = regionLordOf(region);
    let released = 0;
    let kept = 0;
    for (const property of listProperties()) {
        if (property.region !== region || property.parentId !== "" || property.npc !== undefined || property.ownerSteamId === "") {
            continue;
        }
        if (lord !== null && property.ownerSteamId === lord.steamId) {
            released += 1;
        } else {
            kept += 1;
        }
    }
    return { lord, released, kept };
}

/**
 * Takes a region off its lord, back to the Crown, and takes from them the properties they hold in it (2026-10-28, user: "remover dono nas
 * terras: as propriedades da terra que eram do dono devem remover também ... ao perder ela ele perde as propriedades da região"; the first
 * version took only the title, and a test left over a hundred properties in the administrator's name). What the lord was given when it was ceded,
 * and what they held there besides, go back to nobody; what somebody else owns in the region stays with them. Nothing outside the region is
 * touched, the keys already handed out stay with whoever has them, and the chests keep what is in them (they follow their house).
 */
export function releaseRegion(query: string): ReleaseReport {
    const region = regionNamed(query);
    if (region === null) {
        return { ok: false, message: `Não conheço a região '${query}'.`, lord: null, released: 0, kept: 0 };
    }
    const lords = loadLords();
    const lord = lords[region] ?? null;
    if (lord === null) {
        return { ok: false, message: `${region} não tem senhor.`, lord: null, released: 0, kept: 0 };
    }
    const { released, kept } = previewRelease(region);
    delete lords[region];
    persistLords();
    if (released > 0) {
        for (const property of Object.values(load())) {
            if (property.region === region && property.parentId === "" && property.npc === undefined && property.ownerSteamId === lord.steamId) {
                property.ownerSteamId = "";
                delete property.access;
                property.ownerName = "";
            }
        }
        persist();
    }
    return {
        ok: true,
        message: `${region} deixou de ser de ${lord.name}: ${released} propriedade(s) dele ficaram sem dono e ${kept} de outros donos continuam.`,
        lord,
        released,
        kept,
    };
}

/** Gives a ceded region's new, unowned properties (a census that found more) to the lord. How many. */
export function adoptForLord(region: string): number {
    const lord = regionLordOf(region);
    if (lord === null) {
        return 0;
    }
    let adopted = 0;
    for (const property of Object.values(load())) {
        if (property.region === region && property.parentId === "" && property.npc === undefined && property.ownerSteamId === "") {
            property.ownerSteamId = lord.steamId;
            property.ownerName = lord.name;
            adopted += 1;
        }
    }
    if (adopted > 0) {
        persist();
    }
    return adopted;
}

/**
 * What lies in the regions ceded to a player and is not theirs: the vendors' houses, what others own, what nobody does
 * yet, with the chests of each. The player's own list shows them to be looked at, and the server refuses to touch them.
 */
export function domainOf(steamId: string): PropertyInfo[] {
    const regions = new Set(regionsLordedBy(steamId));
    if (regions.size === 0) {
        return [];
    }
    const houses = new Set(listProperties().filter((property) => regions.has(property.region) && property.parentId === "" && ownerOf(property)?.steamId !== steamId).map((property) => property.id));
    return listProperties().filter((property) => houses.has(property.id) || houses.has(property.parentId));
}

export interface Land {
    readonly region: string;
    readonly houses: number;
    readonly chests: number;
    /** The whole region was ceded to them. */
    readonly whole: boolean;
}

/** A player's lands by region, for the hierarchy: how many houses and chests, and the regions they hold whole. */
export function landSummary(steamId: string): Land[] {
    const lands = new Map<string, { houses: number; chests: number }>();
    for (const property of propertiesOwnedBy(steamId)) {
        const entry = lands.get(property.region) ?? { houses: 0, chests: 0 };
        if (property.kind === "chest") {
            entry.chests += 1;
        } else {
            entry.houses += 1;
        }
        lands.set(property.region, entry);
    }
    const whole = new Set(regionsLordedBy(steamId));
    for (const region of whole) {
        if (!lands.has(region)) {
            lands.set(region, { houses: 0, chests: 0 });
        }
    }
    return [...lands].map(([region, counts]) => ({ region, ...counts, whole: whole.has(region) })).sort((a, b) => a.region.localeCompare(b.region));
}

/** Keeps the owner's name current: a player may have been given a name, or a surname, since they were given the property. */
export function noteNickname(player: Player): void {
    if (player.steamId === "") {
        return;
    }
    const current = nameOf(player);
    let changed = false;
    for (const property of Object.values(load())) {
        if (property.ownerSteamId === player.steamId && property.ownerName !== current) {
            property.ownerName = current;
            changed = true;
        }
        for (const grant of property.access ?? []) {
            if (grant.steamId === player.steamId && grant.name !== current) {
                grant.name = current;
                changed = true;
            }
        }
    }
    if (changed) {
        persist();
    }
    const lords = loadLords();
    let lordChanged = false;
    for (const [region, lord] of Object.entries(lords)) {
        if (lord.steamId === player.steamId && lord.name !== current) {
            lords[region] = { ...lord, name: current };
            lordChanged = true;
        }
    }
    if (lordChanged) {
        persistLords();
    }
}

function holdsKey(player: Player, keyItem: string): boolean {
    if (keyItem === "") {
        return false;
    }
    const state = Inventory.get(player);
    return state !== null && state.items.some((row) => row.item === keyItem && row.amount > 0);
}

/** Toggles the lock of the registered property the player stands at, if they hold its key. */
export async function useKeyAt(player: Player): Promise<KeyActionResult> {
    const chest = Stash.nearest(player.position, CHEST_REACH);
    const chestProperty = chest ? findByStash(chest.levelGuid) : null;
    if (chest && chestProperty) {
        if (!holdsKeyOf(player, chestProperty)) {
            return { ok: false, message: `Você não tem a chave de ${displayName(chestProperty)}.` };
        }
        const lock = !chestMeant(chestProperty);
        setLocked(chestProperty.id, lock);
        return { ok: true, message: `${displayName(chestProperty)}: baú ${lock ? "trancado" : "destrancado"}.` };
    }

    const answer = await Door.queryNearest(player);
    if (!answer.found || !answer.door) {
        return { ok: false, message: `Nenhuma porta por perto: ${answer.reason}.` };
    }
    const property = findByDoor(answer.door.guid);
    if (!property) {
        return { ok: false, message: "Essa porta não é uma propriedade com chave." };
    }
    if (!holdsKeyOf(player, property, answer.door.guid)) {
        return { ok: false, message: `Você não tem a chave de ${property.name}.` };
    }
    const lock = !doorMeant(property, answer.door.guid);
    setLocked(property.id, lock);
    return { ok: true, message: `${property.name}: porta ${lock ? "trancada" : "destrancada"}.` };
}

// ---------------------------------------------------------------------------------------------
// Castles.

export interface CastleReport {
    readonly region: string;
    readonly name: string;
    readonly created: boolean;
    /** Doors the castle has now. */
    readonly doors: number;
    /** Chests that are now the castle's (new ones and the ones moved under it). */
    readonly chests: number;
    /** Loose "Fortaleza" and "Porta" properties folded into the castle. */
    readonly absorbed: number;
}

/** A chest name the census gave ("Baú 41 (Torre)"), as against one somebody chose. */
const CENSUS_CHEST_NAME = /^(?:Baú|Armário) \d+(?: \([^)]*\))?$/;

/** How far outside the walls of a castle a gate still belongs to it: a drawbridge lies beyond the wall. */
export const GATE_MARGIN_M = 60;

/** The region a castle property stands in, or null for a property that is not the castle of a mapped place. */
function castleRegion(property: PropertyInfo): Region | null {
    if (property.kind !== "house" || property.parentId !== "") {
        return null;
    }
    return REGIONS.find((region) => region.fortress !== undefined && property.name === `Castelo de ${region.name}`) ?? null;
}

/** The castle's gates (drawbridge, portcullis, fortress gates): those the level places in or by its walls. Empty for what is not a castle. */
export function castleGates(property: PropertyInfo): Gate[] {
    const region = castleRegion(property);
    const box = region?.fortress;
    if (box === undefined || typeof Gate === "undefined") {
        return [];
    }
    const wide = { minX: box.minX - GATE_MARGIN_M, maxX: box.maxX + GATE_MARGIN_M, minY: box.minY - GATE_MARGIN_M, maxY: box.maxY + GATE_MARGIN_M };
    return Gate.all().filter((gate) => withinBox(wide, gate.position));
}

/** Who may work a castle's gates: its owner (the lord of its lands, when they were ceded), and an administrator when `admin` says so. */
export function mayWorkGates(player: Player, property: PropertyInfo, admin = false): boolean {
    return admin || isOwner(player, property) || (player.steamId !== "" && regionLordOf(property.region)?.steamId === player.steamId);
}

/** Whether the castle's gates are open now: every one that is not shut. Null when it has none. */
export function gatesOpen(property: PropertyInfo): boolean | null {
    const gates = castleGates(property);
    return gates.length === 0 ? null : gates.every((gate) => gate.cycle === "open" || gate.cycle === "opening");
}

// ---------------------------------------------------------------------------------------------
// The castles' gates as they were left (user, 2026-10-19: "os portões de Malešov e Raborsch continuam fechando"). The server
// keeps no gate past a restart -- each comes back as the level draws it -- so what a lord chose is written down, and put back
// at the start and every two minutes; a gate nobody chose for is kept open.

const GATES_FILE = `${DIR}/gates.json`;
export const gateKeeping = { firstMs: 25_000, everyMs: 120_000 };
let wantedGates: Record<string, boolean> | null = null;

function wantedGateStates(): Record<string, boolean> {
    if (wantedGates === null) {
        const loaded = read<Record<string, unknown>>(GATES_FILE);
        wantedGates = {};
        if (loaded.status === "ok" && typeof loaded.value === "object" && loaded.value !== null) {
            for (const [guid, open] of Object.entries(loaded.value)) {
                if (typeof open === "boolean") {
                    wantedGates[guid] = open;
                }
            }
        }
    }
    return wantedGates;
}

/** What was chosen for a gate (the panel's button, `/gate`): kept and put back after a restart. */
export function rememberGate(guid: string, open: boolean): void {
    const wanted = wantedGateStates();
    if (wanted[guid] === open) {
        return;
    }
    wanted[guid] = open;
    try {
        ensureDir(DIR);
        write(GATES_FILE, wanted);
    } catch (error: unknown) {
        console.log(`properties: não consegui guardar o portão ${guid}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/** Every gate of a castle's walls, with the castle's place. */
export function castleGateList(): Array<{ gate: Gate; region: string }> {
    if (typeof Gate === "undefined") {
        return [];
    }
    const out: Array<{ gate: Gate; region: string }> = [];
    for (const region of REGIONS) {
        const box = region.fortress;
        if (box === undefined) {
            continue;
        }
        const wide = { minX: box.minX - GATE_MARGIN_M, maxX: box.maxX + GATE_MARGIN_M, minY: box.minY - GATE_MARGIN_M, maxY: box.maxY + GATE_MARGIN_M };
        for (const gate of Gate.all()) {
            if (withinBox(wide, gate.position)) {
                out.push({ gate, region: region.name });
            }
        }
    }
    return out;
}

/** Puts every castle gate the way it was left, open when nobody chose. How many it moved; with `tell`, each is written to the log. */
export function keepGates(tell = false): number {
    let moved = 0;
    const lines: string[] = [];
    for (const { gate, region } of castleGateList()) {
        const chosen = wantedGateStates()[gate.guid];
        const want = chosen ?? true;
        const open = gate.cycle === "open" || gate.cycle === "opening";
        if (!gate.moving && open !== want && gate.toggle(want).accepted) {
            moved += 1;
            // Nobody the server knows of closed it (an order of an owner is remembered): written down, to find out who did.
            console.log(`properties: o portão ${region} ${gate.guid} estava ${open ? "aberto" : "fechado"} contra o que foi escolhido (${want ? "aberto" : "fechado"}); posto de volta`);
        }
        lines.push(`${region} ${gate.kind} ${gate.guid} ${want ? "aberto" : "fechado"} (${chosen === undefined ? "padrão" : "escolhido"})`);
    }
    if (tell) {
        console.log(`properties: portões dos castelos: ${lines.join("; ") || "nenhum"}${moved > 0 ? `; ${moved} posto(s) de volta como estavam` : ""}`);
    }
    return moved;
}

/** Opens or closes every gate of the castle for its owner. What to tell them. */
export function setCastleGates(player: Player, property: PropertyInfo, open: boolean, admin = false): { readonly ok: boolean; readonly message: string } {
    const gates = castleGates(property);
    if (gates.length === 0) {
        return { ok: false, message: `${displayName(property)} não tem portões.` };
    }
    if (!mayWorkGates(player, property, admin)) {
        return { ok: false, message: "Só o dono do castelo abre e fecha os portões." };
    }
    let moved = 0;
    let seconds = 0;
    for (const gate of gates) {
        rememberGate(gate.guid, open);
        const result = gate.toggle(open);
        if (result.accepted) {
            moved += 1;
            seconds = Math.max(seconds, result.seconds);
        }
    }
    // Who gave the order, for the log: a gate closed "by itself" (user, 2026-10-27) was nobody the journal named.
    console.log(`properties: ${player.nickname} mandou ${open ? "abrir" : "fechar"} os portões de ${displayName(property)}${admin ? " (administrador)" : ""}: ${moved} de ${gates.length} moveram`);
    if (moved === 0) {
        return { ok: true, message: `Os portões de ${displayName(property)} já estão ${open ? "abertos" : "fechados"}.` };
    }
    return { ok: true, message: `${open ? "Abrindo" : "Fechando"} os portões de ${displayName(property)}${seconds > 0 ? ` (${Math.ceil(seconds)} s)` : ""}.` };
}

/**
 * How far from a building a loose chest or door still counts as part of it (the user: "tá cheio de porta e baú que era para estar
 * dentro de propriedade"), measured to the nearest of the building's own points: where it was put and where its chests stand, so a
 * barn whose chests are 50 m apart is reached from any of them. A door nobody owns, or the lord owns, goes into a house another
 * player owns only from right at it (2026-10-18: "as portas que ligam propriedade são da propriedade").
 */
export const tidying = {
    /** A chest with the word of the place in its name ("Baú 17 (Taverna)") goes to a building with that word in its name from this far. */
    chestNamedM: 75,
    /**
     * A chest or a door nobody owns goes into the nearest building nobody owns, or the lord does, from this far (2026-10-28, the user: "os mapeamentos de Kuttenberg estão
     * errados, tem baú avulso e porta também; já falamos, tudo é propriedade"): it was 50 m for a chest and 35 m for a door, and Kuttenberg kept eight chests and two
     * doors of its own that stood between 46 and 140 m from the houses.
     */
    chestM: 120,
    doorM: 60,
    /** A door nobody owns goes into a house another player owns only from right at it. */
    doorIntoOwnedM: 12,
    /** A chest or a door this near a building another player owns is most likely theirs, and is not given to a building farther off: it stays as it is. */
    ownedM: 50,
};

export interface TidyReport {
    /** Loose chests put under a building. */
    readonly chests: number;
    /** Loose doors folded into a building's own doors. */
    readonly doors: number;
    /** Places made for what stood in an area of its own that no building was filed for (a shed, a hut, a smithy's yard). */
    readonly places: number;
    /** What went where, for the log: "Porta 16 -> Casa 09 (1.8 m)". */
    readonly moved: readonly string[];
}

/**
 * The game's word for a place somebody owns: an area of the level labelled `private` (the trespass area of a house, a hut, a shed, a smithy's yard, a gate tower).
 * The smallest one that holds the point, or null.
 */
function privateAreaAt(point: { readonly x: number; readonly y: number; readonly z: number }): Area | null {
    let found: readonly Area[] = [];
    try {
        found = Area.getAt(typeof Vector3 === "function" ? new Vector3(point.x, point.y, point.z) : (point as unknown as Vector3));
    } catch {
        return null;
    }
    let best: Area | null = null;
    let bestSize = Infinity;
    for (const area of found) {
        const labels: readonly string[] = Array.isArray(area.labels) ? area.labels : [];
        if (area.kind === "script" || !labels.some((label) => /^private$/i.test(label))) {
            continue;
        }
        let size = Infinity;
        try {
            size = (area.bounds.max.x - area.bounds.min.x) * (area.bounds.max.y - area.bounds.min.y);
        } catch {
            // A size the engine does not give: the first one found stands.
        }
        if (best === null || size < bestSize) {
            best = area;
            bestSize = size;
        }
    }
    return best;
}

/** Whether an area holds the place of a catalog record. */
function areaHolds(area: Area, point: { readonly x: number; readonly y: number; readonly z: number }): boolean {
    try {
        return area.contains(typeof Vector3 === "function" ? new Vector3(point.x, point.y, point.z) : (point as unknown as Vector3));
    } catch {
        return false;
    }
}

/** The word in brackets of a census chest's name ("Baú 17 (Taverna)": Taverna), or "". */
const chestWord = (name: string): string => /\(([^)]+)\)\s*$/.exec(name)?.[1] ?? "";

/**
 * The census leaves, besides the houses, every chest and door it could not tie to a house by the level's own areas: in Suchdol, 41
 * chests and 20 doors that the lists showed one by one, to its lord, beside the houses they belong to. Each is put under the nearest
 * building of its region: a chest by its place ("Baú 17 (Taverna)" under the tavern, when the tavern is within 75 m; otherwise the
 * nearest building within 50 m), a door among the building's own doors (so its lock and key are the building's, and it keeps its
 * own mark, open or shut). A chest goes only from nobody, or the lord, to a building of nobody's or the lord's, so a chest by a
 * player's house does not become the player's. A door goes into a building of its own owner, or, being nobody's or the lord's,
 * into the nearest building, a house another player owns only from right at it. A chest or a door with a key made for it, a
 * vendor's, or one too far from any building is left as it is. Safe to run again.
 *
 * Before the distances, the level's own word (2026-10-28: "tudo é propriedade, e algumas são propriedades de um forte"): a chest or a door that stands inside an area
 * of the level marked `private` is part of that place. It joins the building the level links to the area (a gate tower's doors, a house's) or one that has a door or a
 * chest in it; and where there is none -- a shed or a hut with no door the level links, a smithy's yard -- the place is made, one property for the area, with
 * what stands in it ("Galpão 03", "Ferraria 01"), so nothing is left standing alone in a village the level draws as private ground.
 */
export function tidyLoose(): TidyReport {
    const store = load();
    const flat = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);
    const buildings = Object.values(store).filter((property) => property.kind === "house" && property.parentId === "");
    // Where each building stands, from before anything is moved: what joins one does not stretch it towards the next chest.
    const points = new Map<string, Array<{ x: number; y: number; z: number }>>(buildings.map((building) => [building.id, [building]]));
    for (const property of Object.values(store)) {
        if (property.kind === "chest" && property.parentId !== "") {
            points.get(property.parentId)?.push(property);
        }
    }
    const reach = (loose: PropertyInfo, building: PropertyInfo): number => Math.min(...(points.get(building.id) ?? [building]).map((point) => flat(loose, point)));
    let chests = 0;
    let doors = 0;
    let places = 0;
    const moved: string[] = [];
    /** Whose they may be: nobody's, or the lord's of the region, which the cession stamped on every property it found (a chest a player holds, or anything with a key out, is theirs and stays where it is). */
    const commonTo = (region: string, steamId: string): boolean => steamId === "" || steamId === (regionLordOf(region)?.steamId ?? "");
    const eligible = (loose: PropertyInfo): boolean => loose.parentId === "" && loose.keys === 0 && loose.npc === undefined && (loose.kind === "chest" || loose.kind === "door") && (loose.kind !== "chest" || commonTo(loose.region, loose.ownerSteamId)) && (loose.kind !== "door" || loose.doorGuid !== "");
    /** A chest goes under a building. */
    const fileChest = (loose: PropertyInfo, home: PropertyInfo, how: string): void => {
        const prefix = `${home.name}${CHEST_SEPARATOR}${nounOfName(loose.name)}`;
        const name = `${prefix} ${highestNumber(home.region, prefix) + 1}`;
        store[loose.id] = { ...loose, parentId: home.id, name };
        moved.push(`${loose.name} -> ${name} (${how})`);
        chests += 1;
    };
    /** A door goes among a building's own doors, with the mark it was kept open or shut by on purpose. */
    const foldDoor = (loose: PropertyInfo, current: PropertyInfo, how: string): void => {
        const joined: PropertyInfo = { ...current, doors: [...new Set([...current.doors, ...loose.doors])] };
        if (loose.lockSet === true && current.lockSet === true) {
            const marks: Record<string, boolean> = { ...(current.doorLocks ?? {}) };
            for (const guid of loose.doors) {
                if ((marks[guid] ?? current.locked) !== loose.locked) {
                    marks[guid] = loose.locked;
                }
            }
            if (Object.keys(marks).length > 0) {
                joined.doorLocks = marks;
            }
        }
        store[current.id] = joined;
        delete store[loose.id];
        moved.push(`${loose.name} -> ${current.name} (${how})`);
        doors += 1;
    };

    // The level's own areas first: what stands inside one marked private is that place's.
    const groups = new Map<string, { area: Area; region: string; items: PropertyInfo[] }>();
    for (const loose of Object.values(store).filter(eligible).sort((a, b) => a.name.localeCompare(b.name, "pt", { numeric: true }))) {
        const area = privateAreaAt(loose);
        if (area === null) {
            continue;
        }
        const key = `${area.id}|${loose.region}`;
        const group = groups.get(key) ?? { area, region: loose.region, items: [] };
        group.items.push(loose);
        groups.set(key, group);
    }
    const lordsToAdopt = new Set<string>();
    for (const { area, region, items } of groups.values()) {
        // The building the level links to the area, else one with a door or a chest in it.
        const linked = new Set<string>((Array.isArray(area.doors) ? area.doors : []).map((door) => door.guid));
        const here = buildings.filter((building) => building.region === region);
        let home: PropertyInfo | null = here.find((building) => building.doors.some((guid) => linked.has(guid))) ?? here.find((building) => (points.get(building.id) ?? [building]).some((point) => areaHolds(area, point))) ?? null;
        if (home !== null && home.parentId === "") {
            home = store[home.id] ?? home;
        }
        let made = false;
        if (home === null) {
            const entity = items
                .map((loose) => {
                    try {
                        return loose.kind === "door" ? (Door.find(loose.doorGuid)?.name ?? "") : (Stash.find(loose.stashGuid)?.name ?? "");
                    } catch {
                        return "";
                    }
                })
                .join(" ");
            const label = buildingType(area.name, entity);
            const name = `${label} ${pad(highestNumber(region, label) + 1)}`;
            const first = items.find((loose) => loose.kind === "door") ?? (items[0] as PropertyInfo);
            const id = slugify(`${regionFor(region)?.id ?? region} ${name}`, store);
            const marked = items.some((loose) => loose.kind === "door" && loose.lockSet === true);
            home = {
                id,
                name,
                region,
                kind: "house",
                doorGuid: first.kind === "door" ? first.doorGuid : "",
                doors: [],
                stashGuid: "",
                keyItem: "",
                x: first.x,
                y: first.y,
                z: first.z,
                createdAt: Date.now(),
                createdBy: "arrumação",
                auto: true,
                keys: 0,
                locked: false,
                ...(marked ? { lockSet: true } : {}),
                parentId: "",
                ownerSteamId: "",
                ownerName: "",
                description: "",
            };
            store[id] = home;
            made = true;
            places += 1;
            lordsToAdopt.add(region);
            moved.push(`${name} <- ${area.name.slice(0, 40)}: ${items.length} peça(s) de uma área privada do nível`);
        }
        const homeNow = home as PropertyInfo;
        for (const loose of items) {
            if (loose.kind === "chest") {
                if (commonTo(region, homeNow.ownerSteamId)) {
                    fileChest(loose, homeNow, made ? "área privada, casa nova" : "área privada");
                }
            } else if (homeNow.ownerSteamId === loose.ownerSteamId || commonTo(region, loose.ownerSteamId)) {
                foldDoor(loose, store[homeNow.id] as PropertyInfo, made ? "área privada, casa nova" : "área privada");
            }
        }
    }
    for (const region of lordsToAdopt) {
        adoptForLord(region);
    }

    for (const loose of Object.values(store).sort((a, b) => a.name.localeCompare(b.name, "pt", { numeric: true }))) {
        const lord = regionLordOf(loose.region)?.steamId ?? "";
        const common = (steamId: string): boolean => steamId === "" || steamId === lord;
        if (loose.parentId !== "" || loose.keys > 0 || loose.npc !== undefined || (loose.kind !== "chest" && loose.kind !== "door")) {
            continue;
        }
        const near = buildings
            .filter((building) => building.region === loose.region)
            .map((building) => ({ building, distance: reach(loose, building) }))
            .sort((a, b) => a.distance - b.distance);
        // The nearest building is another player's and close: the piece is most likely theirs, and no farther building is given it.
        const nearest = near[0];
        const nextToOwned = nearest !== undefined && nearest.building.ownerSteamId !== loose.ownerSteamId && !common(nearest.building.ownerSteamId) && nearest.distance <= tidying.ownedM;
        if (loose.kind === "chest") {
            if (!common(loose.ownerSteamId) || nextToOwned) {
                continue;
            }
            const theirs = near.filter((one) => common(one.building.ownerSteamId));
            const word = chestWord(loose.name).toLowerCase();
            const named = word === "" ? undefined : theirs.find((one) => one.building.name.toLowerCase().includes(word) && one.distance <= tidying.chestNamedM);
            const found = named ?? theirs.find((one) => one.distance <= tidying.chestM);
            if (found === undefined) {
                continue;
            }
            fileChest(loose, found.building, `${found.distance.toFixed(1)} m`);
        } else {
            if (loose.doorGuid === "") {
                continue;
            }
            if (nextToOwned && nearest !== undefined && nearest.distance > tidying.doorIntoOwnedM) {
                continue;
            }
            const found = near.find(({ building, distance }) => {
                if (building.ownerSteamId === loose.ownerSteamId) {
                    return distance <= tidying.doorM;
                }
                if (!common(loose.ownerSteamId)) {
                    return false;
                }
                return distance <= (common(building.ownerSteamId) ? tidying.doorM : tidying.doorIntoOwnedM);
            });
            if (found === undefined) {
                continue;
            }
            // A door that was kept open or shut on purpose stays so, as a mark of its own among the building's doors.
            foldDoor(loose, store[found.building.id] as PropertyInfo, `${found.distance.toFixed(1)} m`);
        }
    }
    if (chests > 0 || doors > 0 || places > 0) {
        persist();
    }
    return { chests, doors, places, moved };
}

/**
 * The castle of a region, as one property: "Castelo de Suchdol", with every door inside the walls (one key, one lock
 * for all of them) and every chest inside the walls under it ("Castelo de Suchdol · Baú 7"), the way a house has its
 * chests. The census leaves the fortress out (its doors are not houses), and in Raborsch had filed its doors one by
 * one as "Fortaleza" and "Porta"; those that nobody has a key to, owns or locked are folded into the castle. Safe to
 * run again: it adds what is new and changes nothing else. Null for a region with no walls of its own.
 */
export function mapCastle(regionId: string): CastleReport | null {
    const region = regionFor(regionId);
    if (region === null || region.fortress === undefined) {
        return null;
    }
    return fileWhole(region, region.fortress, `Castelo de ${region.name}`, `${region.id} castelo`, false);
}

/**
 * The compounds of a region, each as one property named for it ("Estalagem de Pschitoky", "Haras de Malešov", "Toca do Diabo"), the way a castle is:
 * every door inside the place is its door, every chest inside it is under it. What the census or the tidying had filed there before (the inn was a region
 * of its own, with a house and ten chests) is folded into it. Safe to run again. Null for a region with no compounds.
 */
export function mapCompounds(regionId: string): CastleReport[] | null {
    const region = regionFor(regionId);
    if (region === null || region.compounds === undefined) {
        return null;
    }
    const places = safeLocations();
    return region.compounds.map((compound) => fileWhole(region, compoundBoxIn(compound, places), compound.name, `${region.id} ${compound.id}`, true));
}

/** A chest name the census gave, with or without the house it was named after ("Casa 01 · Baú 6"), as against one somebody chose. */
const CENSUS_CHEST_NAME_ANY = /^(?:.+ · )?(?:Baú|Armário) \d+(?: \([^)]*\))?$/;

/**
 * One property for everything inside a box: its doors, and its chests under it. A castle's first filing and every compound also take in what was
 * filed there as something else: a census house or loose door nobody has a key to, owns (but for the region's lord) or locked, whose doors are all inside
 * the box; and the chests that lie inside it and were put under a house outside it, or under a house folded in, or in no house at all. A castle that
 * exists already is only added to, as before.
 */
function fileWhole(region: Region, box: Box, name: string, stem: string, joined: boolean): CastleReport {
    const store = load();
    const existing = Object.values(store).find((property) => property.region === region.name && property.name === name) ?? null;
    const extended = joined || existing === null;
    const lord = regionLordOf(region.name);
    /** Nobody's, or the region's lord's: what the lord is given anyway when the new property is filed, so it changes no owner. */
    const mine = (steamId: string): boolean => steamId === "" || (lord !== null && steamId === lord.steamId);
    const byDoor = lookup().byDoor;
    const inBox = (guid: string): boolean => {
        const door = Door.find(guid);
        return door !== null && withinBox(box, door.position);
    };
    const foldable = (owner: PropertyInfo): boolean => {
        if (!owner.auto || owner.keys > 0 || owner.npc !== undefined || owner.locked) {
            return false;
        }
        if (owner.kind === "door") {
            return extended ? mine(owner.ownerSteamId) && owner.lockSet !== true : owner.ownerSteamId === "";
        }
        return extended && owner.kind === "house" && owner.parentId === "" && owner.lockSet !== true && mine(owner.ownerSteamId) && owner.doors.length > 0 && owner.doors.every(inBox);
    };

    const wanted = new Set<string>(existing?.doors ?? []);
    const folded = new Map<string, PropertyInfo>();
    for (const door of Door.all()) {
        // A door a script or a world file hung (KCDC 1.7.2) keeps its GUID only until the server stops: no property is filed by it.
        if (door.spawned || !withinBox(box, door.position) || /^cin_|_cin_/i.test(door.name)) {
            continue;
        }
        const owner = byDoor.get(door.guid);
        if (owner === undefined || owner === existing) {
            wanted.add(door.guid);
        } else if (foldable(owner)) {
            wanted.add(door.guid);
            folded.set(owner.id, owner);
        }
    }
    for (const property of folded.values()) {
        property.doors.forEach((guid) => wanted.add(guid));
    }
    if (wanted.size === 0) {
        return { region: region.name, name, created: false, doors: 0, chests: 0, absorbed: 0 };
    }

    // The main door: the one nearest the middle of the place.
    const middle = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
    const known = [...wanted].flatMap((guid) => {
        const door = Door.find(guid);
        return door === null ? [] : [door];
    });
    const main = known.sort((a, b) => Math.hypot(a.position.x - middle.x, a.position.y - middle.y) - Math.hypot(b.position.x - middle.x, b.position.y - middle.y))[0];
    const here = main?.position ?? { x: middle.x, y: middle.y, z: 0 };

    const doors = [...wanted];
    let castle: PropertyInfo;
    if (existing !== null) {
        castle = { ...existing, doors, doorGuid: doors[0] ?? existing.doorGuid };
        store[existing.id] = castle;
    } else {
        castle = {
            id: slugify(stem, store),
            name,
            region: region.name,
            kind: "house",
            doorGuid: main?.guid ?? doors[0] ?? "",
            doors,
            stashGuid: "",
            keyItem: "",
            x: here.x,
            y: here.y,
            z: here.z,
            createdAt: Date.now(),
            createdBy: "census",
            auto: true,
            keys: 0,
            locked: false,
            parentId: "",
            ownerSteamId: "",
            ownerName: "",
            description: "",
        };
        store[castle.id] = castle;
    }
    // The chests of the houses folded in, before those houses go: they are the place's now, inside its box or not.
    const orphans = Object.values(store).filter((property) => property.kind === "chest" && folded.has(property.parentId));
    for (const property of folded.values()) {
        delete store[property.id];
    }

    // The chests inside the place, west to east. A chest somebody has named keeps its name and still moves under it;
    // one that has an owner or keys handed out stays as it is (under the castle it would take the castle's owner).
    const numbers = new Map<string, number>();
    /** The next name of a chest ("Castelo de Trosky · Baú 7") or of a piece of furniture ("... · Armário 2"), each counted on its own. */
    const nextLabel = (noun: string): string => {
        const stem = `${name}${CHEST_SEPARATOR}${noun}`;
        const next = (numbers.get(stem) ?? highestNumber(region.name, stem)) + 1;
        numbers.set(stem, next);
        return `${stem} ${next}`;
    };
    let chests = 0;
    const taken = new Set<string>();
    const movable = (filed: PropertyInfo): boolean => {
        if (filed.kind !== "chest" || filed.keys > 0 || filed.id === castle.id) {
            return false;
        }
        if (!extended) {
            return filed.parentId === "" && filed.ownerSteamId === "";
        }
        if (filed.parentId === "") {
            return mine(filed.ownerSteamId);
        }
        const parent = store[filed.parentId];
        if (parent === undefined) {
            return true;
        }
        // A chest the tidying put under a house outside these walls, because that house was the nearest one.
        return parent.id !== castle.id && parent.auto && parent.npc === undefined && mine(parent.ownerSteamId) && !withinBox(box, parent);
    };
    const take = (filed: PropertyInfo): void => {
        const label = nextLabel(nounOfName(filed.name));
        const renamed = (extended ? CENSUS_CHEST_NAME_ANY : CENSUS_CHEST_NAME).test(filed.name) ? label : filed.name;
        store[filed.id] = extended ? { ...filed, region: region.name, parentId: castle.id, ownerSteamId: "", ownerName: "", name: renamed } : { ...filed, parentId: castle.id, name: renamed };
        taken.add(filed.id);
        chests += 1;
    };
    const inside = Stash.all()
        .filter((stash) => stash.levelGuid !== "" && isFiledStash(stash.name) && withinBox(box, stash.position))
        .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y);
    const byStash = lookup().byStash;
    for (const stash of inside) {
        const filed = byStash.get(stash.levelGuid);
        if (filed !== undefined) {
            if (movable(filed)) {
                take(filed);
            }
            continue;
        }
        const label = nextLabel(nounOfStash(stash.name));
        const id = slugify(`${stem} ${label}`, store);
        store[id] = {
            id,
            name: label,
            region: region.name,
            kind: "chest",
            doorGuid: "",
            doors: [],
            stashGuid: stash.levelGuid,
            keyItem: "",
            x: stash.position.x,
            y: stash.position.y,
            z: stash.position.z,
            createdAt: Date.now(),
            createdBy: "census",
            auto: true,
            keys: 0,
            locked: false,
            parentId: castle.id,
            ownerSteamId: "",
            ownerName: "",
            description: "",
        };
        chests += 1;
    }
    for (const orphan of orphans) {
        if (!taken.has(orphan.id)) {
            take(store[orphan.id] ?? orphan);
        }
    }

    persist();
    adoptForLord(region.name);
    return { region: region.name, name, created: existing === null, doors: doors.length, chests, absorbed: folded.size };
}

export function describeCastle(report: CastleReport): string {
    return `${report.name}: ${report.created ? "criado" : "atualizado"} com ${report.doors} porta(s); ${report.chests} baú(s) agora são dele${report.absorbed > 0 ? `; ${report.absorbed} porta(s) soltas foram juntadas a ele` : ""}.`;
}

// ---------------------------------------------------------------------------------------------
// The census.

/** What a building is, from the prefab path the level names it by. First match wins. */
const BUILDING_TYPES: ReadonlyArray<readonly [RegExp, string]> = [
    [/smith|forge/i, "Ferraria"],
    [/tavern|innkeeper|\binn\b|pubs?\b/i, "Taverna"],
    [/mill/i, "Moinho"],
    [/church|chapel|parish|religious/i, "Igreja"],
    [/barn|stable|stall/i, "Celeiro"],
    [/shed/i, "Galpão"],
    [/workshop/i, "Oficina"],
    [/tower/i, "Torre"],
    [/fortress|defensive|castle/i, "Fortaleza"],
    [/ammo|depot|military/i, "Depósito"],
    // The unique buildings and the private grounds of the Trosky level (2026-11-09): a hermit's home, a hidden camp, a nomad's tent, a bandit camp, a trespass ground and a court (the names of the level's own areas,
    // which the tidying takes a place's name from when a chest stands in one with no door); the baths of Zhelejov's inn, a castle's kitchen, the huntsman's, the fisher's and the herbalist's houses.
    [/hermit/i, "Casa do Eremita"],
    [/hiddencamp|hideout/i, "Esconderijo"],
    [/[_\/]tent/i, "Tenda"],
    [/banditcamp/i, "Acampamento de Bandidos"],
    [/tresspass|trespass/i, "Terreno"],
    [/court/i, "Pátio"],
    [/[\/_]spa\d*(?:[\/_]|$)|bath/i, "Banhos"],
    [/kitchen/i, "Cozinha"],
    [/huntsman|hunter/i, "Casa do Caçador"],
    [/fisher/i, "Casa do Pescador"],
    [/herbalist/i, "Casa do Herbanário"],
    [/house|home|hut|cottage/i, "Casa"],
];

function buildingType(...names: readonly string[]): string {
    const text = names.join(" ");
    for (const [pattern, label] of BUILDING_TYPES) {
        if (pattern.test(text)) {
            return label;
        }
    }
    return "Edifício";
}

const pad = (n: number): string => String(n).padStart(2, "0");

/** Two doors of one prefab closer than this are doors of one building. */
const SAME_BUILDING_M = 15;

function withinBox(box: Box, p: { x: number; y: number }): boolean {
    return p.x >= box.minX && p.x <= box.maxX && p.y >= box.minY && p.y <= box.maxY;
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The highest number already used by a name that starts `<prefix> 07` in this region. */
function highestNumber(region: string, prefix: string): number {
    const pattern = new RegExp(`^${escapeRegExp(prefix)} (\\d+)(?:\\D|$)`);
    let highest = 0;
    for (const property of Object.values(load())) {
        if (property.region !== region) {
            continue;
        }
        const match = pattern.exec(property.name);
        if (match?.[1]) {
            highest = Math.max(highest, Number(match[1]));
        }
    }
    return highest;
}

interface Candidate {
    readonly label: string;
    readonly kind: PropertyKind;
    readonly doors: readonly string[];
    readonly stashGuid: string;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly raw: string;
}

/** A building of the region, and the name it has (or is about to have), so the chests inside it can be named after it. */
interface Building {
    readonly id: string;
    readonly name: string;
    readonly area: Area | null;
}

/**
 * Files the buildings and chests the level places inside a region that are not tracked yet. Nothing is locked here:
 * a property turns private when its first key is handed out. A chest that stands inside a building is named after it
 * ("Casa 03 · Baú 1"); one outdoors, in a camp or in the fortress, is "Baú 07" with what the level says is around it.
 * Returns null for an unknown region.
 */
export function mapRegion(regionId: string, options: { looseDoors?: boolean } = {}): CensusReport | null {
    const region = regionFor(regionId);
    if (region === null) {
        return null;
    }
    if (region.looseDoors) {
        options = { ...options, looseDoors: true };
    }
    // What a compound of the region takes (a camp, an inn, a stud farm) is filed whole by `mapCompounds`, not building by building here.
    const places = safeLocations();
    const taken = (region.compounds ?? []).map((compound) => compoundBoxIn(compound, places));
    const inside = (p: { x: number; y: number }): boolean => withinBox(region, p) && !taken.some((box) => withinBox(box, p));

    const store = load();
    const known = new Set<string>();
    for (const property of Object.values(store)) {
        property.doors.forEach((guid) => known.add(guid));
        if (property.stashGuid !== "") {
            known.add(property.stashGuid);
        }
    }

    const candidates: Candidate[] = [];
    const claimed = new Set<string>();
    /** Every door some building owns, whether or not its key locks it (an inner door belongs to its house too). */
    const owned = new Set<string>();
    // Only the level's own doors: one a script or a world file hung (KCDC 1.7.2) keeps its GUID only until the server stops.
    const doorsInside = Door.all().filter((door) => !door.spawned && inside(door.position));
    let areasWithDoors = 0;
    let alreadyKnown = 0;

    // Buildings: the doors the level itself links to each area.
    const areas = Area.all("level")
        .filter((area) => area.doors.length > 0)
        .sort((a, b) => a.id.localeCompare(b.id));
    const buildings: Array<{ area: Area; firstDoor: string }> = [];
    for (const area of areas) {
        area.doors.forEach((door) => owned.add(door.guid));
        const entrances = area.doors.filter((door) => door.link === "entrance" || door.link === "storage");
        const doors = entrances.length > 0 ? entrances : area.doors;
        const first = doors[0];
        if (first === undefined || !inside(first.position)) {
            continue;
        }
        areasWithDoors += 1;
        const fresh = doors.filter((door) => !known.has(door.guid) && !claimed.has(door.guid));
        if (fresh.length === 0) {
            alreadyKnown += 1;
            buildings.push({ area, firstDoor: first.guid });
            continue;
        }
        fresh.forEach((door) => claimed.add(door.guid));
        buildings.push({ area, firstDoor: fresh[0]?.guid ?? first.guid });
        candidates.push({
            label: buildingType(area.name, ...doors.map((door) => door.name)),
            kind: "house",
            doors: fresh.map((door) => door.guid),
            stashGuid: "",
            x: first.position.x,
            y: first.position.y,
            z: first.position.z,
            raw: area.name,
        });
    }

    // Doors no building is linked to: houses, a tavern, a church, plain village doors. Doors of the same building (same
    // prefab, near each other) are one property. The fortress's own doors and cutscene props are not houses; the
    // fortress's are filed only when asked for.
    let looseDoorsSeen = 0;
    let looseDoorsAdded = 0;
    let fortressDoorsLeftOut = 0;
    const looseSamples: string[] = [];
    const groups: Array<{ label: string; prefab: string; doors: Door[] }> = [];
    for (const door of doorsInside) {
        if (known.has(door.guid) || claimed.has(door.guid) || owned.has(door.guid)) {
            continue;
        }
        looseDoorsSeen += 1;
        if (looseSamples.length < 25) {
            looseSamples.push(`${door.name.slice(0, 100)} @ ${door.position.x.toFixed(0)},${door.position.y.toFixed(0)}`);
        }
        if (/^cin_|_cin_/i.test(door.name)) {
            continue;
        }
        const prefab = /AnimDoor\[([^:\]]+):/.exec(door.name)?.[1] ?? "";
        const inFortress = region.fortress !== undefined && withinBox(region.fortress, door.position);
        let label = buildingType(prefab);
        if (inFortress || label === "Fortaleza") {
            label = "Fortaleza";
        } else if (label === "Edifício") {
            label = "Porta";
        }
        if (label === "Fortaleza" && !options.looseDoors) {
            fortressDoorsLeftOut += 1;
            continue;
        }
        const group = prefab === "" ? undefined : groups.find((entry) => entry.prefab === prefab && entry.label === label && entry.doors.some((other) => Math.hypot(other.position.x - door.position.x, other.position.y - door.position.y) <= SAME_BUILDING_M));
        if (group !== undefined) {
            group.doors.push(door);
        } else {
            groups.push({ label, prefab, doors: [door] });
        }
    }
    for (const group of groups) {
        const first = group.doors[0];
        if (first === undefined) {
            continue;
        }
        group.doors.forEach((door) => claimed.add(door.guid));
        const kind: PropertyKind = group.label === "Porta" || group.label === "Fortaleza" ? "door" : "house";
        if (kind === "door") {
            looseDoorsAdded += group.doors.length;
        }
        candidates.push({ label: group.label, kind, doors: group.doors.map((door) => door.guid), stashGuid: "", x: first.position.x, y: first.position.y, z: first.position.z, raw: group.prefab || first.name });
    }

    // Numbered per kind of building, west to east, so a number keeps its place when the census runs again.
    candidates.sort((a, b) => a.label.localeCompare(b.label) || a.x - b.x || a.y - b.y);
    const counters = new Map<string, number>();
    const nextNumber = (prefix: string): number => {
        const next = (counters.get(prefix) ?? highestNumber(region.name, prefix)) + 1;
        counters.set(prefix, next);
        return next;
    };
    let housesAdded = 0;
    let chestsAdded = 0;
    const perLabel = new Map<string, number>();
    const samples: string[] = [];
    const add = (candidate: Candidate, name: string, parentId = ""): void => {
        const id = slugify(`${region.id} ${name}`, store);
        const draft: PropertyInfo = {
            id,
            name,
            region: region.name,
            kind: candidate.kind,
            doorGuid: candidate.doors[0] ?? "",
            doors: candidate.doors,
            stashGuid: candidate.stashGuid,
            keyItem: "",
            x: candidate.x,
            y: candidate.y,
            z: candidate.z,
            createdAt: Date.now(),
            createdBy: "census",
            auto: true,
            keys: 0,
            locked: false,
            parentId,
            ownerSteamId: "",
            ownerName: "",
            description: "",
        };
        store[id] = draft;
        if (candidate.kind === "chest") {
            chestsAdded += 1;
        } else if (candidate.kind === "house") {
            housesAdded += 1;
        }
        const shown = perLabel.get(candidate.label) ?? 0;
        perLabel.set(candidate.label, shown + 1);
        if (shown < 3) {
            samples.push(`${name} <- ${candidate.raw}`);
        }
    };
    for (const candidate of candidates) {
        add(candidate, `${candidate.label} ${pad(nextNumber(candidate.label))}`);
    }

    // Each building's name, new or already filed, so the chests inside can be named after it.
    const owners: Building[] = buildings.flatMap((building) => {
        const property = findByDoor(building.firstDoor);
        return property === null ? [] : [{ id: property.id, name: property.name, area: building.area }];
    });

    // Chests: the containers the level places and names as chests. Barrels, sacks and baskets are not properties.
    let chestsSeen = 0;
    const chests = Stash.all()
        .filter((stash) => stash.levelGuid !== "" && isFiledStash(stash.name) && inside(stash.position))
        .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y);
    for (const stash of chests) {
        chestsSeen += 1;
        if (known.has(stash.levelGuid)) {
            alreadyKnown += 1;
            continue;
        }
        const noun = nounOfStash(stash.name);
        const candidate: Candidate = { label: noun, kind: "chest", doors: [], stashGuid: stash.levelGuid, x: stash.position.x, y: stash.position.y, z: stash.position.z, raw: stash.name };
        const owner = owners.find((entry) => entry.area?.contains(stash.position));
        if (owner !== undefined) {
            const prefix = `${owner.name}${CHEST_SEPARATOR}${noun}`;
            add(candidate, `${prefix} ${nextNumber(prefix)}`, owner.id);
            continue;
        }
        const around = buildingType(...Area.getAt(stash.position).map((area) => area.name));
        const hint = around !== "Edifício" && around !== "Casa" ? ` (${around})` : "";
        add(candidate, `${noun} ${pad(nextNumber(noun))}${hint}`);
    }
    if (housesAdded + chestsAdded + looseDoorsAdded > 0) {
        persist();
        adoptForLord(region.name);
    }

    return { region: region.name, doorsInside: doorsInside.length, areasWithDoors, housesAdded, chestsSeen, chestsAdded, looseDoorsSeen, looseDoorsAdded, fortressDoorsLeftOut, alreadyKnown, samples, looseSamples };
}

export function describeCensus(report: CensusReport): string {
    const left = report.fortressDoorsLeftOut > 0 ? `; ${report.fortressDoorsLeftOut} portas da fortaleza ficaram de fora (use "portas" para incluí-las)` : "";
    return `${report.region}: ${report.housesAdded} edifício(s), ${report.looseDoorsAdded} porta(s) soltas e ${report.chestsAdded} baú(s) novos (${report.alreadyKnown} já conhecidos; ${report.doorsInside} portas e ${report.chestsSeen} baús na região, ${report.areasWithDoors} áreas com porta${left})`;
}

// ---------------------------------------------------------------------------------------------

/** Which properties are within `radius` metres of a point, nearest first. */
export function propertiesNear(position: { x: number; y: number; z: number }, radius: number): Array<{ property: PropertyInfo; distance: number }> {
    return listProperties()
        .map((property) => ({ property, distance: Math.hypot(property.x - position.x, property.y - position.y, property.z - position.z) }))
        .filter((entry) => entry.distance <= radius)
        .sort((a, b) => a.distance - b.distance);
}

/** Makes every key type exist, puts the locks back, and maps Suchdol the first time. */
export function installProperties(): void {
    const store = load();
    if (migrated) {
        persist();
    }
    let registered = 0;
    for (const property of Object.values(store)) {
        if (property.keyItem === "") {
            continue;
        }
        const guid = registerKey(property);
        registered += 1;
        if (guid !== property.keyItem) {
            console.log(`properties: ${property.id}: a chave mudou de identidade (${property.keyItem} -> ${guid}); atualizei`);
            property.keyItem = guid;
        }
    }

    // The keys of single doors are made again too, as the house keys are: the framework forgets custom items at a restart.
    for (const property of Object.values(store)) {
        for (const [guid, item] of Object.entries(property.doorKeys ?? {})) {
            const at = property.doors.indexOf(guid);
            const fresh = at >= 0 ? registerDoorKey(property, at) : item;
            if (fresh !== "" && fresh !== item && property.doorKeys !== undefined) {
                console.log(`properties: ${property.id}: a chave da ${doorName(property, at)} mudou de identidade (${item} -> ${fresh}); atualizei`);
                property.doorKeys[guid] = fresh;
            }
        }
    }

    // The doors the census left out of a house (`MISSED_DOORS`) join it, once: a door the level has not reported yet is tried again by the next start.
    for (const [houseId, guids] of Object.entries(MISSED_DOORS)) {
        if (store[houseId] === undefined) {
            continue;
        }
        const report = attachDoors(houseId, guids);
        if (report.added.length > 0) {
            console.log(`properties: ${report.message}`);
        }
    }

    // The locks put on on purpose stand in the world (see Locks). The level reports a door only once somebody has been near
    // it, so what is not there yet is tried again for a while, and the sweep below keeps at it.
    const waiting = new Set<string>();
    let inLine = 0;
    for (const property of Object.values(store)) {
        if (applyLocks(property) < partsOf(property)) {
            waiting.add(property.id);
        } else {
            inLine += 1;
        }
    }
    const onPurpose = Object.values(store).filter((property) => property.lockSet === true).length;
    console.log(`properties: ${Object.keys(store).length} propriedade(s) conhecida(s), ${registered} com chave registrada; ${onPurpose} com tranca posta à mão (trancadas de verdade no jogo), as outras com a do nível; ${inLine} já no mundo${waiting.size > 0 ? `, ${waiting.size} esperando o nível` : ""}`);
    if (waiting.size > 0) {
        let attempts = 0;
        const retry = setInterval(() => {
            attempts += 1;
            for (const id of [...waiting]) {
                const property = getProperty(id);
                if (property === null || applyLocks(property) >= partsOf(property)) {
                    waiting.delete(id);
                }
            }
            if (waiting.size === 0 || attempts >= RELOCK_ATTEMPTS) {
                clearInterval(retry);
                if (waiting.size > 0) {
                    console.log(`properties: ${waiting.size} propriedade(s) o nível ainda não mostrou; a varredura cuida delas quando alguém passar por lá`);
                }
            }
        }, RELOCK_EVERY_MS);
    }

    // Each region in REGIONS is mapped on its own the first time the server starts with it. Later starts leave the
    // catalog alone: an administrator runs `/propriedade mapear` to add what is new.
    // `REGIONS` is the level's own list (Kuttenberg's or Trosky's), so the census runs on whichever level the server has (2026-11-09).
    const unmapped = REGIONS.filter((region) => !Object.values(store).some((property) => property.auto && property.region === region.name));
    if (unmapped.length > 0) {
        setTimeout(() => {
            for (const region of unmapped) {
                try {
                    const outline = regionFor(region.id);
                    const report = mapRegion(region.id);
                    if (report !== null) {
                        const from = outline !== null && (outline.minX !== region.minX || outline.maxY !== region.maxY) ? "contorno do mapa" : "caixa de reserva";
                        console.log(`properties: mapeamento automático (${from}: x ${outline?.minX.toFixed(0)}..${outline?.maxX.toFixed(0)}, y ${outline?.minY.toFixed(0)}..${outline?.maxY.toFixed(0)}) -- ${describeCensus(report)}`);
                        report.samples.forEach((line) => console.log(`properties:   ${line}`));
                        report.looseSamples.slice(0, 10).forEach((line) => console.log(`properties:   porta solta: ${line}`));
                    }
                } catch (error: unknown) {
                    console.error(`properties: o mapeamento automático de ${region.name} falhou: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        }, 20_000);
    }

    // The castles' gates as they were left: at the start, then every two minutes.
    setTimeout(() => {
        try {
            keepGates(true);
        } catch (error: unknown) {
            console.log(`properties: os portões não puderam ser postos como estavam: ${error instanceof Error ? error.message : String(error)}`);
        }
        setInterval(() => {
            try {
                keepGates();
            } catch {
                // Read again at the next turn.
            }
        }, gateKeeping.everyMs);
    }, gateKeeping.firstMs);

    // The castles of the mapped places, as one property each: after the census, and again later for a level that
    // reports its doors slowly. It adds what is new and changes nothing else.
    for (const delay of [30_000, 120_000]) {
        setTimeout(() => {
            for (const region of REGIONS.filter((candidate) => candidate.fortress !== undefined)) {
                try {
                    const report = mapCastle(region.id);
                    if (report !== null && (report.created || report.chests > 0 || report.absorbed > 0)) {
                        console.log(`properties: ${describeCastle(report)}`);
                    }
                } catch (error: unknown) {
                    console.error(`properties: o castelo de ${region.name} não pôde ser mapeado: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
            for (const region of REGIONS.filter((candidate) => candidate.compounds !== undefined)) {
                try {
                    for (const report of mapCompounds(region.id) ?? []) {
                        if (report.created || report.chests > 0 || report.absorbed > 0) {
                            console.log(`properties: ${describeCastle(report)}`);
                        }
                    }
                } catch (error: unknown) {
                    console.error(`properties: os lugares de ${region.name} não puderam ser mapeados: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        }, delay);
    }

    // What the census left loose, put under the buildings it stands by, after the castles have taken theirs.
    setTimeout(() => {
        try {
            const done = tidyLoose();
            if (done.chests > 0 || done.doors > 0 || done.places > 0) {
                console.log(`properties: ${done.chests} baú(s) e ${done.doors} porta(s) soltos foram para dentro das propriedades perto delas${done.places > 0 ? `, e ${done.places} lugar(es) novo(s) foram feitos para o que estava em área privada` : ""}: ${done.moved.join("; ")}`);
            }
        } catch (error: unknown) {
            console.error(`properties: não consegui arrumar os baús e portas soltos: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, 150_000);

    // An owner who has changed their name is called by the new one.
    Events.on("playerSpawned", (player) => noteNickname(player));

    // The world kept in line: what the level reports later, a lock the game reports picked, and a locked door found open. Each property is looked at every
    // `SWEEP_EVERY_MS`, as before, but a fifth of the catalog at a time, every `SWEEP_EVERY_MS / SWEEP_PARTS`: the whole catalog in one turn read some two
    // thousand doors and stashes through the engine and stalled the server for up to 190 ms (perf-watch, 2026-10-26).
    let turn = 0;
    const sweep = setInterval(() => {
        const part = { index: turn % SWEEP_PARTS, of: SWEEP_PARTS };
        turn += 1;
        const { closed, picked } = sweepWorld(part);
        if (closed.length > 0) {
            console.log(`properties: ${closed.length} porta(s) trancada(s) estava(m) aberta(s) e foi(ram) fechada(s): ${closed.map((guid) => labelFor(guid) || guid).join("; ")}`);
        }
        for (const listener of lockPicked) {
            for (const guid of picked) {
                try {
                    listener(guid);
                } catch (error: unknown) {
                    console.log(`properties: um ouvinte de fechadura arrombada falhou: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        }
        const idle = closeIdleDoors(Date.now(), typeof Player === "undefined" ? [] : Player.all(), part);
        if (idle.length > 0) {
            console.log(`properties: ${idle.length} porta(s) aberta(s) sem ninguém por perto foi(ram) fechada(s): ${idle.map((guid) => labelFor(guid) || guid).join("; ")}`);
        }
    }, SWEEP_EVERY_MS / SWEEP_PARTS);
    Events.on("resourceStop", (name) => {
        if (name === "kcdc-gamemode") {
            clearInterval(sweep);
        }
    });
}
