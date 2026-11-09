/**
 * Who may use what (user, 2026-10-17): each trade has its own tools.
 *
 *   Ferreiro    the forge (smithing)                 Alquimista  the alchemy tables and the drying rack
 *   Caçador     the smoker, butchering game          Taberneiro  the cooking fire (roasting, stews and the like)
 *   Coletor     cutting wood and breaking stone (2026-10-21, `gather.ts`)
 *   Agricultor  the gardens' beds (2026-10-22, `farm.ts`)
 *   Domador     the taming of the wild horses (2026-10-22 as a part of the Agricultores' trade, `wild-horses.ts`; a guild of its own, Domitores,
 *               since 2026-10-25: user, "vamos separar a mecânica de domar cavalo totalmente da guilda dos agricultores")
 *
 * The grindstone beside a forge was everybody's from 2026-10-22 ("para facilitar nossa vida vamos deixar liberado para todo mundo mesmo": it had been the smiths'
 * for an afternoon, held back on the client and undone here, and the game's own E still reached it from one angle). Since 2026-10-27 it is the smiths' again, and
 * in a better way (user: "na pedra de amolar vamos travar igual fizemos com a forja, só ferreiro vai poder usar"): the grindstones are places of ours with their
 * own menu ("Reparar / Sair", `cook-menu.ts`, `repair.ts`), and the game's own sharpening is undone for everybody (`sharpen-log.ts`), so no angle leaks.
 *
 * The drying rack went to the alchemists on 2026-10-18 (user: "o secador é do alquimista e não do caçador"): herbs are dried.
 *
 * The tailors have nothing to use yet: the game has no such work, and the user will make a system of their own. The mod hands
 * the server the smithery and the alchemy table (`craftingStarting`, which says no by returning `false`); cooking, drying
 * and smoking are done by the server itself (`cooking.ts`), which asks `mayCraft` first. An administrator without a guild may use all of
 * them; one with a guild keeps to its trade, as a player does, until they ask for every tool (`/oficios livre`): on 2026-10-18 the
 * user, who is a hunter and an administrator, found that "o bloqueio ... não funcionou" -- it had let them through as an
 * administrator. Until KCDC 1.7.0 the game's own cooking screen could not be refused (the game did it on the player's own machine)
 * but what it made was never handed over by the server, so for anybody else it came to nothing; from 1.7.0 the game's own work
 * is converted by the server, and `prepare-guard.ts` asks `mayCraft` before it is (`playerPreparing`).
 */

import { isAdmin } from "./auth.js";
import { trimCarcass } from "./carcass.js";
import { getGuildId, onGuildChange } from "./status.js";

const RESOURCE = "kcdc-gamemode";
/** What the player's client is told it may do with the game's own actions (`client/trade-rights.ts`), and its asking for it. */
const RIGHTS = `${RESOURCE}:crafts.rights`;
const ASK_RIGHTS = `${RESOURCE}:crafts.ask`;

/** A place that has an owner among the guilds. */
/** `abate` is butchering a carcass, the hunters' (2026-10-18: "o F de abater caça os animais ... só caçador"). */
export type Craft = "smithing" | "alchemy" | "fogo" | "secador" | "defumador" | "costura" | "abate" | "lenha" | "mineracao" | "horta" | "domar";

/** The guild that owns each, by its id in the catalog. */
export const CRAFT_GUILD: Readonly<Record<Craft, string>> = {
    smithing: "fabri-ferrarii",
    alchemy: "alchemistae",
    fogo: "tabernarii",
    secador: "alchemistae",
    defumador: "venatores",
    costura: "artifices",
    abate: "venatores",
    lenha: "collectores",
    mineracao: "collectores",
    horta: "agricolae",
    domar: "domitores",
};

const PLACE: Readonly<Record<Craft, string>> = {
    smithing: "a forja",
    alchemy: "as mesas de alquimia",
    fogo: "o fogo de cozinha",
    secador: "o secador do açougueiro",
    defumador: "o defumador",
    costura: "a costura",
    abate: "o abate dos animais",
    lenha: "o corte de lenha",
    mineracao: "a quebra de pedra",
    horta: "as hortas",
    domar: "a doma dos cavalos selvagens",
};

