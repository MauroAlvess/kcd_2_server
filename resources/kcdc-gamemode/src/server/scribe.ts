/**
 * The "Escrivão" section of the panel (user, 2026-10-29: "as guildas não vão poder mais ser selecionadas pelos jogadores ... sendo necessário procurar um mestre de ofício ou guilda, ou
 * cargos acima que façam sentido; vai ter uma seção nova no menu F2 chamada Escrivão: nele ele pode selecionar jogadores que sejam da cidadania dele ou das mesmas terras de Suchdol por
 * exemplo, e ceder uma guilda a esse jogador; ele recebe o título, exemplo caçador, e aparece na árvore hierárquica como caçador; no escrivão ele consegue filtrar por guildas e terras,
 * assim consegue saber quais jogadores estão em cada lugar e controlar").
 *
 * Who has the section: a holder of one of `GUILD_GRANT_TITLES` (nobility.ts: the clerk, the masters of the guilds and of the trades, the town's officers, the lord's chancellor and burgrave, the lords
 * and the Crown), a lord of lands (a region ceded to them, `citizenship.ts`), and an administrator. Whose guild they hand out: the citizens of their own HOUSE -- the town they are a citizen of
 * with its seat and its lands, so a citizen of Wysoka sees Suchdol and all of Suchdol's lands -- and, for a lord, the towns of the lands he rules; an administrator, everybody. Which guild: the masters
 * hand out only the guild they themselves belong to; the others, any of the eight. Nobody hands one to themselves (an administrator excepted).
 *
 * What it does: `ceder` sets the guild of a citizen (replacing the one they had, which the page says before it asks), hands the guild's kit when they are in the game (and at their next entry
 * when not, `index.ts`), and writes down who did it (`playerdata/guild-grants.json`, which the hierarchy's tree reads: the one who handed it is the one the tradesman hangs from); `retirar` takes
 * the guild off. Players do not choose a guild any more (`status.selectGuild`): an administrator still does, for tests.
 */

import { isAdmin } from "./auth.js";
import { citizensOf, keyOf, landsOf, lordOfTown, seatOf, TOWNS, townOf } from "./citizenship.js";
import { nameOfMember } from "./guild-members.js";
import { grantGuildKit, guildKitHint } from "./kits.js";
import { grantsOwnGuildOnly, mayGrantGuildWith } from "./nobility.js";
import type { Town } from "./citizenship.js";
import { addPayload, clearGuildId, getGuildId, GUILDS, listGuildMembers, notice, sendSocial, setGuildId } from "./status.js";
import { ensureDir, read, write } from "./store.js";
import { titlesOf } from "./titles.js";

const RESOURCE = "kcdc-gamemode";
const DIR = "playerdata";
const FILE = `${DIR}/guild-grants.json`;

export const PAGE_SIZE = 10;

export interface GuildGrant {
    readonly guild: string;
    /** The Steam id of who handed it, "" for an administrator who has none. */
    readonly by: string;
    readonly byName: string;
    readonly at: number;
}

const grants = new Map<string, GuildGrant>();
let writable = true;

