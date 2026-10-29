/**
 * The torch goes down before a body is made to play an animation (user, 2026-10-25: "nas animações gerais, quando o jogador vai fazer e estiver
 * com tochas em mãos, a tocha deve abaixar; se não, ela fica aparecendo nas animações, meio bugada").
 *
 * The game's work and gesture animations were made for empty hands (or the tool of the work): a torch still drawn in a hand is carried through
 * them, clipping into the body and the tools. So every animation this server plays on a player (the trades' work, the farm, the emotes, sitting
 * and lying, drinking, the wild horses, `/anim`) first calls `lowerTorch`: a torch in either hand is put away, its row of the bag un-equipped
 * the way the character creator takes clothes off (`Inventory.set` with the same rows and `equipped` 0 on the torch). The player draws it again
 * when they have finished. A torch that is equipped but not in a hand (the game keeps the slot) is left alone.
 *
 * (It is a call at each of those places and not one hook on `Player.playAnimation`: the methods of a player are not on `Player.prototype`, which
 * has nothing but its constructor, so the hook would have caught nothing.)
 */

/** What the hands report: an item class of 32 hex digits in the engine's order, not the dashed GUID (docs/guides/Players/items.md). */
export function itemClassOf(guid: string): string {
    const hex = guid.replace(/-/g, "").toLowerCase();
    const pairs = hex.slice(16).match(/../g) ?? [];
    return hex.slice(12, 16) + hex.slice(8, 12) + hex.slice(0, 8) + pairs.reverse().join("");
}

/** The torches of the game's tables are `rutinaAVypad_trackview_torch_weapon` (the player's own) and `torch_weapon`: a name with "torch" in it. */
const TORCH = /torch/i;

/** A player is told they put the torch down at most this often. */
const TELL_EVERY_MS = 60_000;

const toldAt = new Map<number, number>();

/**
 * Puts away the torch(es) a player holds in their hands. True when something was put away (the game's inventory accepted the change).
 * Nothing happens, and nothing is read from the inventory, for hands with nothing in them. It never throws: an animation goes on whatever
 * the bag says.
 */
export function lowerTorch(player: Player, now: number = Date.now()): boolean {
    try {
        if (!player.ready) {
            return false;
        }
        const held = [player.rightHandItem, player.leftHandItem].filter((item): item is string => typeof item === "string" && item !== "");
        if (held.length === 0) {
            return false;
        }
        const state = Inventory.get(player);
        if (state === null || !state.ready) {
            return false;
        }
        const down = new Set(state.items.filter((row) => row.equipped > 0 && TORCH.test(String(row.name)) && held.includes(itemClassOf(row.item))).map((row) => row.id));
        if (down.size === 0) {
            return false;
        }
        const items = state.items.map((row) => ({ id: row.id, item: row.item, amount: row.amount, metadata: { ...row.metadata }, equipped: down.has(row.id) ? 0 : row.equipped }));
        const result = Inventory.set(player, { items, quickslots: state.quickslots });
        if (!result.ok) {
            console.log(`tocha: a tocha de ${player.nickname} não pôde ser abaixada (${result.code})`);
            return false;
        }
        if (now - (toldAt.get(player.id) ?? -Infinity) >= TELL_EVERY_MS) {
            toldAt.set(player.id, now);
            Chat.sendToPlayer(player, "Você abaixou a tocha para fazer isso. Empunhe-a de novo quando terminar.");
        }
        return true;
    } catch (error: unknown) {
        console.log(`tocha: não consegui abaixar a tocha de ${player.nickname}: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}
