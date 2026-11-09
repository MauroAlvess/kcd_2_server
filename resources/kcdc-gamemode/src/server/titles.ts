/**
 * Who holds which title (`nobility.ts` has the catalog and the rules), kept by Steam id in `playerdata/titles.json`, and the
 * one place a title shows in the world: the game's own nametag.
 *
 * Names stay hidden (`encounters.ts`). A player's title is over their head only if they chose to wear one of their titles (the
 * "Título sobre a cabeça" option of the panel), in gold; a marked thief wears "Ladrão" in red instead. The social status
 * (plebeius, nobilis) is never written over a head.
 *
 * Since 2026-11-04 (user: "título na cabeça e título de ladrão só aparece acima da cabeça para quem já se apresentou") the text is not the
 * game's nametag, which everybody would read: the native nametag is a blank line that the text hangs on, and the text itself goes only to
 * the players who know the wearer, one by one (`head-labels.ts`, the client's `Nametags.setLabel`). `headOf` says what the text is.
 *
 * A record keeps who named each title and when, so the hierarchy can say whose man somebody is, and the name the holder
 * had when last seen, so it can list them while they are away.
 */

import { getCharacter } from "./characters.js";
import { bloodTitleOf, known, labelOf, levelOf, order, titleById, TITLES } from "./nobility.js";
import type { TitleDef } from "./nobility.js";
import { ensureDir, read, write } from "./store.js";
import { onThiefChange, thiefMark } from "./thieves.js";

const DIR = "playerdata";
const FILE = `${DIR}/titles.json`;
const LEGACY_COPY = `${DIR}/titles.legacy.json`;

export interface Grant {
    readonly id: string;
    /** The Steam id of whoever named them, or "admin" for an administrator. */
    readonly by: string;
    readonly byName: string;
    readonly at: number;
    /**
     * The town the title is of (an id of `citizenship.ts`): "Cavaleiro de Suchdol" (2026-10-31, user: "ao nomear um jogador deve se escolher qual região ... isso manterá a árvore organizada").
     * None for a title of no place (the King's), and for one the migration did not find a town for.
     */
    readonly region?: string;
}

/** What a town is called, to write it after a title; the town's own name for one the catalog has (`index.ts` hands it in). */
let regionName: (id: string) => string = (id) => id;

export function setRegionNamer(namer: (id: string) => string): void {
    regionName = namer;
}

const REGION_ID = /^[a-z0-9-]{1,40}$/;

/** A title as its holder is called by it: "Cavaleiro", and "Cavaleiro de Suchdol" when it is of a region. */
export function labelWithRegion(title: TitleDef, female: boolean, region: string | undefined): string {
    return region === undefined || region === "" ? labelOf(title, female) : `${labelOf(title, female)} de ${regionName(region)}`;
}

interface Holder {
    name: string;
    grants: Grant[];
    /** The title they chose to wear over their head. */
    shown?: string;
}

interface StoreFile {
    version: 2;
    holders: Record<string, Holder>;
}

/** The panel's gold (213, 161, 86), opaque. */
const TITLE_COLOUR = 0xffd5a156;
const PLAIN_COLOUR = 0xffffffff;
/** The thief's mark: red, over whatever title they hold, for as long as it lasts (`thieves.ts`). */
const THIEF_COLOUR = 0xffd23c32;

let cache: Record<string, Holder> | null = null;

const fold = (text: string): string => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** What an old free-text title most plausibly meant, by the words the catalog has for it; null for the rest. */
function legacyMatch(text: string): string | null {
    const wanted = fold(text);
    const aliases: Readonly<Record<string, string>> = { senhor: "lorde", senhora: "lorde", dama: "cavaleiro", "capitao da guarda": "capitao-guarda" };
    const alias = aliases[wanted];
    if (alias !== undefined) {
        return alias;
    }
    return TITLES.find((title) => fold(title.male) === wanted || fold(title.female) === wanted)?.id ?? null;
}

