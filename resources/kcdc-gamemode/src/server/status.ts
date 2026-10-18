/**
 * The status panel's server half: the guild and faction catalogs, and each
 * player's social status, guild, faction and the one the panel shows first,
 * kept on disk by Steam id so they survive a restart and a reconnect (see
 * `characters.ts`, the same pattern for a chosen look). Also the family tree's
 * events (`family.ts` keeps the data), the properties pages (an administrator's "Chaves" and an owner's
 * "Propriedades": names, descriptions, owners and keys, see `properties.ts`) and the name a door or chest shows.
 */

import { adminLabel, nameOf } from "./acquaintances.js";
import { fullName } from "./character-name.js";
import { isAdmin, roleOf } from "./auth.js";
import { getCharacter } from "./characters.js";
import { addPerson, answerInvite, backfillMirrors, editPerson, familyHeirs, getSurname, invitesFor, LIMITS, listFamily, maritalStatus, RELATIONS, removePersonDetailed, ROWS, setSurname } from "./family.js";
import type { MirrorOutcome, Mirroring } from "./family.js";
import { grantFactionColours, grantGuildKit } from "./kits.js";
import {
    assignOwner,
    cedeRegion,
    clearOwner,
    DESCRIPTION_MAX,
    describeProperty,
    displayName,
    domainOf,
    doorLines,
    getProperty,
    isOwner,
    issueDoorKey,
    issueKey,
    labelFor,
    listProperties,
    lockState,
    npcOf,
    NAME_MAX,
    NAME_MIN,
    OWNER_KEY_LIMIT,
    ownerOf,
    previewRegion,
    propertiesOwnedBy,
    propertyOfGuid,
    REGION_MAX,
    REGION_MIN,
    regionNamed,
    renameProperty,
    setDoorLocked,
    setLocked,
    setRegion,
    shortName,
} from "./properties.js";
import type { PropertyInfo } from "./properties.js";
import { byName, DEFAULT_QUERY, matches, PAGE_SIZE, paginate, parseQuery } from "./roster.js";
import type { RosterFilter, RosterQuery } from "./roster.js";
import { languageOf, translate } from "./language.js";
import { supporters } from "./supporters.js";
import { summarize } from "./nobility.js";
import { shownOf, titleLines, titlesOf } from "./titles.js";

declare function require(id: string): unknown;

interface NodeFs {
    readFileSync(path: string, encoding: "utf8"): string;
    writeFileSync(path: string, data: string): void;
    mkdirSync(path: string, options: { recursive: true }): void;
}

const fs = require("node:fs") as NodeFs;

const DIR = "playerdata";
const FILE = `${DIR}/social.json`;

const RESOURCE = "kcdc-gamemode";

export type SocialStatus = "plebeius" | "nobilis";

/** Which of the two the character page shows on its right-hand side. */
export type Showcase = "guild" | "faction" | "citizenship";

export interface FactionInfo {
    readonly id: string;
    readonly name: string;
    readonly motto: string;
    readonly crest: string;
}

export interface GuildInfo {
    readonly id: string;
    readonly nameLatin: string;
    readonly profession: string;
    readonly crest: string;
    readonly description: string;
}

/** What the panel shows for a status: the Latin word, and a short Portuguese gloss under it. */
export const SOCIAL_STATUS: Readonly<Record<SocialStatus, { readonly label: string; readonly gloss: string }>> = {
    plebeius: { label: "Plebeius", gloss: "plebeu" },
    nobilis: { label: "Nobilis", gloss: "nobre" },
};

export const GUILDS: readonly GuildInfo[] = [
    {
        id: "fabri-ferrarii",
        nameLatin: "Fabri Ferrarii",
        profession: "Ferreiro",
        crest: "guild-ferreiro.webp",
        description:
            "Trabalham o ferro nas forjas de Kuttenberg: espadas, armaduras e ferramentas para quem precisa. " +
            "Sem eles, nenhum exército se arma e nenhum arado corta a terra.",
    },
    {
        id: "venatores",
        nameLatin: "Venatores",
        profession: "Caçador",
        crest: "guild-cacador.webp",
        description:
            "Caçam e rastreiam nas florestas ao redor de Kuttenberg, trazendo carne, pele e couro. " +
            "Conhecem cada trilha que os soldados não veem.",
    },
    {
        id: "tabernarii",
        nameLatin: "Tabernarii",
        profession: "Taberneiro",
        crest: "guild-taberneiro.webp",
        description:
            "Fermentam cevada e lúpulo e servem nas tabernas de Kuttenberg. Onde há cerveja, há notícia, " +
            "fofoca e um ouvido disposto a escutar por uma moeda.",
    },
    {
        id: "alchemistae",
        nameLatin: "Alchemistae",
        profession: "Alquimista",
        crest: "guild-alquimista.webp",
        description:
            "Destilam ervas e minerais em poções, venenos e remédios. Conhecimento guardado a sete chaves, " +
            "tão útil quanto perigoso nas mãos erradas.",
    },
    {
        id: "artifices",
        nameLatin: "Artifices",
        profession: "Artesão",
        crest: "guild-artesao.webp",
        description:
            "Cosem e remendam o que Kuttenberg veste: túnicas, calças e capuzes. " +
            "Do camponês ao mercador, todos precisam de um pano que dure.",
    },
];

/** The two great houses. A player swears to one; the panel splits its faction page between them. */
export const FACTIONS: readonly FactionInfo[] = [
    {
        id: "leao-dourado",
        name: "Casa do Leão Dourado",
        motto: "Pela honra, a lei e o sangue, manteremos a ordem.",
        crest: "faction-leao.webp",
    },
    {
        id: "corvo",
        name: "Casa do Corvo",
        motto: "Nas sombras da guerra, a astúcia conquista o que a força não pode.",
        crest: "faction-corvo.webp",
    },
];

