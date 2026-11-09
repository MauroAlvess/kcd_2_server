/**
 * The horse whistle. The game's own (X, "call" in its controls) whistles for the game's own horse, which a player here
 * has none of: their horses are the server's (`src/server/horses.ts`). So the key is heard here as well, and the server
 * sends the player's nearest horse running, the way the panel's Chamar does. The game still plays its whistle.
 *
 * Only the physical X: the mod's key API names keys, not the game's controls, and `ActionHint` covers a fixed list of
 * controls that has no whistle in it. A whistle moved to another key in the controls menu calls nothing. And only while
 * the player is in the world: X also confirms on the game's screens (the dice, a trade, the time wheel), and pressing it
 * there must not call the horse (user, 2026-10-16). The pause menu is one of those since 2026-10-18; and the server answers nothing to a rider or a seat of a cart.
 */

const RESOURCE = "kcdc-gamemode";

export const WHISTLE_KEY = "x";

/**
 * Somebody else's whistle (user, 2026-10-22: "tem como colocar para os jogadores escutarem o assobio quando um jogador aperta X"): the server
 * tells the players near a whistler (`whistle.heard`, the whistler's id) and this plays the game's own horse whistle on that body, the way it
 * is heard from the player who whistles it, up to the 20 m the game gives it. Never one's own: the game plays that.
 */
export const WHISTLE_HEARD = `${RESOURCE}:whistle.heard`;
export const WHISTLE_SOUND = "v_horse_whistle";

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
    // A menu open, the pause menu too, keeps the key to itself (user, 2026-10-18).
    if (up(MENU) || !Controls.isEnabled()) {
        return true;
    }
    return SCREENS.some(up);
}

/** The whistle of the player with this network id, played on their body here. */
export function playWhistleOf(id: unknown): boolean {
    if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) {
        return false;
    }
    try {
        const whistler = new Player(id);
        if (whistler.local || whistler.entityId === 0 || !Audio.hasTrigger(WHISTLE_SOUND)) {
            return false;
        }
        return Audio.playOnEntity(WHISTLE_SOUND, whistler.entityId);
    } catch {
        return false;
    }
}

export function installWhistle(): void {
    let last = 0;
    Events.on(WHISTLE_HEARD, (payload) => {
        let fields: unknown = payload;
        if (typeof payload === "string") {
            try {
                fields = JSON.parse(payload) as unknown;
            } catch {
                return;
            }
        }
        playWhistleOf(typeof fields === "object" && fields !== null ? (fields as { id?: unknown }).id : undefined);
    });
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
