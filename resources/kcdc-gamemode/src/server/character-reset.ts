/**
 * "Apagar personagem" (user, 2026-10-25: "uma opção na seção Opções, apagar personagem: isso deleta o personagem dele, irreversível, deve
 * avisar, e joga ele na tela de menu principal do mod"). It began as "Recomeçar do zero" (2026-10-18: "o jogador perde toda progressão e
 * dados do personagem e cria um novo, apenas uma vez por conta"); since the 25th it is a delete the player may ask for whenever they want.
 * The panel's Opções page warns twice that there is no way back; this is what happens after the second yes.
 *
 * What goes is everything of the character (user, 2026-10-25: "ao apagar o personagem deve perder os cavalos, carroças e tudo, até
 * apoiador, afinal ele perdeu o personagem"; "o apagar realmente apaga"): what it carries and has learnt (`character-state.ts`:
 * inventory, progression, recipes, vitals, kits), its look and name (`characters.ts`, so the creator is asked for at the next entry),
 * the standing, guild and faction (`status.ts`), the citizenship, the family tree, the titles, the people who know them, the place they
 * stood at, the thief's mark; its horses and carts (taken out of the world), the support given to the server with its dog, the houses
 * and chests it owned (back to nobody, the chests emptied), its rooms, the regions ceded to it, the beds it sowed, what it had won over
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
import { esgrima } from "./esgrima.js";
import { setCitizenship } from "./citizenship.js";
import { forgetDropOwner } from "./death-drop.js";
import { forgetFamily } from "./family.js";
import { clearPlotsOf } from "./farm.js";
import { forgetFreeChanges } from "./free-changes.js";
import { forgetHorsesOf } from "./horses.js";
import { forgetPlace } from "./position.js";
import { releaseAllOf } from "./properties.js";
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
    const held = part("as propriedades", () => releaseAllOf(steamId), { properties: 0, regions: 0, chests: [] as string[] });
    count(held.properties, "propriedade", "propriedades");
    count(held.regions, "região", "regiões");
    count(held.chests.filter((guid) => part("um baú", () => emptyChest(guid), false)).length, "baú esvaziado", "baús esvaziados");
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
    if (part("os combos", () => esgrima.forget(steamId), false)) {
        said.push("os combos de esgrima");
    }
    part("o que lhe era devido", () => forgetOwed(steamId), false);
    return said.join(", ");
}

/** Deletes the character, for good, and sends the player back to the mod's main menu. */
export function resetCharacter(player: Player, now = Date.now()): Outcome {
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
    discardCharacter(steamId);
    forgetCharacter(steamId);
    resetRecord(steamId);
    setCitizenship(steamId, null);
    forgetFamily(steamId);
    forgetTitles(steamId);
    forgetAcquaintances(steamId);
    forgetPlace(player);
    const gone = forgetBelongings(steamId);
    leaving.add(player.id);
    console.log(`reset: ${player.nickname} apagou o personagem${before === undefined ? "" : " (já tinha apagado antes)"}${gone === "" ? "" : `; foram junto ${gone}`}; volta ao menu principal`);
    const id = player.id;
    setTimeout(() => {
        leaving.delete(id);
        try {
            player.kick(DELETED_REASON);
        } catch {
            // The player left on their own.
        }
    }, KICK_AFTER_MS);
    return { ok: true, message: "Personagem apagado. Em instantes você volta ao menu principal; ao entrar de novo, cria um novo personagem." };
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
