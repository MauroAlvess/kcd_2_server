/**
 * Cidadania (user, 2026-10-17). A player may become a citizen of one of the realm's towns -- Suchdol, Raborsch, Malešov -- in the
 * panel's Cidadania section, and a citizen who dies wakes in their town; one with no citizenship wakes in the nearest church, as
 * before (`respawn.ts`). The choice is for good: the only way to change it is for the lord of the town's lands (the player the
 * region was ceded to, `regions.json`) to depose it, from the same section, where he also sees who lives on his lands. An
 * administrator may do the same, and `/cidadania` sets or clears one by hand.
 *
 * Kept by Steam id in `playerdata/citizenship.json`. The page is told, for each town, its crest, its lord, the lord's family name
 * and how many citizens it has; the list of citizens is asked for a page at a time and only the lord (or an administrator) gets it.
 */

import { isAdmin } from "./auth.js";
import { getSurname } from "./family.js";
import { BARBERS } from "./barbers.js";
import { nameOfMember } from "./guild-members.js";
import { regionLordOf } from "./properties.js";
import { CHURCHES, setHomeResolver, wakePoint } from "./respawn.js";
import { addPayload, notice, sendSocial } from "./status.js";
import { ensureDir, read, write } from "./store.js";
import { VENDORS } from "./vendors.js";

const RESOURCE = "kcdc-gamemode";
const DIR = "playerdata";
const FILE = `${DIR}/citizenship.json`;

export interface Town {
    readonly id: string;
    /** The property catalog's region the town's lord is lord of. */
    readonly region: string;
    readonly name: string;
    /** The crest, in `ui/img`. */
    readonly crest: string;
    /** The church a citizen wakes in, when the town has one. */
    readonly church: string | null;
    /** Where a citizen wakes in a town with no church of its own: its square. */
    readonly square: { readonly x: number; readonly y: number; readonly z: number } | null;
}

export const TOWNS: readonly Town[] = [
    { id: "suchdol", region: "Suchdol", name: "Suchdol", crest: "town-suchdol.webp", church: "suchdol", square: null },
    { id: "raborsch", region: "Raborsch", name: "Raborsch", crest: "town-raborsch.webp", church: "raborsch", square: null },
    { id: "malesov", region: "Malešov", name: "Malešov", crest: "town-maleshov.webp", church: null, square: { x: 560.5, y: 258.3, z: 109.6 } },
];

export const PAGE_SIZE = 8;

interface Citizen {
    town: string;
    since: number;
}

const citizens = new Map<string, Citizen>();
let writable = true;

export function townById(id: unknown): Town | null {
    return typeof id === "string" ? (TOWNS.find((town) => town.id === id) ?? null) : null;
}

/** The town a player is a citizen of, or null. */
export function townOf(steamId: string): Town | null {
    const record = steamId === "" ? undefined : citizens.get(steamId);
    return record === undefined ? null : townById(record.town);
}

/** The Steam ids of a town's citizens, the oldest first. */
export function citizensOf(town: Town): string[] {
    return [...citizens.entries()]
        .filter(([, record]) => record.town === town.id)
        .sort((a, b) => a[1].since - b[1].since)
        .map(([steamId]) => steamId);
}

/** A key for the page to name a citizen by, which is no Steam id. */
export function keyOf(steamId: string): string {
    let hash = 5381;
    for (let index = 0; index < steamId.length; index += 1) {
        hash = ((hash * 33) ^ steamId.charCodeAt(index)) >>> 0;
    }
    return `c${hash.toString(36)}`;
}

/** Whether `player` is the lord of the town's lands, or an administrator. */
export function mayDepose(player: Player, town: Town): boolean {
    const lord = regionLordOf(town.region);
    return isAdmin(player) || (lord !== null && player.steamId !== "" && lord.steamId === player.steamId);
}

