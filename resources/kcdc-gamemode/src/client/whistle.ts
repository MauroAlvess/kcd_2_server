/**
 * The horse whistle. The game's own (X, "call" in its controls) whistles for the game's own horse, which a player here
 * has none of: their horses are the server's (`src/server/horses.ts`). So the key is heard here as well, and the server
 * sends the player's nearest horse running, the way the panel's Chamar does. The game still plays its whistle.
 *
 * Only the physical X: the mod's key API names keys, not the game's controls, and `ActionHint` covers a fixed list of
 * controls that has no whistle in it. A whistle moved to another key in the controls menu calls nothing. And only while
 * the player is in the world: X also confirms on the game's screens (the dice, a trade, the time wheel), and pressing it
 * there must not call the horse (user, 2026-10-16). The pause menu, where the inventory is, is not one of those: a
 * player calls the horse from there to bring it close and store things on it (user, 2026-10-16: "o X no inventário
 * precisa ativar para eu guardar itens no cavalo").
 */

const RESOURCE = "kcdc-gamemode";

export const WHISTLE_KEY = "x";

/** Holding the key, or pressing it again at once, is one whistle. */
const WHISTLE_AGAIN_MS = 2_000;

/** The pause menu, whose pages are the inventory, the map and the rest. */
const MENU = "Menu";

/** The game's own screens a key press belongs to while they are up (their UI elements, as the game's XML names them). */
export const SCREENS = ["ItemSelection", "ItemTransfer", "SkipTime", "GeneralBook", "AlchemyBook", "HorseInspect", "LockPicking", "Pickpocketing", "ApseModalDialog"];

/** Whether a game screen, a conversation, a book or one of the mod's pages has the keyboard. */
function busy(): boolean {
    const up = (name: string): boolean => {
        try {
            return NativeUI.element(name).visible;
        } catch {
            return false;
        }
    };
    if (Hud.isInDialogue() || Book.getOpenBook() !== null) {
        return true;
    }
    // In the pause menu the game holds gameplay input itself, so "controls off" says nothing there.
    if (!up(MENU) && !Controls.isEnabled()) {
        return true;
    }
    return SCREENS.some(up);
}

export function installWhistle(): void {
    let last = 0;
    Key.bind(WHISTLE_KEY, "down", () => {
        const me = LocalPlayer;
        const now = Date.now();
        if (me === null || !me.ready || !me.alive || now - last < WHISTLE_AGAIN_MS || busy()) {
            return;
        }
        last = now;
        Events.emitServer(`${RESOURCE}:horse.whistle`, "{}");
    });
}
