/**
 * "Apagar personagem" (user, 2026-10-25: "uma opção na seção Opções, apagar personagem: isso deleta o personagem dele, irreversível, deve
 * avisar, e joga ele na tela de menu principal do mod"). It began as "Recomeçar do zero" (2026-10-18: "o jogador perde toda progressão e
 * dados do personagem e cria um novo, apenas uma vez por conta"); since the 25th it is a delete the player may ask for whenever they want.
 * The panel's Opções page warns twice that there is no way back; this is what happens after the second yes.
 *
 * What goes is everything of the character (user, 2026-10-25: "ao apagar o personagem deve perder os cavalos, carroças e tudo, até
 * apoiador, afinal ele perdeu o personagem"; "o apagar realmente apaga"): what it carries and has learnt (`character-state.ts`:
 * inventory, progression, recipes, vitals, kits), its look and name (`characters.ts`, so the creator is asked for at the next entry),
 * the standing and guild (`status.ts`), the citizenship, the family tree, the titles, the people who know them, the place they
 * stood at, the thief's mark; its horses and carts (taken out of the world), the support given to the server with its dog, the houses
 * and chests it owned (back to nobody; the chests emptied, but for those of a lord's lands and of houses others had access to, which keep what they hold), its rooms, the regions ceded to it, the beds it sowed, what it had won over
 * of the wild horses, its thirst, its reading of the skill books, its free changes, what was owed to it, and its death drops (nobody's
 * from then on). What stays with the account: the player's own options (camera, microphone, size of the pages, language) and their
 * administrator's role. The appearance alone is remade, once for each account, by "Refazer aparência" (`look-remake.ts`).
 *
 * When each account last deleted is kept (`playerdata/character-resets.json`), for an administrator's question. The player is then sent
 * back to the mod's main menu (a kick, with the reason shown there), since the game holds the old body: the next entry has nothing to
 * restore and begins with the creator.
 */

import { forgetAcquaintances } from "./acquaintances.js";
import { cartsOf, removeCart } from "./carts.js";
import { discardCharacter } from "./character-state.js";
import { forgetCharacter } from "./characters.js";
import { emptyChest } from "./chest-state.js";
import { setCitizenship } from "./citizenship.js";
import { forgetDropOwner } from "./death-drop.js";
import { forgetFamily } from "./family.js";
import { clearPlotsOf } from "./farm.js";
import { forgetFreeChanges } from "./free-changes.js";
import { forgetHorsesOf } from "./horses.js";
import { forgetPlace, forgetPlaceOf } from "./position.js";
import { getProperty, listProperties, releaseAllOf } from "./properties.js";
import { forgetOwed } from "./restitution.js";
import { roomsHeldBy, vacateRoom } from "./rooms.js";
import { forgetReader } from "./skillbooks.js";
import { addPayload, notice, resetRecord } from "./status.js";
import { ensureDir, read, write } from "./store.js";
import { supporters } from "./supporters.js";
import { clearThief } from "./thieves.js";
import { forgetThirst } from "./thirst.js";
import { forgetTitles } from "./titles.js";
import { forgetTamer } from "./wild-horses.js";

const RESOURCE = "kcdc-gamemode";
const DIR = "playerdata";
const FILE = `${DIR}/character-resets.json`;

const STEAM_ID = /^[0-9]{5,20}$/;

/** The player is sent out this long after the answer, so they read it first. */
export const KICK_AFTER_MS = 2_500;

/** What the mod's main menu shows the player once they are back there. */
export const DELETED_REASON = "Seu personagem foi apagado. Entre de novo no servidor para criar um novo.";

export interface Outcome {
    readonly ok: boolean;
    readonly message: string;
}

/** What differs when an administrator's execution deletes the character instead of the player's own ask (`execution.ts`, 2026-11-04). */
export interface ResetOptions {
    /** What the mod's main menu shows (the player's own delete says `DELETED_REASON`). */
    readonly reason?: string;
    /** How long the player stays before the kick (an execution has its screen up meanwhile). */
    readonly kickAfterMs?: number;
    /** The verb of the log line. */
    readonly did?: string;
}

let used: Record<string, number> = {};
/** False while the file could not be read: nothing is written over it then, and nobody is deleted. */
let writable = true;
/** Players whose character was just deleted and who are on their way out: a second ask is not a second delete. */
const leaving = new Set<number>();

function load(): void {
    const loaded = read<Record<string, unknown>>(FILE);
    used = {};
    if (loaded.status === "ok") {
        for (const [steamId, at] of Object.entries(loaded.value)) {
            if (STEAM_ID.test(steamId) && typeof at === "number" && Number.isFinite(at)) {
                used[steamId] = at;
            }
        }
    } else if (loaded.status === "corrupt") {
        writable = false;
        console.log(`reset: ${FILE} está ilegível e foi deixado como está: ${loaded.reason}; ninguém pode apagar o personagem até ser consertado`);
    }
}

/** Whether this account has deleted a character before. */
export function hasReset(steamId: string): boolean {
    return used[steamId] !== undefined;
}