interface SocialRecord {
    socialStatus: SocialStatus;
    guildId: string | null;
    factionId: string | null;
    showcase: Showcase;
    updatedAt: number;
}

const NEW_RECORD: Omit<SocialRecord, "updatedAt"> = { socialStatus: "plebeius", guildId: null, factionId: null, showcase: "guild" };

let cache: Record<string, SocialRecord> | null = null;

function load(): Record<string, SocialRecord> {
    if (cache) {
        return cache;
    }
    try {
        cache = JSON.parse(fs.readFileSync(FILE, "utf8")) as Record<string, SocialRecord>;
    } catch {
        cache = {};
    }
    return cache;
}

function persist(store: Record<string, SocialRecord>): void {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(store, null, 2));
}

/**
 * A record for this Steam id, defaulting a new one to Plebeius with no guild or faction. A record saved
 * before factions existed has no such fields, so every field a stored record lacks takes its default.
 * Never written for an empty id.
 */
function recordFor(steamId: string): SocialRecord {
    const store = load();
    const record: SocialRecord = { ...NEW_RECORD, updatedAt: Date.now(), ...store[steamId] };
    // A guild the catalog no longer has (the tailors' guild, "sartores", became the artisans', "artifices") reads as
    // none, so the panel never points at a card that is not there. The stored value is left alone until the next write.
    if (record.guildId !== null && !GUILDS.some((guild) => guild.id === record.guildId)) {
        record.guildId = null;
    }
    return record;
}

function write(steamId: string, record: SocialRecord): void {
    if (!steamId) {
        return;
    }
    const store = load();
    store[steamId] = record;
    persist(store);
}

export function getSocialStatus(steamId: string): SocialStatus {
    return recordFor(steamId).socialStatus;
}

/** Told when somebody's social status changes, after it is written: `nominations.ts` takes the titles of a noble who is not one. */
type StatusListener = (steamId: string, status: SocialStatus, before: SocialStatus) => void;
const statusListeners: StatusListener[] = [];

export function onStatusChange(listener: StatusListener): void {
    statusListeners.push(listener);
}

