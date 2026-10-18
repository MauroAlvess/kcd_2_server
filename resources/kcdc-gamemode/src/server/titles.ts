/**
 * Who holds which title (`nobility.ts` has the catalog and the rules), kept by Steam id in `playerdata/titles.json`, and the
 * one place a title shows in the world: the game's own nametag.
 *
 * Names stay hidden (`encounters.ts`). A player's nametag is off unless they chose to wear one of their titles (the
 * "Título sobre a cabeça" option of the panel): then it shows that title, in gold, and nothing else. The social status
 * (plebeius, nobilis) is never written over a head.
 *
 * A record keeps who named each title and when, so the hierarchy can say whose man somebody is, and the name the holder
 * had when last seen, so it can list them while they are away.
 */

import { getCharacter } from "./characters.js";
import { bloodTitleOf, known, labelOf, order, titleById, TITLES } from "./nobility.js";
import type { TitleDef } from "./nobility.js";
import { ensureDir, read, write } from "./store.js";

const DIR = "playerdata";
const FILE = `${DIR}/titles.json`;
const LEGACY_COPY = `${DIR}/titles.legacy.json`;

export interface Grant {
    readonly id: string;
    /** The Steam id of whoever named them, or "admin" for an administrator. */
    readonly by: string;
    readonly byName: string;
    readonly at: number;
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
                    grants.push({ id: grant.id, by: typeof grant.by === "string" ? grant.by : "admin", byName: typeof grant.byName === "string" ? grant.byName : "", at: typeof grant.at === "number" ? grant.at : 0 });
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

/** A player's titles as the panel reads them: the label for their body, the highest first. */
export function titleLines(steamId: string, female: boolean): TitleLine[] {
    return titlesOf(steamId).flatMap((id) => {
        const title = titleById(id);
        return title === null ? [] : [{ id, label: labelOf(title, female), kind: title.kind, branch: title.branch }];
    });
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
export function addTitle(steamId: string, name: string, id: string, by: Namer): Granted {
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
        holder.grants.push({ id, by: by.steamId, byName: by.name, at: Date.now() });
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

/** Puts the title the player chose over their head, or keeps their nametag off when they chose none. */
export function applyNametag(player: Player): void {
    const chosen = shownOf(player.steamId);
    const title = chosen === null ? null : titleById(chosen);
    try {
        if (title === null) {
            player.setNametagVisible(false);
            player.setNametagText("");
            player.setNametagColor(PLAIN_COLOUR);
        } else {
            player.setNametagText(labelOf(title, isFemale(player)));
            player.setNametagColor(TITLE_COLOUR);
            player.setNametagHealthVisible(false);
            player.setNametagVisible(true);
        }
    } catch {
        // A player gone between the event and here.
    }
}

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
