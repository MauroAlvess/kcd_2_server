/**
 * The tavern keepers' soups (user, 2026-10-20: "adicione sopa nas receitas do taverneiro na profissão da guilda").
 *
 * The game has no soup to cook: its soups are the pot's, eaten at a fire, and three of one quest's. So the soups of the fire's recipes
 * (`craft-data.ts`, the category "Sopas") are items of our own, registered with an action in the bag (`craft-items.ts`: "Comer", or
 * "Tomar" for a broth). Using one raises `playerCustomItemUse`, as a book's "Ler" does (`books.ts`), and here the server decides what
 * eating is: the bowl is spent, the stomach gets the share of itself the soup fills (`SOUP_EFFECTS`, in the game's own scale: bread fills
 * 19 of a hundred, a roast 26) and the server's own thirst (`thirst.ts`) is quenched a little. A stomach that is full takes no soup: the
 * bowl stays in the bag.
 */

import { CUSTOM_ITEMS, SOUP_EFFECTS } from "./craft-data.js";
import { thirstPace } from "./thirst.js";

const RESOURCE = "kcdc-gamemode";

/** A stomach this full (a share of its capacity) takes no more soup. */
export const FULL_AT = 0.97;

/** What eating needs of a player: what a player object offers. */
export interface Eater {
    readonly id: number;
    readonly nickname: string;
    readonly ready: boolean;
    readonly alive: boolean;
    readonly hunger: number;
    readonly maxHunger: number;
    setHunger(value: number): boolean;
    emit(event: string, payload: string): void;
}

export interface Outcome {
    readonly ok: boolean;
    readonly message: string;
}

/** The soup an item id is, with its name and its verb, or null for anything else. */
export function soupOf(id: string): { readonly name: string; readonly verb: string; readonly nutrition: number; readonly thirst: number } | null {
    const effect = SOUP_EFFECTS[id];
    const item = CUSTOM_ITEMS[id];
    if (effect === undefined || item === undefined) {
        return null;
    }
    return { name: item[0], verb: item[5] ?? "Comer", nutrition: effect[0], thirst: effect[1] };
}

/** "Comer" is "come", "Tomar" is "toma". */
const present = (verb: string): string => (verb === "Tomar" ? "toma" : "come");

/** What a player is told. */
function tell(player: Eater, text: string): void {
    Chat.sendToPlayer(player as unknown as Player, text);
    player.emit(`${RESOURCE}:notify`, JSON.stringify({ text }));
}

/**
 * Eats one soup of `row`. The bowl is taken from the bag first, by the revision the player's game pressed it at: a bag that changed in
 * between refuses it, and the player presses again.
 */
export function eat(player: Eater, row: InventoryRow, revision: number): Outcome {
    const soup = soupOf(row.name);
    if (soup === null) {
        return { ok: false, message: "" };
    }
    if (!player.ready || !player.alive) {
        return { ok: false, message: "" };
    }
    const max = player.maxHunger > 0 ? player.maxHunger : 100;
    if (!Number.isFinite(player.hunger) || player.hunger >= max * FULL_AT) {
        return { ok: false, message: `Você está sem fome: ${soup.name.toLowerCase()} fica na bolsa para depois.` };
    }
    const taken = Inventory.remove(player as unknown as Player, { units: [{ id: row.id, amount: 1 }], revision, notify: false });
    if (!taken.ok) {
        return { ok: false, message: "Não consegui pegar o prato agora. Tente de novo." };
    }
    player.setHunger(Math.min(max, player.hunger + soup.nutrition * max));
    thirstPace.quench(player as unknown as Parameters<typeof thirstPace.quench>[0], soup.thirst);
    const share = Math.round(soup.nutrition * 100);
    return { ok: true, message: `Você ${present(soup.verb)} ${soup.name.toLowerCase()}: sacia ${share}% da fome${soup.thirst > 0 ? " e um pouco da sede" : ""}.` };
}

export function installSoups(): void {
    Events.on("playerCustomItemUse", (player, row, revision) => {
        if (SOUP_EFFECTS[row.name] === undefined) {
            return;
        }
        const result = eat(player, row, revision);
        if (result.message !== "") {
            tell(player, result.message);
        }
    });
    console.log(`soups: ${Object.keys(SOUP_EFFECTS).length} sopas nas receitas do fogo, que se comem da bolsa`);
}
