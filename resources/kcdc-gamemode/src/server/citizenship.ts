/**
 * Cidadania (user, 2026-10-17). A player may become a citizen of one of the realm's towns -- Suchdol, Raborsch, Malešov, Kuttenberg, Pschitoky -- in the
 * panel's Cidadania section, and a citizen who dies wakes in their town; one with no citizenship wakes in the nearest church, as
 * before (`respawn.ts`). The lord of the town's lands (the player the region was ceded to, `regions.json`) may depose a citizenship, from the
 * same section, where he also sees who lives on his lands; an administrator may do the same, and `/cidadania` sets or clears one by hand.
 *
 * Seats and lands (user, 2026-10-26: "Raborsch manda nas terras de Bohunowitz e Horschan; Suchdol em Wysoka; Malešov em Bylany; Pschitoky em
 * Miskowitz; Kuttenberg em Stará Kutná"): each of the five towns is the SEAT of a house, and the villages that house rules are its LANDS. A
 * land carries its seat's crest (the panel draws it repeated, marked as a land) and a player may be a citizen of it as of any town: they
 * wake there, and the lord of its seat, or of its own region when that was ceded on its own, is its lord and may depose its citizens.
 *
 * Changing the citizenship (2026-10-26: "uma vez grátis, depois custa 100 moedas"): the first change is the player's free one, every one after
 * it costs `CHANGE_PRICE_COINS` (`change-fee.ts`); the first choice costs nothing, and neither does a citizen the lord deposed choosing again, nor an
 * administrator changing town.
 *
 * Closing and expelling (2026-10-29, the user: "um lorde no painel Cidadania deve poder bloquear a cidadania, e assim nenhum jogador consegue virar cidadão das terras
 * dele, e também deve poder expulsar cidadãos de suas terras"): the lord of a town's lands (or an administrator) may CLOSE its citizenship, so that nobody new can become a
 * citizen of it (those who already are stay, and may leave), and open it again; the lord himself and the administrators may still choose it. EXPELLING is deposing: the
 * citizen loses the town and wakes in the churches again.
 *
 * The rest of the mapped regions (2026-10-29, the user: "as regiões mapeadas vamos colocar nas terras de cada cidadania que já temos ... de forma equilibrada ... e entregar as
 * terras novas ao dono da região principal, que é o lorde"): the five regions of the catalog that were no town's -- Opatowitz, Rabstein, Stará Lhota, Danemark and Minas -- are
 * lands now, one or two to a seat, so the five houses hold two or three lands each (the distance to the seat decided who gets which, within that balance). Each of them
 * FOLLOWS its seat's lord (`follows`): the first time it has no lord of its own and its seat has one, the region is ceded to him (`grantFollowingLands`), as an
 * administrator's "Ceder a região inteira" would, and written down so that a lord taken off later is not put back.
 *
 * Kept by Steam id in `playerdata/citizenship.json`, with the towns held shut and the lands already handed over. The page is told, for each town, its crest, its lord, the lord's family name,
 * the lord's spouse (the Lady, user 2026-10-25) and how many citizens it has; the list of citizens is asked for a page at a time and only
 * the lord (or an administrator) gets it.
 */

import { isAdmin } from "./auth.js";
import { consortsOf } from "./consort.js";
import type { Consort } from "./consort.js";
import { getSurname } from "./family.js";
import { BARBERS } from "./barbers.js";
import { nameOfMember } from "./guild-members.js";
import { cedeRegionTo, regionCeded, regionLordOf } from "./properties.js";
import type { RegionLord } from "./properties.js";
import { CHURCHES, setHomeResolver, wakePoint } from "./respawn.js";
import { addPayload, notice, sendSocial } from "./status.js";
import { ensureDir, read, write } from "./store.js";
import { chargeForChange } from "./change-fee.js";
import { CHANGE_PRICE_COINS } from "./free-changes.js";
import { VENDORS } from "./vendors.js";

const RESOURCE = "kcdc-gamemode";
const DIR = "playerdata";
const FILE = `${DIR}/citizenship.json`;