const WHO: Readonly<Record<string, string>> = {
    "fabri-ferrarii": "os ferreiros (guilda Fabri Ferrarii)",
    alchemistae: "os alquimistas (guilda Alchemistae)",
    tabernarii: "os taberneiros (guilda Tabernarii)",
    venatores: "os caçadores (guilda Venatores)",
    artifices: "os artesãos (guilda Artifices)",
    collectores: "os coletores (guilda Collectores)",
    agricolae: "os agricultores (guilda Agricolae)",
    domitores: "os domadores (guilda Domitores)",
};

export function isCraft(value: unknown): value is Craft {
    return typeof value === "string" && Object.hasOwn(CRAFT_GUILD, value);
}

/** The administrators who asked for every tool, until they leave (`/oficios livre`). */
const freed = new Set<number>();

export function setFreeCrafts(player: Player, free: boolean): void {
    if (free) {
        freed.add(player.id);
    } else {
        freed.delete(player.id);
    }
    sendRights(player);
}

export function usesFreeCrafts(player: Player): boolean {
    return freed.has(player.id);
}

/** Why a player may use the place, or "" when they may not: their own trade's, an administrator's without a guild, or one who asked. */
export function craftReason(player: Player, craft: Craft): string {
    const guild = player.steamId === "" ? null : getGuildId(player.steamId);
    if (guild !== null && guild === CRAFT_GUILD[craft]) {
        return "da guilda";
    }
    if (!isAdmin(player)) {
        return "";
    }
    if (guild === null) {
        return "administrador sem guilda";
    }
    return freed.has(player.id) ? "administrador com /oficios livre" : "";
}

/** Whether the player may use the place: a member of its guild, an administrator without a guild, or one who asked for every tool. */
export function mayCraft(player: Player, craft: Craft): boolean {
    return craftReason(player, craft) !== "";
}

/**
 * What the player's own game is let do (user, 2026-10-21: "mesmo eu não sendo caçador o F de abater apareceu e permitiu eu abater, não era para isso
 * poder ocorrer"): the butchering of a carcass, which only the client can stop before it happens (the game's own `butcher` action, on F), and
 * the Coletores' blows, which the client does not report for anybody else; and (2026-10-22) whether the gardens' beds and the wild horses
 * put up an E for this player, an Agricultor's.
 */
export function rightsOf(player: Player): { readonly abate: boolean; readonly lenha: boolean; readonly mina: boolean; readonly horta: boolean; readonly domar: boolean } {
    return { abate: mayCraft(player, "abate"), lenha: mayCraft(player, "lenha"), mina: mayCraft(player, "mineracao"), horta: mayCraft(player, "horta"), domar: mayCraft(player, "domar") };
}

export function sendRights(player: Player): void {
    try {
        player.emit(RIGHTS, JSON.stringify(rightsOf(player)));
    } catch {
        // Gone already.
    }
}

/** What a player who may not is told. */
export function refusal(craft: Craft): string {
    return `Só ${WHO[CRAFT_GUILD[craft]] ?? "a guilda do ofício"} usam ${PLACE[craft]}. Aprenda o ofício com o comerciante da guilda da sua cidade.`;
}

/** What each place is for, the word of its choice in the menu a refused player is shown. */
const ACTION: Readonly<Record<Craft, string>> = { smithing: "Forjar", alchemy: "Criar", fogo: "Cozinhar", secador: "Secar", defumador: "Defumar", costura: "Costurar", abate: "Abater", lenha: "Cortar", mineracao: "Minerar", horta: "Plantar", domar: "Domar" };

const menus = new Set<number>();

/**
 * What a player not of the trade meets at its place (user, 2026-10-18: "ao invés de bloquear ... abre o menu ... fica desabilitado
 * quando o jogador não é da guilda"): the game's choice list with the work greyed out and "Sair", and the reason above it.
 * Nothing opens where there is a conversation already, and then the reason is said in the chat instead.
 */
export function showRefusal(player: Player, place: Craft): void {
    const reason = place === "abate" ? BUTCHER_UNDONE : refusal(place);
    if (Dialogue.sessionOf(player.id) === 0) {
        const session = Dialogue.open(player.id, {
            line: reason,
            onRight: false,
            options: [
                { id: "work", text: ACTION[place], enabled: false },
                { id: "leave", text: "Sair", enabled: true },
            ],
        });
        if (session !== 0) {
            menus.add(session);
            return;
        }
    }
    Chat.sendToPlayer(player, reason);
}