/** One part of the wipe: run, and its failure written down without stopping the rest. */
function part<T>(label: string, run: () => T, fallback: T): T {
    try {
        return run();
    } catch (error: unknown) {
        console.log(`reset: ${label} não foi apagado: ${error instanceof Error ? error.message : String(error)}`);
        return fallback;
    }
}

/** What the character had besides its body and its standing: gone with it. What went, for the log ("" for nothing). */
function forgetBelongings(steamId: string): string {
    const said: string[] = [];
    const count = (n: number, one: string, many: string): void => {
        if (n > 0) {
            said.push(`${n} ${n === 1 ? one : many}`);
        }
    };
    count(part("os cavalos", () => forgetHorsesOf(steamId), 0), "cavalo", "cavalos");
    count(part("as carroças", () => cartsOf(steamId).filter((owned) => removeCart(owned.record.key)).length, 0), "carroça", "carroças");
    if (part("o apoio", () => supporters.forgetSupport(steamId), false)) {
        said.push("o apoio (benefícios e cão)");
    }
    const held = part("as propriedades", () => releaseAllOf(steamId), { properties: 0, regions: 0, chests: [] as string[], kept: 0 });
    count(held.properties, "propriedade", "propriedades");
    count(held.regions, "região", "regiões");
    count(held.chests.filter((guid) => part("um baú", () => emptyChest(guid), false)).length, "baú esvaziado", "baús esvaziados");
    // The chests of a lord's lands and of a house others were given access to keep what they hold (2026-10-31): the belongings of other players are in them.
    count(held.kept, "baú ficou com o que tem (era de todos)", "baús ficaram com o que têm (eram de todos)");
    count(part("os quartos", () => roomsHeldBy(steamId).filter((room) => vacateRoom(room.id, steamId).ok).length, 0), "quarto", "quartos");
    count(part("as hortas", () => clearPlotsOf(steamId), 0), "canteiro", "canteiros");
    count(part("a doma", () => forgetTamer(steamId), 0), "cavalo selvagem em doma", "cavalos selvagens em doma");
    count(part("os baús de morte", () => forgetDropOwner(steamId), 0), "baú de morte", "baús de morte");
    if (part("a marca de ladrão", () => clearThief(steamId), false)) {
        said.push("a marca de ladrão");
    }
    part("a sede", () => forgetThirst(steamId), false);
    part("os livros lidos", () => forgetReader(steamId), false);
    part("as trocas grátis", () => forgetFreeChanges(steamId), false);
    part("o que lhe era devido", () => forgetOwed(steamId), false);
    return said.join(", ");
}

/** The wipe itself, for a Steam id: the body, the standing and everything it had. What went with it, for the log ("" for nothing). */
function wipe(steamId: string, forgetWhere: () => void): string {
    discardCharacter(steamId);
    forgetCharacter(steamId);
    resetRecord(steamId);
    setCitizenship(steamId, null);
    forgetFamily(steamId);
    forgetTitles(steamId);
    forgetAcquaintances(steamId);
    forgetWhere();
    return forgetBelongings(steamId);
}

/** Deletes the character, for good, and sends the player back to the mod's main menu. */
export function resetCharacter(player: Player, now = Date.now(), options: ResetOptions = {}): Outcome {
    const steamId = player.steamId;
    if (!STEAM_ID.test(steamId)) {
        return { ok: false, message: "Sem identificação Steam não dá para saber qual personagem apagar; nada foi apagado." };
    }
    if (!writable) {
        return { ok: false, message: "O registro dos personagens apagados não pôde ser lido; nada foi apagado." };
    }
    if (leaving.has(player.id)) {
        return { ok: false, message: "O seu personagem já foi apagado: você está voltando ao menu principal." };
    }
    const before = used[steamId];
    used[steamId] = now;
    try {
        ensureDir(DIR);
        write(FILE, used);
    } catch (error: unknown) {
        if (before === undefined) {
            delete used[steamId];
        } else {
            used[steamId] = before;
        }
        return { ok: false, message: `Não consegui registrar a exclusão (${error instanceof Error ? error.message : String(error)}); nada foi apagado.` };
    }
    const gone = wipe(steamId, () => forgetPlace(player));
    leaving.add(player.id);
    console.log(`reset: ${player.nickname} ${options.did ?? "apagou o personagem"}${before === undefined ? "" : " (já tinha apagado antes)"}${gone === "" ? "" : `; foram junto ${gone}`}; volta ao menu principal`);
    const id = player.id;
    setTimeout(() => {
        leaving.delete(id);
        try {
            player.kick(options.reason ?? DELETED_REASON);
        } catch {
            // The player left on their own.
        }
    }, options.kickAfterMs ?? KICK_AFTER_MS);
    return { ok: true, message: "Personagem apagado. Em instantes você volta ao menu principal; ao entrar de novo, cria um novo personagem." };
}

const PENDING_FILE = `${DIR}/erase-pending.json`;

/** What a house would say of why its chests were left as they are, or "" when they may be emptied. */
function whyNotEmpty(house: { readonly ownerSteamId: string; readonly access?: readonly unknown[] }): string {
    if (house.ownerSteamId !== "") {
        return "tem dono";
    }
    return (house.access ?? []).length > 0 ? "deixa outras pessoas entrarem" : "";
}