function normalize(raw: unknown): Record<string, Holder> {
    const holders: Record<string, Holder> = {};
    if (typeof raw !== "object" || raw === null) {
        return holders;
    }
    const record = raw as Record<string, unknown>;
    if (record["version"] === 2 && typeof record["holders"] === "object" && record["holders"] !== null) {
        for (const [steamId, value] of Object.entries(record["holders"] as Record<string, unknown>)) {
            const holder = value as Partial<Holder> | null;
            if (holder === null || typeof holder !== "object" || !Array.isArray(holder.grants)) {
                continue;
            }
            const grants: Grant[] = [];
            for (const grant of holder.grants as Array<Partial<Grant>>) {
                if (typeof grant?.id === "string" && titleById(grant.id) !== null && !grants.some((have) => have.id === grant.id)) {
                    grants.push({ id: grant.id, by: typeof grant.by === "string" ? grant.by : "admin", byName: typeof grant.byName === "string" ? grant.byName : "", ...(typeof grant.region === "string" && REGION_ID.test(grant.region) ? { region: grant.region } : {}), at: typeof grant.at === "number" ? grant.at : 0 });
                }
            }
            if (grants.length > 0) {
                holders[steamId] = { name: typeof holder.name === "string" ? holder.name : "", grants, ...(typeof holder.shown === "string" && grants.some((have) => have.id === holder.shown) ? { shown: holder.shown } : {}) };
            }
        }
        return holders;
    }
    // The first version of the file: one free-text title for each Steam id.
    const lost: string[] = [];
    for (const [steamId, text] of Object.entries(record)) {
        if (typeof text !== "string" || text === "") {
            continue;
        }
        const id = legacyMatch(text);
        if (id === null) {
            lost.push(`${steamId}: ${text}`);
            continue;
        }
        holders[steamId] = { name: "", grants: [{ id, by: "admin", byName: "", at: 0 }] };
    }
    if (lost.length > 0) {
        console.log(`titles: ${lost.length} título(s) antigo(s) de texto livre não têm lugar na hierarquia e foram guardados em ${LEGACY_COPY}: ${lost.join("; ")}`);
        try {
            ensureDir(DIR);
            write(LEGACY_COPY, record);
        } catch {
            // The log line above has them.
        }
    }
    return holders;
}

function load(): Record<string, Holder> {
    if (cache !== null) {
        return cache;
    }
    cache = {};
    const loaded = read<unknown>(FILE);
    if (loaded.status === "ok") {
        cache = normalize(loaded.value);
    } else if (loaded.status === "corrupt") {
        console.error(`titles: ${FILE} está ilegível e foi deixado como está: ${loaded.reason}`);
    }
    return cache;
}

