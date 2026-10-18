/**
 * Tells a player's client which items' inventory action the server handles (`src/client/item-uses.ts`), in small messages:
 * `use` is the client event the action asks for, `items` the class GUIDs.
 */

const RESOURCE = "kcdc-gamemode";
const CHUNK = 20;

export function sendItemUses(player: Player, use: string, items: readonly string[]): void {
    for (let from = 0; from < items.length; from += CHUNK) {
        player.emit(`${RESOURCE}:itemuses`, JSON.stringify({ use, items: items.slice(from, from + CHUNK) }));
    }
}