/** The chests of a house nobody owns and nobody was let into: emptied. How many went, or why they were left as they are. */
function emptyIdleHouse(id: string, everything: ReturnType<typeof listProperties>): { readonly emptied: number; readonly left: string } {
    const house = getProperty(id);
    if (house === null) {
        return { emptied: 0, left: "não existe" };
    }
    // A chest filed under a house stands in that house: its owner and the people let in decide about it too.
    const parent = house.parentId === "" ? null : getProperty(house.parentId);
    const why = whyNotEmpty(house) || (parent === null ? "" : whyNotEmpty(parent));
    if (why !== "") {
        return { emptied: 0, left: why };
    }
    let emptied = 0;
    for (const chest of everything) {
        if (chest.kind === "chest" && chest.stashGuid !== "" && chest.ownerSteamId === "" && (chest.id === house.id || chest.parentId === house.id)) {
            emptied += part("um baú", () => emptyChest(chest.stashGuid), false) ? 1 : 0;
        }
    }
    return { emptied, left: "" };
}

/**
 * Accounts and houses an administrator wants cleaned while their players are not here (2026-11-01, user: "tire do mapa os cavalos do Gunther que saiu ... além de todos itens
 * no mundo depois apague os personagens"). `playerdata/erase-pending.json`, written by hand with the server stopped, is `{ "v": 1, "characters": [Steam ids], "houses": [property ids] }`;
 * it is read once, at the end of the start, when every module has its data. Each character goes exactly as when its player deletes it (`wipe`), without the kick. A house
 * in `houses` has its chests emptied only if nobody owns it and nobody was let into it (so the villagers' things in a lord's chests, or in a house with guests, stay: the
 * 2026-10-31 lesson). The file is then rewritten with nothing left to do and what was done, so a second start does nothing.
 */
export function runPendingErasures(now = Date.now()): void {
    const asked = read<{ characters?: unknown; houses?: unknown }>(PENDING_FILE);
    if (asked.status === "missing") {
        return;
    }
    if (asked.status === "corrupt") {
        console.log(`reset: ${PENDING_FILE} está ilegível e foi deixado como está: ${asked.reason}`);
        return;
    }
    const strings = (value: unknown): string[] => [...new Set(Array.isArray(value) ? value.filter((one): one is string => typeof one === "string") : [])];
    const characters = strings(asked.value.characters).filter((steamId) => STEAM_ID.test(steamId));
    const houses = strings(asked.value.houses).filter((id) => id.length > 0 && id.length <= 80);
    if (characters.length === 0 && houses.length === 0) {
        return;
    }
    const done: string[] = [];
    // The accounts that could not be wiped stay in the file, for the next start.
    const left: string[] = [];
    if (!writable && characters.length > 0) {
        console.log("reset: o registro dos personagens apagados não pôde ser lido; nenhum personagem foi apagado");
        left.push(...characters);
    } else {
        for (const steamId of characters) {
            try {
                used[steamId] = now;
                const gone = wipe(steamId, () => forgetPlaceOf(steamId));
                console.log(`reset: personagem …${steamId.slice(-4)} apagado pela administração${gone === "" ? "" : `; foram junto ${gone}`}`);
                done.push(steamId.slice(-4));
            } catch (error: unknown) {
                console.log(`reset: personagem …${steamId.slice(-4)} não foi apagado por inteiro (fica para a próxima subida): ${error instanceof Error ? error.message : String(error)}`);
                left.push(steamId);
            }
        }
        if (done.length > 0) {
            try {
                ensureDir(DIR);
                write(FILE, used);
            } catch (error: unknown) {
                console.log(`reset: não consegui registrar as exclusões: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    if (houses.length > 0) {
        const everything = listProperties();
        for (const id of houses) {
            try {
                const result = emptyIdleHouse(id, everything);
                console.log(`reset: ${id}: ${result.left === "" ? `${result.emptied} baú(s) esvaziado(s)` : `os baús ficaram como estavam (${result.left})`}`);
            } catch (error: unknown) {
                console.log(`reset: ${id} não foi esvaziada: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    try {
        write(PENDING_FILE, { v: 1, characters: left, houses: [], done: { at: now, characters: done, houses } });
    } catch (error: unknown) {
        console.log(`reset: não consegui marcar ${PENDING_FILE} como feito: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function installCharacterReset(): void {
    load();
    addPayload((player) => ({ reset: { used: hasReset(player.steamId) } }));
    Events.onClient(`${RESOURCE}:status.resetCharacter`, (sender, payload) => {
        const player = sender as Player;
        let confirm: unknown;
        try {
            confirm = ((typeof payload === "string" ? JSON.parse(payload) : payload) as { confirm?: unknown } | null)?.confirm;
        } catch {
            return;
        }
        if (confirm !== 1 || !player.ready) {
            return;
        }
        const result = resetCharacter(player);
        notice(player, result.message);
        if (result.ok) {
            Chat.sendToPlayer(player, result.message);
        }
    });
}
