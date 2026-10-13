/**
 * The look a player chose in the character creator, kept on disk so it
 * survives a restart and a reconnect. Keyed by Steam id, the one identifier
 * that outlives a session (`player.steamId`); a player without one (no
 * Steam id reported) is never looked up or saved here, so they see the
 * creator every join.
 */

/**
 * A resource runs in the framework's isolate, not a plain Node program, so
 * its declarations (`@kingdomsconnected/types/server`) leave Node's own
 * globals out on purpose. The engine embeds Node under the hood and `fs`
 * works at runtime regardless; this is just enough of a hand-typed bridge
 * to call it without widening that global surface for the rest of the resource.
 */
declare function require(id: string): unknown;

interface NodeFs {
    readFileSync(path: string, encoding: "utf8"): string;
    writeFileSync(path: string, data: string): void;
    mkdirSync(path: string, options: { recursive: true }): void;
}

const fs = require("node:fs") as NodeFs;

const DIR = "playerdata";
const FILE = `${DIR}/characters.json`;

interface SavedCharacter {
    appearance: Appearance;
    nickname: string;
    createdAt: number;
    updatedAt: number;
}

let cache: Record<string, SavedCharacter> | null = null;

function load(): Record<string, SavedCharacter> {
    if (cache) {
        return cache;
    }
    try {
        cache = JSON.parse(fs.readFileSync(FILE, "utf8")) as Record<string, SavedCharacter>;
    } catch {
        cache = {};
    }
    return cache;
}

function persist(store: Record<string, SavedCharacter>): void {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(store, null, 2));
}

/** The saved look for this Steam id, or null with none saved yet (or no Steam id at all). */
export function getCharacter(steamId: string): SavedCharacter | null {
    if (!steamId) {
        return null;
    }
    return load()[steamId] ?? null;
}

/** Remembers this look under the player's Steam id. Does nothing without one. */
export function saveCharacter(steamId: string, appearance: Appearance, nickname: string): void {
    if (!steamId) {
        return;
    }
    const store = load();
    const existing = store[steamId];
    store[steamId] = {
        appearance,
        nickname,
        createdAt: existing?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
    };
    persist(store);
}
