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
import { ensureDir, read, write } from "./store.js";

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

/** What stands between a house's name and its chest's own ("Casa 03 · Baú 1"). */
const CHEST_SEPARATOR = " · ";

/** How far from a chest a player may stand to use its key. */
const CHEST_REACH = 3;

/** A door or chest the level has not reported at start is tried again this often, this many times. */
const RELOCK_EVERY_MS = 5_000;
const RELOCK_ATTEMPTS = 24;

/** How often the world is put back in line with the server's locks (`sweepWorld`). */
const SWEEP_EVERY_MS = 5_000;

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
}

/**
 * The regions that can be mapped, as boxes in the level's own coordinates (the ones `/tp` reports). Suchdol's covers
 * the village, the fortress and the mill, and nothing of any other settlement; the fortress is the box of its walls.
 * Wysoka's and Raborsch's boxes come from the level's own placements (Wysoka's homes around 390, 2455; Raborsch's
 * fortress around 1430, 3845 and its village square, where the town crier calls, around 1588, 3820), and give way to
 * the map's own outline of the place when the level has one.
 */
export const REGIONS: readonly Region[] = [
    { id: "suchdol", name: "Suchdol", minX: 430, maxX: 900, minY: 3140, maxY: 3480, fortress: { minX: 725, maxX: 825, minY: 3325, maxY: 3395 } },
    { id: "wysoka", name: "Wysoka", minX: 250, maxX: 540, minY: 2320, maxY: 2600, locations: ["Wysoka", "Vysoka", "Vysoká"] },
    { id: "raborsch", name: "Raborsch", minX: 1340, maxX: 1720, minY: 3720, maxY: 3980, fortress: { minX: 1400, maxX: 1460, minY: 3805, maxY: 3870 }, locations: ["Raborsch", "Ratbor", "Ratboř"], looseDoors: true },
    // The village east, the castle on the rise to the west (the level's layer `kmal_malesov`, 2026-10-16).
    { id: "malesov", name: "Malešov", minX: 430, maxX: 660, minY: 225, maxY: 410, fortress: { minX: 440, maxX: 500, minY: 344, maxY: 402 }, locations: ["Maleshov", "Malešov", "Malesov"] },
];

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
        // Set on purpose: said so, or kept shut, or with keys out, or with doors marked one by one (all from before the flag).
        ...(r["lockSet"] === true || r["locked"] !== false || toNumber(r["keys"]) > 0 || (typeof r["doorLocks"] === "object" && r["doorLocks"] !== null) ? { lockSet: true } : {}),
    };
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
        if (linkChests(cache) > 0) {
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

function findByDoor(doorGuid: string): PropertyInfo | null {
    return listProperties().find((property) => property.doors.includes(doorGuid)) ?? null;
}

function findByStash(stashGuid: string): PropertyInfo | null {
    return stashGuid === "" ? null : (listProperties().find((property) => property.stashGuid === stashGuid) ?? null);
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
// The lock of a property is kept here, and the game never sees it: every door and chest of a property stands unlocked in
// the world, so the game offers at it the one thing it offers at anything unlocked -- "Abrir" (or "Fechar") -- and
// `property-menu.ts` hears that press first and decides what it does. The game's own prompts at a locked door are
// "Abrir" from the side without the keyhole, "Arrombar" with a lockpick and "Destrancar e abrir" with the level's key;
// beside a script's own hint they made the two options a player found at a door after logging in inside a house
// (2026-10-15). Only a lockpicking puts a real lock on, for a while, so that the game offers its minigame (`holdShut`).
//
// A part is locked:
// - on a property locked or unlocked on purpose (`lockSet`: from the menu, the panel, `/chave`, and any that had keys out
//   or was kept shut before), as its record says: each door by its own mark (`doorLocks`), else `locked`;
// - on any other, as the level built it (`startsLocked`), but for what was forced or unbolted from inside since the server
//   started (`levelOpened`), which a restart shuts again, as the level would.

/** Unlocked since the start, on a property whose lock is the level's: forced, or unbolted from inside. */
const levelOpened = new Set<string>();

/** Locked in the world for a lockpicking: `openInWorld` leaves these alone until they are let go. */
const heldShut = new Set<string>();

/** Locked in the world for as long as somebody stands looking at them (`holdGaze`): `openInWorld` leaves these alone too. */
const gazeShut = new Set<string>();

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

/** Whether a door of the property is locked. */
function doorMeant(property: PropertyInfo, guid: string): boolean {
    if (property.lockSet === true) {
        return property.doorLocks?.[guid] ?? property.locked;
    }
    return !levelOpened.has(guid) && Door.find(guid)?.startsLocked === true;
}

/** Whether the chest of a chest property is locked. */
function chestMeant(property: PropertyInfo): boolean {
    if (property.lockSet === true) {
        return property.locked;
    }
    return property.stashGuid !== "" && !levelOpened.has(property.stashGuid) && Stash.find(property.stashGuid)?.startsLocked === true;
}

/** Whether a door or chest of a property is locked, by this server's word. Null for anything that is no property. */
export function lockedNow(guid: string): boolean | null {
    const property = propertyOfGuid(guid);
    if (property === null) {
        return null;
    }
    return property.doors.includes(guid) ? doorMeant(property, guid) : chestMeant(property);
}

/**
 * Stands every door and the chest of a property unlocked in the world, but a part held shut for a lockpicking. How many
 * parts it reached: the level reports a door only once somebody has been near it.
 */
function openInWorld(property: PropertyInfo): number {
    let reached = 0;
    for (const door of doorsOf(property)) {
        if (!heldShut.has(door.guid) && !gazeShut.has(door.guid) && door.locked) {
            door.locked = false;
        }
        reached += 1;
    }
    const stash = stashOf(property);
    if (stash !== null) {
        if (!heldShut.has(property.stashGuid) && stash.locked) {
            stash.locked = false;
        }
        reached += 1;
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
 */
export function holdsKeyOf(player: Player, property: PropertyInfo, doorGuid?: string): boolean {
    if (holdsKey(player, property.keyItem)) {
        return true;
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
 * Whether the door or container is locked in the world right now: only while it is held shut for a lockpicking, or
 * before the world was put in line with this server. Null when unknown.
 */
export function lockedInWorld(guid: string): boolean | null {
    const door = Door.find(guid);
    if (door !== null) {
        return door.locked;
    }
    const stash = Stash.find(guid);
    return stash === null ? null : stash.locked;
}

/** Whether the door or chest stands open in the world, as the last client to touch it said. False for a chest. */
export function openInWorldNow(guid: string): boolean {
    return Door.find(guid)?.open === true;
}

/** Whether the level lets the door or container be lockpicked at all. */
export function lockpickableOf(guid: string): boolean {
    const door = Door.find(guid);
    if (door !== null) {
        return door.lockpickable !== false;
    }
    const stash = Stash.find(guid);
    return stash !== null && stash.lockpickable !== false;
}

/**
 * Locks a door or chest in the world for a lockpicking, so the game offers its minigame there to whoever holds a
 * lockpick (`shut` true), or lets it go again (false). False when the level has not reported it.
 */
export function holdShut(guid: string, shut: boolean): boolean {
    const door = Door.find(guid);
    const part = door ?? Stash.find(guid);
    if (part === null) {
        return false;
    }
    if (shut) {
        heldShut.add(guid);
        part.locked = true;
    } else {
        heldShut.delete(guid);
        part.locked = false;
    }
    return true;
}

/**
 * Locks a door in the world for as long as somebody looks at it (`property-menu.ts`, the look), or lets it go. The game starts
 * to open an unlocked door the moment E is pressed, and a refusal from the server then puts the door back on the very client
 * that was opening it; a door the game thinks locked offers nothing at its keyhole side, so the press does nothing there and
 * the menu comes up with nothing to take back. False when the level has not reported the door, or when a lockpicking holds
 * it, which keeps it either way.
 */
export function holdGaze(guid: string, shut: boolean): boolean {
    const door = Door.find(guid);
    if (door === null) {
        return false;
    }
    if (shut) {
        if (heldShut.has(guid)) {
            return false;
        }
        gazeShut.add(guid);
        if (!door.locked) {
            door.locked = true;
        }
        return true;
    }
    if (!gazeShut.delete(guid)) {
        return false;
    }
    if (!heldShut.has(guid) && door.locked) {
        door.locked = false;
    }
    return true;
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

/** Swings a door open, so the player can walk in. False for a container or a door that was already open. */
export function swingOpen(guid: string): boolean {
    const door = Door.find(guid);
    return door !== null && typeof door.setOpen === "function" ? door.setOpen(true) : false;
}

/**
 * A door or chest got open without its key: forced with a lockpick, or unbolted from inside. A property locked on purpose
 * keeps that in its record (one door of several on its own); one whose lock is the level's stays open until the next start.
 */
export function unlockPart(guid: string): void {
    const property = propertyOfGuid(guid);
    if (property === null) {
        return;
    }
    if (property.lockSet !== true) {
        levelOpened.add(guid);
        return;
    }
    const index = property.doors.indexOf(guid);
    if (index >= 0 && property.doors.length > 1) {
        setDoorLocked(property.id, index, false);
    } else {
        setLocked(property.id, false);
    }
}

/**
 * Puts the world back in line: every part of every property unlocked in the world, but the ones held for a lockpicking;
 * and a door that stands open while it is locked shut again, since it can only have been opened behind this server's
 * back (a client whose door was not in sync). The doors it closed, for the log.
 */
export function sweepWorld(): string[] {
    const closed: string[] = [];
    for (const property of Object.values(load())) {
        openInWorld(property);
        for (const door of doorsOf(property)) {
            if (door.open === true && !heldShut.has(door.guid) && doorMeant(property, door.guid) && typeof door.setOpen === "function" && door.setOpen(false)) {
                closed.push(door.guid);
            }
        }
    }
    return closed;
}

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
export function closeIdleDoors(now: number = Date.now(), bodies: ReadonlyArray<{ readonly position: { readonly x: number; readonly y: number; readonly z: number } }> = typeof Player === "undefined" ? [] : Player.all()): string[] {
    const closed: string[] = [];
    for (const property of Object.values(load())) {
        for (const door of doorsOf(property)) {
            if (door.open !== true) {
                openSince.delete(door.guid);
                continue;
            }
            if (heldShut.has(door.guid) || typeof door.setOpen !== "function") {
                continue;
            }
            const about = bodies.some((body) => Math.hypot(body.position.x - door.position.x, body.position.y - door.position.y) <= idleDoors.nearM && Math.abs(body.position.z - door.position.z) <= idleDoors.nearUpM);
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
    for (const guid of [...property.doors, property.stashGuid]) {
        levelOpened.delete(guid);
    }
    const reached = openInWorld(property);
    if (locked) {
        shutDoors(property);
    }
    persist();
    return { ok: true, message: `${property.name}: ${locked ? "trancada" : "destrancada"} (${reached} ${reached === 1 ? "peça" : "peças"}).` };
}

// ---------------------------------------------------------------------------------------------
// One door at a time: the doors of a house are listed under it like its chests, each with its own lock.

/** The name a door goes by in the lists and on the prompt: the entrance, or its number among the house's doors. */
export function doorName(property: PropertyInfo, index: number): string {
    const guid = property.doors[index];
    return guid !== undefined && guid === property.doorGuid ? "Entrada" : `Porta ${index + 1}`;
}

/** Which door of the property this is, or -1. */
export function doorIndexOf(property: PropertyInfo, guid: string): number {
    return property.doors.indexOf(guid);
}

export interface DoorLine {
    readonly name: string;
    /** Locked, by this server's word (`doorMeant`): the world has every door of a property unlocked. */
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
    for (const door of property.doors) {
        levelOpened.delete(door);
    }
    openInWorld(property);
    if (locked) {
        shutDoors(property, guid);
    }
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
    persist();
    return { ok: true, message: `${property.name} agora é de ${target.nickname}. As chaves ficam no painel (Propriedades), para pegar uma de cada vez, quando precisar.` };
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
    persist();
    return { ok: true, message: `${property.name} deixou de ser de ${was}. As chaves entregues continuam com quem as tem.` };
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
    const result = previewRegion(region, target.steamId);
    for (const property of Object.values(load())) {
        if (property.region === region && property.parentId === "" && property.npc === undefined && property.ownerSteamId === "") {
            property.ownerSteamId = target.steamId;
            property.ownerName = nameOf(target);
        }
    }
    loadLords()[region] = { steamId: target.steamId, name: nameOf(target), at: Date.now(), by: giver.nickname };
    persistLords();
    if (result.given > 0) {
        persist();
    }
    const tail = [result.npc > 0 ? `${result.npc} ${result.npc === 1 ? "casa" : "casas"} de NPC ${result.npc === 1 ? "continua" : "continuam"} dos moradores` : "", result.kept > 0 ? `${result.kept} já ${result.kept === 1 ? "tinha" : "tinham"} dono e não ${result.kept === 1 ? "mudou" : "mudaram"}` : ""].filter((part) => part !== "");
    return {
        ok: true,
        message: `${region} agora é de ${target.nickname}: ${result.given} ${result.given === 1 ? "propriedade" : "propriedades"} (e ${result.chests} ${result.chests === 1 ? "baú" : "baús"})${tail.length > 0 ? `; ${tail.join("; ")}` : ""}.`,
        ...result,
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
        if (!holdsKey(player, chestProperty.keyItem)) {
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
const CENSUS_CHEST_NAME = /^Baú \d+(?: \([^)]*\))?$/;

/** How far from a building a loose chest or door still counts as part of it (the user: "tá cheio de porta e baú que era para estar dentro de propriedade"). */
export const tidying = { chestM: 35, chestNamedM: 75, doorM: 35 };

export interface TidyReport {
    /** Loose chests put under a building. */
    readonly chests: number;
    /** Loose doors folded into a building's own doors. */
    readonly doors: number;
}

/** The word in brackets of a census chest's name ("Baú 17 (Taverna)": Taverna), or "". */
const chestWord = (name: string): string => /\(([^)]+)\)\s*$/.exec(name)?.[1] ?? "";

/**
 * The census leaves, besides the houses, every chest and door it could not tie to a house by the level's own areas: in Suchdol, 41
 * chests and 20 doors that the lists showed one by one, to its lord, beside the houses they belong to. Each is put under the nearest
 * building of its region: a chest by its place ("Baú 17 (Taverna)" under the tavern, when the tavern is within 75 m; otherwise the
 * nearest building within 35 m), a door among the building's own doors (so its lock and key are the building's). A chest or a door
 * with a key made for it, an owner other than the region's lord or a lock of its own is left as it is, and so is one too far from any building. Safe to run again.
 */
export function tidyLoose(): TidyReport {
    const store = load();
    const flat = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);
    const buildings = Object.values(store).filter((property) => property.kind === "house" && property.parentId === "");
    let chests = 0;
    let doors = 0;
    for (const loose of Object.values(store).sort((a, b) => a.name.localeCompare(b.name, "pt", { numeric: true }))) {
        // Whose they may be: nobody's, or the lord's of the region, which the cession stamped on every property it found (a
        // chest or a door a player holds, or has a key to, is theirs and stays where it is). And a building takes them only if
        // it is nobody's or the lord's too, so a chest by a player's house does not become the player's.
        const lord = regionLordOf(loose.region)?.steamId ?? "";
        const common = (steamId: string): boolean => steamId === "" || steamId === lord;
        if (loose.parentId !== "" || loose.keys > 0 || !common(loose.ownerSteamId) || loose.npc !== undefined || (loose.kind !== "chest" && loose.kind !== "door")) {
            continue;
        }
        const near = buildings.filter((building) => building.region === loose.region && common(building.ownerSteamId)).sort((a, b) => flat(loose, a) - flat(loose, b));
        if (loose.kind === "chest") {
            const word = chestWord(loose.name).toLowerCase();
            const named = word === "" ? undefined : near.find((building) => building.name.toLowerCase().includes(word) && flat(loose, building) <= tidying.chestNamedM);
            const home = named ?? near.find((building) => flat(loose, building) <= tidying.chestM);
            if (home === undefined) {
                continue;
            }
            const prefix = `${home.name}${CHEST_SEPARATOR}Baú`;
            store[loose.id] = { ...loose, parentId: home.id, name: `${prefix} ${highestNumber(home.region, prefix) + 1}` };
            chests += 1;
        } else {
            const home = near.find((building) => flat(loose, building) <= tidying.doorM);
            if (home === undefined || loose.lockSet === true || loose.locked || loose.doorGuid === "") {
                continue;
            }
            const current = store[home.id] as PropertyInfo;
            store[home.id] = { ...current, doors: [...new Set([...current.doors, ...loose.doors])] };
            delete store[loose.id];
            doors += 1;
        }
    }
    if (chests > 0 || doors > 0) {
        persist();
    }
    return { chests, doors };
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
    const box = region.fortress;
    const store = load();
    const name = `Castelo de ${region.name}`;
    const existing = Object.values(store).find((property) => property.region === region.name && property.name === name) ?? null;
    const byDoor = lookup().byDoor;

    const wanted = new Set<string>(existing?.doors ?? []);
    const folded = new Map<string, PropertyInfo>();
    for (const door of Door.all()) {
        if (!withinBox(box, door.position) || /^cin_|_cin_/i.test(door.name)) {
            continue;
        }
        const owner = byDoor.get(door.guid);
        if (owner === undefined || owner === existing) {
            wanted.add(door.guid);
        } else if (owner.kind === "door" && owner.auto && owner.keys === 0 && owner.ownerSteamId === "" && !owner.locked) {
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

    // The main door: the one nearest the middle of the walls.
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
            id: slugify(`${region.id} castelo`, store),
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
    for (const property of folded.values()) {
        delete store[property.id];
    }

    // The chests inside the walls, west to east. A chest somebody has named keeps its name and still moves under the
    // castle; one that has an owner or keys handed out stays as it is (under the castle it would take the castle's owner).
    const prefix = `${name}${CHEST_SEPARATOR}Baú`;
    let number = highestNumber(region.name, prefix);
    let chests = 0;
    const inside = Stash.all()
        .filter((stash) => stash.levelGuid !== "" && /chest/i.test(stash.name) && withinBox(box, stash.position))
        .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y);
    const byStash = lookup().byStash;
    for (const stash of inside) {
        const filed = byStash.get(stash.levelGuid);
        if (filed !== undefined && (filed.parentId !== "" || filed.kind !== "chest" || filed.ownerSteamId !== "" || filed.keys > 0)) {
            continue;
        }
        number += 1;
        const label = `${prefix} ${number}`;
        if (filed !== undefined) {
            store[filed.id] = { ...filed, parentId: castle.id, name: CENSUS_CHEST_NAME.test(filed.name) ? label : filed.name };
        } else {
            const id = slugify(`${region.id} ${label}`, store);
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
        }
        chests += 1;
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
    [/smithy|blacksmith|forge/i, "Ferraria"],
    [/tavern|innkeeper|\binn\b|pubs?\b/i, "Taverna"],
    [/mill/i, "Moinho"],
    [/church|chapel|parish|religious/i, "Igreja"],
    [/barn|stable|stall/i, "Celeiro"],
    [/shed/i, "Galpão"],
    [/workshop/i, "Oficina"],
    [/tower/i, "Torre"],
    [/fortress|defensive|castle/i, "Fortaleza"],
    [/ammo|depot|military/i, "Depósito"],
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
    const inside = (p: { x: number; y: number }): boolean => withinBox(region, p);

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
    const doorsInside = Door.all().filter((door) => inside(door.position));
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
        .filter((stash) => stash.levelGuid !== "" && /chest/i.test(stash.name) && inside(stash.position))
        .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y);
    for (const stash of chests) {
        chestsSeen += 1;
        if (known.has(stash.levelGuid)) {
            alreadyKnown += 1;
            continue;
        }
        const candidate: Candidate = { label: "Baú", kind: "chest", doors: [], stashGuid: stash.levelGuid, x: stash.position.x, y: stash.position.y, z: stash.position.z, raw: stash.name };
        const owner = owners.find((entry) => entry.area?.contains(stash.position));
        if (owner !== undefined) {
            const prefix = `${owner.name}${CHEST_SEPARATOR}Baú`;
            add(candidate, `${prefix} ${nextNumber(prefix)}`, owner.id);
            continue;
        }
        const around = buildingType(...Area.getAt(stash.position).map((area) => area.name));
        const hint = around !== "Edifício" && around !== "Casa" ? ` (${around})` : "";
        add(candidate, `Baú ${pad(nextNumber("Baú"))}${hint}`);
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

    // Every door and chest of a property stands unlocked in the world (see Locks). The level reports a door only once
    // somebody has been near it, so what is not there yet is tried again for a while, and the sweep below keeps at it.
    const waiting = new Set<string>();
    let inLine = 0;
    for (const property of Object.values(store)) {
        if (openInWorld(property) < partsOf(property)) {
            waiting.add(property.id);
        } else {
            inLine += 1;
        }
    }
    const onPurpose = Object.values(store).filter((property) => property.lockSet === true).length;
    console.log(`properties: ${Object.keys(store).length} propriedade(s) conhecida(s), ${registered} com chave registrada; ${onPurpose} com tranca posta à mão, as outras com a do nível; ${inLine} já destrancada(s) no mundo (a tranca é do servidor)${waiting.size > 0 ? `, ${waiting.size} esperando o nível` : ""}`);
    if (waiting.size > 0) {
        let attempts = 0;
        const retry = setInterval(() => {
            attempts += 1;
            for (const id of [...waiting]) {
                const property = getProperty(id);
                if (property === null || openInWorld(property) >= partsOf(property)) {
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
        }, delay);
    }

    // What the census left loose, put under the buildings it stands by, after the castles have taken theirs.
    setTimeout(() => {
        try {
            const done = tidyLoose();
            if (done.chests > 0 || done.doors > 0) {
                console.log(`properties: ${done.chests} baú(s) e ${done.doors} porta(s) soltos foram para dentro das propriedades perto delas`);
            }
        } catch (error: unknown) {
            console.error(`properties: não consegui arrumar os baús e portas soltos: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, 150_000);

    // An owner who has changed their name is called by the new one.
    Events.on("playerSpawned", (player) => noteNickname(player));

    // The world kept in line: what the level reports later, and a door opened behind this server's back while locked.
    const sweep = setInterval(() => {
        const closed = sweepWorld();
        if (closed.length > 0) {
            console.log(`properties: ${closed.length} porta(s) trancada(s) estava(m) aberta(s) sem passar pelo menu e foi(ram) fechada(s): ${closed.map((guid) => labelFor(guid) || guid).join("; ")}`);
        }
        const idle = closeIdleDoors();
        if (idle.length > 0) {
            console.log(`properties: ${idle.length} porta(s) aberta(s) sem ninguém por perto foi(ram) fechada(s): ${idle.map((guid) => labelFor(guid) || guid).join("; ")}`);
        }
    }, SWEEP_EVERY_MS);
    Events.on("resourceStop", (name) => {
        if (name === "kcdc-gamemode") {
            clearInterval(sweep);
        }
    });
}