function save(): void {
    if (!writable) {
        return;
    }
    try {
        ensureDir(DIR);
        write(FILE, { v: 1, citizens: Object.fromEntries(citizens) });
    } catch (error: unknown) {
        console.log(`citizenship: não consegui gravar ${FILE}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export interface Outcome {
    readonly ok: boolean;
    readonly message: string;
}

/** A player becomes a citizen of a town, if they are not one already. */
export function choose(player: Player, townId: unknown, now: number = Date.now()): Outcome {
    const town = townById(townId);
    if (town === null) {
        return { ok: false, message: "Essa cidade não existe." };
    }
    if (player.steamId === "") {
        return { ok: false, message: "Sua conta não tem identificação Steam, então a cidadania não poderia ser salva." };
    }
    const current = townOf(player.steamId);
    if (current !== null) {
        return { ok: false, message: current.id === town.id ? `Você já é cidadão de ${town.name}.` : `Você já é cidadão de ${current.name}: só o senhor das terras pode depor a sua cidadania.` };
    }
    citizens.set(player.steamId, { town: town.id, since: now });
    save();
    console.log(`citizenship: ${player.nickname} é cidadão de ${town.name}`);
    return { ok: true, message: `Você agora é cidadão de ${town.name}: quando morrer, é lá que você acorda.` };
}

/** Takes a citizenship away, for the lord of the lands (or an administrator): the citizen may choose again. */
export function depose(actor: Player, townId: unknown, key: unknown): Outcome {
    const town = townById(townId);
    if (town === null || typeof key !== "string") {
        return { ok: false, message: "Essa cidade não existe." };
    }
    if (!mayDepose(actor, town)) {
        return { ok: false, message: `Só o senhor das terras de ${town.name} depõe uma cidadania.` };
    }
    const steamId = citizensOf(town).find((candidate) => keyOf(candidate) === key);
    if (steamId === undefined) {
        return { ok: false, message: "Essa pessoa não é mais cidadã dessa cidade." };
    }
    const name = nameOfMember(steamId);
    citizens.delete(steamId);
    save();
    const online = Player.all().find((other) => other.steamId === steamId);
    if (online !== undefined) {
        notice(online, `A sua cidadania de ${town.name} foi deposta. Você pode escolher uma cidade de novo, na seção Cidadania.`);
        sendSocial(online);
    }
    console.log(`citizenship: ${actor.nickname} depôs a cidadania de ${name} em ${town.name}`);
    return { ok: true, message: `A cidadania de ${name} em ${town.name} foi deposta.` };
}

/** What `/cidadania` does: sets a citizenship by hand (administrators), whatever it was. */
export function setCitizenship(steamId: string, townId: string | null, now: number = Date.now()): boolean {
    if (steamId === "") {
        return false;
    }
    if (townId === null) {
        const had = citizens.delete(steamId);
        if (had) {
            save();
        }
        return had;
    }
    if (townById(townId) === null) {
        return false;
    }
    citizens.set(steamId, { town: townId, since: now });
    save();
    return true;
}

/** Where a citizen wakes: the church of their town, or its square. Null for somebody with no town. */
export function homeOf(steamId: string): { town: Town; point: { x: number; y: number; z: number } } | null {
    const town = townOf(steamId);
    if (town === null) {
        return null;
    }
    const church = town.church === null ? undefined : CHURCHES.find((candidate) => candidate.id === town.church);
    if (church !== undefined) {
        return { town, point: wakePoint(church) };
    }
    if (town.square !== null) {
        const floor = Navigation.ready ? Navigation.closestPoint(town.square, { searchRadius: 6, searchHeight: 4, doors: "any" }) : null;
        return { town, point: floor !== null ? { x: floor.x, y: floor.y, z: floor.z } : { ...town.square, z: town.square.z + 0.3 } };
    }
    return null;
}

export interface TownView {
    readonly id: string;
    readonly name: string;
    readonly crest: string;
    /** The lord of the lands: the name the character was given, or null while nobody holds them. */
    readonly lord: string | null;
    /** The lord's family name, or null. */
    readonly family: string | null;
    readonly citizens: number;
    /** How many NPCs live in the town: its vendors, its bath maids and its barber (not the pedlars of the roadside camps). */
    readonly npcs: number;
}

/** The NPCs of a town: the vendors whose village it is (the pedlars' "village" is their camp), and its barber. */
export function npcsOf(town: Town): number {
    return VENDORS.filter((vendor) => vendor.village === town.region && vendor.trade !== "mascate").length + BARBERS.filter((barber) => barber.id === `barbeiro-${town.id}`).length;
}

export function townView(town: Town): TownView {
    const lord = regionLordOf(town.region);
    return { id: town.id, name: town.name, crest: town.crest, lord: lord === null ? null : (lord.name !== "" ? lord.name : nameOfMember(lord.steamId)), family: lord === null ? null : getSurname(lord.steamId), citizens: citizensOf(town).length, npcs: npcsOf(town) };
}

export interface CitizenLine {
    readonly key: string;
    readonly name: string;
    readonly since: number;
    readonly you: boolean;
}

export interface CitizenPage {
    readonly town: string;
    readonly total: number;
    readonly page: number;
    readonly pages: number;
    readonly first: number;
    readonly citizens: CitizenLine[];
}

/** One page of a town's citizens, for its lord or an administrator; null for anybody else. */
export function citizenPage(viewer: Player, townId: unknown, wanted: unknown): CitizenPage | null {
    const town = townById(townId);
    if (town === null || !mayDepose(viewer, town)) {
        return null;
    }
    const all = citizensOf(town);
    const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    const page = typeof wanted === "number" && Number.isInteger(wanted) ? Math.min(Math.max(wanted, 0), pages - 1) : 0;
    const slice = all.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    return {
        town: town.id,
        total: all.length,
        page,
        pages,
        first: page * PAGE_SIZE,
        citizens: slice.map((steamId) => ({ key: keyOf(steamId), name: nameOfMember(steamId), since: citizens.get(steamId)?.since ?? 0, you: steamId === viewer.steamId })),
    };
}

function fieldsOf(payload: unknown): Record<string, unknown> {
    try {
        const value = typeof payload === "string" && payload.length <= 512 ? (JSON.parse(payload) as unknown) : payload;
        return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}

export function installCitizenship(): void {
    const loaded = read<{ citizens?: Record<string, unknown> }>(FILE);
    if (loaded.status === "ok" && typeof loaded.value.citizens === "object" && loaded.value.citizens !== null) {
        for (const [steamId, raw] of Object.entries(loaded.value.citizens)) {
            const record = raw as Partial<Citizen> | null;
            if (record !== null && typeof record === "object" && typeof record.town === "string" && townById(record.town) !== null) {
                citizens.set(steamId, { town: record.town, since: typeof record.since === "number" && Number.isFinite(record.since) ? record.since : 0 });
            }
        }
    } else if (loaded.status === "corrupt") {
        writable = false;
        console.log(`citizenship: ${FILE} está ilegível e foi deixado como está: ${loaded.reason}`);
    }
    console.log(`citizenship: ${citizens.size} cidadão(s) em ${TOWNS.length} cidade(s)`);

    // Who dies wakes in their town.
    setHomeResolver((steamId) => {
        const home = homeOf(steamId);
        return home === null ? null : { place: home.town.name, point: home.point, text: `${home.town.name}, a sua cidade` };
    });

    addPayload((player) => {
        const lorded = TOWNS.filter((town) => mayDepose(player, town) && regionLordOf(town.region) !== null).map((town) => town.id);
        return { citizenship: { towns: TOWNS.map(townView), mine: townOf(player.steamId)?.id ?? null, lordOf: isAdmin(player) ? TOWNS.map((town) => town.id) : lorded } };
    });

    Events.onClient(`${RESOURCE}:status.citizenChoose`, (sender, payload) => {
        const player = sender as Player;
        const result = choose(player, fieldsOf(payload)["town"]);
        notice(player, result.message);
        sendSocial(player);
    });

    Events.onClient(`${RESOURCE}:status.citizens`, (sender, payload) => {
        const player = sender as Player;
        const fields = fieldsOf(payload);
        const answer = citizenPage(player, fields["town"], fields["page"]);
        if (answer !== null) {
            player.emit(`${RESOURCE}:status.citizens`, JSON.stringify(answer));
        }
    });

    Events.onClient(`${RESOURCE}:status.citizenDepose`, (sender, payload) => {
        const player = sender as Player;
        const fields = fieldsOf(payload);
        const result = depose(player, fields["town"], fields["key"]);
        notice(player, result.message);
        const answer = citizenPage(player, fields["town"], fields["page"]);
        if (answer !== null) {
            player.emit(`${RESOURCE}:status.citizens`, JSON.stringify(answer));
        }
        sendSocial(player);
    });
}
