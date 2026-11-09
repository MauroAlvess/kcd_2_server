/**
 * Who knows whom. Nobody's name floats over their head: to everybody else a player is "Desconhecido" (or
 * "Desconhecida") until they introduce themselves to somebody from the talk menu (`encounters.ts`), and from then on that
 * somebody sees their name. It goes one way: introducing yourself to Hans does not tell you Hans's name.
 *
 * The name is the one the character goes by -- the first name and alcunha the player gave in the creator (`Henry II`), or
 * the nickname they joined with when the character was made before the creator asked, and the family's surname when there
 * is one -- read when it is shown, so a surname chosen later shows at once. Kept by Steam id in
 * `playerdata/acquaintances.json`.
 *
 * Death forgets (2026-11-04, user: "sempre que um jogador morre todo mundo que se apresentou pra ele desapresenta"): whoever dies is a stranger to
 * everybody again, and knows nobody (`installAcquaintances`).
 */

import { fullName } from "./character-name.js";
import { getCharacter } from "./characters.js";
import { getSurname } from "./family.js";
import { ensureDir, read, write } from "./store.js";

const DIR = "playerdata";
const FILE = `${DIR}/acquaintances.json`;

/** viewer Steam id -> the Steam ids they know -> when they were told. */
type Book = Record<string, Record<string, number>>;

let cache: Book | null = null;

function load(): Book {
    if (cache !== null) {
        return cache;
    }
    cache = {};
    const loaded = read<Record<string, unknown>>(FILE);
    if (loaded.status === "ok") {
        for (const [viewer, known] of Object.entries(loaded.value)) {
            if (typeof known !== "object" || known === null) {
                continue;
            }
            const page: Record<string, number> = {};
            for (const [target, at] of Object.entries(known as Record<string, unknown>)) {
                if (typeof at === "number" && Number.isFinite(at)) {
                    page[target] = at;
                }
            }
            cache[viewer] = page;
        }
    } else if (loaded.status === "corrupt") {
        console.error(`acquaintances: ${FILE} está ilegível e foi deixado como está: ${loaded.reason}`);
    }
    return cache;
}

function persist(): void {
    try {
        ensureDir(DIR);
        write(FILE, load());
    } catch (error: unknown) {
        console.log(`acquaintances: não consegui salvar: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/** Who is told when somebody comes to know somebody, or stops: the labels over heads (`head-labels.ts`). */
const listeners: Array<() => void> = [];

export function onKnowledgeChange(listener: () => void): void {
    listeners.push(listener);
}

function changed(): void {
    for (const listener of listeners) {
        try {
            listener();
        } catch (error: unknown) {
            console.log(`acquaintances: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

/** A player starts again (`character-reset.ts`): nobody knows them any longer, and they know nobody. */
export function forgetAcquaintances(steamId: string): void {
    const book = load();
    delete book[steamId];
    for (const page of Object.values(book)) {
        delete page[steamId];
    }
    persist();
    changed();
}

/** Whether `viewer` has been told `target`'s name. Everybody knows themselves; nobody can know a player without a Steam id. */
export function knows(viewer: Player, target: Player): boolean {
    if (viewer.id === target.id) {
        return true;
    }
    if (viewer.steamId === "" || target.steamId === "") {
        return false;
    }
    return load()[viewer.steamId]?.[target.steamId] !== undefined;
}

/** The same by Steam id, for a player who is not here: whether `viewer` was told `target`'s name. */
export function knowsSteam(viewer: string, target: string): boolean {
    return viewer !== "" && target !== "" && (viewer === target || load()[viewer]?.[target] !== undefined);
}

/** `speaker` tells `listener` their name. False when the listener already knew it, or when it cannot be kept. */
export function introduce(speaker: Player, listener: Player, now: number = Date.now()): boolean {
    if (knows(listener, speaker) || speaker.steamId === "" || listener.steamId === "") {
        return false;
    }
    const book = load();
    book[listener.steamId] = { ...book[listener.steamId], [speaker.steamId]: now };
    persist();
    changed();
    return true;
}

/** The name a character goes by: the one they gave it (or their nickname), the alcunha, and the family's surname when they have one. */
export function nameOf(player: Player): string {
    const saved = player.steamId === "" ? null : getCharacter(player.steamId);
    const first = saved?.name ? fullName(saved.name, saved.epithet) : player.nickname;
    const surname = player.steamId === "" ? null : getSurname(player.steamId);
    return surname ? `${first} ${surname}` : first;
}

/** `nameOf` for an account that is not in the game: the saved character's name, or the nickname it was saved under, and the family's surname. */
export function nameOfAccount(steamId: string): string {
    const saved = getCharacter(steamId);
    const first = saved?.name ? fullName(saved.name, saved.epithet) : (saved?.nickname ?? "um jogador");
    const surname = getSurname(steamId);
    return surname ? `${first} ${surname}` : first;
}

/** `adminLabel` for an account that is not in the game: the character's name and, when it is not the account's, the account in brackets. */
export function accountLabel(steamId: string): string {
    const saved = getCharacter(steamId);
    const name = nameOfAccount(steamId);
    return saved === null || name === saved.nickname ? name : `${name} (${saved.nickname})`;
}

/** What an administrator reads for a player: the character's name and, when it is not the account's, the account in brackets. */
export function adminLabel(player: Player): string {
    const name = nameOf(player);
    return name === player.nickname ? name : `${name} (${player.nickname})`;
}

/** What a stranger is called, in the gender of the body they chose. */
export function strangerWord(player: Player): string {
    const saved = player.steamId === "" ? null : getCharacter(player.steamId);
    const gender = saved?.appearance.gender ?? player.appearance?.gender;
    return gender === "female" ? "Desconhecida" : "Desconhecido";
}

/** How `viewer` sees `target`: their name once introduced, "Desconhecido" before. */
export function labelFor(viewer: Player, target: Player): string {
    return knows(viewer, target) ? nameOf(target) : strangerWord(target);
}

/** What the player who died is told: the introductions are gone in both directions. */
export const DEATH_FORGETS = "A morte apagou as apresentações: você já não conhece ninguém e ninguém mais o conhece. Será preciso se apresentar de novo.";

/**
 * Whoever dies is a stranger to everybody again, and knows nobody (user, 2026-11-04: "sempre que um jogador morre todo mundo que se apresentou pra ele desapresenta"). Both ways: those who
 * introduced themselves to the one who died stop being known to them, and the one who died stops being known to those they had introduced themselves to. True when there was anything to forget.
 */
export function forgetOnDeath(steamId: string): boolean {
    if (steamId === "") {
        return false;
    }
    const book = load();
    const knew = Object.keys(book[steamId] ?? {}).length > 0;
    const wasKnown = Object.values(book).some((page) => page[steamId] !== undefined);
    if (!knew && !wasKnown) {
        return false;
    }
    forgetAcquaintances(steamId);
    return true;
}

export function installAcquaintances(): void {
    Events.on("playerDied", (player) => {
        if (forgetOnDeath(player.steamId)) {
            console.log(`acquaintances: ${player.nickname} morreu: ninguém o conhece mais, e ele não conhece ninguém`);
            Chat.sendToPlayer(player, DEATH_FORGETS);
        }
    });
}
