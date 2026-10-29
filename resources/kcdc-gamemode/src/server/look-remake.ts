/**
 * "Refazer aparência" (user, 2026-10-25: "uma opção chamada refazer aparência, essa é uma por conta, permite o jogador refazer a aparência do
 * personagem uma vez caso não tenha gostado, e trocar o nome; não perde nada"). The panel's Opções page asks once; this opens the character
 * creator over the body, with the name and the alcunha free to change, and nothing else of the character touched. It is spent when the new
 * look is saved: a creator left without saving keeps it for later. The body stays the character's own (a man stays a man), since the
 * family, the titles and the clothes are a man's or a woman's.
 *
 * It is used once for each Steam id (`playerdata/look-remakes.json`); "Apagar personagem" does not give it back.
 */

import { getCharacter } from "./characters.js";
import { openCreatorFor } from "./creator.js";
import { addPayload, notice } from "./status.js";
import { ensureDir, read, write } from "./store.js";

const RESOURCE = "kcdc-gamemode";
const DIR = "playerdata";
const FILE = `${DIR}/look-remakes.json`;

const STEAM_ID = /^[0-9]{5,20}$/;

export interface Outcome {
    readonly ok: boolean;
    readonly message: string;
}

let used: Record<string, number> | null = null;
/** False while the file could not be read: nobody remakes meanwhile, and nothing is written over it. */
let writable = true;

function load(): Record<string, number> {
    if (used !== null) {
        return used;
    }
    used = {};
    const loaded = read<Record<string, unknown>>(FILE);
    if (loaded.status === "ok") {
        for (const [steamId, at] of Object.entries(loaded.value)) {
            if (STEAM_ID.test(steamId) && typeof at === "number" && Number.isFinite(at)) {
                used[steamId] = at;
            }
        }
    } else if (loaded.status === "corrupt") {
        writable = false;
        console.log(`look-remake: ${FILE} está ilegível e foi deixado como está: ${loaded.reason}; ninguém refaz a aparência até ser consertado`);
    }
    return used;
}

/** Whether this account has spent its remake. */
export function remakeUsed(steamId: string): boolean {
    return load()[steamId] !== undefined;
}

/** The remake is spent: the new look was saved. */
function spend(player: Player, now: number): void {
    const all = load();
    all[player.steamId] = now;
    try {
        ensureDir(DIR);
        write(FILE, all);
    } catch (error: unknown) {
        console.log(`look-remake: não consegui gravar que ${player.nickname} refez a aparência: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log(`look-remake: ${player.nickname} refez a aparência (uma vez por conta: gasto)`);
}

/** Opens the creator to remake the look and the name. Once for each account, spent when the new look is saved. */
export function startRemake(player: Player, now = Date.now()): Outcome {
    if (!STEAM_ID.test(player.steamId)) {
        return { ok: false, message: "Sem identificação Steam não dá para guardar que a aparência foi refeita; nada foi aberto." };
    }
    load();
    if (!writable) {
        return { ok: false, message: "O registro de quem refez a aparência não pôde ser lido; tente mais tarde." };
    }
    if (remakeUsed(player.steamId)) {
        return { ok: false, message: "Esta conta já refez a aparência: isso vale uma vez só." };
    }
    const saved = getCharacter(player.steamId);
    if (saved === null) {
        return { ok: false, message: "Você ainda não tem um personagem para refazer." };
    }
    if (!player.ready || !player.alive) {
        return { ok: false, message: "Espere estar de pé no mundo para refazer a aparência." };
    }
    const gender = saved.appearance.gender === "female" ? "female" : "male";
    openCreatorFor(player, gender, { remake: (who) => spend(who, now) });
    console.log(`look-remake: ${player.nickname} abriu o criador para refazer a aparência`);
    return { ok: true, message: "Escolha a nova aparência e, se quiser, um novo nome. Só vale quando você salvar; saindo sem salvar, a chance continua sua." };
}

export function installLookRemake(): void {
    load();
    addPayload((player) => ({ remake: { used: remakeUsed(player.steamId) } }));
    Events.onClient(`${RESOURCE}:status.remakeLook`, (sender, payload) => {
        const player = sender as Player;
        let confirm: unknown;
        try {
            confirm = ((typeof payload === "string" ? JSON.parse(payload) : payload) as { confirm?: unknown } | null)?.confirm;
        } catch {
            return;
        }
        if (confirm !== 1) {
            return;
        }
        const result = startRemake(player);
        if (!result.ok) {
            notice(player, result.message);
        }
        Chat.sendToPlayer(player, result.message);
    });
}

/** For tests: forget what was read. */
export function resetLookRemakes(): void {
    used = null;
    writable = true;
}
