/**
 * Who may use what (user, 2026-10-17): each trade has its own tools.
 *
 *   Ferreiro    the forge (smithing)                 Alquimista  the alchemy tables
 *   Caçador     the smoker and the butcher's rack    Taberneiro  the cooking fire (roasting, stews and the like)
 *
 * The tailors have nothing to use yet: the game has no such work, and the user will make a system of their own. The mod hands
 * the server the smithery and the alchemy table (`craftingStarting`, which says no by returning `false`); cooking, drying
 * and smoking are done by the server itself (`cooking.ts`), which asks `mayCraft` first. An administrator may use all of
 * them. The game's own cooking screen cannot be refused (the game does it on the player's own machine), but what it makes is
 * never handed over by the server, so for anybody else it comes to nothing.
 */

import { isAdmin } from "./auth.js";
import { getGuildId } from "./status.js";

/** A place that has an owner among the guilds. */
export type Craft = "smithing" | "alchemy" | "fogo" | "secador" | "defumador";

/** The guild that owns each, by its id in the catalog. */
export const CRAFT_GUILD: Readonly<Record<Craft, string>> = {
    smithing: "fabri-ferrarii",
    alchemy: "alchemistae",
    fogo: "tabernarii",
    secador: "venatores",
    defumador: "venatores",
};

const PLACE: Readonly<Record<Craft, string>> = {
    smithing: "a forja",
    alchemy: "as mesas de alquimia",
    fogo: "o fogo de cozinha",
    secador: "o secador do açougueiro",
    defumador: "o defumador",
};

const WHO: Readonly<Record<string, string>> = {
    "fabri-ferrarii": "os ferreiros (guilda Fabri Ferrarii)",
    alchemistae: "os alquimistas (guilda Alchemistae)",
    tabernarii: "os taberneiros (guilda Tabernarii)",
    venatores: "os caçadores (guilda Venatores)",
};

export function isCraft(value: unknown): value is Craft {
    return typeof value === "string" && Object.hasOwn(CRAFT_GUILD, value);
}

/** Whether the player may use the place: a member of its guild, or an administrator. */
export function mayCraft(player: Player, craft: Craft): boolean {
    return isAdmin(player) || (player.steamId !== "" && getGuildId(player.steamId) === CRAFT_GUILD[craft]);
}

/** What a player who may not is told. */
export function refusal(craft: Craft): string {
    return `Só ${WHO[CRAFT_GUILD[craft]] ?? "a guilda do ofício"} usam ${PLACE[craft]}. Escolha a guilda no painel (F2), em Guildas.`;
}

/** How long before the same player is told again (the table asks again at every try). */
const TELL_EVERY_MS = 10_000;
const told = new Map<number, number>();

function tell(player: Player, text: string): void {
    const now = Date.now();
    if (now - (told.get(player.id) ?? 0) >= TELL_EVERY_MS) {
        told.set(player.id, now);
        Chat.sendToPlayer(player, text);
    }
}

export const SHARPEN_UNDONE = "A pedra de amolar é da ferraria: a afiação foi desfeita. Só os ferreiros (guilda Fabri Ferrarii) afiam lâminas. Escolha a guilda no painel (F2), em Guildas.";

export function installGuildCrafts(): void {
    Events.on("craftingStarting", (player, proposal) => {
        const kind = (proposal as { kind?: unknown }).kind;
        if (!isCraft(kind) || mayCraft(player, kind)) {
            return undefined;
        }
        tell(player, refusal(kind));
        return false;
    });
    // The grindstone is the game's own and cannot be refused before it works (nor can the forge's screen be kept from opening: the
    // forge says no when a recipe is chosen). What the mod reports afterwards is a `sharpen` change, and it is undone for whoever is
    // not a smith: each blade it touched goes back to the health it had.
    Events.on("playerInventoryChanged", (player, change) => {
        if (change.reason !== "sharpen" || mayCraft(player, "smithing")) {
            return;
        }
        let undone = false;
        for (const row of change.items) {
            if (row.before === null || row.after === null || row.after.health <= row.before.health) {
                continue;
            }
            const metadata: Record<string, unknown> = { ...row.before.metadata };
            delete metadata["condition"];
            metadata["health"] = row.before.health;
            const result = Inventory.setProperties(player, { id: row.id, metadata });
            undone = undone || result.ok;
        }
        if (undone) {
            tell(player, SHARPEN_UNDONE);
        }
    });
    Events.on("playerDisconnect", (player) => {
        told.delete(player.id);
    });
}