export interface Town {
    readonly id: string;
    /** The property catalog's region the town's lord is lord of. */
    readonly region: string;
    readonly name: string;
    /** The crest, in `ui/img`; `@name` is a picture the server sends instead (`ui-images.ts`, `data/ui-images.json`). */
    readonly crest: string;
    /** The church a citizen wakes in, when the town has one. */
    readonly church: string | null;
    /** Where a citizen wakes in a town with no church of its own: its square. */
    readonly square: { readonly x: number; readonly y: number; readonly z: number } | null;
    /** The town this one is the land of (a seat's `id`), or null for a seat: the village of a house itself. */
    readonly seat: string | null;
    /** A land that follows its seat's lord: when it has no lord of its own, the region is ceded to the seat's lord once (`grantFollowingLands`). */
    readonly follows?: true;
}

export const TOWNS: readonly Town[] = [
    // Each seat is followed by the lands of its house (user, 2026-10-26), so a list of them reads in groups. A land is drawn with its seat's crest.
    { id: "suchdol", region: "Suchdol", name: "Suchdol", crest: "town-suchdol.webp", church: "suchdol", square: null, seat: null },
    { id: "wysoka", region: "Wysoka", name: "Wysoka", crest: "town-suchdol.webp", church: "wysoka", square: null, seat: "suchdol" },
    // The lands the rest of the mapped regions became (2026-10-29). Those with no church wake their citizens at a house of the hamlet (the position the catalog keeps for it),
    // snapped to the walkable floor like the others; unverified in game. Minas has its own church (the miners' one, `grunta`).
    { id: "opatowitz", region: "Opatowitz", name: "Opatowitz", crest: "town-suchdol.webp", church: null, square: { x: 1886.71, y: 2992.22, z: 145.89 }, seat: "suchdol", follows: true },
    { id: "raborsch", region: "Raborsch", name: "Raborsch", crest: "town-raborsch.webp", church: "raborsch", square: null, seat: null },
    // The lands with no church wake their citizens at the village's tavern keeper's door when the census has one (`villageSpot`), and else where the
    // coach stop of the village sets travellers down (hand-placed in World Builder, `travel.ts`): outside the village, on its road, but walkable.
    { id: "bohunowitz", region: "Bohunowitz", name: "Bohunowitz", crest: "town-raborsch.webp", church: null, square: { x: 1913.53, y: 3451.07, z: 108.53 }, seat: "raborsch" },
    { id: "horschan", region: "Horschan", name: "Horschan", crest: "town-raborsch.webp", church: null, square: { x: 2669.5, y: 2672.6, z: 130.83 }, seat: "raborsch" },
    { id: "malesov", region: "Malešov", name: "Malešov", crest: "town-maleshov.webp", church: null, square: { x: 560.5, y: 258.3, z: 109.6 }, seat: null },
    { id: "bylany", region: "Bylany", name: "Bylany", crest: "town-maleshov.webp", church: null, square: { x: 1716.6, y: 974.5, z: 105.26 }, seat: "malesov" },
    { id: "rabstein", region: "Rabstein", name: "Rabstein", crest: "town-maleshov.webp", church: null, square: { x: 982.01, y: 1051.63, z: 89.06 }, seat: "malesov", follows: true },
    { id: "stara-lhota", region: "Stará Lhota", name: "Stará Lhota", crest: "town-maleshov.webp", church: null, square: { x: 680.93, y: 922.71, z: 95.0 }, seat: "malesov", follows: true },
    // Kuttenberg (2026-10-20): its crest is one the package has no room for (`@`: the server sends it, `ui-images.ts`); a citizen wakes in
    // São Tiago, the church nearest the middle of the town (Santa Bárbara is on its western edge, the arrabalde's on the north).
    { id: "kuttenberg", region: "Kuttenberg", name: "Kuttenberg", crest: "@town-kuttenberg", church: "sao-tiago", square: null, seat: null },
    { id: "stara-kutna", region: "Stará Kutná", name: "Stará Kutná", crest: "@town-kuttenberg", church: "stara-kutna", square: null, seat: "kuttenberg" },
    { id: "danemark", region: "Danemark", name: "Danemark", crest: "@town-kuttenberg", church: null, square: { x: 1561.14, y: 222.37, z: 57.21 }, seat: "kuttenberg", follows: true },
    // Pschitoky (2026-10-25: "adicione a cidadania de Pschitoky, o brasão está na pasta img"): the crest is sent by the server too, and the village has no
    // church, so a citizen wakes at its square: where the user put the village's notice board (2304.5, 1821.5), a few steps to the side of it.
    { id: "pschitoky", region: "Pschitoky", name: "Pschitoky", crest: "@town-pschitoky", church: null, square: { x: 2307.0, y: 1821.5, z: 129.8 }, seat: null },
    { id: "miskowitz", region: "Miskowitz", name: "Miskowitz", crest: "@town-pschitoky", church: null, square: { x: 1689.88, y: 1901.07, z: 145.97 }, seat: "pschitoky" },
    { id: "minas", region: "Minas", name: "Minas", crest: "@town-pschitoky", church: "grunta", square: null, seat: "pschitoky", follows: true },
];