function persist(): void {
    try {
        ensureDir(DIR);
        const file: StoreFile = { version: 2, holders: load() };
        write(FILE, file);
    } catch (error: unknown) {
        console.log(`titles: não consegui salvar: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// ---------------------------------------------------------------------------------------------
// Reading.

/** A player starts again (`character-reset.ts`): every title they hold, and the one they showed, goes. */
export function forgetTitles(steamId: string): void {
    const store = load();
    if (store[steamId] !== undefined) {
        delete store[steamId];
        persist();
    }
}

export function grantsOf(steamId: string): readonly Grant[] {
    return steamId === "" ? [] : (load()[steamId]?.grants ?? []);
}

/** The ids of a player's titles, the highest first. */
export function titlesOf(steamId: string): string[] {
    return known(grantsOf(steamId).map((grant) => grant.id))
        .sort((a, b) => order(a) - order(b))
        .map((title) => title.id);
}

export interface HolderInfo {
    readonly steamId: string;
    readonly name: string;
    readonly grants: readonly Grant[];
}

/** Everybody who holds a title, with the name they had when last seen. */
export function holders(): HolderInfo[] {
    return Object.entries(load()).map(([steamId, holder]) => ({ steamId, name: holder.name, grants: holder.grants }));
}

/** The Steam id of whoever holds a title that only one may hold, or null. */
export function holderOfTitle(id: string): string | null {
    for (const [steamId, holder] of Object.entries(load())) {
        if (holder.grants.some((grant) => grant.id === id)) {
            return steamId;
        }
    }
    return null;
}

export function holdsTitle(steamId: string, id: string): boolean {
    return grantsOf(steamId).some((grant) => grant.id === id);
}

/** The title a player chose to wear, if they still hold it. */
export function shownOf(steamId: string): string | null {
    const holder = steamId === "" ? undefined : load()[steamId];
    return holder?.shown !== undefined && holder.grants.some((grant) => grant.id === holder.shown) ? holder.shown : null;
}

export interface TitleLine {
    readonly id: string;
    readonly label: string;
    readonly kind: TitleDef["kind"];
    readonly branch: TitleDef["branch"];
}

/** The town a player's title is of ("" for none): the town they were named for. */
export function regionOfTitle(steamId: string, titleId: string): string {
    return grantsOf(steamId).find((grant) => grant.id === titleId)?.region ?? "";
}

/** A player's titles as the panel reads them: the label for their body (and the town it is of), the highest first. */
export function titleLines(steamId: string, female: boolean): TitleLine[] {
    return titlesOf(steamId).flatMap((id) => {
        const title = titleById(id);
        return title === null ? [] : [{ id, label: labelWithRegion(title, female, regionOfTitle(steamId, id)), kind: title.kind, branch: title.branch }];
    });
}

/**
 * Links the titles that were given before they had a place to the town their holder is a citizen of (2026-10-31, user: "nos jogadores que já têm título vamos vinculá-los a sua cidadania"):
 * a title with no town (the King's has none to have) takes `townOf(steamId)`, when the holder has one. Idempotent. How many titles were linked.
 */
export function linkTitlesToTowns(townOf: (steamId: string) => string | null): number {
    const store = load();
    let linked = 0;
    for (const [steamId, holder] of Object.entries(store)) {
        const town = townOf(steamId);
        if (town === null || town === "") {
            continue;
        }
        holder.grants = holder.grants.map((grant) => {
            const title = titleById(grant.id);
            if (grant.region !== undefined || title === null || levelOf(title) <= 1) {
                return grant;
            }
            linked += 1;
            return { ...grant, region: town };
        });
    }
    if (linked > 0) {
        persist();
    }
    return linked;
}

// ---------------------------------------------------------------------------------------------
// Writing.

export interface Namer {
    readonly steamId: string;
    readonly name: string;
}

export interface Granted {
    /** The blood title this one replaced. */
    readonly replaced: string | null;
    /** The player who lost a title only one may hold, when this one was theirs. */
    readonly displaced: string | null;
}

/**
 * Gives a player a title, with the checks of `nobility.ts` already made. A blood title takes the place of the one
 * they held; a title only one may hold is taken from whoever had it.
 */
export function addTitle(steamId: string, name: string, id: string, by: Namer, region = ""): Granted {
    const title = titleById(id);
    if (title === null || steamId === "") {
        return { replaced: null, displaced: null };
    }
    const store = load();
    let displaced: string | null = null;
    if (title.unique === true) {
        const other = holderOfTitle(id);
        if (other !== null && other !== steamId) {
            removeTitle(other, id);
            displaced = other;
        }
    }
    const holder = store[steamId] ?? { name, grants: [] };
    holder.name = name || holder.name;
    let replaced: string | null = null;
    if (title.kind === "blood") {
        const current = bloodTitleOf(holder.grants.map((grant) => grant.id));
        if (current !== null && current.id !== id) {
            replaced = current.id;
            holder.grants = holder.grants.filter((grant) => grant.id !== current.id);
            if (holder.shown === current.id) {
                delete holder.shown;
            }
        }
    }
    if (!holder.grants.some((grant) => grant.id === id)) {
        holder.grants.push({ id, by: by.steamId, byName: by.name, at: Date.now(), ...(region !== "" && REGION_ID.test(region) ? { region } : {}) });
    } else if (region !== "" && REGION_ID.test(region)) {
        // The title they hold is named again for another town: it is of that one now.
        holder.grants = holder.grants.map((grant) => (grant.id === id ? { ...grant, region } : grant));
    }
    store[steamId] = holder;
    persist();
    return { replaced, displaced };
}

export function removeTitle(steamId: string, id: string): boolean {
    const store = load();
    const holder = store[steamId];
    if (holder === undefined || !holder.grants.some((grant) => grant.id === id)) {
        return false;
    }
    holder.grants = holder.grants.filter((grant) => grant.id !== id);
    if (holder.shown === id) {
        delete holder.shown;
    }
    if (holder.grants.length === 0) {
        delete store[steamId];
    }
    persist();
    return true;
}

/** Takes away the titles of a player that match; the ids taken. For a player who stopped being a noble. */
export function removeWhere(steamId: string, matches: (title: TitleDef) => boolean): string[] {
    const taken = titlesOf(steamId).filter((id) => {
        const title = titleById(id);
        return title !== null && matches(title);
    });
    for (const id of taken) {
        removeTitle(steamId, id);
    }
    return taken;
}

/** Chooses the title to wear over the head, or none. False when the player does not hold it. */
export function setShown(steamId: string, id: string | null): boolean {
    const store = load();
    const holder = store[steamId];
    if (id === null) {
        if (holder !== undefined && holder.shown !== undefined) {
            delete holder.shown;
            persist();
        }
        return true;
    }
    if (holder === undefined || !holder.grants.some((grant) => grant.id === id)) {
        return false;
    }
    holder.shown = id;
    persist();
    return true;
}

/** Keeps the name current, for the hierarchy to list a holder who is away. */
export function noteName(steamId: string, name: string): void {
    const holder = steamId === "" ? undefined : load()[steamId];
    if (holder !== undefined && name !== "" && holder.name !== name) {
        holder.name = name;
        persist();
    }
}

// ---------------------------------------------------------------------------------------------
// The nametag.

/** Whether a player's body is a woman's, as the panel's own lines decide it: the saved look first, then the game's. */
export function isFemale(player: Player): boolean {
    return (getCharacter(player.steamId)?.appearance.gender ?? player.appearance.gender) === "female";
}

/**
 * What is over a player's head for those who know them: the thief's mark ("Ladrão", "Ladra", in red) over whatever title they hold, else the title they chose to wear (in gold,
 * "Cavaleiro de Suchdol" when it is of a place); null when there is nothing. Who may read it is `head-labels.ts`'s to say.
 */
export function headOf(player: Player): { readonly text: string; readonly colour: number } | null {
    if (thiefMark(player.steamId) !== null) {
        return { text: isFemale(player) ? "Ladra" : "Ladrão", colour: THIEF_COLOUR };
    }
    const chosen = shownOf(player.steamId);
    const title = chosen === null ? null : titleById(chosen);
    return title === null ? null : { text: labelWithRegion(title, isFemale(player), regionOfTitle(player.steamId, title.id)), colour: TITLE_COLOUR };
}

/**
 * The name drawn on a head that has something to say: a line of one no-break space, which draws nothing, so that the label of `head-labels.ts` has a nametag to hang on and
 * the player's own name is not read there ("empty restores the name": an empty text would show it).
 */
export const BLANK_NAME = "\u00a0";

/** Who is told when a head changes (`head-labels.ts`). */
const headListeners: Array<(player: Player) => void> = [];

export function onHeadChange(listener: (player: Player) => void): void {
    headListeners.push(listener);
}

/** Puts a blank nametag on the player when they have something over their head (the text goes to whoever knows them), or keeps their nametag off when they have not. */
export function applyNametag(player: Player): void {
    try {
        if (headOf(player) === null) {
            player.setNametagVisible(false);
            player.setNametagText("");
            player.setNametagColor(PLAIN_COLOUR);
        } else {
            player.setNametagText(BLANK_NAME);
            player.setNametagColor(PLAIN_COLOUR);
            player.setNametagHealthVisible(false);
            player.setNametagVisible(true);
        }
    } catch {
        // A player gone between the event and here.
    }
    for (const listener of headListeners) {
        try {
            listener(player);
        } catch (error: unknown) {
            console.log(`titles: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

// A mark put on or run out redraws the head it is over.
onThiefChange((player) => applyNametag(player));

/** The nametag as the game had it: the player's own name, untinted. When the resource stops. */
export function restoreNametag(player: Player): void {
    try {
        player.setNametagText("");
        player.setNametagColor(PLAIN_COLOUR);
        player.setNametagVisible(true);
    } catch {
        // Gone.
    }
}