function save(): void {
    if (!writable) {
        return;
    }
    try {
        ensureDir(DIR);
        write(FILE, { v: 1, grants: Object.fromEntries(grants) });
    } catch (error: unknown) {
        console.log(`scribe: não consegui gravar ${FILE}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/** Who handed the player their guild, when it was handed here: null for a guild chosen before, or given by an administrator. */
export function grantOf(steamId: string): GuildGrant | null {
    const kept = grants.get(steamId);
    return kept !== undefined && getGuildId(steamId) === kept.guild ? kept : null;
}

function online(steamId: string): Player | null {
    return steamId === "" ? null : (Player.all().find((player) => player.steamId === steamId && player.ready) ?? null);
}

// ---------------------------------------------------------------------------------------------
// Who may, and over whom.

/** Whether the player holds the power to hand out guilds: a title that gives it, the lordship of lands, or the staff. */
export function mayGrant(player: Player): boolean {
    if (player.steamId === "") {
        return false;
    }
    return isAdmin(player) || mayGrantGuildWith(titlesOf(player.steamId)) || TOWNS.some((town) => lordOfTown(town)?.steamId === player.steamId);
}

/** The house of a town: its seat and the seat's lands. */
function houseOf(town: Town): Town[] {
    const seat = seatOf(town) ?? town;
    return [seat, ...landsOf(seat)];
}

/** The towns whose citizens the player may hand a guild to: their own house, the lands they rule, everything for the staff. */
export function scopeOf(player: Player): Town[] {
    if (isAdmin(player)) {
        return [...TOWNS];
    }
    const ids = new Set<string>();
    const own = townOf(player.steamId);
    if (own !== null) {
        for (const town of houseOf(own)) {
            ids.add(town.id);
        }
    }
    for (const town of TOWNS) {
        if (lordOfTown(town)?.steamId === player.steamId) {
            ids.add(town.id);
        }
    }
    return TOWNS.filter((town) => ids.has(town.id));
}

/** The guilds the player may hand out: any of the eight, or for a master only their own. */
export function guildsOf(player: Player): string[] {
    if (!mayGrant(player)) {
        return [];
    }
    const lord = TOWNS.some((town) => lordOfTown(town)?.steamId === player.steamId);
    if (!isAdmin(player) && !lord && grantsOwnGuildOnly(titlesOf(player.steamId))) {
        const mine = getGuildId(player.steamId);
        return mine === null ? [] : [mine];
    }
    return GUILDS.map((guild) => guild.id);
}

// ---------------------------------------------------------------------------------------------
// The list.

export interface ScribeEntry {
    readonly key: string;
    readonly name: string;
    readonly town: string;
    readonly townName: string;
    readonly guild: string | null;
    readonly by: string;
    readonly you: boolean;
}

export interface ScribePage {
    readonly guild: string;
    readonly town: string;
    readonly search: string;
    readonly total: number;
    readonly page: number;
    readonly pages: number;
    readonly first: number;
    readonly entries: readonly ScribeEntry[];
    /** How many citizens each town of the scope has, and how many of them have a guild: "quais jogadores estão em cada lugar". */
    readonly towns: ReadonlyArray<{ readonly id: string; readonly name: string; readonly citizens: number; readonly guilded: number }>;
    /** How many there are in each guild (the scope's citizens only), "none" for those with no guild. */
    readonly counts: Readonly<Record<string, number>>;
}

function fold(text: string): string {
    return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** The citizens of the towns `towns` as the list shows them. The Steam ids stay here: the page names a citizen by `key`. */
function citizensIn(towns: readonly Town[], viewer: Player): Array<ScribeEntry & { readonly steamId: string }> {
    const rows: Array<ScribeEntry & { readonly steamId: string }> = [];
    for (const town of towns) {
        for (const steamId of citizensOf(town)) {
            const guild = getGuildId(steamId);
            rows.push({
                steamId,
                key: keyOf(steamId),
                name: nameOfMember(steamId),
                town: town.id,
                townName: town.name,
                guild,
                by: grantOf(steamId)?.byName ?? "",
                you: steamId === viewer.steamId,
            });
        }
    }
    return rows;
}

/** One page of the scribe's list, for `viewer`; null when they have no such power. */
export function pageFor(viewer: Player, filter: { readonly guild?: unknown; readonly town?: unknown; readonly search?: unknown; readonly page?: unknown }): ScribePage | null {
    if (!mayGrant(viewer)) {
        return null;
    }
    const scope = scopeOf(viewer);
    const guild = typeof filter.guild === "string" && (filter.guild === "none" || GUILDS.some((candidate) => candidate.id === filter.guild)) ? filter.guild : "";
    const town = typeof filter.town === "string" && scope.some((candidate) => candidate.id === filter.town) ? filter.town : "";
    const search = typeof filter.search === "string" ? filter.search.slice(0, 40) : "";
    const everybody = citizensIn(scope, viewer);
    const counts: Record<string, number> = { none: 0 };
    for (const row of everybody) {
        const id = row.guild ?? "none";
        counts[id] = (counts[id] ?? 0) + 1;
    }
    const wanted = fold(search);
    const rows = everybody
        .filter((row) => (town === "" || row.town === town) && (guild === "" || (guild === "none" ? row.guild === null : row.guild === guild)) && (wanted === "" || fold(row.name).includes(wanted)))
        .sort((a, b) => a.name.localeCompare(b.name, "pt", { numeric: true }));
    const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const page = typeof filter.page === "number" && Number.isInteger(filter.page) ? Math.min(Math.max(filter.page, 0), pages - 1) : 0;
    return {
        guild,
        town,
        search,
        total: rows.length,
        page,
        pages,
        first: page * PAGE_SIZE,
        entries: rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(({ steamId: _steamId, ...entry }) => entry),
        towns: scope.map((one) => {
            const inTown = everybody.filter((row) => row.town === one.id);
            return { id: one.id, name: one.name, citizens: inTown.length, guilded: inTown.filter((row) => row.guild !== null).length };
        }),
        counts,
    };
}

/** What the player's panel is told at every update: whether the section is theirs, which guilds they may hand out, and the towns they may look at. */
export function payloadFor(player: Player): Record<string, unknown> {
    if (!mayGrant(player)) {
        return { scribe: { visible: false } };
    }
    const own = TOWNS.some((town) => lordOfTown(town)?.steamId === player.steamId) ? false : !isAdmin(player) && grantsOwnGuildOnly(titlesOf(player.steamId));
    return { scribe: { visible: true, guilds: guildsOf(player), own, towns: scopeOf(player).map((town) => ({ id: town.id, name: town.name, seat: town.seat })) } };
}

// ---------------------------------------------------------------------------------------------
// Handing a guild, and taking it off.

type Outcome = { readonly ok: boolean; readonly message: string };

/** The citizen of the scope the page's key names, with the town they are a citizen of. */
function citizenByKey(viewer: Player, key: unknown): { readonly steamId: string; readonly town: Town } | null {
    if (typeof key !== "string") {
        return null;
    }
    for (const town of scopeOf(viewer)) {
        for (const steamId of citizensOf(town)) {
            if (keyOf(steamId) === key) {
                return { steamId, town };
            }
        }
    }
    return null;
}

/** `actor` hands `guildId` to the citizen `key` names. Everything is checked again here: what the page offered decides nothing. */
export function grant(actor: Player, key: unknown, guildId: unknown): Outcome {
    if (!mayGrant(actor)) {
        return { ok: false, message: "Só um escrivão, um mestre de ofício ou guilda, ou um senhor das terras cede uma guilda." };
    }
    const guild = typeof guildId === "string" ? GUILDS.find((candidate) => candidate.id === guildId) : undefined;
    if (guild === undefined || !guildsOf(actor).includes(guild.id)) {
        return { ok: false, message: guild === undefined ? "Essa guilda não existe." : `O seu cargo não cede a guilda ${guild.nameLatin}: um mestre cede só a sua.` };
    }
    const target = citizenByKey(actor, key);
    if (target === null) {
        return { ok: false, message: "Essa pessoa não é cidadã de nenhuma das terras que você atende." };
    }
    if (target.steamId === actor.steamId && !isAdmin(actor)) {
        return { ok: false, message: "Ninguém cede uma guilda a si mesmo: peça a outro escrivão ou mestre." };
    }
    const name = nameOfMember(target.steamId);
    const had = getGuildId(target.steamId);
    if (had === guild.id) {
        return { ok: false, message: `${name} já faz parte de ${guild.nameLatin}.` };
    }
    if (had !== null && !mayRetire(actor, had)) {
        const kept = GUILDS.find((candidate) => candidate.id === had);
        return { ok: false, message: `${name} faz parte de ${kept?.nameLatin ?? had}, que o seu cargo não retira.` };
    }
    if (!setGuildId(target.steamId, guild.id)) {
        return { ok: false, message: "Essa guilda não pôde ser cedida agora." };
    }
    grants.set(target.steamId, { guild: guild.id, by: actor.steamId, byName: nameOfMember(actor.steamId), at: Date.now() });
    save();
    console.log(`scribe: ${actor.nickname} cedeu ${guild.nameLatin} a ${name} (${target.town.name})${had !== null ? ` no lugar de ${had}` : ""}`);
    const player = online(target.steamId);
    if (player !== null) {
        notice(player, `${nameOfMember(actor.steamId)} cedeu a você a guilda ${guild.nameLatin} (${guild.profession}).`);
        const handed = grantGuildKit(player, guild.id);
        if (handed.length > 0) {
            notice(player, `Kit da guilda entregue: ${handed.join(", ")}.`);
            if (guildKitHint(guild.id) !== "") {
                notice(player, guildKitHint(guild.id));
            }
        }
        sendSocial(player);
    }
    return { ok: true, message: `${name} agora é ${guild.profession} (${guild.nameLatin}).` };
}

/** Whether `actor` may take the guild `guildId` off somebody: whoever hands any guild, or a master for their own. */
function mayRetire(actor: Player, guildId: string): boolean {
    return guildsOf(actor).includes(guildId);
}

/** `actor` takes the guild off the citizen `key` names. */
export function retire(actor: Player, key: unknown): Outcome {
    if (!mayGrant(actor)) {
        return { ok: false, message: "Só um escrivão, um mestre de ofício ou guilda, ou um senhor das terras retira uma guilda." };
    }
    const target = citizenByKey(actor, key);
    if (target === null) {
        return { ok: false, message: "Essa pessoa não é cidadã de nenhuma das terras que você atende." };
    }
    const had = getGuildId(target.steamId);
    const name = nameOfMember(target.steamId);
    if (had === null) {
        return { ok: false, message: `${name} não tem guilda.` };
    }
    if (!mayRetire(actor, had)) {
        return { ok: false, message: "O seu cargo não retira essa guilda: um mestre retira só a sua." };
    }
    if (!clearGuildId(target.steamId)) {
        return { ok: false, message: "A guilda não pôde ser retirada agora." };
    }
    grants.delete(target.steamId);
    save();
    const kept = GUILDS.find((candidate) => candidate.id === had);
    console.log(`scribe: ${actor.nickname} retirou ${kept?.nameLatin ?? had} de ${name}`);
    const player = online(target.steamId);
    if (player !== null) {
        notice(player, `${nameOfMember(actor.steamId)} retirou de você a guilda ${kept?.nameLatin ?? had}. Procure um escrivão ou um mestre de ofício para receber outra.`);
        sendSocial(player);
    }
    return { ok: true, message: `${name} deixou de ser ${kept?.profession ?? "da guilda"}.` };
}

// ---------------------------------------------------------------------------------------------

function fieldsOf(payload: unknown): Record<string, unknown> {
    try {
        const value = typeof payload === "string" && payload.length <= 512 ? (JSON.parse(payload) as unknown) : payload;
        return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}

/** The list's filter as the page sends it along with an action, so that the list comes back the way it was (`fguild`, `ftown`, `fsearch`, `fpage`). */
function filterOf(fields: Record<string, unknown>): { guild: unknown; town: unknown; search: unknown; page: unknown } {
    return { guild: fields["fguild"], town: fields["ftown"], search: fields["fsearch"], page: fields["fpage"] };
}

/** The tradesmen of the realm as the hierarchy's tree hangs them: whoever has a guild, with the town they are a citizen of and who handed it. */
export function tradesmen(): Array<{ readonly steamId: string; readonly guild: string; readonly town: string | null; readonly by: string }> {
    const found: Array<{ steamId: string; guild: string; town: string | null; by: string }> = [];
    for (const guild of GUILDS) {
        for (const steamId of listGuildMembers(guild.id)) {
            found.push({ steamId, guild: guild.id, town: townOf(steamId)?.id ?? null, by: grantOf(steamId)?.by ?? "" });
        }
    }
    return found;
}

export function installScribe(): void {
    const loaded = read<{ grants?: Record<string, unknown> }>(FILE);
    if (loaded.status === "ok" && typeof loaded.value.grants === "object" && loaded.value.grants !== null) {
        for (const [steamId, raw] of Object.entries(loaded.value.grants)) {
            const entry = raw as Partial<GuildGrant> | null;
            if (entry !== null && typeof entry === "object" && steamId !== "" && typeof entry.guild === "string") {
                grants.set(steamId, { guild: entry.guild, by: typeof entry.by === "string" ? entry.by : "", byName: typeof entry.byName === "string" ? entry.byName : "", at: typeof entry.at === "number" ? entry.at : 0 });
            }
        }
    } else if (loaded.status === "corrupt") {
        writable = false;
        console.log(`scribe: ${FILE} está ilegível e foi deixado como está: ${loaded.reason}`);
    }
    console.log(`scribe: ${grants.size} guilda(s) cedida(s) registrada(s)`);

    addPayload((player) => payloadFor(player));

    Events.onClient(`${RESOURCE}:status.scribe`, (sender, payload) => {
        const player = sender as Player;
        const page = pageFor(player, fieldsOf(payload));
        if (page !== null) {
            player.emit(`${RESOURCE}:status.scribe`, JSON.stringify(page));
        }
    });
    Events.onClient(`${RESOURCE}:status.scribeGrant`, (sender, payload) => {
        const player = sender as Player;
        const fields = fieldsOf(payload);
        const result = grant(player, fields["key"], fields["guild"]);
        notice(player, result.message);
        const page = pageFor(player, filterOf(fields));
        if (page !== null) {
            player.emit(`${RESOURCE}:status.scribe`, JSON.stringify(page));
        }
    });
    Events.onClient(`${RESOURCE}:status.scribeRevoke`, (sender, payload) => {
        const player = sender as Player;
        const fields = fieldsOf(payload);
        const result = retire(player, fields["key"]);
        notice(player, result.message);
        const page = pageFor(player, filterOf(fields));
        if (page !== null) {
            player.emit(`${RESOURCE}:status.scribe`, JSON.stringify(page));
        }
    });
}