export const PAGE_SIZE = 8;

interface Citizen {
    town: string;
    since: number;
}

const citizens = new Map<string, Citizen>();
/** The towns whose citizenship the lord of their lands holds shut (the ids). */
const closedTowns = new Set<string>();
/** The regions of the lands that follow their seat's lord which were already handed over (or had a lord of their own): never handed again, whatever happens to the lord later. */
const grantedRegions = new Set<string>();
let granting = false;
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

/** The seat of a land, or null for a seat. */
export function seatOf(town: Town): Town | null {
    return town.seat === null ? null : townById(town.seat);
}

/** The lands a seat rules, in the list's order. */
export function landsOf(town: Town): Town[] {
    return TOWNS.filter((candidate) => candidate.seat === town.id);
}

/** The regions whose lord is lord of this town: its own and, for a land, its seat's. */
export function lordRegions(town: Town): string[] {
    const seat = seatOf(town);
    return seat === null ? [town.region] : [town.region, seat.region];
}

/** The lord of a town's lands: the player its region was ceded to, and for a land that has none of its own, the lord of its seat. */
export function lordOfTown(town: Town): RegionLord | null {
    for (const region of lordRegions(town)) {
        const lord = regionLordOf(region);
        if (lord !== null) {
            return lord;
        }
    }
    return null;
}

/** Whether the lord of the town's lands has closed its citizenship to newcomers. */
export function isClosed(town: Town): boolean {
    return closedTowns.has(town.id);
}

/** Whether `player` is the lord of the town's lands (of a land's seat too), or an administrator. */
export function mayDepose(player: Player, town: Town): boolean {
    return isAdmin(player) || (player.steamId !== "" && lordRegions(town).some((region) => regionLordOf(region)?.steamId === player.steamId));
}