/** How long before the same player is told again (the table asks again at every try). */
const TELL_EVERY_MS = 10_000;
const told = new Map<number, number>();

function tell(player: Player, place: Craft): void {
    const now = Date.now();
    if (now - (told.get(player.id) ?? 0) >= TELL_EVERY_MS) {
        told.set(player.id, now);
        const guild = player.steamId === "" ? null : getGuildId(player.steamId);
        console.log(`guild-crafts: ${player.nickname} (${guild ?? "sem guilda"}) barrado em ${place}; é de ${CRAFT_GUILD[place]}`);
        showRefusal(player, place);
    }
}

/** What each use by an administrator looked like, once a minute per person and place: how a "bloqueio que não funcionou" is told apart. */
const allowedAt = new Map<string, number>();

function noteAllowed(player: Player, craft: Craft, reason: string): void {
    const now = Date.now();
    const key = `${player.id}:${craft}`;
    if (reason !== "da guilda" && now - (allowedAt.get(key) ?? 0) >= 60_000) {
        allowedAt.set(key, now);
        console.log(`guild-crafts: ${player.nickname} usa ${craft} (${reason})`);
    }
}

/** What a player who is not a hunter is told after butchering a carcass: what it held is gone. */
export const BUTCHER_UNDONE = "Só os caçadores (guilda Venatores) sabem abater animais: você estragou a carcaça, e a carne e o couro se perderam. Aprenda o ofício com o comerciante da guilda da sua cidade.";

export function installGuildCrafts(): void {
    Events.on("craftingStarting", (player, proposal) => {
        const kind = (proposal as { kind?: unknown }).kind;
        if (!isCraft(kind)) {
            return undefined;
        }
        const reason = craftReason(player, kind);
        if (reason !== "") {
            noteAllowed(player, kind, reason);
            return undefined;
        }
        tell(player, kind);
        return false;
    });
    // Butchering game is the hunters'. The game butchers on the player's own machine and the server hears only that it was done
    // (`npcHarvested`), so nothing can say no before: a carcass butchered by anybody else is emptied -- its meat and hide spoilt --
    // and they are told why, as at the forge or the fire.
    Events.on("npcHarvested", (npc, player) => {
        const reason = craftReason(player, "abate");
        if (reason !== "") {
            noteAllowed(player, "abate", reason);
            // A hunter's carcass gives less meat than the game authored (2026-10-22: "está vindo carne demais").
            const trimmed = trimCarcass(npc);
            if (trimmed.before > trimmed.after) {
                console.log(`abate: ${player.nickname} abateu um animal: carne ${trimmed.before} -> ${trimmed.after}`);
            }
            return;
        }
        let emptied = "";
        try {
            const result = Inventory.set(npc, { items: [], harvested: true });
            emptied = result.ok ? "esvaziada" : `não esvaziada (${result.code})`;
        } catch (error: unknown) {
            emptied = `não esvaziada (${error instanceof Error ? error.message : String(error)})`;
        }
        console.log(`guild-crafts: ${player.nickname} abateu um animal sem ser caçador; carcaça ${emptied}`);
        told.delete(player.id);
        tell(player, "abate");
    });
    Events.on("dialogueChoice", (session) => {
        if (menus.delete(session)) {
            Dialogue.close(session);
        }
    });
    // The client asks when its resource starts, and is told again at every spawn and whenever the guild changes.
    Events.onClient(ASK_RIGHTS, (sender) => {
        sendRights(sender as Player);
    });
    Events.on("playerSpawned", (player) => {
        sendRights(player);
    });
    onGuildChange((steamId) => {
        for (const player of Player.all()) {
            if (player.steamId === steamId) {
                sendRights(player);
            }
        }
    });
    Events.on("dialogueClosed", (session) => {
        menus.delete(session);
    });
    Events.on("playerDisconnect", (player) => {
        told.delete(player.id);
        freed.delete(player.id);
        for (const key of [...allowedAt.keys()]) {
            if (key.startsWith(`${player.id}:`)) {
                allowedAt.delete(key);
            }
        }
    });
}
