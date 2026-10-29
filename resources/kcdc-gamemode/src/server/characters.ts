/**
 * The look a player chose in the character creator, and the name they gave the character (a first name and an alcunha:
 * `character-name.ts`), kept on disk so they survive a restart and a reconnect. Keyed by Steam id, the one identifier
 * that outlives a session (`player.steamId`); a player without one (no Steam id reported) is never looked up or saved
 * here, so they see the creator every join.
 *
 * A character made before the name was asked for has none: it goes by the nickname the player joins with.
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

export interface SavedCharacter {
    appearance: Appearance;
    nickname: string;
    createdAt: number;
    updatedAt: number;
    /** The first name the player gave the character, when they did. */
    name?: string;
    /** The id of the alcunha (`EPITHETS`), when they chose one. */
    epithet?: string;
    /**
     * An administrator asked for this character to be made again (`/creator refazer`): at the next entry the creator opens and
     * cannot be left until a look is accepted, the name free to change. Whatever saves the character next drops it.
     */
    redo?: true;
    /**
     * The creator's "Roupas" pieces (item classes) this character was already given: a character that exists gets each piece
     * once, in the inventory (user, 2026-10-19: the tab was missing from /creator for a character already made).
     */
    clothesGiven?: string[];
}

/** What a character is called, apart from the family's surname. */
export interface CharacterIdentity {
    readonly name: string;
    readonly epithet: string;
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

/**
 * Remembers this look under the player's Steam id. Does nothing without one. The name and the alcunha already kept
 * stay, unless `identity` brings new ones.
 */
export function saveCharacter(steamId: string, appearance: Appearance, nickname: string, identity?: CharacterIdentity): void {
    if (!steamId) {
        return;
    }
    const store = load();
    const existing = store[steamId];
    const name = identity?.name ?? existing?.name;
    const epithet = identity === undefined ? existing?.epithet : identity.epithet;
    store[steamId] = {
        appearance,
        nickname,
        createdAt: existing?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        ...(name !== undefined && name !== "" ? { name } : {}),
        ...(epithet !== undefined && epithet !== "" ? { epithet } : {}),
        ...(existing?.clothesGiven !== undefined && existing.clothesGiven.length > 0 ? { clothesGiven: existing.clothesGiven } : {}),
    };
    persist(store);
}

/** The creator's clothes this character was already given (`clothesGiven`). */
export function clothesGivenTo(steamId: string): string[] {
    return getCharacter(steamId)?.clothesGiven ?? [];
}

/** Remembers clothes the creator gave this character, so that each piece is given once. */
export function noteClothesGiven(steamId: string, items: readonly string[]): void {
    const store = load();
    const saved = steamId ? store[steamId] : undefined;
    if (saved === undefined || items.length === 0) {
        return;
    }
    saved.clothesGiven = [...new Set([...(saved.clothesGiven ?? []), ...items])];
    persist(store);
}

/** A player starts again (`character-reset.ts`): the look, the name and the alcunha go, and the creator is asked for at the next entry. */
export function forgetCharacter(steamId: string): boolean {
    const store = load();
    if (!steamId || store[steamId] === undefined) {
        return false;
    }
    delete store[steamId];
    persist(store);
    return true;
}

/**
 * Asks for this character to be made again at its owner's next entry (user, 2026-10-18: "na próxima vez que o Vavřinec de Zelený
 * logar, ative o creator nele para ele refazer o personagem"). The look stays until then; the inventory, the progression and
 * everything else are not touched. False when this Steam id has no character to make again.
 */
export function askRedo(steamId: string): boolean {
    const store = load();
    const saved = steamId ? store[steamId] : undefined;
    if (saved === undefined) {
        return false;
    }
    saved.redo = true;
    persist(store);
    return true;
}

/** The characters waiting to be made again. */
export function redoPending(): { steamId: string; name: string }[] {
    return Object.entries(load())
        .filter(([, saved]) => saved.redo === true)
        .map(([steamId, saved]) => ({ steamId, name: saved.name ?? saved.nickname }));
}

/** The name and alcunha this player gave the character, or null when they have not (they go by their nickname). */
export function getIdentity(steamId: string): CharacterIdentity | null {
    const saved = steamId ? (load()[steamId] ?? null) : null;
    return saved?.name ? { name: saved.name, epithet: saved.epithet ?? "" } : null;
}

/** Every saved character: its Steam id, and what it goes by (the name given, or the nickname of a character made without one). */
export function allCharacters(): { steamId: string; name: string; epithet: string; nickname: string; named: boolean }[] {
    return Object.entries(load()).map(([steamId, saved]) => ({ steamId, name: saved.name ?? saved.nickname, epithet: saved.epithet ?? "", nickname: saved.nickname, named: Boolean(saved.name) }));
}