function save(): void {
    if (!writable) {
        return;
    }
    try {
        ensureDir(DIR);
        write(FILE, { v: 1, citizens: Object.fromEntries(citizens), closed: [...closedTowns], granted: [...grantedRegions] });
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
    if (current !== null && current.id === town.id) {
        return { ok: false, message: `Você já é cidadão de ${town.name}.` };
    }
    // A town whose lord has closed its citizenship takes nobody new; the lord of its lands and the administrators may still choose it.
    if (isClosed(town) && !mayDepose(player, town)) {
        return { ok: false, message: `A cidadania de ${town.name} está fechada pelo senhor das terras: ninguém novo pode se tornar cidadão por enquanto.` };
    }
    // An administrator changes town at will, without the price and without using the free change (2026-10-26), as they change guild.
    if (current !== null && isAdmin(player)) {
        citizens.set(player.steamId, { town: town.id, since: now });
        save();
        console.log(`citizenship: ${player.nickname} (administrador) mudou de cidade sem pagar: ${current.name} -> ${town.name}`);
        return { ok: true, message: `Administrador: você agora é cidadão de ${town.name} (era de ${current.name}). Administradores não pagam a troca.` };
    }
    // Every player's one free change (2026-10-19), then a change for a price (2026-10-26): the old town lets them go.
    if (current !== null) {
        const fee = chargeForChange(player, "citizenship");
        if (!fee.ok) {
            return { ok: false, message: fee.message };
        }
        citizens.set(player.steamId, { town: town.id, since: now });
        save();
        console.log(`citizenship: ${player.nickname} trocou de cidade (${fee.free ? "troca gratuita" : `${CHANGE_PRICE_COINS} moedas`}): ${current.name} -> ${town.name}`);
        return {
            ok: true,
            message: fee.free
                ? `Você agora é cidadão de ${town.name} (era de ${current.name}). Esta era a sua troca gratuita: as próximas custam ${CHANGE_PRICE_COINS} moedas.`
                : `Você agora é cidadão de ${town.name} (era de ${current.name}) por ${CHANGE_PRICE_COINS} moedas.`,
        };
    }
    citizens.set(player.steamId, { town: town.id, since: now });
    save();
    console.log(`citizenship: ${player.nickname} é cidadão de ${town.name}`);
    return { ok: true, message: `Você agora é cidadão de ${town.name}: quando morrer, é lá que você acorda.` };
}

/** Closes or opens the citizenship of a town, for the lord of its lands (or an administrator). */
export function setClosed(actor: Player, townId: unknown, closed: boolean): Outcome {
    const town = townById(townId);
    if (town === null) {
        return { ok: false, message: "Essa cidade não existe." };
    }
    if (!mayDepose(actor, town)) {
        return { ok: false, message: `Só o senhor das terras de ${town.name} fecha ou abre a cidadania.` };
    }
    if (isClosed(town) === closed) {
        return { ok: false, message: closed ? `A cidadania de ${town.name} já está fechada.` : `A cidadania de ${town.name} já está aberta.` };
    }
    if (closed) {
        closedTowns.add(town.id);
    } else {
        closedTowns.delete(town.id);
    }
    save();
    console.log(`citizenship: ${actor.nickname} ${closed ? "fechou" : "abriu"} a cidadania de ${town.name}`);
    return {
        ok: true,
        message: closed
            ? `A cidadania de ${town.name} está fechada: ninguém novo pode se tornar cidadão. Quem já é continua, e você a abre de novo quando quiser.`
            : `A cidadania de ${town.name} está aberta: quem quiser pode se tornar cidadão.`,
    };
}

/** Expels a citizen from the town (takes the citizenship away), for the lord of the lands (or an administrator): they wake in the churches again, and may choose again unless the town is closed. */
export function depose(actor: Player, townId: unknown, key: unknown): Outcome {
    const town = townById(townId);
    if (town === null || typeof key !== "string") {
        return { ok: false, message: "Essa cidade não existe." };
    }
    if (!mayDepose(actor, town)) {
        return { ok: false, message: `Só o senhor das terras de ${town.name} expulsa um cidadão.` };
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
        notice(online, `Você foi expulso(a) de ${town.name}: a sua cidadania acabou. ${isClosed(town) ? "A cidadania de lá está fechada." : "Você pode escolher uma cidade de novo, na seção Cidadania."}`);
        sendSocial(online);
    }
    console.log(`citizenship: ${actor.nickname} expulsou ${name} de ${town.name}`);
    return { ok: true, message: `${name} foi expulso(a) de ${town.name}: a cidadania acabou.` };
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
        // A land with no church wakes its citizens at the village itself when the census has found its vendors, at the stop's spot otherwise.
        const spot = (town.seat !== null ? villageSpot(town) : null) ?? town.square;
        const floor = Navigation.ready ? Navigation.closestPoint(spot, { searchRadius: 6, searchHeight: 4, doors: "any" }) : null;
        return { town, point: floor !== null ? { x: floor.x, y: floor.y, z: floor.z } : { ...spot, z: spot.z + 0.3 } };
    }
    return null;
}