export function setSocialStatus(steamId: string, socialStatus: SocialStatus): void {
    const record = recordFor(steamId);
    write(steamId, { ...record, socialStatus, updatedAt: Date.now() });
    if (steamId !== "" && record.socialStatus !== socialStatus) {
        for (const listener of statusListeners) {
            try {
                listener(steamId, socialStatus, record.socialStatus);
            } catch (error: unknown) {
                console.log(`status: um ouvinte da mudança de status falhou: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
}

/** Every Steam id whose social status is nobilis. */
export function listNobles(): string[] {
    return Object.entries(load())
        .filter(([steamId, record]) => steamId !== "" && record.socialStatus === "nobilis")
        .map(([steamId]) => steamId);
}

export function getGuildId(steamId: string): string | null {
    return recordFor(steamId).guildId;
}

/** Every Steam id whose guild is this one. */
export function listGuildMembers(guildId: string): string[] {
    return Object.entries(load())
        .filter(([steamId, record]) => steamId !== "" && record.guildId === guildId)
        .map(([steamId]) => steamId);
}

/** Takes a player out of their guild, so they may choose again (an administrator's remedy: the choice is for good otherwise). */
export function clearGuildId(steamId: string): boolean {
    const store = load();
    const record = store[steamId];
    if (steamId === "" || record === undefined || record.guildId === null) {
        return false;
    }
    write(steamId, { ...record, guildId: null, updatedAt: Date.now() });
    return true;
}

/** False for a guild id the catalog does not have. */
export function setGuildId(steamId: string, guildId: string): boolean {
    if (!GUILDS.some((guild) => guild.id === guildId)) {
        return false;
    }
    const record = recordFor(steamId);
    write(steamId, { ...record, guildId, updatedAt: Date.now() });
    return true;
}

export function getFactionId(steamId: string): string | null {
    return recordFor(steamId).factionId;
}

/** Takes a player out of their faction, so they may swear again (an administrator's remedy: the oath is for good otherwise). */
export function clearFactionId(steamId: string): boolean {
    const record = steamId === "" ? undefined : load()[steamId];
    if (record === undefined || record.factionId === null) {
        return false;
    }
    write(steamId, { ...record, factionId: null, updatedAt: Date.now() });
    return true;
}

/** False for a faction id the catalog does not have. */
export function setFactionId(steamId: string, factionId: string): boolean {
    if (!FACTIONS.some((faction) => faction.id === factionId)) {
        return false;
    }
    const record = recordFor(steamId);
    write(steamId, { ...record, factionId, updatedAt: Date.now() });
    return true;
}

export function getShowcase(steamId: string): Showcase {
    return recordFor(steamId).showcase;
}

/** False for anything but "guild", "faction" or "citizenship". */
export function setShowcase(steamId: string, showcase: unknown): boolean {
    if (showcase !== "guild" && showcase !== "faction" && showcase !== "citizenship") {
        return false;
    }
    const record = recordFor(steamId);
    write(steamId, { ...record, showcase, updatedAt: Date.now() });
    return true;
}

/** The fields of a page event, however the framework handed them over: an object, or the JSON text of one. */
function fieldsOf(payload: unknown): Record<string, unknown> {
    let value = payload;
    if (typeof value === "string" && value.length <= 4096) {
        try {
            value = JSON.parse(value) as unknown;
        } catch {
            return {};
        }
    }
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

/**
 * What the properties pages are told about one property. A chest in a house goes by its own part of the name. A field
 * with nothing to say is left out (no owner, no house, no description, no keys made, not the viewer's), because an
 * administrator is sent the whole catalog at once: a couple of hundred of these.
 */
function propertyEntry(property: PropertyInfo, viewer: Player, domain = false): Record<string, unknown> {
    const owner = ownerOf(property);
    const state = lockState(property);
    const entry: Record<string, unknown> = { id: property.id, name: property.kind === "door" ? displayName(property) : shortName(property), region: property.region, kind: property.kind, locked: state === "all" };
    if (state === "part") {
        entry["part"] = true;
    }
    // A house with several doors lists them under it, like its chests: one character each, 1 shut and 0 open, and which is the entrance.
    if (property.doors.length > 1) {
        entry["doors"] = property.doors.length;
        entry["doorState"] = doorLines(property).map((door) => (door.locked ? "1" : "0")).join("");
        const entrance = property.doors.indexOf(property.doorGuid);
        if (entrance >= 0) {
            entry["entrance"] = entrance;
        }
    }
    // Part of a region ceded to the viewer that is not theirs: shown to be read, never touched.
    if (domain) {
        entry["domain"] = true;
    }
    if (property.keys > 0) {
        entry["keys"] = property.keys;
    }
    if (property.parentId !== "") {
        entry["parentId"] = property.parentId;
    }
    if (owner !== null) {
        entry["owner"] = owner.name;
        if (viewer.steamId !== "" && owner.steamId === viewer.steamId) {
            entry["mine"] = true;
        }
    }
    const npc = npcOf(property);
    if (npc !== null) {
        entry["npc"] = npc;
    }
    if (property.description !== "") {
        entry["description"] = property.description;
    }
    return entry;
}

/** What a player is told of properties: an administrator the whole catalog, the rest what they own and what lies in the regions ceded to them. */
function propertiesFor(player: Player): ReadonlyArray<Record<string, unknown>> {
    if (isAdmin(player)) {
        return listProperties().map((property) => propertyEntry(property, player));
    }
    return [...propertiesOwnedBy(player.steamId).map((property) => propertyEntry(property, player)), ...domainOf(player.steamId).map((property) => propertyEntry(property, player, true))];
}

/** The limits the page checks a name, a description and a region against before it asks; the server checks again. */
const PROPERTY_LIMITS = { nameMin: NAME_MIN, nameMax: NAME_MAX, descriptionMax: DESCRIPTION_MAX, regionMin: REGION_MIN, regionMax: REGION_MAX, keyLimit: OWNER_KEY_LIMIT };

/**
 * A gauge as the page draws it: the reading and the capacity, in whole numbers. The game reports a capacity of 0 until it
 * has told the server about a body (`hunger.ts` reads it the same way), and a bar with no capacity draws as "—": a
 * capacity that is not known is the scale of 100, and a reading that is not a number is no reading at all.
 */
export function gauge(reading: number, capacity: number): [number, number] {
    if (!Number.isFinite(reading)) {
        return [0, 0];
    }
    return [Math.round(Math.max(0, reading)), Math.round(Number.isFinite(capacity) && capacity > 0 ? capacity : 100)];
}

/**
 * Who is on the server, for an administrator's "Jogadores" page (the Tab list is switched off for everybody): the list,
 * and for the one picked, their guild and house, their standing, how they are, and whether they support the server.
 */
/** The name and alcunha the player gave the character, as the panel's big name; "" when they did not give one. */
function characterNameOf(player: Player): string {
    const saved = player.steamId === "" ? null : getCharacter(player.steamId);
    return saved?.name ? fullName(saved.name, saved.epithet) : "";
}

function playerEntry(viewer: Player, other: Player, label: string): Record<string, unknown> {
    const gender = getCharacter(other.steamId)?.appearance.gender ?? other.appearance.gender;
    const guildId = getGuildId(other.steamId);
    return {
        id: other.id,
        self: other.id === viewer.id,
        nickname: label,
        role: roleOf(other),
        guild: GUILDS.find((guild) => guild.id === guildId)?.profession ?? null,
        guildId,
        factionId: getFactionId(other.steamId),
        status: SOCIAL_STATUS[getSocialStatus(other.steamId)],
        statusId: getSocialStatus(other.steamId),
        titles: summarize(titlesOf(other.steamId), gender === "female"),
        titleIds: titlesOf(other.steamId),
        heirs: heirNames(other.steamId),
        marital: maritalStatus(other.steamId, gender ?? null),
        surname: getSurname(other.steamId),
        body: gender === "female" ? "female" : "male",
        health: gauge(other.health, other.maxHealth),
        stamina: gauge(other.stamina, other.maxStamina),
        hunger: gauge(other.hunger, other.maxHunger),
        energy: gauge(other.exhaust, other.maxExhaust),
        supporter: supporters.summary(other.steamId),
        ready: other.ready,
        alive: other.alive,
        steamId: other.steamId,
    };
}

/** A player by Steam id, for a line: the name they are online under, the one last saved, or a plain word. */
function nameOfSteamId(steamId: string): string {
    return Player.all().find((other) => other.steamId === steamId)?.nickname ?? getCharacter(steamId)?.nickname ?? "um jogador";
}

/** A body's gender as the family tree words a relation by it: the live body's, or else the saved character's. */
function genderOfPlayer(player: Player): "male" | "female" | null {
    const gender = player.appearance?.gender ?? (player.steamId === "" ? undefined : getCharacter(player.steamId)?.appearance.gender);
    return gender === "female" ? "female" : gender === "male" ? "male" : null;
}

/** What the other side of a link is told of the player who makes it: the name their tree will give them, and their body. */
function mirroring(player: Player): Mirroring {
    return { name: nameOf(player), gender: genderOfPlayer(player) };
}

/** The same for a player who is not here, from the saved character: null when there is none. */
function savedMirroring(steamId: string): Mirroring | null {
    const saved = getCharacter(steamId);
    if (saved === null) {
        return null;
    }
    const first = saved.name ? fullName(saved.name, saved.epithet) : saved.nickname;
    const surname = getSurname(steamId);
    const gender = saved.appearance.gender;
    return { name: surname ? `${first} ${surname}` : first, gender: gender === "female" ? "female" : gender === "male" ? "male" : null };
}

/** What a change of a link did to the other player's tree, said to the one who made it (on the panel) and to the one it happened to (in the chat). */
function tellMirror(player: Player, outcome: MirrorOutcome): void {
    const other = Player.all().find((candidate) => candidate.steamId === outcome.steamId);
    const otherName = other !== undefined ? nameOf(other) : nameOfSteamId(outcome.steamId);
    const me = nameOf(player);
    switch (outcome.kind) {
        case "updated":
            notice(player, `Na árvore de ${otherName}, você agora é ${outcome.person.label}.`);
            if (other !== undefined) {
                Chat.sendToPlayer(other, `${me} mudou o parentesco entre vocês: na sua árvore, ${me} agora aparece como ${outcome.person.label}.`);
            }
            return;
        case "removed":
            notice(player, `${otherName} não tem mais você na árvore.`);
            if (other !== undefined) {
                Chat.sendToPlayer(other, `${me} tirou você da árvore de família, e saiu da sua também.`);
            }
            return;
    }
}

/** Who would share a change of `steamId`'s standing, as the administrator reads it: "Dorota (Katerina)". */
function heirNames(steamId: string): string[] {
    return familyHeirs(steamId).map((heir) => {
        const nickname = nameOfSteamId(heir.steamId);
        return heir.name !== "" && heir.name !== nickname ? `${heir.name} (${nickname})` : nickname;
    });
}

/** Whether a player passes the filter of the administrator's list. */
function passes(filter: RosterFilter, other: Player): boolean {
    switch (filter) {
        case "admin":
            return roleOf(other) === "admin";
        case "patron":
            return supporters.summary(other.steamId) !== null;
        case "noble":
            return getSocialStatus(other.steamId) === "nobilis";
        case "noguild":
            return getGuildId(other.steamId) === null;
        default:
            return true;
    }
}

/** Whom a noble may name now (`nominations.ts` says who), for the picker of the Nomeação page. */
type Nominees = (viewer: Player) => ReadonlyArray<{ id: number; name: string }>;
let nominees: Nominees = () => [];

export function setNominees(source: Nominees): void {
    nominees = source;
}

/**
 * One page of a player list, as `viewer` may read it: everything about each player for an administrator's list, a number and a name
 * for a picker (never oneself). The search and the filter are applied to the whole server and only the page's lines are built.
 */
export function rosterAnswer(viewer: Player, wanted: RosterQuery): Record<string, unknown> {
    const admin = isAdmin(viewer);
    // Only an administrator has the list page; a player who asks for it is answered as for a picker.
    const query: RosterQuery = wanted.tag === "list" && !admin ? { ...wanted, tag: "pick" } : wanted;
    const size = PAGE_SIZE[query.tag];
    let paged;
    let players: Array<Record<string, unknown>>;
    if (query.tag === "list") {
        const rows = Player.all()
            .map((other) => ({ other, label: adminLabel(other) }))
            .filter((row) => passes(query.filter, row.other) && matches(query.q, row.other.id, row.label))
            .sort((a, b) => byName(a.label, b.label) || a.other.id - b.other.id);
        paged = paginate(rows, query.page, size);
        players = paged.rows.map((row) => playerEntry(viewer, row.other, row.label));
    } else if (query.tag === "nom") {
        const rows = nominees(viewer)
            .filter((candidate) => matches(query.q, candidate.id, candidate.name))
            .slice()
            .sort((a, b) => byName(a.name, b.name) || a.id - b.id);
        paged = paginate(rows, query.page, size);
        players = paged.rows.map((candidate) => ({ id: candidate.id, nickname: candidate.name }));
    } else {
        const rows = Player.all()
            .filter((other) => other.ready && other.id !== viewer.id)
            .map((other) => ({ other, label: admin ? adminLabel(other) : nameOf(other) }))
            .filter((row) => matches(query.q, row.other.id, row.label))
            .sort((a, b) => byName(a.label, b.label) || a.other.id - b.other.id);
        paged = paginate(rows, query.page, size);
        players = paged.rows.map((row) => ({ id: row.other.id, nickname: row.label }));
    }
    return { tag: query.tag, q: query.q, filter: query.filter, page: paged.page, pages: paged.pages, total: paged.total, players };
}

/** What other modules add to a player's payload (the nominations' block), so this one does not have to know them. */
type Contributor = (player: Player) => Record<string, unknown>;
const contributors: Contributor[] = [];

export function addPayload(contributor: Contributor): void {
    contributors.push(contributor);
}

/** The administrator's list as each last asked for it (what was typed, the page, the filter), so an action can refresh it. */
const lastList = new Map<number, RosterQuery>();

/** The administrator's list again, as they last asked for it. */
export function sendRoster(player: Player): void {
    player.emit(`${RESOURCE}:status.roster`, JSON.stringify(rosterAnswer(player, lastList.get(player.id) ?? DEFAULT_QUERY)));
}

function payloadFor(player: Player): Record<string, unknown> {
    const extra: Record<string, unknown> = {};
    for (const contributor of contributors) {
        Object.assign(extra, contributor(player));
    }
    return {
        ...extra,
        socialStatus: SOCIAL_STATUS[getSocialStatus(player.steamId)],
        guildId: getGuildId(player.steamId),
        guilds: GUILDS,
        factionId: getFactionId(player.steamId),
        factions: FACTIONS,
        showcase: getShowcase(player.steamId),
        // Which nav sections the page may show: the server decides, never the page's own guess.
        role: roleOf(player),
        // An administrator is sent the whole catalog, everybody else only what they own, and only a name for each other player.
        properties: propertiesFor(player),
        propertyLimits: PROPERTY_LIMITS,
        family: listFamily(player.steamId),
        // Who asks this player to be their relative, waiting for a yes or a no in the Família section.
        familyInvites: invitesFor(player.steamId),
        familyRows: ROWS,
        familyRelations: RELATIONS,
        familyLimits: LIMITS,
        surname: getSurname(player.steamId),
        // What the player called the character in the creator (the first name and the alcunha; the surname is a row of its own): empty for one made before the names.
        characterName: characterNameOf(player),
        maritalStatus: maritalStatus(player.steamId, getCharacter(player.steamId)?.appearance.gender ?? null),
        // What they hold and which of it they wear over the head (Personagem and Opções); the nominations are a block of their own.
        titles: titleLines(player.steamId, getCharacter(player.steamId)?.appearance.gender === "female"),
        shownTitle: shownOf(player.steamId),
        // The "Apoiador" page thanks a supporter by date.
        supporter: supporters.summary(player.steamId),
    };
}

export function sendSocial(player: Player): void {
    player.emit(`${RESOURCE}:status.social`, JSON.stringify(payloadFor(player)));
}

/**
 * Tells the player something. The panel covers the whole screen, so a chat line alone would be
 * hidden behind it: the page shows this one itself, and the chat keeps it as a record.
 */
export function notice(player: Player, text: string): void {
    // In the player's language when it is not Portuguese; the chat line below would be translated on its way out too.
    const shown = translate(text, languageOf(player));
    Chat.sendToPlayer(player, shown);
    player.emit(`${RESOURCE}:status.notice`, JSON.stringify({ text: shown }));
}

export function installStatus(): void {
    Events.onClient(`${RESOURCE}:status.poll`, (sender) => {
        sendSocial(sender as Player);
    });

    // The player lists ask for the page they show (what was typed, the filter, the page) and are answered with that page and
    // how many there are; the administrator's list asks again every few seconds while it is the page on screen.
    Events.onClient(`${RESOURCE}:status.roster`, (sender, payload) => {
        const player = sender as Player;
        const query = parseQuery(fieldsOf(payload));
        if (query.tag === "list" && isAdmin(player)) {
            lastList.set(player.id, query);
        }
        player.emit(`${RESOURCE}:status.roster`, JSON.stringify(rosterAnswer(player, query)));
    });

    Events.onClient(`${RESOURCE}:status.selectGuild`, (sender, payload) => {
        const player = sender as Player;
        if (!player.steamId) {
            Chat.sendToPlayer(player, "Sua conta não tem identificação Steam, então a guilda não poderia ser salva.");
            return;
        }
        const guildId = typeof payload === "object" && payload !== null ? (payload as { guildId?: unknown }).guildId : undefined;
        // One guild for good (user, 2026-10-17): the choice is not undone from the panel, only by an administrator (`/guilda`).
        const current = getGuildId(player.steamId);
        if (current !== null) {
            const kept = GUILDS.find((candidate) => candidate.id === current);
            notice(player, current === guildId ? `Você já faz parte de ${kept?.nameLatin ?? current}.` : `Você já escolheu a guilda ${kept?.nameLatin ?? current}: a escolha é definitiva e não se troca. Só um administrador pode desfazê-la.`);
            return;
        }
        if (typeof guildId !== "string" || !setGuildId(player.steamId, guildId)) {
            Chat.sendToPlayer(player, "Essa guilda não pode ser selecionada.");
            return;
        }
        const guild = GUILDS.find((candidate) => candidate.id === guildId);
        Chat.sendToPlayer(player, `Você agora faz parte de ${guild?.nameLatin ?? guildId}.`);
        // The first time in a guild brings its kit; the ledger in character-state.ts stops a second one.
        const handed = grantGuildKit(player, guildId);
        if (handed.length > 0) {
            notice(player, `Kit da guilda entregue: ${handed.join(", ")}.`);
        }
        sendSocial(player);
    });

    Events.onClient(`${RESOURCE}:status.selectFaction`, (sender, payload) => {
        const player = sender as Player;
        if (!player.steamId) {
            Chat.sendToPlayer(player, "Sua conta não tem identificação Steam, então a facção não poderia ser salva.");
            return;
        }
        const factionId = typeof payload === "object" && payload !== null ? (payload as { factionId?: unknown }).factionId : undefined;
        // One faction for good, like the guild (user, 2026-10-17): the oath is not swapped from the panel, only by an administrator (`/faccao`).
        const sworn = getFactionId(player.steamId);
        if (sworn !== null) {
            const kept = FACTIONS.find((candidate) => candidate.id === sworn);
            notice(player, sworn === factionId ? `Você já jurou lealdade à ${kept?.name ?? sworn}.` : `Você já jurou lealdade à ${kept?.name ?? sworn}: o juramento é definitivo e não se troca. Só um administrador pode desfazê-lo.`);
            return;
        }
        if (typeof factionId !== "string" || !setFactionId(player.steamId, factionId)) {
            Chat.sendToPlayer(player, "Essa facção não pode ser escolhida.");
            return;
        }
        const faction = FACTIONS.find((candidate) => candidate.id === factionId);
        Chat.sendToPlayer(player, `Você jurou lealdade à ${faction?.name ?? factionId}: ela é a sua facção de lealdade.`);
        // The first oath to a faction brings its colours; the ledger in character-state.ts stops a second set.
        const colours = grantFactionColours(player, factionId);
        if (colours.length > 0) {
            notice(player, `As cores da facção estão no seu inventário: ${colours.join(" e ")}. Vista pelo inventário.`);
        }
        sendSocial(player);
    });

    // Which page the character screen shows is a preference, not a rule: a bad value is ignored without a word.
    Events.onClient(`${RESOURCE}:status.selectShowcase`, (sender, payload) => {
        const player = sender as Player;
        if (!player.steamId) {
            return;
        }
        const showcase = typeof payload === "object" && payload !== null ? (payload as { showcase?: unknown }).showcase : undefined;
        if (setShowcase(player.steamId, showcase)) {
            sendSocial(player);
        }
    });

    /** Who a request is for: the sender themselves unless the page named another player who is still here. */
    const targetOf = (player: Player, fields: Record<string, unknown>): Player | null => {
        if (typeof fields["targetId"] !== "number" || fields["targetId"] === player.id) {
            return player;
        }
        const picked = Player.getById(fields["targetId"]);
        if (picked === null) {
            notice(player, "Esse jogador não está mais no servidor.");
        }
        return picked;
    };

    // The administrator hands any property's key to anybody; an owner may make keys of theirs, up to a limit. Who is
    // who is decided here, never by what the page shows.
    Events.onClient(`${RESOURCE}:status.grantKey`, (sender, payload) => {
        const player = sender as Player;
        const fields = fieldsOf(payload);
        if (typeof fields["propertyId"] !== "string") {
            return;
        }
        const target = targetOf(player, fields);
        if (target === null) {
            return;
        }
        // One door of a house has a key of its own, which opens that door and nothing else.
        const doorIndex = fields["doorIndex"];
        const result = typeof doorIndex === "number" ? issueDoorKey(player, fields["propertyId"], doorIndex, target, isAdmin(player)) : issueKey(player, fields["propertyId"], target, isAdmin(player));
        notice(player, result.message);
        if (result.ok && target !== player) {
            Chat.sendToPlayer(target, `${nameOf(player)} entregou a você uma chave${typeof doorIndex === "number" ? " de uma porta" : ""}. Fique perto da porta ou do baú e digite /chave para usá-la.`);
        }
        sendSocial(player);
    });

    // The name and the description may be changed by the owner or an administrator; the region only by an administrator.
    Events.onClient(`${RESOURCE}:status.propSave`, (sender, payload) => {
        const player = sender as Player;
        const fields = fieldsOf(payload);
        const property = typeof fields["id"] === "string" ? getProperty(fields["id"]) : null;
        if (property === null) {
            notice(player, "Propriedade não encontrada.");
            return;
        }
        const admin = isAdmin(player);
        if (!admin && !isOwner(player, property)) {
            notice(player, "Só o dono pode mudar isso.");
            return;
        }

        const failures: string[] = [];
        if (typeof fields["name"] === "string" && fields["name"] !== shortName(property)) {
            const result = renameProperty(property.id, fields["name"]);
            if (!result.ok) {
                failures.push(result.message);
            }
        }
        if (typeof fields["description"] === "string" && fields["description"] !== property.description) {
            const result = describeProperty(property.id, fields["description"]);
            if (!result.ok) {
                failures.push(result.message);
            }
        }
        if (admin && typeof fields["region"] === "string" && fields["region"] !== "" && fields["region"] !== property.region && property.parentId === "") {
            const result = setRegion(property.id, fields["region"]);
            if (!result.ok) {
                failures.push(result.message);
            }
        }
        notice(player, failures[0] ?? "Propriedade atualizada.");
        sendSocial(player);
    });

    // Handing a property to a player (administrator only): they become its owner and get the keys.
    Events.onClient(`${RESOURCE}:status.propOwner`, (sender, payload) => {
        const player = sender as Player;
        if (!isAdmin(player)) {
            return;
        }
        const fields = fieldsOf(payload);
        if (typeof fields["id"] !== "string") {
            return;
        }
        const target = targetOf(player, fields);
        if (target === null) {
            return;
        }
        const result = assignOwner(player, fields["id"], target);
        notice(player, result.message);
        if (result.ok && target !== player) {
            Chat.sendToPlayer(target, `${nameOf(player)} entregou a você uma propriedade. Veja na seção Propriedades do painel (F2).`);
        }
        sendSocial(player);
    });

    Events.onClient(`${RESOURCE}:status.propDisown`, (sender, payload) => {
        const player = sender as Player;
        const fields = fieldsOf(payload);
        if (!isAdmin(player) || typeof fields["id"] !== "string") {
            return;
        }
        notice(player, clearOwner(fields["id"]).message);
        sendSocial(player);
    });

    // A property given on by its owner (the house, with its chests) to a player who is here: what an owner of a ceded
    // region does with it. The vendors' houses are never given, whoever asks.
    Events.onClient(`${RESOURCE}:status.propGive`, (sender, payload) => {
        const player = sender as Player;
        const fields = fieldsOf(payload);
        const property = typeof fields["id"] === "string" ? getProperty(fields["id"]) : null;
        if (property === null) {
            notice(player, "Propriedade não encontrada.");
            return;
        }
        if (!isAdmin(player) && !isOwner(player, property)) {
            notice(player, "Só o dono pode entregar a propriedade.");
            return;
        }
        if (typeof fields["targetId"] !== "number" || fields["targetId"] === player.id) {
            notice(player, "Escolha outro jogador para receber a propriedade.");
            return;
        }
        const target = targetOf(player, fields);
        if (target === null) {
            return;
        }
        const result = assignOwner(player, property.id, target);
        notice(player, result.message);
        if (result.ok) {
            Chat.sendToPlayer(target, `${nameOf(player)} entregou a você ${property.name}. Veja na seção Propriedades do painel (F2).`);
            sendSocial(target);
        }
        sendSocial(player);
    });

    // Locking and unlocking one door of a house from the panel, as its chests are: the owner or an administrator.
    Events.onClient(`${RESOURCE}:status.doorLock`, (sender, payload) => {
        const player = sender as Player;
        const fields = fieldsOf(payload);
        const property = typeof fields["id"] === "string" ? getProperty(fields["id"]) : null;
        if (property === null) {
            notice(player, "Propriedade não encontrada.");
            return;
        }
        if (!isAdmin(player) && !isOwner(player, property)) {
            notice(player, "Só o dono pode trancar ou destrancar.");
            return;
        }
        const index = fields["index"];
        if (typeof index !== "number" || !Number.isInteger(index) || (fields["locked"] !== 0 && fields["locked"] !== 1)) {
            return;
        }
        notice(player, setDoorLocked(property.id, index, fields["locked"] === 1).message);
        sendSocial(player);
    });

    // A whole region to a player (administrator only): they get every property of it that nobody owns, and decide for
    // themselves. The page shows what would pass before it asks; `previewRegion` is the same count.
    Events.onClient(`${RESOURCE}:status.regionCede`, (sender, payload) => {
        const player = sender as Player;
        if (!isAdmin(player)) {
            return;
        }
        const fields = fieldsOf(payload);
        const region = typeof fields["region"] === "string" ? regionNamed(fields["region"]) : null;
        if (region === null) {
            notice(player, "Escolha uma região para ceder.");
            return;
        }
        const target = targetOf(player, fields);
        if (target === null) {
            return;
        }
        if (fields["confirm"] !== 1) {
            const would = previewRegion(region, target.steamId);
            notice(player, `${region} para ${target.nickname}: ${would.given} propriedade(s) e ${would.chests} baú(s) passariam a ele.`);
            return;
        }
        const report = cedeRegion(player, region, target);
        notice(player, report.message);
        if (report.ok && target !== player) {
            Chat.sendToPlayer(target, `${nameOf(player)} cedeu a você a região de ${region}: tudo o que não tinha dono é seu, e você decide o que fazer. Veja na seção Propriedades do painel (F2).`);
        }
        sendSocial(target);
        if (target !== player) {
            sendSocial(player);
        }
    });

    // The supporter benefits (administrator only, from the "Jogadores" page, once the receipt has been seen on Discord).
    Events.onClient(`${RESOURCE}:status.supporterGrant`, (sender, payload) => {
        const player = sender as Player;
        if (!isAdmin(player)) {
            return;
        }
        const id = fieldsOf(payload)["targetId"];
        const target = typeof id === "number" && Number.isInteger(id) ? Player.getById(id) : null;
        if (target === null) {
            notice(player, "Esse jogador não está mais no servidor.");
            return;
        }
        notice(player, supporters.grant(player, target).message);
        sendRoster(player);
        if (target !== player) {
            sendSocial(target);
        }
    });

    // A door or a chest the player is looking at: its name, and its owner's if it has one. Everybody may ask, since
    // the name is on the prompt for everybody; an object that is no property answers with nothing.
    Events.onClient(`${RESOURCE}:props.peek`, (sender, payload) => {
        const player = sender as Player;
        const guid = fieldsOf(payload)["guid"];
        if (typeof guid !== "string" || !/^[0-9a-f]{8,32}$/.test(guid)) {
            return;
        }
        // `use` says it is a door or chest of a property: an E pressed at it is told to the server too (property-menu.ts),
        // for a client whose door the game does not report.
        const property = propertyOfGuid(guid);
        const use = property !== null;
        // `door` says it is one of its doors, the only part a look is held for (property-menu.ts).
        const door = property !== null && property.doors.includes(guid);
        player.emit(`${RESOURCE}:props.label`, JSON.stringify({ guid, label: labelFor(guid), use, door }));
    });

    // Locking and unlocking from the panel: the owner (and the owner of the house a chest is in) or an administrator.
    // The chest of a house is its own property here, with its own button.
    Events.onClient(`${RESOURCE}:status.propLock`, (sender, payload) => {
        const player = sender as Player;
        const fields = fieldsOf(payload);
        const property = typeof fields["id"] === "string" ? getProperty(fields["id"]) : null;
        if (property === null) {
            notice(player, "Propriedade não encontrada.");
            return;
        }
        if (!isAdmin(player) && !isOwner(player, property)) {
            notice(player, "Só o dono pode trancar ou destrancar.");
            return;
        }
        if (fields["locked"] !== 0 && fields["locked"] !== 1) {
            return;
        }
        notice(player, setLocked(property.id, fields["locked"] === 1).message);
        sendSocial(player);
    });

    /**
     * The player a relative is, by the network id the page picked from who is online: their Steam id, or null for "no
     * player". Undefined when the field was left out; a reason when the id names nobody who can be linked.
     */
    const linkOf = (player: Player, value: unknown): string | null | undefined | { reason: string } => {
        if (value === undefined) {
            return undefined;
        }
        if (value === -1) {
            return null;
        }
        const other = typeof value === "number" && Number.isInteger(value) ? Player.getById(value) : null;
        if (other === null || other.steamId === "") {
            return { reason: "Esse jogador não está mais no servidor." };
        }
        if (other.id === player.id) {
            return { reason: "Você não pode ser o seu próprio parente." };
        }
        return other.steamId;
    };

    /** A relative who is a player sees the tree's word on them at once: married, a widow, their standing. */
    const refreshLinked = (steamIds: Iterable<string>): void => {
        for (const steamId of steamIds) {
            const online = Player.all().find((other) => other.steamId === steamId);
            if (online !== undefined) {
                sendSocial(online);
            }
        }
    };

    /** A player put in somebody's tree is asked first, in their own Família section; the one who asks is told it waits. */
    const ask = (player: Player, steamId: string, label: string): void => {
        const other = Player.all().find((candidate) => candidate.steamId === steamId);
        notice(player, `O pedido foi para ${other !== undefined ? nameOf(other) : nameOfSteamId(steamId)}: o vínculo vale quando for aceito, na seção Família.`);
        if (other !== undefined) {
            sendSocial(other);
            Chat.sendToPlayer(other, `${nameOf(player)} quer registrar você na família como ${label}. Aceite ou recuse na seção Família do painel (F2).`);
        }
    };

    Events.onClient(`${RESOURCE}:status.familyAdd`, (sender, payload) => {
        const player = sender as Player;
        const fields = fieldsOf(payload);
        const link = linkOf(player, fields["linkId"]);
        if (typeof link === "object" && link !== null) {
            notice(player, link.reason);
            return;
        }
        const result = addPerson(player.steamId, fields["relation"], fields["degree"], fields["name"], link ?? null, mirroring(player));
        if (!result.ok) {
            notice(player, result.reason);
            return;
        }
        sendSocial(player);
        if (result.invited !== undefined) {
            ask(player, result.invited, result.person.label);
        }
    });

    Events.onClient(`${RESOURCE}:status.familyEdit`, (sender, payload) => {
        const player = sender as Player;
        const fields = fieldsOf(payload);
        const link = linkOf(player, fields["linkId"]);
        if (typeof link === "object" && link !== null) {
            notice(player, link.reason);
            return;
        }
        const deceased = fields["deceased"] === 1 ? true : fields["deceased"] === 0 ? false : fields["deceased"];
        const before = familyHeirs(player.steamId).map((heir) => heir.steamId);
        const result = editPerson(player.steamId, fields["id"], { relation: fields["relation"], deceased, ...(link === undefined ? {} : { link }) }, mirroring(player));
        if (!result.ok) {
            notice(player, result.reason);
            return;
        }
        sendSocial(player);
        const mirrors = result.mirrors ?? [];
        refreshLinked(new Set([...before, ...familyHeirs(player.steamId).map((heir) => heir.steamId), ...(typeof link === "string" ? [link] : []), ...mirrors.map((outcome) => outcome.steamId)]));
        for (const outcome of mirrors) {
            tellMirror(player, outcome);
        }
        if (result.invited !== undefined) {
            ask(player, result.invited, result.person.label);
        }
    });

    // The one asked answers: a yes makes the link and their side of it, a no leaves the asker's relative a name.
    Events.onClient(`${RESOURCE}:status.familyAnswer`, (sender, payload) => {
        const player = sender as Player;
        const fields = fieldsOf(payload);
        const result = answerInvite(player.steamId, fields["key"], fields["accept"] === 1);
        sendSocial(player);
        if (!result.ok) {
            notice(player, result.reason);
            return;
        }
        refreshLinked([result.owner]);
        const asker = Player.all().find((other) => other.steamId === result.owner);
        const askerName = asker !== undefined ? nameOf(asker) : nameOfSteamId(result.owner);
        if (result.accepted) {
            notice(
                player,
                result.mirror?.kind === "added"
                    ? `Você aceitou: ${askerName} está na sua árvore como ${result.mirror.person.label}.`
                    : result.mirror?.kind === "full"
                      ? `Você aceitou o vínculo com ${askerName}, mas sua árvore está cheia: ${askerName} não entrou nela.`
                      : `Você aceitou o vínculo de família com ${askerName}.`,
            );
        } else {
            notice(player, `Você recusou o pedido de ${askerName}.`);
        }
        if (asker !== undefined) {
            Chat.sendToPlayer(asker, result.accepted ? `${nameOf(player)} aceitou ser ${result.label} na sua árvore de família.` : `${nameOf(player)} recusou ser ${result.label} na sua árvore; o parente fica só com o nome.`);
        }
    });

    // A player's standing (administrator only), and with it, when asked, their spouse's and their legitimate line's.
    Events.onClient(`${RESOURCE}:status.setSocial`, (sender, payload) => {
        const player = sender as Player;
        if (!isAdmin(player)) {
            return;
        }
        const fields = fieldsOf(payload);
        const id = fields["targetId"];
        const status = fields["status"];
        const target = typeof id === "number" && Number.isInteger(id) ? Player.getById(id) : null;
        if (status !== "plebeius" && status !== "nobilis") {
            return;
        }
        if (target === null || target.steamId === "") {
            notice(player, "Esse jogador não está mais no servidor.");
            return;
        }
        const label = SOCIAL_STATUS[status];
        const changed: string[] = [];
        const steamIds = [target.steamId, ...(fields["family"] === 1 ? familyHeirs(target.steamId).map((heir) => heir.steamId) : [])];
        for (const steamId of steamIds) {
            if (getSocialStatus(steamId) === status) {
                continue;
            }
            setSocialStatus(steamId, status);
            changed.push(nameOfSteamId(steamId));
            const online = Player.all().find((other) => other.steamId === steamId);
            if (online !== undefined) {
                sendSocial(online);
                if (online !== player) {
                    Chat.sendToPlayer(online, steamId === target.steamId ? `Seu status social agora é ${label.label} (${label.gloss}).` : `Seu status social agora é ${label.label} (${label.gloss}), com ${target.nickname}.`);
                }
            }
        }
        notice(player, changed.length === 0 ? `Ninguém mudou: já eram ${label.label}.` : `${label.label} (${label.gloss}) agora: ${changed.join(", ")}.`);
        sendRoster(player);
    });

    Events.onClient(`${RESOURCE}:status.familyRemove`, (sender, payload) => {
        const player = sender as Player;
        const id = typeof payload === "object" && payload !== null ? (payload as { id?: unknown }).id : undefined;
        const result = removePersonDetailed(player.steamId, id);
        if (result.removed) {
            sendSocial(player);
            if (result.mirror !== null) {
                // The other player's side of the link goes with it.
                refreshLinked([result.mirror.steamId]);
                tellMirror(player, result.mirror);
            }
        }
    });

    Events.onClient(`${RESOURCE}:status.familySurname`, (sender, payload) => {
        const player = sender as Player;
        const surname = typeof payload === "object" && payload !== null ? (payload as { surname?: unknown }).surname : undefined;
        const result = setSurname(player.steamId, surname);
        if (!result.ok) {
            notice(player, result.reason);
            return;
        }
        sendSocial(player);
    });

    // The links made before a relative got their own side of it are given it once, now.
    const mirrored = backfillMirrors(savedMirroring);
    if (mirrored > 0) {
        console.log(`family: ${mirrored} ligação(ões) antiga(s) ganharam o lado delas na árvore do outro jogador`);
    }

    console.log(`status panel answering; ${GUILDS.length} guild(s) and ${FACTIONS.length} faction(s) in the catalog`);
}
