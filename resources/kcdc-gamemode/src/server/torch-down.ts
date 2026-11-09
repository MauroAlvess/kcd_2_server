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
 *
 * Lowered, not taken off (2026-11-02, user: "ao usar algo, a tocha desequipa; o correto era só abaixar"): the server has no way to tell a body to put a
 * torch away and keep it on, so the torch's row comes off for the animation and is equipped again, as it was, when the game says the animation is over
 * (`playerAnimationEnd`, a moment later: the stand-up after a seat is an animation of its own; one replaced by the next waits for that one). A row the
 * player equipped again by hand, or one gone from the bag, is left as it is.
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

/** The torches lowered for an animation, by player: the rows and how many of each were worn, put back when the animation is over (`torchBack`). */
const lowered = new Map<number, { readonly rows: Map<string, number>; at: number }>();
/** The putting back waits this long after the animation's end: the body is still getting up, or the next animation is about to be asked for. */
export const BACK_AFTER_MS = 700;
/** A torch lowered for an animation that never told its end is let go after this (it stays off, as it did before 2026-11-02). */
export const FORGET_AFTER_MS = 30 * 60_000;
const backTimers = new Map<number, ReturnType<typeof setTimeout>>();

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
        // A new animation: a torch waiting to go back after the last one stays down for this one too (its hands are empty by now, so this comes first).
        const waiting = backTimers.get(player.id);
        if (waiting !== undefined) {
            clearTimeout(waiting);
            backTimers.delete(player.id);
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
        const entry = lowered.get(player.id) ?? { rows: new Map<string, number>(), at: now };
        for (const row of state.items) {
            if (down.has(row.id)) {
                entry.rows.set(row.id, row.equipped);
            }
        }
        entry.at = now;
        lowered.set(player.id, entry);
        if (now - (toldAt.get(player.id) ?? -Infinity) >= TELL_EVERY_MS) {
            toldAt.set(player.id, now);
            Chat.sendToPlayer(player, "Você baixou a tocha para fazer isso: ela volta ao lugar dela quando você terminar.");
        }
        return true;
    } catch (error: unknown) {
        console.log(`tocha: não consegui abaixar a tocha de ${player.nickname}: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

/**
 * The torch lowered for an animation goes back to its place: its row equipped again as it was. Not a row the player equipped again by hand, nor one gone
 * from the bag. True when something went back. It never throws.
 */
export function torchBack(player: Player): boolean {
    const entry = lowered.get(player.id);
    if (entry === undefined) {
        return false;
    }
    lowered.delete(player.id);
    try {
        if (!player.ready) {
            return false;
        }
        const state = Inventory.get(player);
        if (state === null || !state.ready) {
            return false;
        }
        let back = 0;
        const items = state.items.map((row) => {
            const was = entry.rows.get(row.id);
            const again = was !== undefined && row.equipped === 0 && row.amount >= was;
            if (again) {
                back += 1;
            }
            return { id: row.id, item: row.item, amount: row.amount, metadata: { ...row.metadata }, equipped: again ? (was as number) : row.equipped };
        });
        if (back === 0) {
            return false;
        }
        const result = Inventory.set(player, { items, quickslots: state.quickslots, revision: state.revision });
        if (!result.ok) {
            console.log(`tocha: a tocha de ${player.nickname} não pôde voltar ao lugar (${result.code})`);
            return false;
        }
        return true;
    } catch (error: unknown) {
        console.log(`tocha: não consegui pôr a tocha de ${player.nickname} de volta: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

/** When an animation is over (and not replaced by the next), the torch lowered for it goes back a moment later. */
export function animationOver(player: Player, reason: string): void {
    if (reason === "replaced" || !lowered.has(player.id)) {
        return;
    }
    const id = player.id;
    const waiting = backTimers.get(id);
    if (waiting !== undefined) {
        clearTimeout(waiting);
    }
    backTimers.set(
        id,
        setTimeout(() => {
            backTimers.delete(id);
            const live = Player.getById(id);
            if (live !== null) {
                torchBack(live);
            }
        }, BACK_AFTER_MS),
    );
}

/** Lowered torches that never heard their animation end are let go after a while; a player who leaves takes theirs. */
export function forgetLowered(now: number = Date.now()): number {
    let gone = 0;
    for (const [id, entry] of lowered) {
        if (now - entry.at > FORGET_AFTER_MS) {
            lowered.delete(id);
            gone += 1;
        }
    }
    return gone;
}

export function installTorchDown(): void {
    Events.on("playerAnimationEnd", (player, _fragment, reason) => animationOver(player, reason));
    Events.on("playerDisconnect", (player) => {
        lowered.delete(player.id);
        const waiting = backTimers.get(player.id);
        if (waiting !== undefined) {
            clearTimeout(waiting);
            backTimers.delete(player.id);
        }
    });
    const timer = setInterval(() => forgetLowered(), 60_000);
    Events.on("resourceStop", (name) => {
        if (name === "kcdc-gamemode") {
            clearInterval(timer);
        }
    });
}