/** The middle of a village as its vendors stand in it: the tavern keeper's door, the smith's, the apothecary's. Null when the village has none (yet). */
export function villageSpot(town: Town): { x: number; y: number; z: number } | null {
    for (const trade of ["taberneiro", "ferreiro", "alquimista"]) {
        const home = VENDORS.find((vendor) => vendor.village === town.region && vendor.trade === trade)?.home;
        if (home !== undefined) {
            return { x: home.x, y: home.y, z: home.z };
        }
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
    /** The lord's spouse, as the realm calls them beside him (his wife is a Lady), or null. */
    readonly consort: Consort | null;
    /** The seat this town is the land of (its `id`), or null for a seat. */
    readonly seat: string | null;
    /** The seat's name, for a land. */
    readonly seatName: string | null;
    /** The names of the lands of a seat. */
    readonly lands: string[];
    readonly citizens: number;
    /** Whether the lord has closed the citizenship to newcomers. */
    readonly closed: boolean;
    /** How many NPCs live in the town: its vendors, its bath maids and its barber (not the pedlars of the roadside camps). */
    readonly npcs: number;
}

/** The NPCs of a town: the vendors whose village it is (the pedlars' "village" is their camp), and its barber. */
export function npcsOf(town: Town): number {
    return VENDORS.filter((vendor) => vendor.village === town.region && vendor.trade !== "mascate").length + BARBERS.filter((barber) => barber.id === `barbeiro-${town.id}`).length;
}

export function townView(town: Town): TownView {
    const lord = lordOfTown(town);
    const consort = lord === null ? null : (consortsOf(lord.steamId)[0] ?? null);
    return {
        id: town.id,
        name: town.name,
        crest: town.crest,
        lord: lord === null ? null : (lord.name !== "" ? lord.name : nameOfMember(lord.steamId)),
        family: lord === null ? null : getSurname(lord.steamId),
        consort,
        seat: town.seat,
        seatName: seatOf(town)?.name ?? null,
        lands: landsOf(town).map((land) => land.name),
        citizens: citizensOf(town).length,
        closed: isClosed(town),
        npcs: npcsOf(town),
    };
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

/**
 * Hands the lands that follow their seat's lord (`follows`) to him: for each one not handed yet, when its seat has a lord, the land's region is ceded to him unless it already has
 * a lord of its own, and either way it is written down (`granted`) so that it is never handed again. Returns the regions ceded.
 */
export function grantFollowingLands(): string[] {
    if (granting) {
        return [];
    }
    granting = true;
    const handed: string[] = [];
    let marked = false;
    try {
        for (const town of TOWNS) {
            if (town.follows !== true || town.seat === null || grantedRegions.has(town.region)) {
                continue;
            }
            const seat = townById(town.seat);
            const lord = seat === null ? null : regionLordOf(seat.region);
            if (seat === null || lord === null) {
                continue;
            }
            grantedRegions.add(town.region);
            marked = true;
            if (regionLordOf(town.region) !== null) {
                continue;
            }
            const result = cedeRegionTo(town.region, lord, "cidadania");
            handed.push(town.region);
            console.log(`citizenship: ${town.name} segue o senhor de ${seat.name}: ${lord.name} recebeu a região (${result.given} propriedade(s) e ${result.chests} baú(s); ${result.npc} de NPC e ${result.kept} de outros donos ficaram como estavam)`);
            const online = Player.all().find((candidate) => candidate.steamId === lord.steamId && candidate.ready);
            if (online !== undefined) {
                notice(online, `${town.name} é terra de ${seat.name} e agora é sua: ${result.given} ${result.given === 1 ? "propriedade" : "propriedades"} (e ${result.chests} ${result.chests === 1 ? "baú" : "baús"}) passaram para você.`);
                sendSocial(online);
            }
        }
    } finally {
        granting = false;
    }
    if (marked) {
        save();
    }
    return handed;
}

export function installCitizenship(): void {
    const loaded = read<{ citizens?: Record<string, unknown>; closed?: unknown; granted?: unknown }>(FILE);
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
    if (loaded.status === "ok" && Array.isArray(loaded.value.closed)) {
        for (const id of loaded.value.closed) {
            if (townById(id) !== null) {
                closedTowns.add(id as string);
            }
        }
    }
    if (loaded.status === "ok" && Array.isArray(loaded.value.granted)) {
        for (const region of loaded.value.granted) {
            if (TOWNS.some((town) => town.follows === true && town.region === region)) {
                grantedRegions.add(region as string);
            }
        }
    }
    console.log(`citizenship: ${citizens.size} cidadão(s) em ${TOWNS.length} cidade(s)${closedTowns.size > 0 ? `; fechada(s) pelo senhor: ${[...closedTowns].join(", ")}` : ""}`);

    // The lands that follow their seat's lord: handed over now if the seat has one, and whenever a seat is ceded from here on.
    regionCeded.push((region) => {
        if (TOWNS.some((town) => town.seat === null && town.region === region)) {
            grantFollowingLands();
        }
    });
    grantFollowingLands();

    // Who dies wakes in their town.
    setHomeResolver((steamId) => {
        const home = homeOf(steamId);
        return home === null ? null : { place: home.town.name, point: home.point, text: `${home.town.name}, a sua cidade` };
    });

    addPayload((player) => {
        const lorded = TOWNS.filter((town) => mayDepose(player, town) && lordOfTown(town) !== null).map((town) => town.id);
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

    Events.onClient(`${RESOURCE}:status.citizenClose`, (sender, payload) => {
        const player = sender as Player;
        const fields = fieldsOf(payload);
        const result = setClosed(player, fields["town"], fields["closed"] === 1);
        notice(player, result.message);
        sendSocial(player);
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
